// @deskssh/server — web gateway. Holds live SSH sessions (via @deskssh/core) and
// exposes a small HTTP API; the browser only ever handles opaque session ids.

import { createGateway } from './gateway.js';
import { ensurePluginDirs, loadAdapterPlugins, loadAppPlugins } from './plugins.js';

export const SERVER_PACKAGE = '@deskssh/server';
export { createGateway, type GatewayDeps } from './gateway.js';
export {
  loadAdapterPlugins,
  loadAppPlugins,
  importAdapterPlugin,
  importAppPlugin,
  resolveAppFile,
  uninstallPlugin,
  setPluginEnabled,
  pluginsStatus,
  ensurePluginDirs,
  pluginsRoot,
  type PluginLoadReport,
  type AppLoadReport,
  type LoadedPlugin,
  type LoadedApp,
  type SkippedPlugin,
  type PluginStatus,
  type PluginKind,
  type ImportResult,
} from './plugins.js';
export {
  SessionManager,
  toSessionInfo,
  type SessionInfo,
  type SessionEntry,
} from './session-manager.js';
export {
  createSshOpener,
  HostKeyUnknownError,
  HostKeyMismatchError,
  type ConnectRequest,
  type SessionOpener,
} from './opener.js';
export { InMemoryKnownHosts, FileKnownHosts, type KnownHostsStore } from './known-hosts.js';

export interface StartOptions {
  /** Port to listen on (default: PORT env or 8717). */
  port?: number;
  /** Interface to bind. Default 127.0.0.1 — DeskSSH is an SSH proxy and must not
   *  be exposed on all interfaces by accident (Art. 4). */
  host?: string;
  /** Directory of the built web UI to serve. */
  staticDir?: string;
}

/** Start the gateway and return the bound HTTP server. */
export function startGateway(options: StartOptions = {}) {
  const port = options.port ?? Number(process.env['PORT'] ?? 8717);
  const host = options.host ?? process.env['HOST'] ?? '127.0.0.1';

  // Discover and register adapter plugins before serving (FR-251 / E10).
  ensurePluginDirs();
  const plugins = loadAdapterPlugins();
  for (const p of plugins.loaded) {
    console.log(`Loaded adapter plugin "${p.id}" v${p.version}`);
  }
  for (const s of plugins.skipped) {
    console.warn(`Skipped plugin ${s.path}: ${s.reason}`);
  }
  const appPlugins = loadAppPlugins();
  for (const a of appPlugins.apps) {
    console.log(`Found app plugin "${a.id}" v${a.version}`);
  }
  for (const s of appPlugins.skipped) {
    console.warn(`Skipped app plugin ${s.path}: ${s.reason}`);
  }

  const server = createGateway({ staticDir: options.staticDir });
  server.listen(port, host, () => {
    console.log(`DeskSSH listening on http://${host}:${String(port)}`);
  });
  return server;
}

// Run directly (node dist/index.js), not when imported.
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  startGateway();
}
