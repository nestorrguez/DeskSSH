import { describe, it, expect, vi } from 'vitest';
import { TransparencyLog, withTransparency } from './log.js';
import { FakeExecutor, okResult } from '../test/fake-executor.js';

describe('TransparencyLog + withTransparency', () => {
  it('records every successful command with host and exit code', async () => {
    const log = new TransparencyLog();
    const exec = withTransparency(new FakeExecutor().on('ls', okResult('a\nb')), log, 'me@host');

    await exec.exec('ls /tmp');

    const records = log.list();
    expect(records).toHaveLength(1);
    expect(records[0]?.command).toBe('ls /tmp');
    expect(records[0]?.host).toBe('me@host');
    expect(records[0]?.exitCode).toBe(0);
    expect(records[0]?.id).toBe(1);
  });

  it('records and re-throws when execution itself fails', async () => {
    const log = new TransparencyLog();
    const failing = {
      exec: () => Promise.reject(new Error('connection lost')),
    };
    const exec = withTransparency(failing, log, 'me@host');

    await expect(exec.exec('whoami')).rejects.toThrow('connection lost');
    expect(log.list()[0]?.error).toBe('connection lost');
    expect(log.list()[0]?.exitCode).toBeUndefined();
  });

  it('notifies subscribers and supports unsubscribe', async () => {
    const log = new TransparencyLog();
    const listener = vi.fn();
    const unsubscribe = log.subscribe(listener);
    const exec = withTransparency(new FakeExecutor().on('id', okResult('uid=0')), log, 'h');

    await exec.exec('id');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await exec.exec('id');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
