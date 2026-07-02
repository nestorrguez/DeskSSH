import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adapterCatalog, selectAdapter } from '@deskssh/core';
import type { CommandExecutor } from '@deskssh/core';
import { loadAdapterPlugins } from './plugins.js';

/** A tiny CommandExecutor that records commands and returns canned stdout. */
function fakeExecutor(stdout = '') {
  const commands: string[] = [];
  const executor: CommandExecutor = {
    exec(command: string) {
      commands.push(command);
      return Promise.resolve({ stdout, stderr: '', exitCode: 0 });
    },
  };
  return { executor, commands };
}

// A minimal but valid declarative adapter manifest (rhel family, listDir only).
function rhelManifest(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schema: 1,
    kind: 'adapter',
    id: 'rhel-test',
    name: 'RHEL (test)',
    version: '0.1.0',
    author: { name: 'tester', github: 'tester' },
    contract: '^0.1.0',
    osSupport: ['rhel', 'fedora'],
    capabilities: {
      listDir: {
        template: 'ls {path}',
        normalize: {
          kind: 'records',
          columnDelimiter: '\t',
          columns: [{ field: 'name', rest: true }],
        },
      },
    },
    ...overrides,
  });
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deskssh-plugins-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loadAdapterPlugins', () => {
  it('returns empty for a missing folder', () => {
    const report = loadAdapterPlugins({ dir: join(dir, 'nope') });
    expect(report.loaded).toEqual([]);
    expect(report.skipped).toEqual([]);
  });

  it('loads a valid manifest file and registers it', () => {
    writeFileSync(join(dir, 'rhel.json'), rhelManifest());
    const report = loadAdapterPlugins({ dir });
    expect(report.loaded).toEqual([{ id: 'rhel-test', name: 'RHEL (test)', version: '0.1.0' }]);
    expect(adapterCatalog().some((a) => a.id === 'rhel-test')).toBe(true);

    // The registered provider resolves for a matching host and runs its template.
    const { executor, commands } = fakeExecutor('a\nb\n');
    const adapter = selectAdapter({ family: 'rhel', id: 'fedora' }, executor);
    return adapter.listDir('/etc').then((r) => {
      expect(r.kind).toBe('ok');
      expect(commands[0]).toBe("ls '/etc'");
    });
  });

  it('loads a plugin laid out as a subfolder/manifest.json', () => {
    const sub = join(dir, 'my-rhel');
    mkdirSync(sub);
    writeFileSync(join(sub, 'manifest.json'), rhelManifest({ id: 'rhel-sub' }));
    const report = loadAdapterPlugins({ dir });
    expect(report.loaded.map((p) => p.id)).toContain('rhel-sub');
  });

  it('skips malformed JSON without throwing', () => {
    writeFileSync(join(dir, 'broken.json'), '{ not valid');
    const report = loadAdapterPlugins({ dir });
    expect(report.loaded).toEqual([]);
    expect(report.skipped).toHaveLength(1);
  });

  it('skips a manifest that fails validation, with a reason', () => {
    writeFileSync(join(dir, 'bad.json'), rhelManifest({ osSupport: [] }));
    const report = loadAdapterPlugins({ dir });
    expect(report.skipped[0]?.reason).toContain('osSupport');
  });

  it('skips an adapter built for an incompatible Contract', () => {
    writeFileSync(join(dir, 'old.json'), rhelManifest({ id: 'rhel-old', contract: '^2.0.0' }));
    const report = loadAdapterPlugins({ dir });
    expect(report.loaded.some((p) => p.id === 'rhel-old')).toBe(false);
    expect(report.skipped[0]?.reason).toContain('does not include');
  });

  it('isolates failures: one bad plugin does not stop a good one', () => {
    writeFileSync(join(dir, 'broken.json'), '{ nope');
    writeFileSync(join(dir, 'good.json'), rhelManifest({ id: 'rhel-good' }));
    const report = loadAdapterPlugins({ dir });
    expect(report.loaded.some((p) => p.id === 'rhel-good')).toBe(true);
    expect(report.skipped).toHaveLength(1);
  });
});
