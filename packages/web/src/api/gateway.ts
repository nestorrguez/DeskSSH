// Typed client for the DeskSSH gateway. The browser never opens SSH directly; it
// posts connection details here and gets back an opaque session id. Type-only
// imports from @deskssh/core are erased at build, so no Node/ssh2 code reaches the
// bundle.

import type {
  AdapterInfo,
  CapabilityResult,
  CommandRecord,
  FileEntry,
  PrivilegeInfo,
  Process,
  ProcessSignal,
  ServiceAction,
  ServiceState,
  SystemInfo,
  SystemMetrics,
} from '@deskssh/core';

/** A one-shot privilege elevation for a single action (FR-094/095). */
export type Elevate =
  | { kind: 'current'; password: string }
  | { kind: 'user'; user: string; password: string };

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
  /** Capabilities the connected host's adapter implements (graceful-degrade). */
  capabilities: string[];
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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return data as T;
}

export function connect(input: ConnectInput): Promise<ConnectResult> {
  return post<ConnectResult>('/api/connect', input);
}

/** Installed OS adapters (Extensions view, FR-230). Sessionless. */
export function getAdapters(): Promise<{ adapters: AdapterInfo[] }> {
  return get('/api/adapters');
}

/** The Desk's Contract + app-runtime API versions, for the Settings About section
 *  (FR-241 / E9.2). Sessionless: static server identity, shown before login. */
export function getVersions(): Promise<{ contract: string; appRuntime: string }> {
  return get('/api/versions');
}

/** Result of importing a plugin (E10.2). */
export interface ImportPluginResult {
  ok: true;
  kind: 'adapter' | 'app';
  id: string;
  name: string;
  version: string;
}

/** Import an adapter plugin from its parsed manifest. Sessionless. */
export function importPlugin(manifest: unknown): Promise<ImportPluginResult> {
  return post('/api/plugins/import', manifest);
}

/** Import an app plugin from a `.zip` (E10.2b). Sent as a binary body; the gateway
 *  extracts + validates + places it for the next restart. */
export async function importAppZip(zip: ArrayBuffer): Promise<ImportPluginResult> {
  const res = await fetch('/api/plugins/import', {
    method: 'POST',
    headers: { 'content-type': 'application/zip' },
    body: zip,
  });
  if (!res.ok)
    throw new Error(
      ((await res.json()) as { error?: string }).error ?? `HTTP ${String(res.status)}`,
    );
  return res.json() as Promise<ImportPluginResult>;
}

/** A plugin's status in the Settings manager (E10.3b). */
export interface PluginStatus {
  kind: 'adapter' | 'app';
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  compatible: boolean;
  author?: { name: string; github?: string; email?: string };
  reason?: string;
}

/** Full status of installed plugins for the Settings manager (E10.3b). Sessionless. */
export function listPlugins(): Promise<{ plugins: PluginStatus[] }> {
  return get('/api/plugins');
}

/** Enable or disable an installed plugin (restart/reload to apply) (E10.3b). */
export function setPluginEnabled(
  kind: 'adapter' | 'app',
  id: string,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  return post('/api/plugins/enable', { kind, id, enabled });
}

/** Uninstall an installed plugin (E10.3b). */
export function uninstallPlugin(kind: 'adapter' | 'app', id: string): Promise<{ ok: boolean }> {
  return post('/api/plugins/uninstall', { kind, id });
}

/** A loadable app plugin advertised by the gateway for dynamic import at boot (E10.4e). */
export interface AppPluginInfo {
  id: string;
  name: string;
  version: string;
  /** URL of the ESM entry to dynamically import. */
  entry: string;
  capabilities: string[];
  icon?: string;
  category?: string;
  author: { name: string; github?: string; email?: string };
}

/** The app plugins the web should dynamically import at boot (E10.4e). Sessionless. */
export function getAppPlugins(): Promise<{ apps: AppPluginInfo[] }> {
  return get('/api/plugins/apps');
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
  elevate?: Elevate,
): Promise<{ result: CapabilityResult<void> }> {
  return post('/api/writefile', { sessionId, path, base64, ...(elevate ? { elevate } : {}) });
}

type VoidResult = { result: CapabilityResult<void> };

export function makeDir(sessionId: string, path: string, elevate?: Elevate): Promise<VoidResult> {
  return post('/api/mkdir', { sessionId, path, ...(elevate ? { elevate } : {}) });
}

export function createFile(
  sessionId: string,
  path: string,
  elevate?: Elevate,
): Promise<VoidResult> {
  return post('/api/createfile', { sessionId, path, ...(elevate ? { elevate } : {}) });
}

export function movePath(
  sessionId: string,
  from: string,
  to: string,
  elevate?: Elevate,
): Promise<VoidResult> {
  return post('/api/move', { sessionId, from, to, ...(elevate ? { elevate } : {}) });
}

export function copyPath(
  sessionId: string,
  from: string,
  to: string,
  elevate?: Elevate,
): Promise<VoidResult> {
  return post('/api/copy', { sessionId, from, to, ...(elevate ? { elevate } : {}) });
}

export function removePath(
  sessionId: string,
  path: string,
  elevate?: Elevate,
): Promise<VoidResult> {
  return post('/api/remove', { sessionId, path, ...(elevate ? { elevate } : {}) });
}

export function listProcesses(
  sessionId: string,
): Promise<{ result: CapabilityResult<readonly Process[]> }> {
  return post('/api/processes', { sessionId });
}

export function signalProcess(
  sessionId: string,
  pid: number,
  signal: ProcessSignal,
  elevate?: Elevate,
): Promise<VoidResult> {
  return post('/api/signal', { sessionId, pid, signal, ...(elevate ? { elevate } : {}) });
}

export function serviceAction(
  sessionId: string,
  name: string,
  action: ServiceAction,
  elevate?: Elevate,
): Promise<{ result: CapabilityResult<ServiceState> }> {
  return post('/api/service', { sessionId, name, action, ...(elevate ? { elevate } : {}) });
}

export function getPrivilege(sessionId: string): Promise<{ privilege: PrivilegeInfo }> {
  return post('/api/privilege', { sessionId });
}

export function getSystemInfo(
  sessionId: string,
): Promise<{ result: CapabilityResult<SystemInfo> }> {
  return post('/api/systeminfo', { sessionId });
}

export function getTransparency(
  sessionId: string,
): Promise<{ transparency: readonly CommandRecord[] }> {
  return post('/api/transparency', { sessionId });
}
