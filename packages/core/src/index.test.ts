import { describe, it, expect } from 'vitest';
import { CORE_PACKAGE } from './index';

describe('@deskssh/core', () => {
  it('exposes its package name', () => {
    expect(CORE_PACKAGE).toBe('@deskssh/core');
  });
});
