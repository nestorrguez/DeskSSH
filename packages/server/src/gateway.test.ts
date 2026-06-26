import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { TransparencyLog, ok, type Capabilities } from '@deskssh/core';
import { createGateway } from './gateway.js';
import { SessionManager } from './session-manager.js';
import type { SessionOpener } from './opener.js';

// A fake opener: no SSH, an adapter that lists one entry.
const fakeOpener: SessionOpener = (req) => {
  const log = new TransparencyLog();
  const adapter = {
    listDir: () =>
      Promise.resolve(
        ok(
          [
            {
              name: 'file.txt',
              type: 'file',
              size: 1,
              mode: 0o644,
              owner: 'me',
              group: 'me',
              mtime: 0,
            },
          ],
          'raw',
        ),
      ),
  } as unknown as Capabilities;
  return Promise.resolve({
    host: `${req.username}@${req.host}`,
    home: '/home/me',
    os: { family: 'debian', prettyName: 'Ubuntu' },
    adapter,
    log,
    close: () => {},
  });
};

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  server = createGateway({ manager: new SessionManager(), opener: fakeOpener });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterEach(() => {
  server.close();
});

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

describe('gateway', () => {
  it('connect returns an opaque session id and OS info, no secrets', async () => {
    const { status, json } = await post('/api/connect', {
      host: 'example.com',
      username: 'me',
      auth: { kind: 'password', password: 'hunter2' },
    });
    expect(status).toBe(200);
    expect(json.status).toBe('connected');
    expect(json.sessionId).toMatch(/[0-9a-f-]{36}/);
    expect(json.host).toBe('me@example.com');
    expect(json.os.family).toBe('debian');
    expect(JSON.stringify(json)).not.toContain('hunter2');
  });

  it('rejects an invalid auth block', async () => {
    const { status, json } = await post('/api/connect', {
      host: 'h',
      username: 'u',
      auth: { kind: 'nope' },
    });
    expect(status).toBe(400);
    expect(json.error).toContain('auth');
  });

  it('listdir works for a known session and 404s for an unknown one', async () => {
    const { json: conn } = await post('/api/connect', {
      host: 'h',
      username: 'u',
      auth: { kind: 'password', password: 'x' },
    });
    const listed = await post('/api/listdir', { sessionId: conn.sessionId });
    expect(listed.status).toBe(200);
    expect(listed.json.path).toBe('/home/me');
    expect(listed.json.result.value[0].name).toBe('file.txt');

    const missing = await post('/api/listdir', { sessionId: 'does-not-exist' });
    expect(missing.status).toBe(404);
  });

  it('disconnect removes the session', async () => {
    const { json: conn } = await post('/api/connect', {
      host: 'h',
      username: 'u',
      auth: { kind: 'password', password: 'x' },
    });
    const off = await post('/api/disconnect', { sessionId: conn.sessionId });
    expect(off.json.ok).toBe(true);
    const after = await post('/api/listdir', { sessionId: conn.sessionId });
    expect(after.status).toBe(404);
  });
});
