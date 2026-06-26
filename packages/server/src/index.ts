// @deskssh/server — web gateway. Holds live SSH sessions (via @deskssh/core) and
// exposes a small HTTP API; the browser only ever handles opaque session ids.

import { createGateway } from './gateway.js';

export const SERVER_PACKAGE = '@deskssh/server';
export { createGateway, type GatewayDeps } from './gateway.js';
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

/** Start the gateway on the given port (defaults to PORT env or 8717). */
export function startGateway(port = Number(process.env['PORT'] ?? 8717)): void {
  const server = createGateway();
  server.listen(port, () => {
    console.log(`DeskSSH gateway listening on http://localhost:${String(port)}`);
  });
}

// Run directly (node dist/index.js), not when imported.
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  startGateway();
}
