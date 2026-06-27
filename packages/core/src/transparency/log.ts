// Command transparency (Constitution Art. 3): every command DeskSSH runs flows
// through a single point that records it, so the UI can always show what was
// executed. This log doubles as an audit trail (plan §5).

import type { CommandExecutor, ExecResult } from '../exec/types.js';

/** One executed command and its outcome. */
export interface CommandRecord {
  /** Monotonic id, unique within a log. */
  readonly id: number;
  /** The exact command string sent to the host. */
  readonly command: string;
  /** Host label this ran against (e.g. "user@host"). */
  readonly host: string;
  /** When execution started (epoch milliseconds). */
  readonly startedAt: number;
  /** Wall-clock duration of the round trip, in milliseconds. */
  readonly durationMs: number;
  /** Exit code, null if killed by a signal, or undefined if it threw. */
  readonly exitCode: number | null | undefined;
  /** Error message if the execution itself failed (transport/throw). */
  readonly error?: string;
}

/** A subscriber notified whenever a new record is appended. */
export type TransparencyListener = (record: CommandRecord) => void;

/** In-memory, append-only log of executed commands. */
export class TransparencyLog {
  private readonly entries: CommandRecord[] = [];
  private readonly listeners = new Set<TransparencyListener>();
  private nextId = 1;

  /** Append a record, assigning it an id, and notify listeners. */
  record(entry: Omit<CommandRecord, 'id'>): CommandRecord {
    const full: CommandRecord = { ...entry, id: this.nextId++ };
    this.entries.push(full);
    for (const listener of this.listeners) listener(full);
    return full;
  }

  /** All records so far, in execution order. */
  list(): readonly CommandRecord[] {
    return this.entries;
  }

  /** Subscribe to new records; returns an unsubscribe function. */
  subscribe(listener: TransparencyListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/**
 * Wrap an executor so every command it runs is recorded in {@link TransparencyLog}.
 * This is the "single execution point": adapters use the wrapped executor, so no
 * command can bypass the log.
 */
export function withTransparency(
  executor: CommandExecutor,
  log: TransparencyLog,
  host: string,
): CommandExecutor {
  return {
    // `input` (e.g. a sudo password) is forwarded to the host but never logged.
    async exec(command: string, input?: string): Promise<ExecResult> {
      const startedAt = Date.now();
      try {
        const result = await executor.exec(command, input);
        log.record({
          command,
          host,
          startedAt,
          durationMs: Date.now() - startedAt,
          exitCode: result.exitCode,
        });
        return result;
      } catch (err) {
        log.record({
          command,
          host,
          startedAt,
          durationMs: Date.now() - startedAt,
          exitCode: undefined,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  };
}
