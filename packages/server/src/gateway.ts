// The DeskSSH web gateway (Art. 4: the critical surface). A small HTTP API over
// node:http — no framework, minimal attack surface. It holds SSH sessions server
// side and hands the browser only opaque ids. Request handling is injected with a
// SessionManager and a SessionOpener so it can be tested without real SSH.

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { SessionManager, toSessionInfo } from './session-manager.js';
import { openSshSession, type SessionOpener } from './opener.js';

const MAX_BODY_BYTES = 1_000_000; // PEM keys are small; cap to avoid abuse.

export interface GatewayDeps {
  readonly manager?: SessionManager;
  readonly opener?: SessionOpener;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function asString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpError(400, `Missing or invalid "${key}"`);
  }
  return value;
}

/** Build (but do not start) the gateway HTTP server. */
export function createGateway(deps: GatewayDeps = {}): Server {
  const manager = deps.manager ?? new SessionManager();
  const opener = deps.opener ?? openSshSession;

  return createServer((req, res) => {
    handle(req, res, manager, opener).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Internal error';
      if (!res.headersSent) sendJson(res, status, { error: message });
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  manager: SessionManager,
  opener: SessionOpener,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = `${req.method ?? 'GET'} ${url.pathname}`;

  if (route === 'GET /api/health') return sendJson(res, 200, { ok: true });

  if (route === 'POST /api/connect') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const auth = parseAuth(body['auth']);
    const entry = manager.add(
      await opener({
        host: asString(body, 'host'),
        port: body['port'] === undefined ? undefined : Number(body['port']),
        username: asString(body, 'username'),
        auth,
      }),
    );
    return sendJson(res, 200, toSessionInfo(entry));
  }

  if (route === 'POST /api/disconnect') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    return sendJson(res, 200, { ok: manager.remove(asString(body, 'sessionId')) });
  }

  if (route === 'POST /api/listdir') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = manager.get(asString(body, 'sessionId'));
    if (!entry) throw new HttpError(404, 'Unknown session');
    const path = typeof body['path'] === 'string' && body['path'] ? body['path'] : entry.home;
    const result = await entry.adapter.listDir(path);
    return sendJson(res, 200, { path, result, transparency: entry.log.list() });
  }

  sendJson(res, 404, { error: `No route for ${route}` });
}

/** Validate and normalize the auth block from a request body (no secret logging). */
function parseAuth(value: unknown): import('@deskssh/core').SshAuth {
  if (typeof value !== 'object' || value === null) throw new HttpError(400, 'Missing "auth"');
  const auth = value as Record<string, unknown>;
  if (auth['kind'] === 'password' && typeof auth['password'] === 'string') {
    return { kind: 'password', password: auth['password'] };
  }
  if (auth['kind'] === 'privateKey' && typeof auth['privateKey'] === 'string') {
    return {
      kind: 'privateKey',
      privateKey: auth['privateKey'],
      ...(typeof auth['passphrase'] === 'string' ? { passphrase: auth['passphrase'] } : {}),
    };
  }
  throw new HttpError(400, 'Invalid "auth": expected password or privateKey');
}
