// Adapter plugins (spec 002, FR-202/251 / E10). A third-party OS adapter ships as a
// JSON manifest dropped into `~/.deskssh/plugins/adapters/` — no host-side code
// (FR-202): because it is JSON, its capability specs can only be declarative command
// templates, never functions. This module is pure (no filesystem): the server reads
// the file and hands the parsed value here to validate and turn into an
// AdapterProvider backed by the E2 ManifestAdapter engine.

import type { Author } from '../contract/author.js';
import type { CapabilityName } from '../contract/version.js';
import { ManifestAdapter, type AdapterManifest } from './manifest.js';
import type { AdapterProvider } from './registry.js';

/** Manifest of a declarative OS adapter plugin (schema v1). */
export interface AdapterPluginManifest {
  readonly schema: 1;
  readonly kind: 'adapter';
  /** Stable id (de-duplicates registration; replaces a built-in of the same id). */
  readonly id: string;
  /** Human label for the Settings panel. */
  readonly name: string;
  /** The adapter's own semver (FR-241). */
  readonly version: string;
  /** Provenance (FR-242). */
  readonly author: Author;
  /** SPDX license id, optional. */
  readonly license?: string;
  /** The Contract range this adapter implements, e.g. `^0.1.0` (FR-241). */
  readonly contract: string;
  /** os-release IDs / families this adapter matches (e.g. `["rhel","fedora"]`). */
  readonly osSupport: readonly string[];
  /** Declarative capability map (E2). From JSON, so normalization is always a spec. */
  readonly capabilities: AdapterManifest;
}

/** A validation outcome carrying either the typed manifest or a human reason. */
export type ManifestValidation =
  | { readonly ok: true; readonly manifest: AdapterPluginManifest }
  | { readonly ok: false; readonly reason: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function validateCapabilities(value: unknown): string | null {
  if (!isObject(value)) return 'capabilities must be an object';
  const names = Object.keys(value);
  if (names.length === 0) return 'capabilities is empty';
  for (const name of names) {
    const spec = value[name];
    if (!isObject(spec)) return `capability "${name}" must be an object`;
    if (!isNonEmptyString(spec['template'])) return `capability "${name}" needs a template`;
    const norm = spec['normalize'];
    if (typeof norm === 'function') return `capability "${name}" may not carry code (FR-202)`;
    if (!isObject(norm) || norm['kind'] !== 'records') {
      return `capability "${name}" needs a declarative "records" normalize spec`;
    }
    if (!isNonEmptyString(norm['columnDelimiter'])) {
      return `capability "${name}" normalize needs a columnDelimiter`;
    }
    if (!Array.isArray(norm['columns']) || norm['columns'].length === 0) {
      return `capability "${name}" normalize needs columns`;
    }
  }
  return null;
}

/** Validate an untrusted, parsed manifest value (never throws). */
export function validateAdapterPluginManifest(value: unknown): ManifestValidation {
  if (!isObject(value)) return { ok: false, reason: 'manifest is not an object' };
  if (value['kind'] !== 'adapter') return { ok: false, reason: 'kind must be "adapter"' };
  if (value['schema'] !== 1) return { ok: false, reason: 'unsupported schema (expected 1)' };
  for (const field of ['id', 'name', 'version', 'contract'] as const) {
    if (!isNonEmptyString(value[field])) return { ok: false, reason: `missing "${field}"` };
  }
  const author = value['author'];
  if (!isObject(author) || !isNonEmptyString(author['name'])) {
    return { ok: false, reason: 'author.name is required' };
  }
  const osSupport = value['osSupport'];
  if (!Array.isArray(osSupport) || !osSupport.every(isNonEmptyString) || osSupport.length === 0) {
    return { ok: false, reason: 'osSupport must be a non-empty string array' };
  }
  const capError = validateCapabilities(value['capabilities']);
  if (capError) return { ok: false, reason: capError };
  return { ok: true, manifest: value as unknown as AdapterPluginManifest };
}

/** Build a registry provider from a validated adapter manifest. */
export function manifestToProvider(manifest: AdapterPluginManifest): AdapterProvider {
  const ids = manifest.osSupport.map((s) => s.toLowerCase());
  return {
    id: manifest.id,
    label: manifest.name,
    osSupport: manifest.osSupport,
    version: manifest.version,
    contract: manifest.contract,
    author: manifest.author,
    capabilities: Object.keys(manifest.capabilities) as CapabilityName[],
    matches: (os) => {
      const candidates = [os.id, os.idLike, os.family]
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.toLowerCase());
      return candidates.some((c) => ids.includes(c)) ? 1 : 0;
    },
    create: (executor) => new ManifestAdapter(executor, manifest.capabilities),
  };
}
