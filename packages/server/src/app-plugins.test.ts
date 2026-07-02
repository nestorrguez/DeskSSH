import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import {
  importAppPlugin,
  loadAppPlugins,
  pluginsStatus,
  resolveAppFile,
  setPluginEnabled,
  uninstallPlugin,
} from './plugins.js';

function appManifest(overrides: Record<string, unknown> = {}) {
  return {
    schema: 1,
    kind: 'app',
    id: 'logs',
    name: 'Log viewer',
    version: '1.0.0',
    author: { name: 'tester' },
    contract: '^0.1.0',
    desk: '^0.2.0',
    entry: 'index.js',
    capabilities: ['readFile'],
    ...overrides,
  };
}

/** Build an in-memory `.zip` from a path→string map. */
function zipOf(entries: Record<string, string>): Uint8Array {
  const data: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(entries)) data[k] = strToU8(v);
  return zipSync(data);
}

let root: string;
let appsDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'deskssh-apps-'));
  appsDir = join(root, 'apps');
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('importAppPlugin', () => {
  it('extracts a valid app zip into apps/<id>/ and loads it', () => {
    const zip = zipOf({
      'manifest.json': JSON.stringify(appManifest()),
      'index.js': 'export const x = 1;',
    });
    const result = importAppPlugin(zip, { dir: appsDir });
    expect(result).toMatchObject({ ok: true, kind: 'app', id: 'logs', version: '1.0.0' });
    expect(readFileSync(join(appsDir, 'logs', 'index.js'), 'utf8')).toContain('export const x');

    const report = loadAppPlugins({ root });
    expect(report.apps.map((a) => a.id)).toEqual(['logs']);
    expect(report.apps[0]?.entry).toBe('index.js');
  });

  it('flattens a zip whose manifest is in a top-level folder', () => {
    const zip = zipOf({
      'logs/manifest.json': JSON.stringify(appManifest()),
      'logs/index.js': 'export const x = 1;',
    });
    expect(importAppPlugin(zip, { dir: appsDir }).ok).toBe(true);
    expect(loadAppPlugins({ root }).apps.map((a) => a.id)).toEqual(['logs']);
  });

  it('rejects a zip without a manifest', () => {
    const result = importAppPlugin(zipOf({ 'index.js': 'x' }), { dir: appsDir });
    expect(result).toMatchObject({ ok: false });
  });

  it('rejects a zip whose declared entry is absent', () => {
    const zip = zipOf({ 'manifest.json': JSON.stringify(appManifest({ entry: 'missing.js' })) });
    expect(importAppPlugin(zip, { dir: appsDir })).toMatchObject({ ok: false });
  });

  it('rejects an invalid manifest', () => {
    const zip = zipOf({
      'manifest.json': JSON.stringify(appManifest({ desk: undefined })),
      'index.js': 'x',
    });
    expect(importAppPlugin(zip, { dir: appsDir })).toMatchObject({ ok: false });
  });

  it('replaces a previous install (no stale files linger)', () => {
    importAppPlugin(
      zipOf({ 'manifest.json': JSON.stringify(appManifest()), 'index.js': 'a', 'old.js': 'stale' }),
      { dir: appsDir },
    );
    importAppPlugin(zipOf({ 'manifest.json': JSON.stringify(appManifest()), 'index.js': 'b' }), {
      dir: appsDir,
    });
    expect(resolveAppFile('logs', 'old.js', { dir: appsDir })).toBeNull();
    expect(readFileSync(join(appsDir, 'logs', 'index.js'), 'utf8')).toBe('b');
  });
});

describe('loadAppPlugins compat + state', () => {
  function install(overrides: Record<string, unknown> = {}) {
    const zip = zipOf({ 'manifest.json': JSON.stringify(appManifest(overrides)), 'index.js': 'x' });
    return importAppPlugin(zip, { dir: appsDir });
  }

  it('skips an app requiring an incompatible Desk app-runtime', () => {
    install({ desk: '^9.0.0' });
    const report = loadAppPlugins({ root });
    expect(report.apps).toEqual([]);
    expect(report.skipped[0]?.reason).toContain('app-runtime');
  });

  it('skips an app requiring an incompatible Contract and flags it in pluginsStatus', () => {
    install({ contract: '^9.0.0' });
    const report = loadAppPlugins({ root });
    expect(report.apps).toEqual([]);
    expect(report.skipped[0]?.reason).toContain('Contract');
    const status = pluginsStatus({ root }).find((p) => p.id === 'logs');
    expect(status).toMatchObject({ kind: 'app', compatible: false });
    expect(status?.reason).toContain('Contract');
  });

  it('skips a disabled app and pluginsStatus reflects it', () => {
    install();
    setPluginEnabled('app', 'logs', false, root);
    expect(loadAppPlugins({ root }).apps).toEqual([]);
    const status = pluginsStatus({ root }).find((p) => p.id === 'logs');
    expect(status).toMatchObject({ kind: 'app', enabled: false, compatible: true });
  });

  it('re-enabling restores loading', () => {
    install();
    setPluginEnabled('app', 'logs', false, root);
    setPluginEnabled('app', 'logs', true, root);
    expect(loadAppPlugins({ root }).apps.map((a) => a.id)).toEqual(['logs']);
  });
});

describe('resolveAppFile', () => {
  beforeEach(() => {
    importAppPlugin(zipOf({ 'manifest.json': JSON.stringify(appManifest()), 'index.js': 'x' }), {
      dir: appsDir,
    });
  });

  it('resolves a real file inside the app folder', () => {
    expect(resolveAppFile('logs', 'index.js', { dir: appsDir })).toContain(
      join('logs', 'index.js'),
    );
  });

  it('rejects path traversal out of the app folder', () => {
    expect(resolveAppFile('logs', '../../etc/passwd', { dir: appsDir })).toBeNull();
    expect(resolveAppFile('../logs', 'index.js', { dir: appsDir })).toBeNull();
  });

  it('returns null for a missing file', () => {
    expect(resolveAppFile('logs', 'nope.js', { dir: appsDir })).toBeNull();
  });
});

describe('uninstallPlugin', () => {
  it('removes an app folder', () => {
    importAppPlugin(zipOf({ 'manifest.json': JSON.stringify(appManifest()), 'index.js': 'x' }), {
      dir: appsDir,
    });
    expect(uninstallPlugin('app', 'logs', { root })).toBe(true);
    expect(loadAppPlugins({ root }).apps).toEqual([]);
  });
});
