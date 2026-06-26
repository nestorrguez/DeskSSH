// Typed client for the DeskSSH gateway. The browser never opens SSH directly; it
// posts connection details here and gets back an opaque session id. Type-only
// imports from @deskssh/core are erased at build, so no Node/ssh2 code reaches the
// bundle.

import type { CapabilityResult, FileEntry, CommandRecord } from '@deskssh/core';

export type AuthInput =
  | { kind: 'password'; password: string }
  | { kind: 'privateKey'; privateKey: string; passphrase?: string };

export interface ConnectInput {
  host: string;
  port?: number;
  username: string;
  auth: AuthInput;
}

export interface SessionInfo {
  sessionId: string;
  host: string;
  home: string;
  os: { family: string; prettyName?: string };
}

export interface ListDirResponse {
  path: string;
  result: CapabilityResult<readonly FileEntry[]>;
  transparency: readonly CommandRecord[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function connect(input: ConnectInput): Promise<SessionInfo> {
  return post<SessionInfo>('/api/connect', input);
}

export function listDir(sessionId: string, path?: string): Promise<ListDirResponse> {
  return post<ListDirResponse>('/api/listdir', { sessionId, path });
}

export function disconnect(sessionId: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/api/disconnect', { sessionId });
}
