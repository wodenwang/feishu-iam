import { describe, expect, it } from 'vitest';
import {
  createAdminSessionSecret,
  hashAdminSessionSecret,
  timingSafeEqualAdminHash
} from '../src/admin/admin-session-crypto';

describe('admin-session-crypto', () => {
  it('生成 bias_ 前缀 session secret，且只用 hash 校验', () => {
    const secret = createAdminSessionSecret();
    const other = createAdminSessionSecret();
    const hash = hashAdminSessionSecret(secret);

    expect(secret).toMatch(/^bias_[A-Za-z0-9_-]{32,}$/);
    expect(other).not.toBe(secret);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(secret);
    expect(timingSafeEqualAdminHash(secret, hash)).toBe(true);
    expect(timingSafeEqualAdminHash(`${secret}x`, hash)).toBe(false);
  });
});
