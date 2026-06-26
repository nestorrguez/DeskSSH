// Session registry for the gateway. Each live SSH session is keyed by an opaque,
// unguessable id handed to the client; the client never sees credentials or the
// underlying session object (Art. 4 — the gateway is the critical surface). This
// module is pure and transport-agnostic, so it is unit-testable without SSH.

import { randomUUID } from 'node:crypto';
import type {
  Capabilities,
  OsInfo,
  PtySession,
  TransparencyLog,
  CommandRecord,
} from '@deskssh/core';

/** Everything the gateway keeps for one live session. */
export interface SessionEntry {
  readonly id: string;
  /** Display label, e.g. "user@host" (no secrets). */
  readonly host: string;
  /** Remote home directory, used as the default listing path. */
  readonly home: string;
  readonly os: OsInfo;
  readonly adapter: Capabilities;
  readonly log: TransparencyLog;
  /** Open an interactive PTY (Terminal app). Optional: not all openers provide it. */
  readonly openPty?: (cols: number, rows: number) => Promise<PtySession>;
  /** Tear down the underlying SSH connection. */
  readonly close: () => void;
}

/** Public, secret-free view of a session for API responses. */
export interface SessionInfo {
  readonly sessionId: string;
  readonly host: string;
  readonly home: string;
  readonly os: { readonly family: string; readonly prettyName?: string };
}

export function toSessionInfo(entry: SessionEntry): SessionInfo {
  return {
    sessionId: entry.id,
    host: entry.host,
    home: entry.home,
    os: { family: entry.os.family, prettyName: entry.os.prettyName },
  };
}

export class SessionManager {
  private readonly sessions = new Map<string, SessionEntry>();

  /** Register a session under a fresh opaque id. */
  add(entry: Omit<SessionEntry, 'id'>): SessionEntry {
    const id = randomUUID();
    const full: SessionEntry = { ...entry, id };
    this.sessions.set(id, full);
    return full;
  }

  get(id: string): SessionEntry | undefined {
    return this.sessions.get(id);
  }

  /** Close and forget a session. Returns true if it existed. */
  remove(id: string): boolean {
    const entry = this.sessions.get(id);
    if (!entry) return false;
    entry.close();
    this.sessions.delete(id);
    return true;
  }

  /** Recent transparency records for a session (for the UI). */
  transparency(id: string): readonly CommandRecord[] {
    return this.sessions.get(id)?.log.list() ?? [];
  }

  /** Close every session (graceful shutdown). */
  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.remove(id);
  }

  get size(): number {
    return this.sessions.size;
  }
}
