import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedClientSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: 'aes-256-gcm';
};

const ALGORITHM = 'aes-256-gcm' as const;
const KEY_BYTES = 32;
const IV_BYTES = 12;

export class ClientSecretVault {
  private readonly key: Buffer;

  constructor(rawKey = process.env.CLIENT_SECRET_ENCRYPTION_KEY ?? '') {
    if (rawKey.length !== KEY_BYTES) {
      throw new Error('CLIENT_SECRET_ENCRYPTION_KEY_INVALID');
    }
    this.key = Buffer.from(rawKey, 'utf8');
  }

  encrypt(secret: string): EncryptedClientSecret {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      algorithm: ALGORITHM
    };
  }

  decrypt(input: EncryptedClientSecret): string {
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(input.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(input.authTag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(input.ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
  }
}
