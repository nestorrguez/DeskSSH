import { describe, it, expect } from 'vitest';
import { runParsed } from './result.js';
import { FakeExecutor, okResult } from '../test/fake-executor.js';

describe('runParsed', () => {
  it('returns ok with the parsed value on success', async () => {
    const exec = new FakeExecutor().on('echo', okResult('42'));
    const result = await runParsed(exec, 'echo 42', (s) => Number.parseInt(s, 10));
    expect(result).toEqual({ kind: 'ok', value: 42, raw: '42' });
  });

  it('degrades (never throws) when the parser throws, preserving raw output', async () => {
    const exec = new FakeExecutor().on('cmd', okResult('garbage'));
    const result = await runParsed(exec, 'cmd', () => {
      throw new Error('bad format');
    });
    expect(result.kind).toBe('degraded');
    if (result.kind === 'degraded') {
      expect(result.raw).toBe('garbage');
      expect(result.reason).toBe('bad format');
    }
  });

  it('reports failed on a non-zero exit code', async () => {
    const exec = new FakeExecutor().on('cmd', { stdout: '', stderr: 'nope', exitCode: 2 });
    const result = await runParsed(exec, 'cmd', () => 'unused');
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') {
      expect(result.exitCode).toBe(2);
      expect(result.reason).toBe('nope');
    }
  });
});
