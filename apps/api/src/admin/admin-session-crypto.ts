import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createAdminSessionSecret(): string {
  return `bias_${randomBytes(32).toString('base64url')}`;
}

export function hashAdminSessionSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function timingSafeEqualAdminHash(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashAdminSessionSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
