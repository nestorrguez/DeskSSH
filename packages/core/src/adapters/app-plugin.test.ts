import { describe, expect, it } from 'vitest';
import { APP_RUNTIME_VERSION, CONTRACT_VERSION } from '../contract/version.js';
import { checkAppCompat, validateAppPluginManifest, type AppPluginManifest } from './app-plugin.js';

const valid = {
  schema: 1,
  kind: 'app',
  id: 'logs',
  name: 'Log viewer',
  version: '1.0.0',
  author: { name: 'someone' },
  contract: '^0.1.0',
  desk: '^0.2.0',
  entry: 'index.js',
  capabilities: ['readFile'],
};

describe('validateAppPluginManifest', () => {
  it('accepts a well-formed app manifest', () => {
    const result = validateAppPluginManifest(valid);
    expect(result.ok).toBe(true);
  });

  it('rejects the wrong kind', () => {
    const result = validateAppPluginManifest({ ...valid, kind: 'adapter' });
    expect(result).toMatchObject({ ok: false });
  });

  it('rejects a missing required field', () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest['desk'];
    expect(validateAppPluginManifest(rest)).toMatchObject({ ok: false });
  });

  it('rejects an entry that escapes the package', () => {
    for (const entry of ['../evil.js', '/abs.js', 'a\\b.js', 'nested/../../x.js']) {
      expect(validateAppPluginManifest({ ...valid, entry })).toMatchObject({ ok: false });
    }
  });

  it('rejects non-array capabilities', () => {
    expect(validateAppPluginManifest({ ...valid, capabilities: 'readFile' })).toMatchObject({
      ok: false,
    });
  });

  it('allows omitting optional capabilities', () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest['capabilities'];
    expect(validateAppPluginManifest(rest).ok).toBe(true);
  });
});

describe('checkAppCompat', () => {
  const manifest = (validateAppPluginManifest(valid) as { manifest: AppPluginManifest }).manifest;

  it('accepts an app whose ranges cover the current Desk + Contract', () => {
    expect(checkAppCompat(manifest).compatible).toBe(true);
    expect(
      checkAppCompat(manifest, {
        deskVersion: APP_RUNTIME_VERSION,
        contractVersion: CONTRACT_VERSION,
      }).compatible,
    ).toBe(true);
  });

  it('flags an app requiring a newer Desk app-runtime major', () => {
    const result = checkAppCompat({ ...manifest, desk: '^1.0.0' });
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('app-runtime');
  });

  it('flags an app requiring a newer Contract major', () => {
    const result = checkAppCompat({ ...manifest, contract: '^1.0.0' });
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('Contract');
  });
});
