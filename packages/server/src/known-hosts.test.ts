import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryKnownHosts, FileKnownHosts } from './known-hosts.js';

describe('InMemoryKnownHosts', () => {
  it('stores and retrieves fingerprints', () => {
    const store = new InMemoryKnownHosts();
    expect(store.get('h:22')).toBeUndefined();
    store.add('h:22', 'SHA256:abc');
    expect(store.get('h:22')).toBe('SHA256:abc');
  });
});

describe('FileKnownHosts', () => {
  it('persists across instances', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deskssh-kh-'));
    const path = join(dir, 'known_hosts.json');
    try {
      const a = new FileKnownHosts(path);
      a.add('example.com:22', 'SHA256:xyz');

      const b = new FileKnownHosts(path);
      expect(b.get('example.com:22')).toBe('SHA256:xyz');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('starts empty when the file does not exist', () => {
    const store = new FileKnownHosts(join(tmpdir(), 'deskssh-nope', 'known_hosts.json'));
    expect(store.get('whatever:22')).toBeUndefined();
  });
});
