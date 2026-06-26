// Persistent record of host keys we've chosen to trust (the gateway's own
// known_hosts). On first contact with a host the user confirms the fingerprint;
// it is stored here so later connections are verified silently, and a *changed*
// key is treated as a possible MITM (Art. 4).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Maps "host:port" → trusted "SHA256:..." fingerprint. */
export interface KnownHostsStore {
  /** Trusted fingerprint for a host, or undefined if never seen. */
  get(hostPort: string): string | undefined;
  /** Trust (or update) the fingerprint for a host. */
  add(hostPort: string, fingerprint: string): void;
}

/** In-memory store (used in tests and ephemeral deployments). */
export class InMemoryKnownHosts implements KnownHostsStore {
  private readonly map = new Map<string, string>();
  get(hostPort: string): string | undefined {
    return this.map.get(hostPort);
  }
  add(hostPort: string, fingerprint: string): void {
    this.map.set(hostPort, fingerprint);
  }
}

/** JSON file-backed store, default `~/.deskssh/known_hosts.json`. */
export class FileKnownHosts implements KnownHostsStore {
  private readonly map: Map<string, string>;

  constructor(private readonly path = join(homedir(), '.deskssh', 'known_hosts.json')) {
    this.map = new Map(Object.entries(load(path)));
  }

  get(hostPort: string): string | undefined {
    return this.map.get(hostPort);
  }

  add(hostPort: string, fingerprint: string): void {
    this.map.set(hostPort, fingerprint);
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(Object.fromEntries(this.map), null, 2), {
      mode: 0o600,
    });
  }
}

function load(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
