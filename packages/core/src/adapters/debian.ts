// Debian/Ubuntu/Mint adapter (Tier 1, the only v1 host family). Implements the
// capability contract using machine-readable command output (Art. 6/10): `find
// -printf` and `stat --printf` with tab-separated fields, /proc for metrics, and
// base64 for binary-safe file transfer over exec.
//
// Parsers are pure functions (exported for unit testing); the adapter wires each
// capability to a command + parser through the runParsed harness (Art. 7).

import type { CommandExecutor } from '../exec/types.js';
import type { Capabilities } from '../contract/capabilities.js';
import type { CapabilityResult } from '../contract/result.js';
import { ok, runParsed, unsupported } from '../contract/result.js';
import type { FileEntry, FileType, SystemMetrics } from '../contract/types.js';
import { quote } from './shell.js';

const FIND_PRINTF = String.raw`%y\t%s\t%m\t%u\t%g\t%T@\t%f\n`;
const STAT_PRINTF = String.raw`%F\t%s\t%a\t%U\t%G\t%Y\t%n`;

function fileTypeFromFindCode(code: string): FileType {
  switch (code) {
    case 'f':
      return 'file';
    case 'd':
      return 'directory';
    case 'l':
      return 'symlink';
    default:
      return 'other';
  }
}

function fileTypeFromStatWord(word: string): FileType {
  if (word === 'directory') return 'directory';
  if (word === 'symbolic link') return 'symlink';
  if (word.endsWith('file')) return 'file';
  return 'other';
}

function epochSecondsToMs(value: string): number {
  return Math.round(parseFloat(value) * 1000);
}

/** Parse one `find -printf FIND_PRINTF` line into a FileEntry. */
export function parseFindLine(line: string): FileEntry {
  const parts = line.split('\t');
  if (parts.length < 7) throw new Error(`Unexpected find output: ${line}`);
  const [type, size, mode, owner, group, mtime] = parts;
  // %f is last; rejoin in case a name contained a tab.
  const name = parts.slice(6).join('\t');
  return {
    name,
    type: fileTypeFromFindCode(type ?? ''),
    size: Number.parseInt(size ?? '', 10) || 0,
    mode: Number.parseInt(mode ?? '', 8) || 0,
    owner: owner ?? '',
    group: group ?? '',
    mtime: epochSecondsToMs(mtime ?? '0'),
  };
}

/** Parse full `find -printf` output into a FileEntry list (skips blank lines). */
export function parseListDir(stdout: string): FileEntry[] {
  return stdout
    .split('\n')
    .filter((line) => line.length > 0)
    .map(parseFindLine);
}

/** Parse `stat --printf STAT_PRINTF` output into a FileEntry. */
export function parseStat(stdout: string): FileEntry {
  const parts = stdout.split('\t');
  if (parts.length < 7) throw new Error(`Unexpected stat output: ${stdout}`);
  const [typeWord, size, mode, owner, group, mtime] = parts;
  const fullPath = parts.slice(6).join('\t');
  const name = fullPath.replace(/\/+$/, '').split('/').pop() ?? fullPath;
  return {
    name,
    type: fileTypeFromStatWord(typeWord ?? ''),
    size: Number.parseInt(size ?? '', 10) || 0,
    mode: Number.parseInt(mode ?? '', 8) || 0,
    owner: owner ?? '',
    group: group ?? '',
    mtime: (Number.parseInt(mtime ?? '0', 10) || 0) * 1000,
  };
}

function kvFromMeminfo(meminfo: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of meminfo.split('\n')) {
    const match = /^(\w+):\s+(\d+)\s*kB$/.exec(line.trim());
    if (match && match[1] && match[2]) map.set(match[1], Number.parseInt(match[2], 10) * 1024);
  }
  return map;
}

/**
 * Parse the combined /proc snapshot produced by {@link METRICS_COMMAND}. Sections
 * are delimited by marker lines so a single round trip yields uptime, loadavg and
 * memory (Art. 8).
 */
export function parseSystemMetrics(stdout: string): SystemMetrics {
  const sections = new Map<string, string>();
  let current = '';
  const buffer: Record<string, string[]> = {};
  for (const line of stdout.split('\n')) {
    const marker = /^===(\w+)===$/.exec(line);
    if (marker && marker[1]) {
      current = marker[1];
      buffer[current] = [];
      continue;
    }
    if (current) (buffer[current] ??= []).push(line);
  }
  for (const [key, lines] of Object.entries(buffer)) sections.set(key, lines.join('\n'));

  const uptime = sections.get('UPTIME')?.trim().split(/\s+/)[0];
  const load = sections.get('LOAD')?.trim().split(/\s+/) ?? [];
  const mem = kvFromMeminfo(sections.get('MEM') ?? '');

  const total = mem.get('MemTotal') ?? 0;
  const available = mem.get('MemAvailable') ?? 0;
  if (uptime === undefined || load.length < 3) throw new Error('Incomplete metrics output');

  return {
    uptimeSeconds: Math.round(parseFloat(uptime)),
    loadAverage: [
      parseFloat(load[0] ?? '0'),
      parseFloat(load[1] ?? '0'),
      parseFloat(load[2] ?? '0'),
    ],
    memory: {
      totalBytes: total,
      usedBytes: Math.max(0, total - available),
      availableBytes: available,
    },
  };
}

const METRICS_COMMAND =
  'echo ===UPTIME===; cat /proc/uptime; ' +
  'echo ===LOAD===; cat /proc/loadavg; ' +
  'echo ===MEM===; cat /proc/meminfo';

export class DebianAdapter implements Capabilities {
  constructor(private readonly exec: CommandExecutor) {}

  listDir(path: string): Promise<CapabilityResult<readonly FileEntry[]>> {
    const cmd = `find ${quote(path)} -maxdepth 1 -mindepth 1 -printf ${quote(FIND_PRINTF)}`;
    return runParsed(this.exec, cmd, parseListDir);
  }

  stat(path: string): Promise<CapabilityResult<FileEntry>> {
    return runParsed(this.exec, `stat --printf ${quote(STAT_PRINTF)} ${quote(path)}`, parseStat);
  }

  async readFile(path: string): Promise<CapabilityResult<Uint8Array>> {
    return runParsed(this.exec, `base64 -w0 ${quote(path)}`, (b64) =>
      Uint8Array.from(Buffer.from(b64.trim(), 'base64')),
    );
  }

  writeFile(path: string, contents: Uint8Array): Promise<CapabilityResult<void>> {
    const b64 = Buffer.from(contents).toString('base64');
    return this.runVoid(`printf %s ${quote(b64)} | base64 -d > ${quote(path)}`);
  }

  makeDir(path: string): Promise<CapabilityResult<void>> {
    return this.runVoid(`mkdir -p ${quote(path)}`);
  }

  createFile(path: string): Promise<CapabilityResult<void>> {
    return this.runVoid(`touch ${quote(path)}`);
  }

  move(from: string, to: string): Promise<CapabilityResult<void>> {
    return this.runVoid(`mv -n ${quote(from)} ${quote(to)}`);
  }

  copy(from: string, to: string): Promise<CapabilityResult<void>> {
    return this.runVoid(`cp -a -n ${quote(from)} ${quote(to)}`);
  }

  remove(path: string): Promise<CapabilityResult<void>> {
    return this.runVoid(`rm -rf ${quote(path)}`);
  }

  /** Run a command whose only outcome is success/failure (no parsed value). */
  private async runVoid(command: string): Promise<CapabilityResult<void>> {
    const { stdout, stderr, exitCode } = await this.exec.exec(command);
    if (exitCode !== 0) {
      return {
        kind: 'failed',
        raw: stderr || stdout,
        exitCode,
        reason: stderr.trim() || 'command failed',
      };
    }
    return ok(undefined, stdout);
  }

  systemMetrics(): Promise<CapabilityResult<SystemMetrics>> {
    return runParsed(this.exec, METRICS_COMMAND, parseSystemMetrics);
  }

  listProcesses(): Promise<CapabilityResult<never>> {
    return Promise.resolve(unsupported('listProcesses is a post-v1 capability'));
  }

  listServices(): Promise<CapabilityResult<never>> {
    return Promise.resolve(unsupported('listServices is a post-v1 capability'));
  }
}
