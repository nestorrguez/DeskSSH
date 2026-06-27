// Build an elevated capability adapter for a session (FR-094/095). Two paths:
//  - current user: wrap the existing executor with `sudo -S` (Modal 1);
//  - another user: open a transient SSH session as that privileged user to the
//    same, already-trusted host, running directly (root) or under sudo (Modal 2).
// The password is used once for the action and discarded by the caller.

import { SshSession, selectAdapter, withElevation, withTransparency } from '@deskssh/core';
import type { Capabilities } from '@deskssh/core';
import type { SessionEntry } from './session-manager.js';

export type Elevate =
  | { kind: 'current'; password: string }
  | { kind: 'user'; user: string; password: string };

export interface Elevated {
  readonly adapter: Capabilities;
  /** Tear down any transient session opened for this elevation. */
  readonly cleanup: () => void;
}

export async function makeElevated(entry: SessionEntry, elevate: Elevate): Promise<Elevated> {
  if (elevate.kind === 'current') {
    return {
      adapter: selectAdapter(entry.os, withElevation(entry.executor, elevate.password)),
      cleanup: () => {},
    };
  }

  // Another user: a transient session to the same host (already trusted this run).
  const session = await SshSession.connect({
    host: entry.endpoint.host,
    port: entry.endpoint.port,
    username: elevate.user,
    auth: { kind: 'password', password: elevate.password },
    verifyHostKey: () => true,
  });
  const exec = withTransparency(session, entry.log, `${elevate.user}@${entry.endpoint.host}`);
  // root runs directly; any other user runs the action under their own sudo.
  const executor = elevate.user === 'root' ? exec : withElevation(exec, elevate.password);
  return { adapter: selectAdapter(entry.os, executor), cleanup: () => session.close() };
}
