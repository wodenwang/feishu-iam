import { Injectable } from '@nestjs/common';
import type {
  FeishuClient,
  ListDepartmentChildrenParams,
  ListDepartmentUsersParams
} from './feishu-client';
import type { FeishuOAuthUserIdentity } from './feishu-oauth.types';
import {
  FeishuClientError,
  type FeishuDepartmentItem,
  type FeishuPage,
  type FeishuUserItem
} from './feishu.types';

type TenantTokenResponse = {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
};

type FeishuListResponse<T> = {
  code: number;
  msg: string;
  data?: T;
};

type FeishuOAuthTokenData = {
  access_token?: string;
  user_access_token?: string;
};

type FeishuOAuthTokenResponse = FeishuListResponse<FeishuOAuthTokenData> & {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type FeishuOAuthUserData = {
  sub?: string;
  user_id?: string;
  open_id?: string;
  union_id?: string;
  name?: string;
  avatar_url?: string;
  user?: {
    sub?: string;
    user_id?: string;
    open_id?: string;
    union_id?: string;
    name?: string;
    avatar_url?: string;
  };
};

type DepartmentChildrenData = {
  items?: FeishuDepartmentItem[];
  has_more?: boolean;
  page_token?: string;
};

type DepartmentUsersData = {
  items?: FeishuUserItem[];
  has_more?: boolean;
  page_token?: string;
};

@Injectable()
export class FeishuHttpClient implements FeishuClient {
  private cachedToken: { value: string; expiresAt: number } | undefined;
  private readonly baseUrl = 'https://open.feishu.cn/open-apis';
  private readonly oauthAuthorizeBaseUrl = 'https://accounts.feishu.cn/open-apis';

  buildOAuthAuthorizeUrl(params: { state: string; redirectUri: string }): string {
    const appId = process.env.FEISHU_APP_ID;
    if (!appId) {
      throw new FeishuClientError('FEISHU_CONFIG_MISSING', '飞书应用配置缺失');
    }

    const url = new URL(`${this.oauthAuthorizeBaseUrl}/authen/v1/authorize`);
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('state', params.state);
    url.searchParams.set('response_type', 'code');
    return url.toString();
  }

  async exchangeOAuthCode(code: string, redirectUriOverride?: string): Promise<FeishuOAuthUserIdentity> {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    const redirectUri = redirectUriOverride ?? process.env.FEISHU_OAUTH_REDIRECT_URI;
    if (!appId || !appSecret || !redirectUri) {
      throw new FeishuClientError('FEISHU_CONFIG_MISSING', '飞书应用配置缺失');
    }

    const response = await this.postJson<FeishuOAuthTokenResponse>(
      '/authen/v2/oauth/token',
      {
        grant_type: 'authorization_code',
        code,
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri
      }
    );
    const accessToken =
      response.access_token ?? response.data?.access_token ?? response.data?.user_access_token;

    if (response.code !== 0 || !accessToken) {
      throw this.toClientError(
        response.code,
        response.code === 0
          ? '飞书 token 响应缺少 access_token'
          : response.error_description ?? response.error ?? response.msg,
        '/authen/v2/oauth/token',
        undefined,
        {
          response_keys: Object.keys(response).sort(),
          data_keys: response.data ? Object.keys(response.data).sort() : undefined
        }
      );
    }

    const user = await this.getOAuthUserInfo(accessToken);
    if (!user.user_id && !user.open_id && !user.union_id && !user.sub) {
      throw new FeishuClientError('FEISHU_API_ERROR', '飞书 OAuth 响应缺少用户标识', {
        path: '/authen/v1/user_info'
      });
    }

    return {
      sub: user.sub,
      user_id: user.user_id,
      open_id: user.open_id,
      union_id: user.union_id,
      name: user.name,
      avatar_url: user.avatar_url
    };
  }

  private async getOAuthUserInfo(accessToken: string): Promise<FeishuOAuthUserData> {
    const path = '/authen/v1/user_info';
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
    } catch (error) {
      throw new FeishuClientError('FEISHU_NETWORK_ERROR', '飞书接口网络请求失败', {
        path,
        cause: error instanceof Error ? error.message : String(error)
      });
    }

    const payload = await this.readJsonResponse<FeishuListResponse<FeishuOAuthUserData>>(response, path);
    if (!response.ok || payload.code !== 0 || !payload.data) {
      throw this.toClientError(payload.code, payload.msg, path, response.headers.get('x-request-id'));
    }

    return payload.data.user ?? payload.data;
  }

  async getTenantAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt - now > 30 * 60 * 1000) {
      return this.cachedToken.value;
    }

    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    if (!appId || !appSecret) {
      throw new FeishuClientError('FEISHU_CONFIG_MISSING', '飞书应用配置缺失');
    }

    const response = await this.postJson<TenantTokenResponse>(
      '/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret
      }
    );

    if (response.code !== 0 || !response.tenant_access_token || !response.expire) {
      throw this.toClientError(response.code, response.msg, '/auth/v3/tenant_access_token/internal');
    }

    this.cachedToken = {
      value: response.tenant_access_token,
      expiresAt: now + response.expire * 1000
    };
    return response.tenant_access_token;
  }

  async listDepartmentChildren(
    params: ListDepartmentChildrenParams
  ): Promise<FeishuPage<FeishuDepartmentItem>> {
    const departmentIdType = this.resolveDepartmentIdType(params.departmentId);
    const data = await this.getPaged<DepartmentChildrenData>(
      `/contact/v3/departments/${encodeURIComponent(params.departmentId)}/children`,
      {
        department_id_type: departmentIdType,
        user_id_type: 'user_id',
        page_size: String(params.pageSize ?? 50),
        page_token: params.pageToken
      }
    );

    return {
      items: data.items ?? [],
      hasMore: data.has_more === true,
      pageToken: data.page_token
    };
  }

  async listDepartmentUsers(params: ListDepartmentUsersParams): Promise<FeishuPage<FeishuUserItem>> {
    const departmentIdType = this.resolveDepartmentIdType(params.departmentId);
    const data = await this.getPaged<DepartmentUsersData>('/contact/v3/users/find_by_department', {
      department_id: params.departmentId,
      department_id_type: departmentIdType,
      user_id_type: 'user_id',
      page_size: String(params.pageSize ?? 50),
      page_token: params.pageToken
    });

    return {
      items: data.items ?? [],
      hasMore: data.has_more === true,
      pageToken: data.page_token
    };
  }

  private resolveDepartmentIdType(departmentId: string): 'department_id' | 'open_department_id' {
    return departmentId === '0' || departmentId.startsWith('od-') ? 'open_department_id' : 'department_id';
  }

  private async getPaged<T>(path: string, query: Record<string, string | undefined>): Promise<T> {
    const token = await this.getTenantAccessToken();
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value.length > 0) {
        url.searchParams.set(key, value);
      }
    });

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      throw new FeishuClientError('FEISHU_NETWORK_ERROR', '飞书接口网络请求失败', {
        path,
        cause: error instanceof Error ? error.message : String(error)
      });
    }

    const payload = await this.readJsonResponse<FeishuListResponse<T>>(response, path);
    if (!response.ok || payload.code !== 0 || !payload.data) {
      throw this.toClientError(payload.code, payload.msg, path, response.headers.get('x-request-id'));
    }
    return payload.data;
  }

  private async postJson<T>(
    path: string,
    body: Record<string, string>,
    headers: Record<string, string> = {}
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...headers
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new FeishuClientError('FEISHU_NETWORK_ERROR', '飞书 token 请求失败', {
        path,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
    return this.readJsonResponse<T>(response, path);
  }

  private async readJsonResponse<T>(response: Response, path: string): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new FeishuClientError('FEISHU_API_ERROR', '飞书接口返回非 JSON 响应', {
        path,
        status: response.status,
        request_id: response.headers.get('x-request-id') ?? undefined
      });
    }
  }

  private toClientError(
    feishuCode: number,
    message: string | undefined,
    path: string,
    requestId?: string | null,
    detail?: Record<string, unknown>
  ): FeishuClientError {
    const code =
      feishuCode === 99991663 || feishuCode === 99991664
        ? 'FEISHU_PERMISSION_DENIED'
        : 'FEISHU_API_ERROR';
    return new FeishuClientError(code, message || '飞书接口返回错误', {
      feishu_code: feishuCode,
      path,
      request_id: requestId ?? undefined,
      ...detail
    });
  }
}
