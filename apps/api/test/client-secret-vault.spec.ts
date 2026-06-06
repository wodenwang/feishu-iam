import { describe, expect, it } from 'vitest';
import { ClientSecretVault } from '../src/oauth/client-secret-vault';

describe('ClientSecretVault', () => {
  it('encrypts and decrypts client secret without returning plaintext ciphertext', () => {
    const vault = new ClientSecretVault('0123456789abcdef0123456789abcdef');
    const encrypted = vault.encrypt('bics_test_secret');

    expect(encrypted.ciphertext).not.toContain('bics_test_secret');
    expect(encrypted.algorithm).toBe('aes-256-gcm');
    expect(vault.decrypt(encrypted)).toBe('bics_test_secret');
  });

  it('rejects invalid encryption keys', () => {
    expect(() => new ClientSecretVault('short')).toThrow('CLIENT_SECRET_ENCRYPTION_KEY_INVALID');
  });
});
