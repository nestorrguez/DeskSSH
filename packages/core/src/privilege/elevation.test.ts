import { describe, it, expect } from 'vitest';
import { detectPrivilege, isPermissionDenied, withElevation } from './elevation.js';
import { FakeExecutor, okResult } from '../test/fake-executor.js';

describe('isPermissionDenied', () => {
  it('recognises privilege errors and ignores normal output', () => {
    expect(isPermissionDenied('Permission denied')).toBe(true);
    expect(isPermissionDenied('Failed to restart unit: Access denied')).toBe(true);
    expect(isPermissionDenied('kill: (1) - Operation not permitted')).toBe(true);
    expect(isPermissionDenied('deskssh is not in the sudoers file')).toBe(true);
    expect(isPermissionDenied('Active: active (running)')).toBe(false);
  });
});

describe('withElevation', () => {
  it('runs the command under sudo -S with the password on stdin, not in argv', async () => {
    const exec = new FakeExecutor().on('sudo', okResult(''));
    const elevated = withElevation(exec, 's3cr3t');
    await elevated.exec('systemctl restart nginx');
    expect(exec.commands[0]).toBe("sudo -S -p '' sh -c 'systemctl restart nginx'");
    expect(exec.commands[0]).not.toContain('s3cr3t'); // password never in the command
    expect(exec.inputs[0]).toBe('s3cr3t\n'); // fed on stdin instead
  });
});

describe('detectPrivilege', () => {
  const run = (stdout: string) => detectPrivilege(new FakeExecutor().otherwise(okResult(stdout)));

  it('flags root', async () => {
    expect(await run('UID=0\nGROUPS=root\nHAVE_SUDO\nHAVE_SU')).toEqual({
      isRoot: true,
      canSudo: true,
      escalationAvailable: true,
    });
  });

  it('a sudo-group member can sudo', async () => {
    expect(await run('UID=1000\nGROUPS=deskssh sudo users\nHAVE_SUDO\nHAVE_SU')).toEqual({
      isRoot: false,
      canSudo: true,
      escalationAvailable: true,
    });
  });

  it('a plain user cannot sudo but escalation may still exist', async () => {
    expect(await run('UID=1000\nGROUPS=deskssh users\nHAVE_SUDO')).toEqual({
      isRoot: false,
      canSudo: false,
      escalationAvailable: true,
    });
  });

  it('no sudo/su → no escalation path', async () => {
    expect(await run('UID=1000\nGROUPS=deskssh users')).toEqual({
      isRoot: false,
      canSudo: false,
      escalationAvailable: false,
    });
  });
});
