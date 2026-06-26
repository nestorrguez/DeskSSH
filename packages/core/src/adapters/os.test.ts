import { describe, it, expect } from 'vitest';
import { parseOsRelease, familyFor, detectOs } from './os.js';
import { FakeExecutor, okResult } from '../test/fake-executor.js';

describe('parseOsRelease', () => {
  it('parses quoted and unquoted values, skipping comments', () => {
    const raw = [
      '# comment',
      'ID=ubuntu',
      'ID_LIKE=debian',
      'PRETTY_NAME="Ubuntu 24.04 LTS"',
      '',
    ].join('\n');
    const fields = parseOsRelease(raw);
    expect(fields['ID']).toBe('ubuntu');
    expect(fields['ID_LIKE']).toBe('debian');
    expect(fields['PRETTY_NAME']).toBe('Ubuntu 24.04 LTS');
  });
});

describe('familyFor', () => {
  it('maps Debian-likes', () => {
    expect(familyFor('ubuntu', 'debian')).toBe('debian');
    expect(familyFor('linuxmint', 'ubuntu')).toBe('debian');
    expect(familyFor('debian', undefined)).toBe('debian');
  });
  it('maps other families', () => {
    expect(familyFor('fedora', undefined)).toBe('rhel');
    expect(familyFor('arch', undefined)).toBe('arch');
  });
  it('returns unknown for unrecognized ids', () => {
    expect(familyFor('plan9', undefined)).toBe('unknown');
  });
});

describe('detectOs', () => {
  it('detects Ubuntu as the debian family', async () => {
    const exec = new FakeExecutor()
      .on('os-release', okResult('ID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 24.04"\n'))
      .on('uname', okResult('Linux\n'));
    const os = await detectOs(exec);
    expect(os.family).toBe('debian');
    expect(os.kernel).toBe('Linux');
    expect(os.prettyName).toBe('Ubuntu 24.04');
  });

  it('falls back to posix when os-release is missing but kernel is Unix-like', async () => {
    const exec = new FakeExecutor()
      .on('os-release', { stdout: '', stderr: '', exitCode: 1 })
      .on('uname', okResult('Linux\n'));
    const os = await detectOs(exec);
    expect(os.family).toBe('posix');
  });
});
