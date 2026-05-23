import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('parseEnv', () => {
  it('parses a valid local mock runtime config', () => {
    expect(
      parseEnv({
        NODE_ENV: 'development',
        PORT: '4100',
        DATABASE_URL: 'postgres://feishu_iam:feishu_iam@127.0.0.1:5432/feishu_iam_test',
        SESSION_COOKIE_NAME: 'iam_session',
        SESSION_SECRET: 'test-session-secret-at-least-32-bytes',
        FEISHU_AUTH_MODE: 'mock',
      }),
    ).toMatchObject({
      nodeEnv: 'development',
      port: 4100,
      feishuAuthMode: 'mock',
    });
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() =>
      parseEnv({
        SESSION_SECRET: 'test-session-secret-at-least-32-bytes',
        FEISHU_AUTH_MODE: 'mock',
      }),
    ).toThrow('DATABASE_URL is required');
  });

  it('rejects mock Feishu auth in production', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://example',
        SESSION_SECRET: 'test-session-secret-at-least-32-bytes',
        FEISHU_AUTH_MODE: 'mock',
      }),
    ).toThrow('FEISHU_AUTH_MODE=mock is not allowed in production');
  });

  it('rejects real Feishu auth without Feishu credentials', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://example',
        SESSION_SECRET: 'test-session-secret-at-least-32-bytes',
        FEISHU_AUTH_MODE: 'real',
      }),
    ).toThrow('FEISHU_APP_ID is required when FEISHU_AUTH_MODE=real');
  });
});
