import { describe, it, expect } from 'vitest';
import { keyAlgorithm } from './ssh-session.js';

/** Build an SSH key blob: uint32 length + algorithm name + (ignored) key data. */
function keyBlob(algorithm: string): Buffer {
  const name = Buffer.from(algorithm, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(name.length, 0);
  return Buffer.concat([len, name, Buffer.from([1, 2, 3, 4])]);
}

describe('keyAlgorithm', () => {
  it('reads the algorithm name from a host key blob', () => {
    expect(keyAlgorithm(keyBlob('ssh-ed25519'))).toBe('ssh-ed25519');
    expect(keyAlgorithm(keyBlob('ecdsa-sha2-nistp256'))).toBe('ecdsa-sha2-nistp256');
  });

  it('returns empty string for malformed buffers', () => {
    expect(keyAlgorithm(Buffer.from([0, 0]))).toBe('');
    const lying = Buffer.alloc(4);
    lying.writeUInt32BE(999, 0);
    expect(keyAlgorithm(lying)).toBe('');
  });
});
