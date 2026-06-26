// Opens a real SSH session through @deskssh/core and assembles a SessionEntry
// (session + transparency log + OS adapter + home dir). Injected into the gateway
// so request handling can be tested with a fake opener (no SSH host needed).

import {
  SshSession,
  TransparencyLog,
  withTransparency,
  detectOs,
  selectAdapter,
  type SshAuth,
} from '@deskssh/core';
import type { SessionEntry } from './session-manager.js';

/** What the client sends to open a connection (secrets included, never stored). */
export interface ConnectRequest {
  readonly host: string;
  readonly port?: number;
  readonly username: string;
  readonly auth: SshAuth;
}

/** Opens a session and returns its entry (without an id; the manager assigns one). */
export type SessionOpener = (req: ConnectRequest) => Promise<Omit<SessionEntry, 'id'>>;

export const openSshSession: SessionOpener = async (req) => {
  const session = await SshSession.connect({
    host: req.host,
    port: req.port ?? 22,
    username: req.username,
    auth: req.auth,
    // SLICE: trust on first use. A persisted known_hosts policy with explicit
    // user confirmation is M2 work (plan §5, Art. 4) — not production-safe yet.
    verifyHostKey: () => true,
  });

  const log = new TransparencyLog();
  const executor = withTransparency(session, log, session.host);

  const os = await detectOs(executor);
  const adapter = selectAdapter(os, executor);

  const homeResult = await executor.exec('echo "$HOME"');
  const home = homeResult.stdout.trim() || '/';

  return {
    host: session.host,
    home,
    os,
    adapter,
    log,
    close: () => session.close(),
  };
};
