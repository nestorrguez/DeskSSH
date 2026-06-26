// The DeskSSH web gateway (Art. 4: the critical surface). A small HTTP API over
// node:http — no framework, minimal attack surface. It holds SSH sessions server
// side and hands the browser only opaque ids. Request handling is injected with a
// SessionManager and a SessionOpener so it can be tested without real SSH.

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { SessionManager, toSessionInfo } from './session-manager.js';
import {
  createSshOpener,
  HostKeyUnknownError,
  HostKeyMismatchError,
  type SessionOpener,
} from './opener.js';
import { FileKnownHosts } from './known-hosts.js';
import { attachTerminal } from './terminal.js';
import { serveStatic } from './static.js';

const MAX_BODY_BYTES = 1_000_000; // PEM keys are small; cap to avoid abuse.

export interface GatewayDeps {
  readonly manager?: SessionManager;
  readonly opener?: SessionOpener;
  /** Directory of the built web UI to serve (self-hosted npm package). */
  readonly staticDir?: string;
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
  const opener = deps.opener ?? createSshOpener(new FileKnownHosts());

  const server = createServer((req, res) => {
    handle(req, res, manager, opener, deps.staticDir).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Internal error';
      if (!res.headersSent) sendJson(res, status, { error: message });
    });
  });

  // Terminal app: interactive PTY over WebSocket (/api/terminal).
  attachTerminal(server, manager);
  return server;
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  manager: SessionManager,
  opener: SessionOpener,
  staticDir?: string,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = `${req.method ?? 'GET'} ${url.pathname}`;

  // Non-API GET requests are served from the bundled web UI, if configured.
  if (req.method === 'GET' && !url.pathname.startsWith('/api/') && staticDir) {
    if (serveStatic(staticDir, url.pathname, res)) return;
  }

  if (route === 'GET /api/health') return sendJson(res, 200, { ok: true });

  if (route === 'POST /api/connect') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const auth = parseAuth(body['auth']);
    const request = {
      host: asString(body, 'host'),
      port: body['port'] === undefined ? undefined : Number(body['port']),
      username: asString(body, 'username'),
      auth,
      ...(typeof body['trustFingerprint'] === 'string'
        ? { trustFingerprint: body['trustFingerprint'] }
        : {}),
    };
    try {
      const entry = manager.add(await opener(request));
      return sendJson(res, 200, { status: 'connected', ...toSessionInfo(entry) });
    } catch (err) {
      if (err instanceof HostKeyUnknownError) {
        return sendJson(res, 200, {
          status: 'verify-host-key',
          fingerprint: err.fingerprint,
          algorithm: err.algorithm,
        });
      }
      if (err instanceof HostKeyMismatchError) {
        return sendJson(res, 409, {
          error: err.message,
          fingerprint: err.fingerprint,
          expected: err.expected,
        });
      }
      throw err;
    }
  }

  if (route === 'POST /api/disconnect') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    return sendJson(res, 200, { ok: manager.remove(asString(body, 'sessionId')) });
  }

  if (route === 'POST /api/listdir') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const path = typeof body['path'] === 'string' && body['path'] ? body['path'] : entry.home;
    const result = await entry.adapter.listDir(path);
    return sendJson(res, 200, { path, result, transparency: entry.log.list() });
  }

  if (route === 'POST /api/metrics') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    return sendJson(res, 200, { result: await entry.adapter.systemMetrics() });
  }

  if (route === 'POST /api/readfile') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const result = await entry.adapter.readFile(asString(body, 'path'));
    // Bytes are not JSON-safe: send base64 on success, the raw result otherwise.
    if (result.kind === 'ok') {
      return sendJson(res, 200, {
        result: { kind: 'ok', base64: Buffer.from(result.value).toString('base64') },
      });
    }
    return sendJson(res, 200, { result });
  }

  if (route === 'POST /api/writefile') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const bytes = Buffer.from(asString(body, 'base64'), 'base64');
    const result = await entry.adapter.writeFile(asString(body, 'path'), new Uint8Array(bytes));
    return sendJson(res, 200, { result });
  }

  sendJson(res, 404, { error: `No route for ${route}` });
}

/** Look up the session named in the request body, or throw 404. */
function requireSession(manager: SessionManager, body: Record<string, unknown>) {
  const entry = manager.get(asString(body, 'sessionId'));
  if (!entry) throw new HttpError(404, 'Unknown session');
  return entry;
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
