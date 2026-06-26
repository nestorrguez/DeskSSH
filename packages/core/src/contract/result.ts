// The outcome of a capability call. Resilience (Constitution Art. 7): a parsing
// failure must never crash — it degrades to the raw output. Portability (Art. 6):
// a capability a platform can't provide is reported as unsupported, not faked.

import type { CommandExecutor } from '../exec/types.js';

export type CapabilityResult<T> =
  /** Parsed successfully. `raw` is kept for transparency. */
  | { readonly kind: 'ok'; readonly value: T; readonly raw: string }
  /** Command ran but parsing failed; the raw output is preserved. */
  | { readonly kind: 'degraded'; readonly raw: string; readonly reason: string }
  /** The command itself failed (non-zero exit). */
  | {
      readonly kind: 'failed';
      readonly raw: string;
      readonly exitCode: number | null;
      readonly reason: string;
    }
  /** This platform's adapter does not implement the capability. */
  | { readonly kind: 'unsupported'; readonly reason: string };

export function ok<T>(value: T, raw: string): CapabilityResult<T> {
  return { kind: 'ok', value, raw };
}

export function degraded<T>(raw: string, reason: string): CapabilityResult<T> {
  return { kind: 'degraded', raw, reason };
}

export function unsupported<T>(reason: string): CapabilityResult<T> {
  return { kind: 'unsupported', reason };
}

/**
 * Run a command and parse its stdout into a typed value, never throwing:
 * - non-zero exit → `failed` (raw stderr/stdout preserved)
 * - parser throws → `degraded` (raw stdout preserved, Art. 7)
 * - otherwise → `ok`
 *
 * This is the single parse harness all adapters use (plan §4).
 */
export async function runParsed<T>(
  executor: CommandExecutor,
  command: string,
  parser: (stdout: string) => T,
): Promise<CapabilityResult<T>> {
  const { stdout, stderr, exitCode } = await executor.exec(command);
  if (exitCode !== 0) {
    const reason = stderr.trim() || `command exited with code ${String(exitCode)}`;
    return { kind: 'failed', raw: stderr || stdout, exitCode, reason };
  }
  try {
    return ok(parser(stdout), stdout);
  } catch (err) {
    return degraded(stdout, err instanceof Error ? err.message : String(err));
  }
}
