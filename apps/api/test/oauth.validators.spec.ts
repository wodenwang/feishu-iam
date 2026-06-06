import { describe, expect, it } from 'vitest';
import { OauthDomainError } from '../src/oauth/oauth.types';
import { assertEnvironmentKey, assertRedirectUri } from '../src/oauth/oauth.validators';

function expectOauthDomainError(action: () => void, code: string, status: number): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(OauthDomainError);
    expect((error as OauthDomainError).code).toBe(code);
    expect((error as OauthDomainError).status).toBe(status);
    return;
  }

  throw new Error(`Expected OauthDomainError ${code}`);
}

describe('OAuth validators', () => {
  it('保留环境 key 校验的兼容导出', () => {
    expect(() => {
      assertEnvironmentKey('dev');
    }).not.toThrow();
    expectOauthDomainError(() => {
      assertEnvironmentKey('stage');
    }, 'OAUTH_ENVIRONMENT_KEY_INVALID', 422);
  });

  it('允许完整 http 和 https 回调地址，不再套用环境策略', () => {
    expect(() => {
      assertRedirectUri('http://localhost:5173/auth/callback');
    }).not.toThrow();
    expect(() => {
      assertRedirectUri('http://192.168.2.112:3000/callback');
    }).not.toThrow();
    expect(() => {
      assertRedirectUri('http://example.com/callback');
    }).not.toThrow();
    expect(() => {
      assertRedirectUri('https://app.example.com/auth/callback');
    }).not.toThrow();
  });

  it('拒绝无效、通配符和非 HTTP(S) 回调地址', () => {
    const invalidValues = [
      'not-a-url',
      'ftp://example.com/callback',
      'https://*.example.com/callback',
      'https://example.com/*',
      'https://example.com/callback?next=*',
      '/auth/callback'
    ];

    for (const value of invalidValues) {
      expect(() => {
        assertRedirectUri(value);
      }).toThrow(OauthDomainError);
    }
  });

  it('对无效 URL 和通配符返回稳定错误码', () => {
    expectOauthDomainError(() => {
      assertRedirectUri('not-a-url');
    }, 'OAUTH_REDIRECT_URI_INVALID', 400);
    expectOauthDomainError(() => {
      assertRedirectUri('https://*.example.com/callback');
    }, 'OAUTH_REDIRECT_URI_WILDCARD_UNSUPPORTED', 400);
  });
});
