// Plugin discovery (spec 002, FR-251 / E10). On startup the gateway scans the
// plugins folder and registers the adapters it finds. Distribution is by **manual
// drop** of an extracted plugin into `~/.deskssh/plugins/adapters/` (the `.zip`
// import wizard is a later slice). Each adapter is a declarative JSON manifest
// (FR-202) — either a `*.json` file or a `*/manifest.json`. Loading is isolated:
// a bad or incompatible plugin is skipped with a reason and never aborts the scan
// or the gateway (Art. 7).

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import {
  checkAdapterCompat,
  checkAppCompat,
  manifestToProvider,
  registerAdapter,
  validateAdapterPluginManifest,
  validateAppPluginManifest,
  type Author,
  type CapabilityName,
} from '@deskssh/core';

export interface LoadedPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
}

export interface SkippedPlugin {
  readonly path: string;
  readonly reason: string;
}

export interface PluginLoadReport {
  readonly loaded: LoadedPlugin[];
  readonly skipped: SkippedPlugin[];
}

/** The plugins base dir: `$DESKSSH_PLUGINS` or `~/.deskssh/plugins`. */
export function pluginsRoot(): string {
  return process.env['DESKSSH_PLUGINS'] || join(homedir(), '.deskssh', 'plugins');
}

/** Ensure `adapters/ apps/ languages/` exist so users have a place to drop plugins. */
export function ensurePluginDirs(root = pluginsRoot()): void {
  for (const kind of ['adapters', 'apps', 'languages']) {
    try {
      mkdirSync(join(root, kind), { recursive: true });
    } catch {
      // Non-fatal: a read-only home just means no plugins are discovered.
    }
  }
}

/** A plugin kind that can be enabled/disabled/uninstalled from Settings (E10.3b). */
export type PluginKind = 'adapter' | 'app';

/** A `kind:id` key used in the persisted enable/disable state. */
function stateKey(kind: PluginKind, id: string): string {
  return `${kind}:${id}`;
}

/** Path to the per-install enable/disable state file. */
function statePath(root = pluginsRoot()): string {
  return join(root, 'state.json');
}

/** The set of `kind:id` keys the user has disabled (E10.3b). Never throws. */
function readDisabled(root = pluginsRoot()): Set<string> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(statePath(root), 'utf8'));
    const list = (parsed as { disabled?: unknown })?.disabled;
    if (Array.isArray(list)) return new Set(list.filter((k): k is string => typeof k === 'string'));
  } catch {
    // No state file (or unreadable) → nothing disabled.
  }
  return new Set();
}

/** Enable or disable a plugin, persisting to `state.json` (restart/reload to apply). */
export function setPluginEnabled(
  kind: PluginKind,
  id: string,
  enabled: boolean,
  root = pluginsRoot(),
): void {
  const disabled = readDisabled(root);
  if (enabled) disabled.delete(stateKey(kind, id));
  else disabled.add(stateKey(kind, id));
  mkdirSync(root, { recursive: true });
  writeFileSync(
    statePath(root),
    `${JSON.stringify({ disabled: [...disabled].sort() }, null, 2)}\n`,
    'utf8',
  );
}

/** Resolve the manifest file for an `adapters/` entry, or null if it isn't one. */
function manifestPathFor(entryPath: string): string | null {
  try {
    if (statSync(entryPath).isDirectory()) {
      const inner = join(entryPath, 'manifest.json');
      return existsSync(inner) ? inner : null;
    }
    return entryPath.endsWith('.json') ? entryPath : null;
  } catch {
    return null;
  }
}

/**
 * Scan the adapters folder, register every valid + compatible adapter, and return a
 * report of what loaded and what was skipped (with reasons). Never throws.
 */
export function loadAdapterPlugins(opts: { dir?: string; root?: string } = {}): PluginLoadReport {
  const root = opts.root ?? pluginsRoot();
  const dir = opts.dir ?? join(root, 'adapters');
  const disabled = readDisabled(root);
  const loaded: LoadedPlugin[] = [];
  const skipped: SkippedPlugin[] = [];
  if (!existsSync(dir)) return { loaded, skipped };

  for (const entry of readdirSync(dir)) {
    const entryPath = join(dir, entry);
    const manifestPath = manifestPathFor(entryPath);
    if (!manifestPath) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const result = validateAdapterPluginManifest(parsed);
      if (!result.ok) {
        skipped.push({ path: manifestPath, reason: result.reason });
        continue;
      }
      if (disabled.has(stateKey('adapter', result.manifest.id))) {
        skipped.push({ path: manifestPath, reason: 'disabled' });
        continue;
      }
      const provider = manifestToProvider(result.manifest);
      const compat = checkAdapterCompat(provider);
      if (!compat.compatible) {
        skipped.push({ path: manifestPath, reason: compat.reason ?? 'incompatible' });
        continue;
      }
      registerAdapter(provider);
      loaded.push({
        id: provider.id,
        name: provider.label ?? provider.id,
        version: provider.version,
      });
    } catch (err) {
      skipped.push({
        path: manifestPath,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { loaded, skipped };
}

export type ImportResult =
  | {
      readonly ok: true;
      readonly kind: PluginKind;
      readonly id: string;
      readonly name: string;
      readonly version: string;
    }
  | { readonly ok: false; readonly reason: string };

/** A loaded app plugin, as served to the web for dynamic import (E10.4b). */
export interface LoadedApp {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** Relative path to the ESM entry inside the app folder; URL: `/api/plugins/apps/<id>/<entry>`. */
  readonly entry: string;
  readonly capabilities: readonly CapabilityName[];
  readonly icon?: string;
  readonly category?: string;
  readonly author: Author;
}

export interface AppLoadReport {
  readonly apps: LoadedApp[];
  readonly skipped: SkippedPlugin[];
}

/** Sanitize an id into a safe single path segment (never escapes its folder). */
function safeSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Import an adapter plugin from a parsed manifest (E10.2, the `.json` path of the
 * import wizard): validate it, then write it into `adapters/` named after its id, so
 * the next startup scan picks it up (restart-to-load). The filename is derived from
 * the validated id (sanitized), never from caller input, so it can't escape the
 * folder. App `.zip` import (bundled assets) is a later slice.
 */
export function importAdapterPlugin(parsed: unknown, opts: { dir?: string } = {}): ImportResult {
  const result = validateAdapterPluginManifest(parsed);
  if (!result.ok) return { ok: false, reason: result.reason };
  const manifest = result.manifest;
  const dir = opts.dir ?? join(pluginsRoot(), 'adapters');
  const safeId = manifest.id.replace(/[^a-zA-Z0-9._-]/g, '_');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${safeId}.json`), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  return {
    ok: true,
    kind: 'adapter',
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
  };
}

/**
 * Scan the apps folder (E10.4b). Each app is a subfolder `apps/<id>/` holding a
 * `manifest.json` + built ESM. For each: validate the manifest, check Desk↔App and
 * Contract↔App compat (E10.4a) and the disabled state, then return the loadable ones
 * (served + dynamically imported by the web) and a skip report. Never throws.
 */
export function loadAppPlugins(opts: { dir?: string; root?: string } = {}): AppLoadReport {
  const root = opts.root ?? pluginsRoot();
  const dir = opts.dir ?? join(root, 'apps');
  const disabled = readDisabled(root);
  const apps: LoadedApp[] = [];
  const skipped: SkippedPlugin[] = [];
  if (!existsSync(dir)) return { apps, skipped };

  for (const entry of readdirSync(dir)) {
    const appDir = join(dir, entry);
    const manifestPath = join(appDir, 'manifest.json');
    try {
      if (!statSync(appDir).isDirectory() || !existsSync(manifestPath)) continue;
      const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const result = validateAppPluginManifest(parsed);
      if (!result.ok) {
        skipped.push({ path: manifestPath, reason: result.reason });
        continue;
      }
      const m = result.manifest;
      if (disabled.has(stateKey('app', m.id))) {
        skipped.push({ path: manifestPath, reason: 'disabled' });
        continue;
      }
      if (!existsSync(join(appDir, m.entry))) {
        skipped.push({ path: manifestPath, reason: `entry "${m.entry}" not found` });
        continue;
      }
      const compat = checkAppCompat(m);
      if (!compat.compatible) {
        skipped.push({ path: manifestPath, reason: compat.reason ?? 'incompatible' });
        continue;
      }
      apps.push({
        id: m.id,
        name: m.name,
        version: m.version,
        entry: m.entry,
        capabilities: m.capabilities ?? [],
        ...(m.icon ? { icon: m.icon } : {}),
        ...(m.category ? { category: m.category } : {}),
        author: m.author,
      });
    } catch (err) {
      skipped.push({
        path: manifestPath,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { apps, skipped };
}

/**
 * Import an app plugin from a `.zip` (E10.2b). Unzip in memory, locate the inner
 * `manifest.json`, validate it, then write every entry **zip-slip-safely** under
 * `apps/<sanitized-id>/` (restart-to-load). A zip whose manifest lives in a subfolder is
 * flattened to that subfolder's root. Any entry resolving outside the target is rejected.
 */
export function importAppPlugin(zip: Uint8Array, opts: { dir?: string } = {}): ImportResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch (err) {
    return {
      ok: false,
      reason: `not a readable .zip: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Locate manifest.json (root or a single top-level folder) and derive the base prefix.
  const manifestKey = Object.keys(files).find(
    (k) => k === 'manifest.json' || k.endsWith('/manifest.json'),
  );
  if (!manifestKey) return { ok: false, reason: 'no manifest.json in the .zip' };
  const base = manifestKey.slice(0, manifestKey.length - 'manifest.json'.length); // '' or 'sub/'

  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(strFromU8(files[manifestKey]!));
  } catch (err) {
    return {
      ok: false,
      reason: `manifest.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const result = validateAppPluginManifest(manifestValue);
  if (!result.ok) return { ok: false, reason: result.reason };
  const m = result.manifest;

  const appsDir = opts.dir ?? join(pluginsRoot(), 'apps');
  const appDir = join(appsDir, safeSegment(m.id));
  try {
    // Replace any previous install of the same id so stale files can't linger.
    rmSync(appDir, { recursive: true, force: true });
    mkdirSync(appDir, { recursive: true });
    for (const [key, data] of Object.entries(files)) {
      if (key.endsWith('/')) continue; // directory entry
      if (base && !key.startsWith(base)) continue; // outside the chosen package root
      const rel = base ? key.slice(base.length) : key;
      if (!rel) continue;
      const dest = resolve(appDir, rel);
      if (dest !== appDir && !dest.startsWith(appDir + sep)) {
        return { ok: false, reason: `unsafe path in archive: ${key}` };
      }
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, data);
    }
    if (!existsSync(join(appDir, m.entry))) {
      rmSync(appDir, { recursive: true, force: true });
      return { ok: false, reason: `entry "${m.entry}" not present in the .zip` };
    }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, kind: 'app', id: m.id, name: m.name, version: m.version };
}

/**
 * Resolve a request for an app asset to a real file path inside `apps/<id>/`, or null if
 * the id/path is unknown or escapes the folder (E10.4b serve route). `relPath` is the
 * URL tail after `/api/plugins/apps/<id>/`.
 */
export function resolveAppFile(
  id: string,
  relPath: string,
  opts: { dir?: string } = {},
): string | null {
  const appsDir = opts.dir ?? join(pluginsRoot(), 'apps');
  const appDir = join(appsDir, safeSegment(id));
  const dest = resolve(appDir, relPath);
  if (dest !== appDir && !dest.startsWith(appDir + sep)) return null;
  try {
    return statSync(dest).isFile() ? dest : null;
  } catch {
    return null;
  }
}

/** Uninstall a plugin: remove its files from disk (E10.3b). Never throws. */
export function uninstallPlugin(
  kind: PluginKind,
  id: string,
  opts: { root?: string } = {},
): boolean {
  const root = opts.root ?? pluginsRoot();
  const seg = safeSegment(id);
  try {
    if (kind === 'app') {
      rmSync(join(root, 'apps', seg), { recursive: true, force: true });
      return true;
    }
    // Adapter: either `<id>.json` or `<id>/manifest.json` layout.
    rmSync(join(root, 'adapters', `${seg}.json`), { force: true });
    rmSync(join(root, 'adapters', seg), { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/** One row in the Settings plugin manager (E10.3b). */
export interface PluginStatus {
  readonly kind: PluginKind;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly compatible: boolean;
  readonly author?: Author;
  /** Why it isn't active (invalid / incompatible / disabled), when applicable. */
  readonly reason?: string;
}

/**
 * Full status of every installed plugin for the Settings manager (E10.3b): a flat list
 * across adapters + apps with enabled/compatible/reason. Read-only — does not register.
 */
export function pluginsStatus(opts: { root?: string } = {}): PluginStatus[] {
  const root = opts.root ?? pluginsRoot();
  const disabled = readDisabled(root);
  const out: PluginStatus[] = [];

  const adaptersDir = join(root, 'adapters');
  if (existsSync(adaptersDir)) {
    for (const entry of readdirSync(adaptersDir)) {
      const manifestPath = manifestPathFor(join(adaptersDir, entry));
      if (!manifestPath) continue;
      try {
        const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
        const result = validateAdapterPluginManifest(parsed);
        if (!result.ok) {
          out.push({
            kind: 'adapter',
            id: entry,
            name: entry,
            version: '?',
            enabled: false,
            compatible: false,
            reason: result.reason,
          });
          continue;
        }
        const m = result.manifest;
        const enabled = !disabled.has(stateKey('adapter', m.id));
        const compat = checkAdapterCompat(manifestToProvider(m));
        out.push({
          kind: 'adapter',
          id: m.id,
          name: m.name,
          version: m.version,
          author: m.author,
          enabled,
          compatible: compat.compatible,
          ...(compat.compatible ? {} : { reason: compat.reason }),
        });
      } catch (err) {
        out.push({
          kind: 'adapter',
          id: entry,
          name: entry,
          version: '?',
          enabled: false,
          compatible: false,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const appsDir = join(root, 'apps');
  if (existsSync(appsDir)) {
    for (const entry of readdirSync(appsDir)) {
      const manifestPath = join(appsDir, entry, 'manifest.json');
      if (!existsSync(manifestPath)) continue;
      try {
        const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
        const result = validateAppPluginManifest(parsed);
        if (!result.ok) {
          out.push({
            kind: 'app',
            id: entry,
            name: entry,
            version: '?',
            enabled: false,
            compatible: false,
            reason: result.reason,
          });
          continue;
        }
        const m = result.manifest;
        const enabled = !disabled.has(stateKey('app', m.id));
        const compat = checkAppCompat(m);
        out.push({
          kind: 'app',
          id: m.id,
          name: m.name,
          version: m.version,
          author: m.author,
          enabled,
          compatible: compat.compatible,
          ...(compat.compatible ? {} : { reason: compat.reason }),
        });
      } catch (err) {
        out.push({
          kind: 'app',
          id: entry,
          name: entry,
          version: '?',
          enabled: false,
          compatible: false,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return out;
}
