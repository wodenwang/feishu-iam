import { HttpError } from '../errors/httpError';
import type { FeishuAuthAdapter, FeishuUserIdentity } from './feishuAuthAdapter';

interface RealFeishuAuthAdapterOptions {
  appId: string;
  appSecret: string;
}

export class RealFeishuAuthAdapter implements FeishuAuthAdapter {
  constructor(private readonly options: RealFeishuAuthAdapterOptions) {}

  async resolveMockUser(): Promise<FeishuUserIdentity> {
    throw new HttpError(404, 'NOT_FOUND', 'Not found');
  }

  buildAuthorizationUrl(input: { state: string; redirectUri: string }): string {
    const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
    url.searchParams.set('client_id', this.options.appId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('state', input.state);
    return url.toString();
  }

  async exchangeCodeForUser(input: { code: string; redirectUri: string }): Promise<FeishuUserIdentity> {
    const token = await this.exchangeCodeForToken(input);
    return this.fetchUserInfo(token);
  }

  private async exchangeCodeForToken(input: { code: string; redirectUri: string }): Promise<string> {
    const response = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.options.appId,
        client_secret: this.options.appSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new HttpError(502, 'FEISHU_TOKEN_EXCHANGE_FAILED', '飞书授权码换取访问令牌失败', { status: response.status });
    }

    const token = readNestedString(payload, ['access_token']) ?? readNestedString(payload, ['data', 'access_token']);
    const code = readNestedNumber(payload, ['code']);
    if (code !== undefined && code !== 0) {
      throw new HttpError(502, 'FEISHU_TOKEN_EXCHANGE_FAILED', '飞书授权码换取访问令牌失败', {
        feishuCode: code,
        feishuMessage: readNestedString(payload, ['msg']) ?? readNestedString(payload, ['message']),
      });
    }
    if (!token) {
      throw new HttpError(502, 'FEISHU_TOKEN_EXCHANGE_FAILED', '飞书授权码换取访问令牌失败');
    }
    return token;
  }

  private async fetchUserInfo(userAccessToken: string): Promise<FeishuUserIdentity> {
    const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
      headers: { authorization: `Bearer ${userAccessToken}` },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new HttpError(502, 'FEISHU_USER_INFO_FAILED', '飞书用户信息获取失败', { status: response.status });
    }

    const code = readNestedNumber(payload, ['code']);
    if (code !== undefined && code !== 0) {
      throw new HttpError(502, 'FEISHU_USER_INFO_FAILED', '飞书用户信息获取失败', {
        feishuCode: code,
        feishuMessage: readNestedString(payload, ['msg']) ?? readNestedString(payload, ['message']),
      });
    }

    const data = readNestedObject(payload, ['data']) ?? readNestedObject(payload, []);
    const feishuUserId =
      readNestedString(data, ['user_id']) ?? readNestedString(data, ['open_id']) ?? readNestedString(data, ['union_id']);
    const name = readNestedString(data, ['name']) ?? readNestedString(data, ['en_name']) ?? readNestedString(data, ['nickname']);
    if (!feishuUserId || !name) {
      throw new HttpError(502, 'FEISHU_USER_INFO_INVALID', '飞书用户信息缺少用户标识或姓名');
    }

    return {
      feishuUserId,
      name,
      email: readNestedString(data, ['email']),
      status: 'active',
    };
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HttpError(502, 'FEISHU_INVALID_JSON_RESPONSE', '飞书接口返回格式无效');
  }
}

function readNestedObject(payload: unknown, path: string[]): Record<string, unknown> | undefined {
  const value = path.reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, payload);
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function readNestedString(payload: unknown, path: string[]): string | undefined {
  const value = path.reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, payload);
  return typeof value === 'string' && value ? value : undefined;
}

function readNestedNumber(payload: unknown, path: string[]): number | undefined {
  const value = path.reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, payload);
  return typeof value === 'number' ? value : undefined;
}
