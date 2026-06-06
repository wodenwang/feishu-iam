import type { FeishuDepartmentItem, FeishuPage, FeishuUserItem } from './feishu.types';
import type { FeishuOAuthUserIdentity } from './feishu-oauth.types';

export const FEISHU_CLIENT = Symbol('FEISHU_CLIENT');

export type ListDepartmentChildrenParams = {
  departmentId: string;
  pageSize?: number;
  pageToken?: string;
};

export type ListDepartmentUsersParams = {
  departmentId: string;
  pageSize?: number;
  pageToken?: string;
};

export interface FeishuClient {
  getTenantAccessToken(): Promise<string>;
  buildOAuthAuthorizeUrl(params: { state: string; redirectUri: string }): string;
  exchangeOAuthCode(code: string, redirectUri?: string): Promise<FeishuOAuthUserIdentity>;
  listDepartmentChildren(
    params: ListDepartmentChildrenParams
  ): Promise<FeishuPage<FeishuDepartmentItem>>;
  listDepartmentUsers(params: ListDepartmentUsersParams): Promise<FeishuPage<FeishuUserItem>>;
}
