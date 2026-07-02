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
import { makeElevated, type Elevate } from './elevate.js';
import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import {
  detectPrivilege,
  adapterCatalog,
  CONTRACT_VERSION,
  APP_RUNTIME_VERSION,
} from '@deskssh/core';
import {
  importAdapterPlugin,
  importAppPlugin,
  loadAppPlugins,
  pluginsStatus,
  resolveAppFile,
  setPluginEnabled,
  uninstallPlugin,
} from './plugins.js';
import type { Capabilities, CapabilityResult } from '@deskssh/core';
import type { SessionEntry } from './session-manager.js';

const MAX_BODY_BYTES = 1_000_000; // PEM keys are small; cap to avoid abuse.
const MAX_ZIP_BYTES = 25_000_000; // App plugins bundle JS + assets; allow a larger cap.

const APP_MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

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

/** Read a raw binary request body (for `.zip` app import), capped larger than JSON. */
function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_ZIP_BYTES) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
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

/** Validate that a body field is one of an allowed set of string literals. */
function asOneOf<const T extends readonly string[]>(
  obj: Record<string, unknown>,
  key: string,
  allowed: T,
): T[number] {
  const value = obj[key];
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new HttpError(400, `Invalid "${key}": expected one of ${allowed.join(', ')}`);
  }
  return value as T[number];
}

/** Validate an optional one-shot elevation block (current user or another user). */
function parseElevate(value: unknown): Elevate | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') throw new HttpError(400, 'Invalid "elevate"');
  const o = value as Record<string, unknown>;
  if (o['kind'] === 'current' && typeof o['password'] === 'string') {
    return { kind: 'current', password: o['password'] };
  }
  if (o['kind'] === 'user' && typeof o['user'] === 'string' && typeof o['password'] === 'string') {
    return { kind: 'user', user: o['user'], password: o['password'] };
  }
  throw new HttpError(400, 'Invalid "elevate": expected { kind: "current"|"user", … }');
}

/** Run a capability against a session, optionally elevated per the request's
 *  `elevate` block, tearing down any transient session afterwards. */
async function runCap<T>(
  entry: SessionEntry,
  body: Record<string, unknown>,
  call: (adapter: Capabilities) => Promise<CapabilityResult<T>>,
): Promise<CapabilityResult<T>> {
  const elevate = parseElevate(body['elevate']);
  if (!elevate) return call(entry.adapter);
  const { adapter, cleanup } = await makeElevated(entry, elevate);
  try {
    return await call(adapter);
  } finally {
    cleanup();
  }
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

  // Installed OS adapters, for the Extensions view (FR-230). Sessionless: it is
  // static server capability info, shown on the connection screen before login.
  if (route === 'GET /api/adapters') return sendJson(res, 200, { adapters: adapterCatalog() });

  // The Desk's own versions (spec 002, FR-241 / E9.2). Sessionless: shown in the Settings
  // About section so plugin authors know the Contract + app-runtime ranges to target.
  if (route === 'GET /api/versions') {
    return sendJson(res, 200, { contract: CONTRACT_VERSION, appRuntime: APP_RUNTIME_VERSION });
  }

  // Import a plugin. Sessionless and local-only (the gateway binds 127.0.0.1): it
  // validates + places the package into the user's plugins folder, picked up on the
  // next restart (FR-251 / E10.2). An **adapter** is a JSON manifest body; an **app**
  // is a `.zip` body (binary content-type) → extract + validate + place (E10.2b).
  if (route === 'POST /api/plugins/import') {
    const contentType = req.headers['content-type'] ?? '';
    const result = contentType.includes('json')
      ? importAdapterPlugin(await readJsonBody(req))
      : importAppPlugin(new Uint8Array(await readRawBody(req)));
    return result.ok ? sendJson(res, 200, result) : sendJson(res, 400, { error: result.reason });
  }

  // Full status of installed plugins for the Settings manager (E10.3b).
  if (route === 'GET /api/plugins') return sendJson(res, 200, { plugins: pluginsStatus() });

  // Enable/disable a plugin (persisted; restart/reload to apply) (E10.3b).
  if (route === 'POST /api/plugins/enable') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const kind = asOneOf(body, 'kind', ['adapter', 'app'] as const);
    setPluginEnabled(kind, asString(body, 'id'), body['enabled'] !== false);
    return sendJson(res, 200, { ok: true });
  }

  // Uninstall a plugin: remove its files (E10.3b).
  if (route === 'POST /api/plugins/uninstall') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const kind = asOneOf(body, 'kind', ['adapter', 'app'] as const);
    return sendJson(res, 200, { ok: uninstallPlugin(kind, asString(body, 'id')) });
  }

  // The list of loadable app plugins (id, entry URL, capabilities) the web imports at
  // boot (E10.4b). Sessionless: app availability is static, decided before login.
  if (route === 'GET /api/plugins/apps') {
    const { apps } = loadAppPlugins();
    return sendJson(res, 200, {
      apps: apps.map((a) => ({
        id: a.id,
        name: a.name,
        version: a.version,
        entry: `/api/plugins/apps/${encodeURIComponent(a.id)}/${a.entry}`,
        capabilities: a.capabilities,
        ...(a.icon ? { icon: a.icon } : {}),
        ...(a.category ? { category: a.category } : {}),
        author: a.author,
      })),
    });
  }

  // Serve an app plugin's built asset (its ESM entry + bundled files) (E10.4b).
  if (req.method === 'GET' && url.pathname.startsWith('/api/plugins/apps/')) {
    const tail = url.pathname.slice('/api/plugins/apps/'.length);
    const slash = tail.indexOf('/');
    if (slash > 0) {
      const id = decodeURIComponent(tail.slice(0, slash));
      const rel = decodeURIComponent(tail.slice(slash + 1));
      const file = resolveAppFile(id, rel);
      if (file) {
        res.writeHead(200, {
          'content-type': APP_MIME[extname(file)] ?? 'application/octet-stream',
        });
        createReadStream(file).pipe(res);
        return;
      }
    }
    return sendJson(res, 404, { error: 'not found' });
  }

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
    const bytes = new Uint8Array(Buffer.from(asString(body, 'base64'), 'base64'));
    const path = asString(body, 'path');
    const result = await runCap(entry, body, (a) => a.writeFile(path, bytes));
    return sendJson(res, 200, { result });
  }

  if (route === 'POST /api/mkdir') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const path = asString(body, 'path');
    return sendJson(res, 200, { result: await runCap(entry, body, (a) => a.makeDir(path)) });
  }

  if (route === 'POST /api/createfile') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const path = asString(body, 'path');
    return sendJson(res, 200, { result: await runCap(entry, body, (a) => a.createFile(path)) });
  }

  if (route === 'POST /api/move') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const from = asString(body, 'from');
    const to = asString(body, 'to');
    return sendJson(res, 200, { result: await runCap(entry, body, (a) => a.move(from, to)) });
  }

  if (route === 'POST /api/copy') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const from = asString(body, 'from');
    const to = asString(body, 'to');
    return sendJson(res, 200, { result: await runCap(entry, body, (a) => a.copy(from, to)) });
  }

  if (route === 'POST /api/remove') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const path = asString(body, 'path');
    return sendJson(res, 200, { result: await runCap(entry, body, (a) => a.remove(path)) });
  }

  if (route === 'POST /api/processes') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    return sendJson(res, 200, { result: await entry.adapter.listProcesses() });
  }

  if (route === 'POST /api/signal') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const pid = Number(body['pid']);
    if (!Number.isInteger(pid) || pid <= 0) throw new HttpError(400, 'Invalid "pid"');
    const signal = asOneOf(body, 'signal', ['TERM', 'KILL', 'HUP'] as const);
    return sendJson(res, 200, {
      result: await runCap(entry, body, (a) => a.signalProcess(pid, signal)),
    });
  }

  if (route === 'POST /api/service') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    const name = asString(body, 'name');
    const action = asOneOf(body, 'action', ['start', 'stop', 'restart'] as const);
    return sendJson(res, 200, {
      result: await runCap(entry, body, (a) => a.serviceAction(name, action)),
    });
  }

  if (route === 'POST /api/privilege') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    return sendJson(res, 200, { privilege: await detectPrivilege(entry.executor) });
  }

  if (route === 'POST /api/systeminfo') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    return sendJson(res, 200, { result: await entry.adapter.systemInfo() });
  }

  if (route === 'POST /api/transparency') {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const entry = requireSession(manager, body);
    return sendJson(res, 200, { transparency: entry.log.list() });
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
