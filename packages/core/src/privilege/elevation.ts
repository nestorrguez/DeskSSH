// Privilege elevation (sudo) — FR-093..095 / plan §5. When a capability fails for
// lack of privilege, the same command can be re-run elevated. The password is fed
// to `sudo -S` on stdin (never in the command line, so it never reaches the
// transparency log) and used once.

import type { CommandExecutor } from '../exec/types.js';
import { quote } from '../adapters/shell.js';

// stderr phrasings that mean "you lack the privilege", across sudo/systemd/POSIX.
const PERMISSION_RE =
  /permission denied|operation not permitted|must be root|authentication is required|access denied|not in the sudoers|are not allowed to|you must have|insufficient privileg|not permitted/i;

/** Heuristic: does this command output read like a privilege error? (FR-093) */
export function isPermissionDenied(text: string): boolean {
  return PERMISSION_RE.test(text);
}

/**
 * Wrap an executor so every command runs elevated via `sudo -S`. The whole command
 * runs under a subshell (`sh -c`) so pipelines and redirects are elevated too; the
 * password is supplied on stdin and never appears in the command string.
 */
export function withElevation(executor: CommandExecutor, password: string): CommandExecutor {
  return {
    exec(command: string) {
      return executor.exec(`sudo -S -p '' sh -c ${quote(command)}`, `${password}\n`);
    },
  };
}

/** What kind of elevation the connected user can perform (FR-093). */
export interface PrivilegeInfo {
  /** The connected user is already root (uid 0) — no elevation needed. */
  readonly isRoot: boolean;
  /** The user can run `sudo` (root, or member of a sudo-capable group). */
  readonly canSudo: boolean;
  /** The host offers any escalation path at all (`sudo` or `su` present). */
  readonly escalationAvailable: boolean;
}

const SUDO_GROUPS = new Set(['sudo', 'wheel', 'admin', 'root']);

/**
 * Probe the host (one round trip, no password prompt) for what the connected user
 * may do: their uid, groups and whether `sudo`/`su` exist. Used to choose between
 * Modal 1 (password-only) and the insufficient-privilege flow (FR-094/095).
 */
export async function detectPrivilege(executor: CommandExecutor): Promise<PrivilegeInfo> {
  const probe =
    'echo "UID=$(id -u)"; echo "GROUPS=$(id -nG 2>/dev/null)"; ' +
    'command -v sudo >/dev/null 2>&1 && echo HAVE_SUDO; ' +
    'command -v su >/dev/null 2>&1 && echo HAVE_SU';
  const { stdout } = await executor.exec(probe);
  const isRoot = /UID=0\b/.test(stdout);
  const groups = (/GROUPS=(.*)/.exec(stdout)?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const haveSudo = /\bHAVE_SUDO\b/.test(stdout);
  const haveSu = /\bHAVE_SU\b/.test(stdout);
  return {
    isRoot,
    canSudo: isRoot || (haveSudo && groups.some((g) => SUDO_GROUPS.has(g))),
    escalationAvailable: haveSudo || haveSu,
  };
}
