// Manifest-driven adapter engine (spec 002, FR-201/202/203). An adapter can be
// described declaratively — a command template per capability plus a small
// normalization spec — instead of hand-written code. This is the substrate for
// curated OS families (E3) and, later, third-party declarative-only adapters
// (FR-202): an untrusted adapter can only ship inspectable command templates, never
// host-side code.
//
// Two normalization paths:
//   • declarative `NormalizeSpec` — delimiter + columns → typed record list;
//   • first-party `CodeHook` — a TS function, the 20% escape (busybox, PowerShell,
//     multi-section /proc snapshots) reserved for first-party adapters.
//
// Everything runs through the shared `runParsed` harness, so a parse failure
// degrades to raw output (Art. 7) and a capability absent from the manifest reports
// `unsupported` (Art. 6) — never a wrong guess, never a throw.

import type { CommandExecutor } from '../exec/types.js';
import type { Capabilities } from '../contract/capabilities.js';
import type { CapabilityResult } from '../contract/result.js';
import { runParsed, unsupported } from '../contract/result.js';
import type {
  FileEntry,
  Process,
  ProcessSignal,
  ServiceAction,
  ServiceState,
  SystemInfo,
  SystemMetrics,
} from '../contract/types.js';
import { quote } from './shell.js';

/** How a raw column string is coerced into a typed field. Defaults to `string`. */
export type FieldType = 'string' | 'int' | 'octal' | 'epochSeconds';

/** One column of a delimiter-separated record line. */
export interface ColumnSpec {
  /** Output property name on the produced record. */
  readonly field: string;
  /** Coercion applied to the raw text (default `string`). */
  readonly type?: FieldType;
  /** Map raw values to enum outputs (e.g. find's `%y` type codes). */
  readonly enum?: Readonly<Record<string, string>>;
  /** Fallback used when `enum` has no entry for the raw value. */
  readonly enumDefault?: string;
  /** Final column that absorbs any extra delimiters (e.g. a name containing a tab). */
  readonly rest?: boolean;
}

/** Declarative "one typed record per line" normalization. */
export interface RecordsNormalizeSpec {
  readonly kind: 'records';
  /** Row separator (default `\n`); blank rows are dropped. */
  readonly rowDelimiter?: string;
  /** Column separator within a row. */
  readonly columnDelimiter: string;
  /** Columns in positional order. A row with fewer columns degrades (Art. 7). */
  readonly columns: readonly ColumnSpec[];
}

/** The declarative normalization kinds (extensible; today: records). */
export type NormalizeSpec = RecordsNormalizeSpec;

/** First-party escape: parse stdout in TS. Reserved for first-party adapters (FR-202). */
export type CodeHook<T = unknown> = (stdout: string) => T;

/** One capability: a command template plus how to read its output. */
export interface CapabilitySpec {
  /**
   * Command with `{param}` holes. Every hole is `quote()`-escaped before
   * substitution (injection-safe, Art. 4); constants are written literally.
   */
  readonly template: string;
  /** Declarative spec or a first-party code hook. */
  readonly normalize: NormalizeSpec | CodeHook;
}

/**
 * A declarative adapter: a subset of capabilities, each a {@link CapabilitySpec}.
 * Capabilities not present report `unsupported`. Binary (readFile/writeFile),
 * void-only (mkdir/mv/…) and multi-step (serviceAction) capabilities are not
 * expressible declaratively yet and require a {@link CodeHook}.
 */
export type AdapterManifest = Partial<Record<keyof Capabilities, CapabilitySpec>>;

function coerce(raw: string, col: ColumnSpec): unknown {
  if (col.enum) return col.enum[raw] ?? col.enumDefault ?? raw;
  switch (col.type) {
    case 'int':
      return Number.parseInt(raw, 10) || 0;
    case 'octal':
      return Number.parseInt(raw, 8) || 0;
    case 'epochSeconds':
      return Math.round(Number.parseFloat(raw) * 1000) || 0;
    default:
      return raw;
  }
}

function normalizeRow(row: string, spec: RecordsNormalizeSpec): Record<string, unknown> {
  const parts = row.split(spec.columnDelimiter);
  if (parts.length < spec.columns.length) throw new Error(`Unexpected adapter output: ${row}`);
  const out: Record<string, unknown> = {};
  spec.columns.forEach((col, i) => {
    const raw = col.rest ? parts.slice(i).join(spec.columnDelimiter) : (parts[i] ?? '');
    out[col.field] = coerce(raw, col);
  });
  return out;
}

/** Parse delimiter-separated output into a typed record list (one object per row). */
export function normalizeRecords(
  stdout: string,
  spec: RecordsNormalizeSpec,
): Record<string, unknown>[] {
  return stdout
    .split(spec.rowDelimiter ?? '\n')
    .filter((row) => row.length > 0)
    .map((row) => normalizeRow(row, spec));
}

/** Substitute `{param}` holes with `quote()`-escaped values; constants stay literal. */
function interpolate(template: string, params: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (!(name in params)) throw new Error(`Manifest template references unknown param {${name}}`);
    return quote(params[name] ?? '');
  });
}

/** A {@link Capabilities} implementation driven entirely by an {@link AdapterManifest}. */
export class ManifestAdapter implements Capabilities {
  constructor(
    private readonly exec: CommandExecutor,
    private readonly manifest: AdapterManifest,
  ) {}

  /** Resolve a capability's spec, interpolate its command, and parse via the shared harness. */
  private run<T>(
    cap: keyof Capabilities,
    params: Readonly<Record<string, string>> = {},
  ): Promise<CapabilityResult<T>> {
    const spec = this.manifest[cap];
    if (!spec) {
      return Promise.resolve(unsupported<T>(`${cap} is not implemented by this adapter`));
    }
    const command = interpolate(spec.template, params);
    const { normalize } = spec;
    const parse = (stdout: string): T =>
      (typeof normalize === 'function'
        ? normalize(stdout)
        : normalizeRecords(stdout, normalize)) as T;
    return runParsed(this.exec, command, parse);
  }

  listDir(path: string): Promise<CapabilityResult<readonly FileEntry[]>> {
    return this.run('listDir', { path });
  }

  stat(path: string): Promise<CapabilityResult<FileEntry>> {
    return this.run('stat', { path });
  }

  readFile(path: string): Promise<CapabilityResult<Uint8Array>> {
    return this.run('readFile', { path });
  }

  writeFile(path: string): Promise<CapabilityResult<void>> {
    // Binary payloads need a code hook; declaratively unsupported.
    return this.run('writeFile', { path });
  }

  makeDir(path: string): Promise<CapabilityResult<void>> {
    return this.run('makeDir', { path });
  }

  createFile(path: string): Promise<CapabilityResult<void>> {
    return this.run('createFile', { path });
  }

  move(from: string, to: string): Promise<CapabilityResult<void>> {
    return this.run('move', { from, to });
  }

  copy(from: string, to: string): Promise<CapabilityResult<void>> {
    return this.run('copy', { from, to });
  }

  remove(path: string): Promise<CapabilityResult<void>> {
    return this.run('remove', { path });
  }

  systemMetrics(): Promise<CapabilityResult<SystemMetrics>> {
    return this.run('systemMetrics');
  }

  systemInfo(): Promise<CapabilityResult<SystemInfo>> {
    return this.run('systemInfo');
  }

  listProcesses(): Promise<CapabilityResult<readonly Process[]>> {
    return this.run('listProcesses');
  }

  signalProcess(pid: number, signal: ProcessSignal): Promise<CapabilityResult<void>> {
    return this.run('signalProcess', { pid: String(Math.trunc(pid)), signal });
  }

  serviceAction(name: string, action: ServiceAction): Promise<CapabilityResult<ServiceState>> {
    return this.run('serviceAction', { name, action });
  }

  listServices(): Promise<CapabilityResult<readonly ServiceState[]>> {
    return this.run('listServices');
  }
}
