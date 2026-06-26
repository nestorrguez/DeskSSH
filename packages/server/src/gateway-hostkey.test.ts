import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { TransparencyLog, ok, type Capabilities } from '@deskssh/core';
import { createGateway } from './gateway.js';
import { SessionManager } from './session-manager.js';
import { HostKeyUnknownError, HostKeyMismatchError, type SessionOpener } from './opener.js';

const FINGERPRINT = 'SHA256:abc123';

// Opener that simulates host-key states: unknown until the right fingerprint is
// trusted, then connects. Mismatch for a special host.
const hostKeyOpener: SessionOpener = (req) => {
  if (req.host === 'mitm.example') {
    return Promise.reject(new HostKeyMismatchError(FINGERPRINT, 'SHA256:old'));
  }
  if (req.trustFingerprint !== FINGERPRINT) {
    return Promise.reject(new HostKeyUnknownError(FINGERPRINT, 'ssh-ed25519'));
  }
  const adapter = {
    listDir: () => Promise.resolve(ok([], 'raw')),
  } as unknown as Capabilities;
  return Promise.resolve({
    host: `${req.username}@${req.host}`,
    home: '/home/me',
    os: { family: 'debian' },
    adapter,
    log: new TransparencyLog(),
    close: () => {},
  });
};

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  server = createGateway({ manager: new SessionManager(), opener: hostKeyOpener });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(() => server.close());

function connect(body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  return fetch(`${baseUrl}/api/connect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'me', auth: { kind: 'password', password: 'x' }, ...body }),
  }).then(async (res) => ({ status: res.status, json: await res.json() }));
}

describe('gateway host-key verification', () => {
  it('asks the user to verify an unknown host key, then connects on trust', async () => {
    const first = await connect({ host: 'new.example' });
    expect(first.status).toBe(200);
    expect(first.json.status).toBe('verify-host-key');
    expect(first.json.fingerprint).toBe(FINGERPRINT);
    expect(first.json.algorithm).toBe('ssh-ed25519');

    const second = await connect({ host: 'new.example', trustFingerprint: FINGERPRINT });
    expect(second.json.status).toBe('connected');
    expect(second.json.sessionId).toBeTruthy();
  });

  it('refuses a changed host key as a possible MITM (409)', async () => {
    const res = await connect({ host: 'mitm.example' });
    expect(res.status).toBe(409);
    expect(res.json.error).toContain('mismatch');
    expect(res.json.expected).toBe('SHA256:old');
  });
});
