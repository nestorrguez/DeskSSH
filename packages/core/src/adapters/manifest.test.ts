import { describe, it, expect } from 'vitest';
import { ManifestAdapter, normalizeRecords, type AdapterManifest } from './manifest.js';
import { debianManifest } from './debian.manifest.js';
import { DebianAdapter } from './debian.js';
import { FakeExecutor, okResult } from '../test/fake-executor.js';

const FIND_OUT =
  'd\t4096\t755\troot\troot\t1700000000.5\tetc\n' +
  'f\t12\t644\troot\troot\t1700000001\thosts\n' +
  'l\t10\t777\troot\troot\t0\tlink\ttab\n';

const METRICS_OUT = [
  '===UPTIME===',
  '12345.67 98765.43',
  '===LOAD===',
  '0.10 0.20 0.30 1/200 1234',
  '===MEM===',
  'MemTotal:       8000000 kB',
  'MemAvailable:   2000000 kB',
].join('\n');

describe('normalizeRecords', () => {
  it('splits rows/columns, coerces types and maps enums', () => {
    const spec = {
      kind: 'records' as const,
      columnDelimiter: '\t',
      columns: [
        { field: 'type', enum: { f: 'file' }, enumDefault: 'other' },
        { field: 'size', type: 'int' as const },
        { field: 'name', rest: true },
      ],
    };
    const rows = normalizeRecords('f\t12\ta\tb\ns\t0\tsock\n', spec);
    expect(rows).toEqual([
      { type: 'file', size: 12, name: 'a\tb' },
      { type: 'other', size: 0, name: 'sock' },
    ]);
  });

  it('throws on a short row so the harness can degrade (Art. 7)', () => {
    const spec = {
      kind: 'records' as const,
      columnDelimiter: '\t',
      columns: [{ field: 'a' }, { field: 'b' }],
    };
    expect(() => normalizeRecords('only-one', spec)).toThrow();
  });
});

describe('ManifestAdapter', () => {
  it('quote-escapes interpolated params (injection-safe)', async () => {
    const exec = new FakeExecutor().on('find', okResult(''));
    await new ManifestAdapter(exec, debianManifest).listDir("/tmp/a'b");
    expect(exec.commands[0]).toContain("find '/tmp/a'\\''b' -maxdepth 1");
  });

  it('reports unsupported for capabilities absent from the manifest', async () => {
    const adapter = new ManifestAdapter(new FakeExecutor(), debianManifest);
    expect((await adapter.stat('/etc')).kind).toBe('unsupported');
    expect((await adapter.listProcesses()).kind).toBe('unsupported');
  });

  it('degrades (not throws) when the command output is malformed', async () => {
    const exec = new FakeExecutor().on('find', okResult('garbage-without-tabs\n'));
    const result = await new ManifestAdapter(exec, debianManifest).listDir('/etc');
    expect(result.kind).toBe('degraded');
    if (result.kind === 'degraded') expect(result.raw).toBe('garbage-without-tabs\n');
  });

  it('surfaces a failed command as failed', async () => {
    const exec = new FakeExecutor().on('find', { stdout: '', stderr: 'denied', exitCode: 1 });
    const result = await new ManifestAdapter(exec, debianManifest).listDir('/root');
    expect(result.kind).toBe('failed');
  });

  it('runs a code-hook capability that absorbs unknown params', async () => {
    const manifest: AdapterManifest = {
      systemMetrics: { template: 'true', normalize: (out) => ({ raw: out }) },
    };
    const exec = new FakeExecutor().on('true', okResult('hello'));
    const result = await new ManifestAdapter(exec, manifest).systemMetrics();
    expect(result.kind).toBe('ok');
  });
});

// The core of E2.3: the declarative manifest must produce the same typed output AND
// emit the same command as the hand-written reference adapter.
describe('parity: ManifestAdapter(debianManifest) vs DebianAdapter', () => {
  function pair(
    match: string,
    out: string,
  ): [DebianAdapter, ManifestAdapter, FakeExecutor, FakeExecutor] {
    const e1 = new FakeExecutor().on(match, okResult(out));
    const e2 = new FakeExecutor().on(match, okResult(out));
    return [new DebianAdapter(e1), new ManifestAdapter(e2, debianManifest), e1, e2];
  }

  it('listDir: identical entries and identical command', async () => {
    const [ref, man, e1, e2] = pair('find', FIND_OUT);
    const a = await ref.listDir('/etc');
    const b = await man.listDir('/etc');
    expect(b).toEqual(a);
    expect(e2.commands).toEqual(e1.commands);
  });

  it('systemMetrics: identical metrics and identical command', async () => {
    const [ref, man, e1, e2] = pair('proc', METRICS_OUT);
    const a = await ref.systemMetrics();
    const b = await man.systemMetrics();
    expect(b).toEqual(a);
    expect(e2.commands).toEqual(e1.commands);
  });
});
