import type {
  FeishuClient,
  ListDepartmentChildrenParams,
  ListDepartmentUsersParams
} from './feishu-client';
import type { FeishuOAuthUserIdentity } from './feishu-oauth.types';
import type { FeishuDepartmentItem, FeishuPage, FeishuUserItem } from './feishu.types';

export class MockFeishuClient implements FeishuClient {
  constructor(
    private readonly departmentsByParent: Record<string, FeishuDepartmentItem[]> = {},
    private readonly usersByDepartment: Record<string, FeishuUserItem[]> = {},
    private readonly oauthIdentity: FeishuOAuthUserIdentity = {
      user_id: 'mock-user-id',
      open_id: 'mock-open-id',
      union_id: 'mock-union-id',
      name: 'Mock User'
    }
  ) {}

  getTenantAccessToken(): Promise<string> {
    return Promise.resolve('mock-tenant-access-token');
  }

  buildOAuthAuthorizeUrl(params: { state: string; redirectUri: string }): string {
    const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
    url.searchParams.set('client_id', 'mock-feishu-app-id');
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('state', params.state);
    url.searchParams.set('response_type', 'code');
    return url.toString();
  }

  exchangeOAuthCode(): Promise<FeishuOAuthUserIdentity> {
    return Promise.resolve(this.oauthIdentity);
  }

  listDepartmentChildren(
    params: ListDepartmentChildrenParams
  ): Promise<FeishuPage<FeishuDepartmentItem>> {
    return Promise.resolve(
      this.page(this.departmentsByParent[params.departmentId] ?? [], params.pageSize, params.pageToken)
    );
  }

  listDepartmentUsers(params: ListDepartmentUsersParams): Promise<FeishuPage<FeishuUserItem>> {
    return Promise.resolve(
      this.page(this.usersByDepartment[params.departmentId] ?? [], params.pageSize, params.pageToken)
    );
  }

  private page<T>(items: T[], pageSize = 50, pageToken?: string): FeishuPage<T> {
    const start = pageToken ? Number(pageToken) : 0;
    const end = start + pageSize;
    const nextItems = items.slice(start, end);
    return {
      items: nextItems,
      hasMore: end < items.length,
      pageToken: end < items.length ? String(end) : undefined
    };
  }
}
