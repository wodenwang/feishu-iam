import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createOauthSecret(prefix: 'biac' | 'biad' | 'biat' | 'bics' | 'bils'): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

export function hashOauthSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function timingSafeEqualHash(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOauthSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function redactSecret(value: string): string {
  if (value.length <= 12) {
    return '[redacted]';
  }

  return `${value.slice(0, 6)}[redacted]${value.slice(-4)}`;
}
