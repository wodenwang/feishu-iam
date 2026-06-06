import { OauthDomainError, type OauthEnvironmentKey } from './oauth.types';

const ENVIRONMENT_KEYS: OauthEnvironmentKey[] = ['dev', 'test', 'prod'];

export function assertEnvironmentKey(value: string): asserts value is OauthEnvironmentKey {
  if (!ENVIRONMENT_KEYS.includes(value as OauthEnvironmentKey)) {
    throw new OauthDomainError('OAUTH_ENVIRONMENT_KEY_INVALID', '环境 key 必须是 dev、test 或 prod', 422);
  }
}

export function assertRedirectUri(redirectUri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new OauthDomainError('OAUTH_REDIRECT_URI_INVALID', '回调地址必须是完整 URL', 400);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OauthDomainError('OAUTH_REDIRECT_URI_INVALID', '回调地址只支持 HTTP 或 HTTPS', 400);
  }

  if (parsed.hostname.includes('*') || parsed.pathname.includes('*') || parsed.search.includes('*')) {
    throw new OauthDomainError('OAUTH_REDIRECT_URI_WILDCARD_UNSUPPORTED', '回调地址不支持通配符', 400);
  }
}
