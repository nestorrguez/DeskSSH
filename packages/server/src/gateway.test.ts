import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { TransparencyLog, ok, type Capabilities } from '@deskssh/core';
import { createGateway } from './gateway.js';
import { SessionManager } from './session-manager.js';
import type { SessionOpener } from './opener.js';

// A fake opener: no SSH, an adapter covering the v1 capabilities.
const fakeOpener: SessionOpener = (req) => {
  const log = new TransparencyLog();
  const files = new Map<string, Uint8Array>();
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
    systemMetrics: () =>
      Promise.resolve(
        ok(
          {
            uptimeSeconds: 100,
            loadAverage: [0.1, 0.2, 0.3] as const,
            memory: { totalBytes: 1000, usedBytes: 400, availableBytes: 600 },
          },
          'raw',
        ),
      ),
    readFile: (path: string) => Promise.resolve(ok(files.get(path) ?? new Uint8Array(), '')),
    writeFile: (path: string, contents: Uint8Array) => {
      files.set(path, contents);
      return Promise.resolve(ok(undefined, ''));
    },
    makeDir: () => Promise.resolve(ok(undefined, '')),
    createFile: (path: string) => {
      files.set(path, new Uint8Array());
      return Promise.resolve(ok(undefined, ''));
    },
    move: (from: string, to: string) => {
      const data = files.get(from);
      if (data) {
        files.set(to, data);
        files.delete(from);
      }
      return Promise.resolve(ok(undefined, ''));
    },
    copy: (from: string, to: string) => {
      const data = files.get(from);
      if (data) files.set(to, data);
      return Promise.resolve(ok(undefined, ''));
    },
    remove: (path: string) => {
      files.delete(path);
      return Promise.resolve(ok(undefined, ''));
    },
    listProcesses: () =>
      Promise.resolve(
        ok([{ pid: 1, user: 'root', cpu: 0.1, mem: 0.4, command: '/sbin/init' }], 'raw'),
      ),
    signalProcess: (_pid: number, _signal: string) => Promise.resolve(ok(undefined, '')),
    serviceAction: (name: string, _action: string) =>
      Promise.resolve(ok({ name, active: true, enabled: true, status: 'running' }, 'raw')),
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

  async function connectSession(): Promise<string> {
    const { json } = await post('/api/connect', {
      host: 'h',
      username: 'u',
      auth: { kind: 'password', password: 'x' },
    });
    return json.sessionId as string;
  }

  it('metrics returns a typed snapshot', async () => {
    const sessionId = await connectSession();
    const { status, json } = await post('/api/metrics', { sessionId });
    expect(status).toBe(200);
    expect(json.result.kind).toBe('ok');
    expect(json.result.value.memory.totalBytes).toBe(1000);
  });

  it('writefile then readfile round-trips bytes as base64', async () => {
    const sessionId = await connectSession();
    const base64 = Buffer.from('hello').toString('base64');
    const wrote = await post('/api/writefile', { sessionId, path: '/tmp/a', base64 });
    expect(wrote.json.result.kind).toBe('ok');

    const read = await post('/api/readfile', { sessionId, path: '/tmp/a' });
    expect(read.json.result.kind).toBe('ok');
    expect(Buffer.from(read.json.result.base64, 'base64').toString('utf8')).toBe('hello');
  });

  it('mkdir/createfile/move/copy/remove route to the adapter', async () => {
    const sessionId = await connectSession();
    expect((await post('/api/mkdir', { sessionId, path: '/tmp/d' })).json.result.kind).toBe('ok');
    expect((await post('/api/createfile', { sessionId, path: '/tmp/n' })).json.result.kind).toBe(
      'ok',
    );

    const base64 = Buffer.from('hi').toString('base64');
    await post('/api/writefile', { sessionId, path: '/tmp/a', base64 });
    expect(
      (await post('/api/copy', { sessionId, from: '/tmp/a', to: '/tmp/b' })).json.result.kind,
    ).toBe('ok');
    expect(
      (await post('/api/move', { sessionId, from: '/tmp/b', to: '/tmp/c' })).json.result.kind,
    ).toBe('ok');
    const movedAway = await post('/api/readfile', { sessionId, path: '/tmp/b' });
    expect(movedAway.json.result.base64).toBe('');
    const moved = await post('/api/readfile', { sessionId, path: '/tmp/c' });
    expect(Buffer.from(moved.json.result.base64, 'base64').toString('utf8')).toBe('hi');

    expect((await post('/api/remove', { sessionId, path: '/tmp/c' })).json.result.kind).toBe('ok');
    expect((await post('/api/readfile', { sessionId, path: '/tmp/c' })).json.result.base64).toBe(
      '',
    );
  });

  it('mutation endpoints require a known session', async () => {
    const missing = await post('/api/mkdir', { sessionId: 'nope', path: '/tmp/x' });
    expect(missing.status).toBe(404);
  });

  it('processes/signal/service route to the adapter and validate input', async () => {
    const sessionId = await connectSession();

    const procs = await post('/api/processes', { sessionId });
    expect(procs.json.result.kind).toBe('ok');
    expect(procs.json.result.value[0].command).toBe('/sbin/init');

    expect(
      (await post('/api/signal', { sessionId, pid: 1, signal: 'TERM' })).json.result.kind,
    ).toBe('ok');
    const svc = await post('/api/service', { sessionId, name: 'ssh', action: 'restart' });
    expect(svc.json.result.kind).toBe('ok');
    expect(svc.json.result.value.status).toBe('running');

    // Validation: bad signal / action / pid → 400.
    expect((await post('/api/signal', { sessionId, pid: 1, signal: 'BOOM' })).status).toBe(400);
    expect((await post('/api/signal', { sessionId, pid: 0, signal: 'TERM' })).status).toBe(400);
    expect((await post('/api/service', { sessionId, name: 'ssh', action: 'nuke' })).status).toBe(
      400,
    );
  });
});
