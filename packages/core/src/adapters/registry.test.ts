import { describe, it, expect, afterEach } from 'vitest';
import {
  selectAdapter,
  selectProvider,
  registerAdapter,
  listAdapters,
  adapterCatalog,
  checkAdapterCompat,
  debianProvider,
  createUnsupportedAdapter,
  type AdapterProvider,
} from './registry.js';
import { CONTRACT_VERSION } from '../contract/version.js';
import { DebianAdapter } from './debian.js';
import { FakeExecutor } from '../test/fake-executor.js';

describe('selectAdapter', () => {
  it('returns the Debian adapter for the debian family', () => {
    const adapter = selectAdapter({ family: 'debian' }, new FakeExecutor());
    expect(adapter).toBeInstanceOf(DebianAdapter);
  });

  it('returns an unsupported adapter for other families (graceful degradation)', async () => {
    const adapter = selectAdapter({ family: 'rhel' }, new FakeExecutor());
    const result = await adapter.listDir('/');
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') expect(result.reason).toContain('not supported in v1');
  });
});

describe('adapter registry (FR-200)', () => {
  // A synthetic provider keyed on an os.id the built-ins never match, so it never
  // pollutes the Debian selection. Cleaned up after each test.
  const FAMILY = { family: 'posix' as const, id: 'synthetic-test-os' };
  const marker = createUnsupportedAdapter('synthetic');
  const provider: AdapterProvider = {
    id: 'synthetic-test',
    version: '1.0.0',
    contract: '*',
    author: { name: 'test' },
    capabilities: [],
    matches: (os) => (os.id === 'synthetic-test-os' ? 5 : 0),
    create: () => marker,
  };

  afterEach(() => {
    // Drop the synthetic provider so other tests/files see the default registry.
    const all = listAdapters() as AdapterProvider[];
    const i = all.findIndex((p) => p.id === 'synthetic-test');
    if (i >= 0) all.splice(i, 1);
  });

  it('selects the highest-scoring registered provider', () => {
    registerAdapter(provider);
    expect(selectAdapter(FAMILY, new FakeExecutor())).toBe(marker);
  });

  it('registers idempotently by id (replace, not duplicate)', () => {
    const before = listAdapters().length;
    registerAdapter(provider);
    registerAdapter({ ...provider, matches: () => 1 });
    expect(listAdapters().filter((p) => p.id === 'synthetic-test')).toHaveLength(1);
    expect(listAdapters().length).toBe(before + 1);
  });

  it('still falls back to unsupported when no provider matches', async () => {
    const adapter = selectAdapter({ family: 'arch' }, new FakeExecutor());
    expect((await adapter.listDir('/')).kind).toBe('unsupported');
  });
});

describe('versioning & compatibility (FR-241)', () => {
  it('debianProvider declares its version, contract range and capabilities', () => {
    expect(debianProvider.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(debianProvider.contract).toBe('^0.1.0');
    expect(debianProvider.capabilities).toContain('listDir');
    expect(debianProvider.capabilities).not.toContain('listServices'); // post-v1
  });

  it('adapterCatalog exposes the version metadata for the Settings panel', () => {
    const debian = adapterCatalog().find((a) => a.id === 'debian');
    expect(debian).toMatchObject({
      version: debianProvider.version,
      contract: debianProvider.contract,
    });
    expect(debian?.capabilities).toEqual(debianProvider.capabilities);
  });

  it('checkAdapterCompat accepts an adapter whose range covers the Contract', () => {
    expect(checkAdapterCompat(debianProvider).compatible).toBe(true);
    expect(checkAdapterCompat(debianProvider, CONTRACT_VERSION).compatible).toBe(true);
  });

  it('checkAdapterCompat flags an adapter built for a different Contract major', () => {
    const stale: AdapterProvider = { ...debianProvider, contract: '^2.0.0' };
    const result = checkAdapterCompat(stale, '0.1.0');
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('does not include');
  });

  it('selectProvider returns the matched provider (its capabilities drive degrade)', () => {
    expect(selectProvider({ family: 'debian' })?.id).toBe('debian');
    expect(selectProvider({ family: 'debian' })?.capabilities).toContain('listDir');
    expect(selectProvider({ family: 'arch' })).toBeUndefined();
  });
});
