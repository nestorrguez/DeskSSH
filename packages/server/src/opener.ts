// Opens a real SSH session through @deskssh/core and assembles a SessionEntry
// (session + transparency log + OS adapter + home dir). Injected into the gateway
// so request handling can be tested with a fake opener (no SSH host needed).
//
// Host-key verification (Art. 4): the host's key is checked against the known_hosts
// store. Unknown host → refuse and surface the fingerprint for the user to confirm
// (explicit TOFU). Changed key → refuse as a possible MITM.

import {
  SshSession,
  TransparencyLog,
  withTransparency,
  detectOs,
  selectAdapter,
  type SshAuth,
} from '@deskssh/core';
import type { SessionEntry } from './session-manager.js';
import type { KnownHostsStore } from './known-hosts.js';

/** What the client sends to open a connection (secrets included, never stored). */
export interface ConnectRequest {
  readonly host: string;
  readonly port?: number;
  readonly username: string;
  readonly auth: SshAuth;
  /** A fingerprint the user has just explicitly confirmed (second attempt). */
  readonly trustFingerprint?: string;
}

/** Opens a session and returns its entry (without an id; the manager assigns one). */
export type SessionOpener = (req: ConnectRequest) => Promise<Omit<SessionEntry, 'id'>>;

/** Thrown when the host key is unknown and not yet confirmed by the user. */
export class HostKeyUnknownError extends Error {
  constructor(
    readonly fingerprint: string,
    readonly algorithm: string,
  ) {
    super('Host key not trusted');
    this.name = 'HostKeyUnknownError';
  }
}

/** Thrown when the presented host key differs from the trusted one (possible MITM). */
export class HostKeyMismatchError extends Error {
  constructor(
    readonly fingerprint: string,
    readonly expected: string,
  ) {
    super('Host key mismatch — possible man-in-the-middle');
    this.name = 'HostKeyMismatchError';
  }
}

/** Build the production opener backed by a known_hosts store. */
export function createSshOpener(store: KnownHostsStore): SessionOpener {
  return async (req) => {
    const hostPort = `${req.host}:${req.port ?? 22}`;
    const known = store.get(hostPort);

    let presented: { fingerprint: string; algorithm: string } | undefined;
    let rejection: 'unknown' | 'mismatch' | undefined;

    const session = await SshSession.connect({
      host: req.host,
      port: req.port ?? 22,
      username: req.username,
      auth: req.auth,
      verifyHostKey: ({ fingerprint, algorithm }) => {
        presented = { fingerprint, algorithm };
        if (known) {
          if (fingerprint === known) return true;
          rejection = 'mismatch';
          return false;
        }
        if (req.trustFingerprint && req.trustFingerprint === fingerprint) return true;
        rejection = 'unknown';
        return false;
      },
    }).catch((err: unknown) => {
      // Translate a host-key rejection into a typed, actionable error.
      if (rejection === 'unknown' && presented) {
        throw new HostKeyUnknownError(presented.fingerprint, presented.algorithm);
      }
      if (rejection === 'mismatch' && presented && known) {
        throw new HostKeyMismatchError(presented.fingerprint, known);
      }
      throw err;
    });

    // Accepted: persist a newly trusted key on first contact.
    if (presented && !known) store.add(hostPort, presented.fingerprint);

    const log = new TransparencyLog();
    const executor = withTransparency(session, log, session.host);
    const os = await detectOs(executor);
    const adapter = selectAdapter(os, executor);
    const home = (await executor.exec('echo "$HOME"')).stdout.trim() || '/';

    return {
      host: session.host,
      home,
      os,
      adapter,
      log,
      openPty: (cols, rows, cwd) => session.openPty(cols, rows, cwd),
      close: () => session.close(),
    };
  };
}
