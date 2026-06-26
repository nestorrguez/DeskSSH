// OS detection (FR-004, Art. 6). On connect we read /etc/os-release and uname to
// pick the right adapter. Detection is parsing-tolerant: anything unknown falls
// back to a generic POSIX adapter rather than failing.

import type { CommandExecutor } from '../exec/types.js';

/** Families DeskSSH can recognize. `posix` is the generic Unix-like fallback. */
export type OsFamily = 'debian' | 'rhel' | 'arch' | 'posix' | 'unknown';

export interface OsInfo {
  readonly family: OsFamily;
  /** os-release ID, e.g. "ubuntu", "debian", when available. */
  readonly id?: string;
  /** os-release ID_LIKE, e.g. "debian", when available. */
  readonly idLike?: string;
  /** `uname -s`, e.g. "Linux". */
  readonly kernel?: string;
  /** Pretty name for display, when available. */
  readonly prettyName?: string;
}

/** Parse the shell-style key=value lines of /etc/os-release. */
export function parseOsRelease(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Map an os-release ID / ID_LIKE pair to a known family. */
export function familyFor(id: string | undefined, idLike: string | undefined): OsFamily {
  const haystack = `${id ?? ''} ${idLike ?? ''}`.toLowerCase();
  if (/\b(debian|ubuntu|linuxmint|mint|raspbian|pop)\b/.test(haystack)) return 'debian';
  if (/\b(rhel|fedora|centos|rocky|almalinux)\b/.test(haystack)) return 'rhel';
  if (/\b(arch|manjaro)\b/.test(haystack)) return 'arch';
  return 'unknown';
}

/** Detect the host OS by reading os-release and uname over the executor. */
export async function detectOs(executor: CommandExecutor): Promise<OsInfo> {
  const { stdout: releaseRaw, exitCode: releaseCode } = await executor.exec(
    'cat /etc/os-release 2>/dev/null',
  );
  const { stdout: unameRaw } = await executor.exec('uname -s 2>/dev/null');
  const kernel = unameRaw.trim() || undefined;

  if (releaseCode !== 0 || !releaseRaw.trim()) {
    // No os-release: treat any Unix-like kernel as generic POSIX.
    return { family: kernel ? 'posix' : 'unknown', kernel };
  }

  const fields = parseOsRelease(releaseRaw);
  const id = fields['ID'];
  const idLike = fields['ID_LIKE'];
  const known = familyFor(id, idLike);
  return {
    family: known === 'unknown' ? 'posix' : known,
    id,
    idLike,
    kernel,
    prettyName: fields['PRETTY_NAME'],
  };
}
