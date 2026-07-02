// App plugins (spec 002, FR-210/211/241/251 / E10.4). Unlike an adapter (pure
// declarative JSON, no host code), an **app** carries built JS + assets and ships as a
// `.zip` holding a `manifest.json` + an ESM `entry`. The gateway extracts and serves it;
// the web dynamically imports the entry, which self-registers via the versioned
// `@deskssh/app-runtime` SDK (shared React/UI/icon singletons via an import map).
//
// This module is pure (no filesystem): the server unzips and hands the parsed manifest
// here to validate and to resolve the two compatibility joints (Desk↔App app-runtime
// range, Contract↔App range).

import type { Author } from '../contract/author.js';
import { APP_RUNTIME_VERSION, CONTRACT_VERSION, type CapabilityName } from '../contract/version.js';
import { satisfies } from './semver.js';
import type { CompatResult } from './registry.js';

/** Manifest of an app plugin (schema v1), read from the `manifest.json` inside the `.zip`. */
export interface AppPluginManifest {
  readonly schema: 1;
  readonly kind: 'app';
  /** Stable id (de-duplicates registration; replaces a built-in of the same id). */
  readonly id: string;
  /** Human label for the launcher / Settings panel. */
  readonly name: string;
  /** The app's own semver (FR-241). */
  readonly version: string;
  /** Provenance (FR-242). */
  readonly author: Author;
  /** SPDX license id, optional. */
  readonly license?: string;
  /** The Contract range this app requires, e.g. `^0.1.0` (FR-241). */
  readonly contract: string;
  /** The Desk app-runtime API range this app requires, e.g. `^0.2.0` (FR-241). */
  readonly desk: string;
  /** Capabilities the app's actions need; gated against the connected host (E4.3, FR-203). */
  readonly capabilities?: readonly CapabilityName[];
  /** Relative path (inside the package) to the ESM entry, e.g. `index.js`. */
  readonly entry: string;
  /** Optional Lucide icon name shown in the launcher. */
  readonly icon?: string;
  /** Optional launcher category. */
  readonly category?: string;
}

/** A validation outcome carrying either the typed manifest or a human reason. */
export type AppManifestValidation =
  | { readonly ok: true; readonly manifest: AppPluginManifest }
  | { readonly ok: false; readonly reason: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** A relative entry path that can't escape the package folder. */
function isSafeRelativePath(v: unknown): v is string {
  if (!isNonEmptyString(v)) return false;
  if (v.startsWith('/') || v.includes('\\') || v.includes('..')) return false;
  return true;
}

/** Validate an untrusted, parsed app manifest value (never throws). */
export function validateAppPluginManifest(value: unknown): AppManifestValidation {
  if (!isObject(value)) return { ok: false, reason: 'manifest is not an object' };
  if (value['kind'] !== 'app') return { ok: false, reason: 'kind must be "app"' };
  if (value['schema'] !== 1) return { ok: false, reason: 'unsupported schema (expected 1)' };
  for (const field of ['id', 'name', 'version', 'contract', 'desk'] as const) {
    if (!isNonEmptyString(value[field])) return { ok: false, reason: `missing "${field}"` };
  }
  if (!isSafeRelativePath(value['entry'])) {
    return { ok: false, reason: 'entry must be a safe relative path (no "..", no leading "/")' };
  }
  const author = value['author'];
  if (!isObject(author) || !isNonEmptyString(author['name'])) {
    return { ok: false, reason: 'author.name is required' };
  }
  const caps = value['capabilities'];
  if (caps !== undefined && (!Array.isArray(caps) || !caps.every(isNonEmptyString))) {
    return { ok: false, reason: 'capabilities must be a string array' };
  }
  return { ok: true, manifest: value as unknown as AppPluginManifest };
}

/**
 * Resolve the two app joints (FR-241): the app's required **Desk app-runtime** range must
 * admit the Desk's current app-runtime version, and its required **Contract** range must
 * admit the Desk's Contract version. A mismatch flags the app (refused/badged in Settings)
 * rather than loading code built against an API the Desk doesn't provide.
 */
export function checkAppCompat(
  manifest: AppPluginManifest,
  versions: { deskVersion?: string; contractVersion?: string } = {},
): CompatResult {
  const desk = versions.deskVersion ?? APP_RUNTIME_VERSION;
  const contract = versions.contractVersion ?? CONTRACT_VERSION;
  if (!satisfies(desk, manifest.desk)) {
    return {
      compatible: false,
      reason:
        `app "${manifest.id}" requires Desk app-runtime ${manifest.desk}, ` +
        `which does not include the Desk's ${desk}`,
    };
  }
  if (!satisfies(contract, manifest.contract)) {
    return {
      compatible: false,
      reason:
        `app "${manifest.id}" requires Contract ${manifest.contract}, ` +
        `which does not include the Desk's ${contract}`,
    };
  }
  return { compatible: true };
}
