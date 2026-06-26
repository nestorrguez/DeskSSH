import { describe, it, expect } from 'vitest';
import { selectAdapter } from './registry.js';
import { DebianAdapter } from './debian.js';
import { FakeExecutor } from '../test/fake-executor.js';

describe('selectAdapter', () => {
  it('returns the Debian adapter for the debian family', () => {
    const adapter = selectAdapter({ family: 'debian' }, new FakeExecutor());
    expect(adapter).toBeInstanceOf(DebianAdapter);
  });

  it('returns an unsupported adapter for other families (graceful degradation)', async () => {
    const adapter = selectAdapter({ family: 'rhel' }, new FakeExecutor());
    const result = await adapter.listDir('/');
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') expect(result.reason).toContain('not supported in v1');
  });
});
