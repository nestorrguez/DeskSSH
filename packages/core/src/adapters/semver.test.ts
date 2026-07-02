import { describe, it, expect } from 'vitest';
import { parseSemVer, compareSemVer, satisfies } from './semver.js';

describe('parseSemVer', () => {
  it('parses x.y.z', () => {
    expect(parseSemVer('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemVer(' 0.1.0 ')).toEqual({ major: 0, minor: 1, patch: 0 });
  });

  it('throws on malformed input', () => {
    expect(() => parseSemVer('1.2')).toThrow();
    expect(() => parseSemVer('v1.2.3')).toThrow();
    expect(() => parseSemVer('1.2.x')).toThrow();
  });
});

describe('compareSemVer', () => {
  it('orders by major, then minor, then patch', () => {
    const p = parseSemVer;
    expect(compareSemVer(p('1.0.0'), p('1.0.0'))).toBe(0);
    expect(compareSemVer(p('1.2.0'), p('1.10.0'))).toBe(-1);
    expect(compareSemVer(p('2.0.0'), p('1.9.9'))).toBe(1);
    expect(compareSemVer(p('1.2.3'), p('1.2.4'))).toBe(-1);
  });
});

describe('satisfies', () => {
  it('wildcard and empty match anything', () => {
    expect(satisfies('9.9.9', '*')).toBe(true);
    expect(satisfies('0.0.1', '')).toBe(true);
  });

  it('exact ranges match only the same version', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.4', '1.2.3')).toBe(false);
  });

  it('caret on 1.x allows minor/patch up, not the next major', () => {
    expect(satisfies('1.2.3', '^1.2.0')).toBe(true);
    expect(satisfies('1.9.9', '^1.2.0')).toBe(true);
    expect(satisfies('2.0.0', '^1.2.0')).toBe(false);
    expect(satisfies('1.1.9', '^1.2.0')).toBe(false);
  });

  it('caret on 0.x is patch-loose within the same minor (npm 0.x rules)', () => {
    expect(satisfies('0.1.0', '^0.1.0')).toBe(true);
    expect(satisfies('0.1.9', '^0.1.0')).toBe(true);
    expect(satisfies('0.2.0', '^0.1.0')).toBe(false);
  });

  it('caret on 0.0.x pins the patch', () => {
    expect(satisfies('0.0.3', '^0.0.3')).toBe(true);
    expect(satisfies('0.0.4', '^0.0.3')).toBe(false);
  });

  it('tilde allows patch up within the same minor', () => {
    expect(satisfies('1.2.9', '~1.2.0')).toBe(true);
    expect(satisfies('1.3.0', '~1.2.0')).toBe(false);
  });

  it('throws on unparseable bounds', () => {
    expect(() => satisfies('1.2.3', '^1.2')).toThrow();
  });
});
