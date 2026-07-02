// A minimal, dependency-free semver subset for the extension compatibility model
// (spec 002, FR-241). The Desk, the Contract and every App/Adapter carry an
// independent version; a plugin declares the ranges it needs and the host resolves
// them. We only need to parse `x.y.z` and test a version against a single range
// operator — exact, caret (`^`), tilde (`~`) or wildcard (`*`) — so we implement
// exactly that (with correct 0.x caret rules) rather than pull in a dependency,
// matching the codebase's hand-written-parser style. Pre-release/build metadata is
// out of scope (our versions are plain `x.y.z`).

export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Parse `x.y.z` into a {@link SemVer}; throws on anything malformed. */
export function parseSemVer(input: string): SemVer {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(input.trim());
  if (!m) throw new Error(`Invalid semver: "${input}"`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Compare two versions: -1 if a<b, 0 if equal, 1 if a>b. */
export function compareSemVer(a: SemVer, b: SemVer): -1 | 0 | 1 {
  for (const k of ['major', 'minor', 'patch'] as const) {
    if (a[k] < b[k]) return -1;
    if (a[k] > b[k]) return 1;
  }
  return 0;
}

/** Exclusive upper bound for a caret range, following npm's 0.x rules. */
function caretUpper(v: SemVer): SemVer {
  if (v.major > 0) return { major: v.major + 1, minor: 0, patch: 0 };
  if (v.minor > 0) return { major: 0, minor: v.minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: v.patch + 1 };
}

/** Exclusive upper bound for a tilde range (`~x.y.z` → `<x.(y+1).0`). */
function tildeUpper(v: SemVer): SemVer {
  return { major: v.major, minor: v.minor + 1, patch: 0 };
}

/**
 * Does `version` satisfy `range`? Supported ranges:
 * - `*` (or empty) — any version;
 * - `x.y.z` — exact match;
 * - `^x.y.z` — compatible-with (npm caret, incl. 0.x);
 * - `~x.y.z` — approximately-equal (patch-level).
 *
 * Unknown range syntax throws, so a malformed manifest surfaces rather than
 * silently matching nothing.
 */
export function satisfies(version: string, range: string): boolean {
  const trimmed = range.trim();
  if (trimmed === '*' || trimmed === '') return true;

  const v = parseSemVer(version);
  const op = trimmed[0];
  if (op === '^' || op === '~') {
    const lower = parseSemVer(trimmed.slice(1));
    const upper = op === '^' ? caretUpper(lower) : tildeUpper(lower);
    return compareSemVer(v, lower) >= 0 && compareSemVer(v, upper) < 0;
  }
  return compareSemVer(v, parseSemVer(trimmed)) === 0;
}
