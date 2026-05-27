import { HttpError } from '../errors/httpError';

export type DirectoryEntryStatus = 'active' | 'disabled' | 'resigned';

export interface DirectoryDepartmentSnapshot {
  id: string;
  name: string;
  parentId: string | null;
  status?: DirectoryEntryStatus;
}

export interface DirectoryUserSnapshot {
  feishuUserId: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
  departmentId?: string | null;
  status?: DirectoryEntryStatus;
}

export interface DirectorySyncSnapshot {
  departments: DirectoryDepartmentSnapshot[];
  users: DirectoryUserSnapshot[];
  requestBatchCount: number;
}

export type DirectorySyncPreflightStageName = 'token' | 'departments' | 'users';
export type DirectorySyncPreflightStageStatus = 'passed' | 'failed';

export interface DirectorySyncPreflightStage {
  name: DirectorySyncPreflightStageName;
  status: DirectorySyncPreflightStageStatus;
  message?: string;
}

export interface DirectorySyncPreflightResult {
  status: DirectorySyncPreflightStageStatus;
  checkedAt: string;
  requestBatchCount: number;
  stages: DirectorySyncPreflightStage[];
  errorCode?: string;
  message?: string;
}

export interface DirectorySyncAdapter {
  fetchDirectorySnapshot(): Promise<DirectorySyncSnapshot>;
  preflight(): Promise<DirectorySyncPreflightResult>;
}

interface RealFeishuDirectorySyncAdapterOptions {
  appId: string;
  appSecret: string;
}

interface FeishuDepartmentItem {
  department_id?: string;
  open_department_id?: string;
  name?: string;
  parent_department_id?: string;
  status?: { is_deleted?: boolean };
}

interface FeishuUserItem {
  user_id?: string;
  open_id?: string;
  name?: string;
  en_name?: string;
  email?: string;
  mobile?: string;
  department_ids?: string[];
  status?: { is_activated?: boolean; is_exited?: boolean; is_frozen?: boolean };
}

export class RealFeishuDirectorySyncAdapter implements DirectorySyncAdapter {
  private tenantAccessToken: { value: string; expiresAt: number } | undefined;

  constructor(private readonly options: RealFeishuDirectorySyncAdapterOptions) {}

  async preflight(): Promise<DirectorySyncPreflightResult> {
    const checkedAt = new Date().toISOString();
    const stages: DirectorySyncPreflightStage[] = [];
    let requestBatchCount = 0;
    let tenantAccessToken: string;

    try {
      tenantAccessToken = await this.getTenantAccessToken();
      requestBatchCount += 1;
      stages.push({ name: 'token', status: 'passed' });
    } catch (error) {
      return buildFailedPreflight(checkedAt, requestBatchCount + 1, stages, 'token', error);
    }

    try {
      await this.fetchDepartmentPreflight(tenantAccessToken);
      requestBatchCount += 1;
      stages.push({ name: 'departments', status: 'passed' });
    } catch (error) {
      return buildFailedPreflight(checkedAt, requestBatchCount + 1, stages, 'departments', error);
    }

    try {
      await this.fetchUserPreflight(tenantAccessToken);
      requestBatchCount += 1;
      stages.push({ name: 'users', status: 'passed' });
    } catch (error) {
      return buildFailedPreflight(checkedAt, requestBatchCount + 1, stages, 'users', error);
    }

    return {
      status: 'passed',
      checkedAt,
      requestBatchCount,
      stages,
      message: '飞书通讯录权限预检通过',
    };
  }

  async fetchDirectorySnapshot(): Promise<DirectorySyncSnapshot> {
    const tenantAccessToken = await this.getTenantAccessToken();
    const departments = await this.fetchDepartments(tenantAccessToken);
    const departmentIds = ['0', ...departments.map((department) => department.id)];
    const users: DirectoryUserSnapshot[] = [];
    let requestBatchCount = 1;

    for (const departmentId of departmentIds) {
      const page = await this.fetchUsersByDepartment(tenantAccessToken, departmentId);
      requestBatchCount += page.requestBatchCount;
      users.push(...page.users);
    }

    return {
      departments,
      users: dedupeUsers(users),
      requestBatchCount,
    };
  }

  private async getTenantAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tenantAccessToken && this.tenantAccessToken.expiresAt - now > 30 * 60 * 1000) {
      return this.tenantAccessToken.value;
    }

    const payload = await feishuJsonRequest('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: this.options.appId, app_secret: this.options.appSecret }),
    });
    const token = readString(payload, ['tenant_access_token']);
    const expire = readNumber(payload, ['expire']) ?? 7200;
    if (!token) {
      throw new HttpError(502, 'FEISHU_TENANT_TOKEN_INVALID', '飞书 tenant_access_token 返回格式无效');
    }

    this.tenantAccessToken = {
      value: token,
      expiresAt: now + expire * 1000,
    };
    return token;
  }

  private async fetchDepartments(tenantAccessToken: string): Promise<DirectoryDepartmentSnapshot[]> {
    const departments: DirectoryDepartmentSnapshot[] = [];
    let pageToken = '';

    do {
      const url = new URL('https://open.feishu.cn/open-apis/contact/v3/departments/0/children');
      url.searchParams.set('department_id_type', 'open_department_id');
      url.searchParams.set('user_id_type', 'user_id');
      url.searchParams.set('fetch_child', 'true');
      url.searchParams.set('page_size', '50');
      if (pageToken) {
        url.searchParams.set('page_token', pageToken);
      }

      const payload = await feishuJsonRequest(url.toString(), {
        headers: { authorization: `Bearer ${tenantAccessToken}` },
      });
      const items = readArray<FeishuDepartmentItem>(payload, ['data', 'items']);
      departments.push(...items.map(mapFeishuDepartment).filter((item): item is DirectoryDepartmentSnapshot => Boolean(item)));
      pageToken = readString(payload, ['data', 'page_token']) ?? '';
    } while (pageToken);

    return departments;
  }

  private async fetchUsersByDepartment(
    tenantAccessToken: string,
    departmentId: string,
  ): Promise<{ users: DirectoryUserSnapshot[]; requestBatchCount: number }> {
    const users: DirectoryUserSnapshot[] = [];
    let pageToken = '';
    let requestBatchCount = 0;

    do {
      const url = new URL('https://open.feishu.cn/open-apis/contact/v3/users/find_by_department');
      url.searchParams.set('department_id_type', 'open_department_id');
      url.searchParams.set('user_id_type', 'user_id');
      url.searchParams.set('department_id', departmentId);
      url.searchParams.set('page_size', '50');
      if (pageToken) {
        url.searchParams.set('page_token', pageToken);
      }

      const payload = await feishuJsonRequest(url.toString(), {
        headers: { authorization: `Bearer ${tenantAccessToken}` },
      });
      requestBatchCount += 1;
      const items = readArray<FeishuUserItem>(payload, ['data', 'items']);
      users.push(...items.map((item) => mapFeishuUser(item, departmentId)).filter((item): item is DirectoryUserSnapshot => Boolean(item)));
      pageToken = readString(payload, ['data', 'page_token']) ?? '';
    } while (pageToken);

    return { users, requestBatchCount };
  }

  private async fetchDepartmentPreflight(tenantAccessToken: string): Promise<void> {
    const url = new URL('https://open.feishu.cn/open-apis/contact/v3/departments/0/children');
    url.searchParams.set('department_id_type', 'open_department_id');
    url.searchParams.set('user_id_type', 'user_id');
    url.searchParams.set('fetch_child', 'false');
    url.searchParams.set('page_size', '1');

    await feishuJsonRequest(url.toString(), {
      headers: { authorization: `Bearer ${tenantAccessToken}` },
    });
  }

  private async fetchUserPreflight(tenantAccessToken: string): Promise<void> {
    const url = new URL('https://open.feishu.cn/open-apis/contact/v3/users/find_by_department');
    url.searchParams.set('department_id_type', 'open_department_id');
    url.searchParams.set('user_id_type', 'user_id');
    url.searchParams.set('department_id', '0');
    url.searchParams.set('page_size', '1');

    await feishuJsonRequest(url.toString(), {
      headers: { authorization: `Bearer ${tenantAccessToken}` },
    });
  }
}

export class LocalMockDirectorySyncAdapter implements DirectorySyncAdapter {
  async preflight(): Promise<DirectorySyncPreflightResult> {
    return {
      status: 'passed',
      checkedAt: new Date().toISOString(),
      requestBatchCount: 3,
      stages: [
        { name: 'token', status: 'passed' },
        { name: 'departments', status: 'passed' },
        { name: 'users', status: 'passed' },
      ],
      message: '本地 mock 飞书通讯录权限预检通过',
    };
  }

  async fetchDirectorySnapshot(): Promise<DirectorySyncSnapshot> {
    return {
      departments: [
        { id: 'dept_it', name: 'IT 部', parentId: null },
        { id: 'dept_sales', name: '销售部', parentId: null },
      ],
      users: [
        {
          feishuUserId: 'ou_mock_sync_it_001',
          name: '本地同步用户一号',
          email: 'sync-it@example.com',
          departmentId: 'dept_it',
          status: 'active',
        },
        {
          feishuUserId: 'ou_mock_sync_sales_001',
          name: '本地同步用户二号',
          email: 'sync-sales@example.com',
          departmentId: 'dept_sales',
          status: 'active',
        },
      ],
      requestBatchCount: 1,
    };
  }
}

function buildFailedPreflight(
  checkedAt: string,
  requestBatchCount: number,
  passedStages: DirectorySyncPreflightStage[],
  failedStage: DirectorySyncPreflightStageName,
  error: unknown,
): DirectorySyncPreflightResult {
  const sanitized = sanitizePreflightError(error);
  return {
    status: 'failed',
    checkedAt,
    requestBatchCount,
    stages: [...passedStages, { name: failedStage, status: 'failed', message: sanitized.message }],
    errorCode: sanitized.code,
    message: sanitized.message,
  };
}

function sanitizePreflightError(error: unknown): { code: string; message: string } {
  if (error instanceof HttpError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: 'FEISHU_DIRECTORY_PREFLIGHT_FAILED', message: error.message };
  }
  return { code: 'FEISHU_DIRECTORY_PREFLIGHT_FAILED', message: '飞书通讯录权限预检失败' };
}

async function feishuJsonRequest(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new HttpError(502, 'FEISHU_INVALID_JSON_RESPONSE', '飞书接口返回格式无效');
  }

  const code = readNumber(payload, ['code']);
  if (!response.ok || (code !== undefined && code !== 0)) {
    throw new HttpError(502, 'FEISHU_DIRECTORY_API_FAILED', '飞书通讯录 API 调用失败', {
      status: response.status,
      feishuCode: code,
      feishuMessage: readString(payload, ['msg']) ?? readString(payload, ['message']),
    });
  }
  return payload;
}

function mapFeishuDepartment(item: FeishuDepartmentItem): DirectoryDepartmentSnapshot | undefined {
  const id = item.open_department_id ?? item.department_id;
  if (!id || !item.name) {
    return undefined;
  }
  return {
    id,
    name: item.name,
    parentId: item.parent_department_id && item.parent_department_id !== '0' ? item.parent_department_id : null,
    status: item.status?.is_deleted ? 'disabled' : 'active',
  };
}

function mapFeishuUser(item: FeishuUserItem, fallbackDepartmentId: string): DirectoryUserSnapshot | undefined {
  const feishuUserId = item.user_id ?? item.open_id;
  const name = item.name ?? item.en_name;
  if (!feishuUserId || !name) {
    return undefined;
  }
  return {
    feishuUserId,
    name,
    email: item.email ?? null,
    mobile: item.mobile ?? null,
    departmentId: item.department_ids?.[0] ?? (fallbackDepartmentId === '0' ? null : fallbackDepartmentId),
    status: item.status?.is_exited ? 'resigned' : item.status?.is_frozen || item.status?.is_activated === false ? 'disabled' : 'active',
  };
}

function dedupeUsers(users: DirectoryUserSnapshot[]): DirectoryUserSnapshot[] {
  const byId = new Map<string, DirectoryUserSnapshot>();
  for (const user of users) {
    byId.set(user.feishuUserId, { ...byId.get(user.feishuUserId), ...user });
  }
  return [...byId.values()];
}

function readString(payload: unknown, path: string[]): string | undefined {
  const value = readPath(payload, path);
  return typeof value === 'string' && value ? value : undefined;
}

function readNumber(payload: unknown, path: string[]): number | undefined {
  const value = readPath(payload, path);
  return typeof value === 'number' ? value : undefined;
}

function readArray<T>(payload: unknown, path: string[]): T[] {
  const value = readPath(payload, path);
  return Array.isArray(value) ? (value as T[]) : [];
}

function readPath(payload: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, payload);
}
