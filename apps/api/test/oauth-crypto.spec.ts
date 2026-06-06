import { describe, expect, it } from 'vitest';
import { createOauthSecret, hashOauthSecret, timingSafeEqualHash } from '../src/oauth/oauth-crypto';

describe('OAuth crypto helpers', () => {
  it('generates prefixed secrets and verifies hashes without storing plaintext', () => {
    const secret = createOauthSecret('biat');
    const other = createOauthSecret('biat');
    const hash = hashOauthSecret(secret);

    expect(secret).toMatch(/^biat_[A-Za-z0-9_-]{32,}$/);
    expect(other).not.toBe(secret);
    expect(hash).not.toContain(secret);
    expect(timingSafeEqualHash(secret, hash)).toBe(true);
    expect(timingSafeEqualHash(`${secret}x`, hash)).toBe(false);
  });
});
