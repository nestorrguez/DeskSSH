// Typed client for the DeskSSH gateway. The browser never opens SSH directly; it
// posts connection details here and gets back an opaque session id. Type-only
// imports from @deskssh/core are erased at build, so no Node/ssh2 code reaches the
// bundle.

import type { CapabilityResult, FileEntry, CommandRecord, SystemMetrics } from '@deskssh/core';

export type AuthInput =
  | { kind: 'password'; password: string }
  | { kind: 'privateKey'; privateKey: string; passphrase?: string };

export interface ConnectInput {
  host: string;
  port?: number;
  username: string;
  auth: AuthInput;
  /** A fingerprint the user has just confirmed (second attempt after TOFU). */
  trustFingerprint?: string;
}

export interface SessionInfo {
  sessionId: string;
  host: string;
  home: string;
  os: { family: string; prettyName?: string };
}

/** Result of a connect attempt: either a session, or a host key to confirm. */
export type ConnectResult =
  | ({ status: 'connected' } & SessionInfo)
  | { status: 'verify-host-key'; fingerprint: string; algorithm: string };

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

export function connect(input: ConnectInput): Promise<ConnectResult> {
  return post<ConnectResult>('/api/connect', input);
}

export function listDir(sessionId: string, path?: string): Promise<ListDirResponse> {
  return post<ListDirResponse>('/api/listdir', { sessionId, path });
}

export function disconnect(sessionId: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/api/disconnect', { sessionId });
}

export function systemMetrics(
  sessionId: string,
): Promise<{ result: CapabilityResult<SystemMetrics> }> {
  return post('/api/metrics', { sessionId });
}

/** Read a file; on success the bytes arrive base64-encoded. */
type ReadFileResult =
  | { kind: 'ok'; base64: string }
  | { kind: 'degraded' | 'failed' | 'unsupported'; reason: string };

export function readFile(sessionId: string, path: string): Promise<{ result: ReadFileResult }> {
  return post('/api/readfile', { sessionId, path });
}

export function writeFile(
  sessionId: string,
  path: string,
  base64: string,
): Promise<{ result: CapabilityResult<void> }> {
  return post('/api/writefile', { sessionId, path, base64 });
}
