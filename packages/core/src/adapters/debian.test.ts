import { describe, it, expect } from 'vitest';
import {
  DebianAdapter,
  parseFindLine,
  parseListDir,
  parseStat,
  parseSystemMetrics,
} from './debian.js';
import { FakeExecutor, okResult } from '../test/fake-executor.js';

describe('parseFindLine', () => {
  it('parses a directory entry into a typed FileEntry', () => {
    const entry = parseFindLine('d\t4096\t755\troot\troot\t1700000000.5\tetc');
    expect(entry).toEqual({
      name: 'etc',
      type: 'directory',
      size: 4096,
      mode: 0o755,
      owner: 'root',
      group: 'root',
      mtime: 1700000000500,
    });
  });

  it('maps type codes and tolerates tabs in names', () => {
    expect(parseFindLine('f\t10\t644\tu\tg\t0\tplain').type).toBe('file');
    expect(parseFindLine('l\t10\t777\tu\tg\t0\tlink').type).toBe('symlink');
    expect(parseFindLine('s\t0\t644\tu\tg\t0\tsock').type).toBe('other');
    expect(parseFindLine('f\t1\t644\tu\tg\t0\ta\tb').name).toBe('a\tb');
  });

  it('throws on malformed lines (caught upstream as degraded)', () => {
    expect(() => parseFindLine('too\tfew')).toThrow();
  });
});

describe('parseListDir', () => {
  it('parses multiple lines and skips blanks', () => {
    const out =
      'd\t4096\t755\troot\troot\t1700000000\tetc\nf\t12\t644\troot\troot\t1700000001\thosts\n';
    const entries = parseListDir(out);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.name)).toEqual(['etc', 'hosts']);
  });
});

describe('parseStat', () => {
  it('parses stat output and derives the basename', () => {
    const entry = parseStat(
      'regular file\t512\t640\talice\tstaff\t1700000000\t/home/alice/.bashrc',
    );
    expect(entry.name).toBe('.bashrc');
    expect(entry.type).toBe('file');
    expect(entry.mode).toBe(0o640);
    expect(entry.owner).toBe('alice');
    expect(entry.mtime).toBe(1700000000000);
  });
});

describe('parseSystemMetrics', () => {
  it('parses the combined /proc snapshot', () => {
    const out = [
      '===UPTIME===',
      '12345.67 98765.43',
      '===LOAD===',
      '0.10 0.20 0.30 1/200 1234',
      '===MEM===',
      'MemTotal:       8000000 kB',
      'MemAvailable:   2000000 kB',
      'SwapTotal:      1000000 kB',
    ].join('\n');
    const metrics = parseSystemMetrics(out);
    expect(metrics.uptimeSeconds).toBe(12346);
    expect(metrics.loadAverage).toEqual([0.1, 0.2, 0.3]);
    expect(metrics.memory.totalBytes).toBe(8000000 * 1024);
    expect(metrics.memory.availableBytes).toBe(2000000 * 1024);
    expect(metrics.memory.usedBytes).toBe((8000000 - 2000000) * 1024);
  });
});

describe('DebianAdapter capabilities', () => {
  it('listDir returns ok with parsed entries', async () => {
    const exec = new FakeExecutor().on(
      'find',
      okResult('f\t12\t644\troot\troot\t1700000000\thosts\n'),
    );
    const adapter = new DebianAdapter(exec);
    const result = await adapter.listDir('/etc');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value[0]?.name).toBe('hosts');
    expect(exec.commands[0]).toContain("find '/etc' -maxdepth 1 -mindepth 1");
  });

  it('readFile decodes base64 into bytes', async () => {
    const payload = Buffer.from('hello').toString('base64');
    const exec = new FakeExecutor().on('base64 -w0', okResult(payload));
    const adapter = new DebianAdapter(exec);
    const result = await adapter.readFile('/tmp/f');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(Buffer.from(result.value).toString('utf8')).toBe('hello');
  });

  it('writeFile pipes base64 into the target path', async () => {
    const exec = new FakeExecutor().on('base64 -d', okResult(''));
    const adapter = new DebianAdapter(exec);
    const result = await adapter.writeFile('/tmp/f', new Uint8Array([104, 105]));
    expect(result.kind).toBe('ok');
    expect(exec.commands[0]).toContain('base64 -d');
    expect(exec.commands[0]).toContain("> '/tmp/f'");
  });

  it('makeDir creates parents, createFile touches', async () => {
    const exec = new FakeExecutor().on('mkdir', okResult('')).on('touch', okResult(''));
    const adapter = new DebianAdapter(exec);
    expect((await adapter.makeDir('/tmp/a/b')).kind).toBe('ok');
    expect((await adapter.createFile('/tmp/a/f')).kind).toBe('ok');
    expect(exec.commands[0]).toBe("mkdir -p '/tmp/a/b'");
    expect(exec.commands[1]).toBe("touch '/tmp/a/f'");
  });

  it('move and copy refuse to overwrite (-n)', async () => {
    const exec = new FakeExecutor().on('mv', okResult('')).on('cp', okResult(''));
    const adapter = new DebianAdapter(exec);
    expect((await adapter.move('/a', '/b')).kind).toBe('ok');
    expect((await adapter.copy('/a', '/b')).kind).toBe('ok');
    expect(exec.commands[0]).toBe("mv -n '/a' '/b'");
    expect(exec.commands[1]).toBe("cp -a -n '/a' '/b'");
  });

  it('remove deletes recursively, surfacing failures', async () => {
    const exec = new FakeExecutor().on('rm', {
      stdout: '',
      stderr: 'Permission denied',
      exitCode: 1,
    });
    const adapter = new DebianAdapter(exec);
    const result = await adapter.remove('/etc/passwd');
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') expect(result.reason).toBe('Permission denied');
    expect(exec.commands[0]).toBe("rm -rf '/etc/passwd'");
  });

  it('marks post-v1 capabilities as unsupported', async () => {
    const adapter = new DebianAdapter(new FakeExecutor());
    expect((await adapter.listProcesses()).kind).toBe('unsupported');
    expect((await adapter.listServices()).kind).toBe('unsupported');
  });
});
