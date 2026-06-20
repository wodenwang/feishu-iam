export type RecordTab = 'trace' | 'audit' | 'security' | 'sync' | 'tokens';
export type RecordSheet =
  | `trace:${string}`
  | `audit:${string}`
  | `security:${string}`
  | `sync:${string}`
  | `token:${string}`;
export type RecordSort = 'createdAt:desc' | 'createdAt:asc';

export type RecordSearchState = {
  tab: RecordTab;
  requestId?: string;
  action?: string;
  applicationId?: string;
  clientId?: string;
  feishuUserId?: string;
  from?: string;
  to?: string;
  result?: string;
  returnTo?: string;
  page: number;
  pageSize: number;
  sort: RecordSort;
  sheet?: RecordSheet;
};

export type ApplicationSheet = 'create' | `app:${string}` | `client:${string}` | `rotate:${string}` | `prompt:${string}`;
export type ApplicationSort = 'updatedAt:desc' | 'updatedAt:asc' | 'appKey:asc';

export type ApplicationSearchState = {
  q?: string;
  status: 'all' | 'active' | 'disabled';
  owner?: string;
  page: number;
  pageSize: number;
  sort: ApplicationSort;
  sheet?: ApplicationSheet;
};

export type PermissionSheet = 'create' | `role:${string}`;
export type PermissionSort = 'key:asc' | 'updatedAt:desc' | 'updatedAt:asc';

export type PermissionSearchState = {
  appKey?: string;
  q?: string;
  code?: string;
  authStatus: 'all' | 'configured' | 'unconfigured';
  status: 'all' | 'enabled' | 'disabled';
  page: number;
  pageSize: 20 | 50 | 100;
  sort: PermissionSort;
  sheet?: PermissionSheet;
};

export type AdminUserRoleFilter = 'all' | 'platform_admin' | 'application_admin' | 'readonly';
export type AdminUserStatusFilter = 'all' | 'active' | 'disabled';
export type AdminUserSheet = `admin:${string}`;

export type AdminUserSearchState = {
  q?: string;
  role: AdminUserRoleFilter;
  status: AdminUserStatusFilter;
  sheet?: AdminUserSheet;
};

export type SystemSettingsTab = 'feishu' | 'runtime' | 'version';
export type SystemSettingsSheet = `sync:${string}`;

export type SystemSettingsSearchState = {
  tab: SystemSettingsTab;
  sheet?: SystemSettingsSheet;
};

const defaultPage = 1;
const defaultPageSize = 20;
const defaultRecordTab: RecordTab = 'trace';
const defaultRecordSort: RecordSort = 'createdAt:desc';
const defaultApplicationStatus: ApplicationSearchState['status'] = 'all';
const defaultApplicationSort: ApplicationSort = 'updatedAt:desc';
const defaultPermissionStatus: PermissionSearchState['status'] = 'all';
const defaultPermissionAuthStatus: PermissionSearchState['authStatus'] = 'all';
const defaultPermissionSort: PermissionSort = 'key:asc';
const defaultPermissionPageSize: PermissionSearchState['pageSize'] = 20;
const defaultAdminUserRole: AdminUserRoleFilter = 'all';
const defaultAdminUserStatus: AdminUserStatusFilter = 'all';
const defaultSystemSettingsTab: SystemSettingsTab = 'feishu';

const recordTabs: RecordTab[] = ['trace', 'audit', 'security', 'sync', 'tokens'];
const recordSorts: RecordSort[] = ['createdAt:desc', 'createdAt:asc'];
const recordSheetPrefixes = ['trace', 'audit', 'security', 'sync', 'token'] as const;

const applicationStatuses: Array<ApplicationSearchState['status']> = ['all', 'active', 'disabled'];
const applicationSorts: ApplicationSort[] = ['updatedAt:desc', 'updatedAt:asc', 'appKey:asc'];
const applicationSheetPrefixes = ['app', 'client', 'rotate', 'prompt'] as const;
const permissionStatuses: Array<PermissionSearchState['status']> = ['all', 'enabled', 'disabled'];
const permissionAuthStatuses: Array<PermissionSearchState['authStatus']> = ['all', 'configured', 'unconfigured'];
const permissionSorts: PermissionSort[] = ['key:asc', 'updatedAt:desc', 'updatedAt:asc'];
const permissionPageSizes: Array<PermissionSearchState['pageSize']> = [20, 50, 100];
const permissionSheetPrefixes = ['role'] as const;
const adminUserRoles: AdminUserRoleFilter[] = ['all', 'platform_admin', 'application_admin', 'readonly'];
const adminUserStatuses: AdminUserStatusFilter[] = ['all', 'active', 'disabled'];
const adminUserSheetPrefixes = ['admin'] as const;
const systemSettingsTabs: SystemSettingsTab[] = ['feishu', 'runtime', 'version'];
const systemSettingsSheetPrefixes = ['sync'] as const;

export function parseRecordSearch(params: URLSearchParams): RecordSearchState {
  return {
    tab: parseEnum(params.get('tab'), recordTabs, defaultRecordTab),
    requestId: clean(params.get('requestId')),
    action: clean(params.get('action')),
    applicationId: clean(params.get('applicationId')),
    clientId: clean(params.get('clientId')),
    feishuUserId: clean(params.get('feishuUserId')),
    from: clean(params.get('from')),
    to: clean(params.get('to')),
    result: clean(params.get('result')),
    returnTo: cleanPath(params.get('returnTo')),
    page: parsePositiveInt(params.get('page'), defaultPage),
    pageSize: parsePositiveInt(params.get('pageSize'), defaultPageSize),
    sort: parseEnum(params.get('sort'), recordSorts, defaultRecordSort),
    sheet: parseRecordSheet(params.get('sheet'))
  };
}

export function serializeRecordSearch(state: RecordSearchState): URLSearchParams {
  const params = new URLSearchParams();
  const tab = parseEnum(state.tab, recordTabs, defaultRecordTab);
  const requestId = clean(state.requestId);
  const action = clean(state.action);
  const applicationId = clean(state.applicationId);
  const clientId = clean(state.clientId);
  const feishuUserId = clean(state.feishuUserId);
  const from = clean(state.from);
  const to = clean(state.to);
  const result = clean(state.result);
  const returnTo = cleanPath(state.returnTo);
  const page = normalizePositiveInt(state.page, defaultPage);
  const pageSize = normalizePositiveInt(state.pageSize, defaultPageSize);
  const sort = parseEnum(state.sort, recordSorts, defaultRecordSort);
  const sheet = parseRecordSheet(state.sheet);

  if (tab !== defaultRecordTab) {
    params.set('tab', tab);
  }
  setCleanParam(params, 'requestId', requestId);
  setCleanParam(params, 'action', action);
  setCleanParam(params, 'applicationId', applicationId);
  setCleanParam(params, 'clientId', clientId);
  setCleanParam(params, 'feishuUserId', feishuUserId);
  setCleanParam(params, 'from', from);
  setCleanParam(params, 'to', to);
  setCleanParam(params, 'result', result);
  setCleanParam(params, 'returnTo', returnTo);
  if (page !== defaultPage) {
    params.set('page', String(page));
  }
  if (pageSize !== defaultPageSize) {
    params.set('pageSize', String(pageSize));
  }
  if (sort !== defaultRecordSort) {
    params.set('sort', sort);
  }
  if (sheet) {
    params.set('sheet', sheet);
  }

  return params;
}

export function parseApplicationSearch(params: URLSearchParams): ApplicationSearchState {
  return {
    q: clean(params.get('q')),
    status: parseEnum(params.get('status'), applicationStatuses, defaultApplicationStatus),
    owner: clean(params.get('owner')),
    page: parsePositiveInt(params.get('page'), defaultPage),
    pageSize: parsePositiveInt(params.get('pageSize'), defaultPageSize),
    sort: parseEnum(params.get('sort'), applicationSorts, defaultApplicationSort),
    sheet: parseApplicationSheet(params.get('sheet'))
  };
}

export function serializeApplicationSearch(state: ApplicationSearchState): URLSearchParams {
  const params = new URLSearchParams();
  const q = clean(state.q);
  const status = parseEnum(state.status, applicationStatuses, defaultApplicationStatus);
  const owner = clean(state.owner);
  const page = normalizePositiveInt(state.page, defaultPage);
  const pageSize = normalizePositiveInt(state.pageSize, defaultPageSize);
  const sort = parseEnum(state.sort, applicationSorts, defaultApplicationSort);
  const sheet = parseApplicationSheet(state.sheet);

  setCleanParam(params, 'q', q);
  if (status !== defaultApplicationStatus) {
    params.set('status', status);
  }
  setCleanParam(params, 'owner', owner);
  if (page !== defaultPage) {
    params.set('page', String(page));
  }
  if (pageSize !== defaultPageSize) {
    params.set('pageSize', String(pageSize));
  }
  if (sort !== defaultApplicationSort) {
    params.set('sort', sort);
  }
  if (sheet) {
    params.set('sheet', sheet);
  }

  return params;
}

export function parsePermissionSearch(params: URLSearchParams): PermissionSearchState {
  return {
    appKey: clean(params.get('appKey')),
    q: clean(params.get('q')),
    code: clean(params.get('code')),
    authStatus: parseEnum(params.get('authStatus'), permissionAuthStatuses, defaultPermissionAuthStatus),
    status: parseEnum(params.get('status'), permissionStatuses, defaultPermissionStatus),
    page: parsePositiveInt(params.get('page'), defaultPage),
    pageSize: parsePermissionPageSize(params.get('pageSize')),
    sort: parseEnum(params.get('sort'), permissionSorts, defaultPermissionSort),
    sheet: parsePermissionSheet(params.get('sheet'))
  };
}

export function serializePermissionSearch(state: PermissionSearchState): URLSearchParams {
  const params = new URLSearchParams();
  const appKey = clean(state.appKey);
  const q = clean(state.q);
  const code = clean(state.code);
  const authStatus = parseEnum(state.authStatus, permissionAuthStatuses, defaultPermissionAuthStatus);
  const status = parseEnum(state.status, permissionStatuses, defaultPermissionStatus);
  const page = normalizePositiveInt(state.page, defaultPage);
  const pageSize = normalizePermissionPageSize(state.pageSize);
  const sort = parseEnum(state.sort, permissionSorts, defaultPermissionSort);
  const sheet = parsePermissionSheet(state.sheet);

  setCleanParam(params, 'appKey', appKey);
  setCleanParam(params, 'q', q);
  setCleanParam(params, 'code', code);
  if (authStatus !== defaultPermissionAuthStatus) {
    params.set('authStatus', authStatus);
  }
  if (status !== defaultPermissionStatus) {
    params.set('status', status);
  }
  if (page !== defaultPage) {
    params.set('page', String(page));
  }
  if (pageSize !== defaultPermissionPageSize) {
    params.set('pageSize', String(pageSize));
  }
  if (sort !== defaultPermissionSort) {
    params.set('sort', sort);
  }
  if (sheet) {
    params.set('sheet', sheet);
  }

  return params;
}

export function parseAdminUserSearch(params: URLSearchParams): AdminUserSearchState {
  return {
    q: clean(params.get('q')),
    role: parseEnum(params.get('role'), adminUserRoles, defaultAdminUserRole),
    status: parseEnum(params.get('status'), adminUserStatuses, defaultAdminUserStatus),
    sheet: parseAdminUserSheet(params.get('sheet'))
  };
}

export function serializeAdminUserSearch(state: AdminUserSearchState): URLSearchParams {
  const params = new URLSearchParams();
  const q = clean(state.q);
  const role = parseEnum(state.role, adminUserRoles, defaultAdminUserRole);
  const status = parseEnum(state.status, adminUserStatuses, defaultAdminUserStatus);
  const sheet = parseAdminUserSheet(state.sheet);

  setCleanParam(params, 'q', q);
  if (role !== defaultAdminUserRole) {
    params.set('role', role);
  }
  if (status !== defaultAdminUserStatus) {
    params.set('status', status);
  }
  if (sheet) {
    params.set('sheet', sheet);
  }

  return params;
}

export function parseSystemSettingsSearch(params: URLSearchParams): SystemSettingsSearchState {
  return {
    tab: parseEnum(params.get('tab'), systemSettingsTabs, defaultSystemSettingsTab),
    sheet: parseSystemSettingsSheet(params.get('sheet'))
  };
}

export function serializeSystemSettingsSearch(state: SystemSettingsSearchState): URLSearchParams {
  const params = new URLSearchParams();
  const tab = parseEnum(state.tab, systemSettingsTabs, defaultSystemSettingsTab);
  const sheet = parseSystemSettingsSheet(state.sheet);

  if (tab !== defaultSystemSettingsTab) {
    params.set('tab', tab);
  }
  if (sheet) {
    params.set('sheet', sheet);
  }

  return params;
}

export function closeSheet(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('sheet');
  return next;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const cleaned = clean(value);
  if (!cleaned || !/^[1-9]\d*$/.test(cleaned)) {
    return fallback;
  }

  return Number(cleaned);
}

function normalizePositiveInt(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 1) {
    return fallback;
  }

  return value;
}

function parseEnum<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  const cleaned = clean(value);
  if (cleaned && allowed.includes(cleaned as T)) {
    return cleaned as T;
  }

  return fallback;
}

function parseRecordSheet(value: string | null | undefined): RecordSheet | undefined {
  return parsePrefixedSheet(value, recordSheetPrefixes) as RecordSheet | undefined;
}

function parseApplicationSheet(value: string | null | undefined): ApplicationSheet | undefined {
  const cleaned = clean(value);
  if (cleaned === 'create') {
    return cleaned;
  }

  return parsePrefixedSheet(cleaned, applicationSheetPrefixes) as ApplicationSheet | undefined;
}

function parsePermissionSheet(value: string | null | undefined): PermissionSheet | undefined {
  const cleaned = clean(value);
  if (cleaned === 'create') {
    return cleaned;
  }

  return parsePrefixedSheet(cleaned, permissionSheetPrefixes) as PermissionSheet | undefined;
}

function parseAdminUserSheet(value: string | null | undefined): AdminUserSheet | undefined {
  return parsePrefixedSheet(value, adminUserSheetPrefixes) as AdminUserSheet | undefined;
}

function parseSystemSettingsSheet(value: string | null | undefined): SystemSettingsSheet | undefined {
  return parsePrefixedSheet(value, systemSettingsSheetPrefixes) as SystemSettingsSheet | undefined;
}

function parsePermissionPageSize(value: string | null): PermissionSearchState['pageSize'] {
  const parsed = parsePositiveInt(value, defaultPermissionPageSize);
  return normalizePermissionPageSize(parsed);
}

function normalizePermissionPageSize(value: number): PermissionSearchState['pageSize'] {
  return permissionPageSizes.includes(value as PermissionSearchState['pageSize'])
    ? (value as PermissionSearchState['pageSize'])
    : defaultPermissionPageSize;
}

function parsePrefixedSheet(value: string | null | undefined, allowedPrefixes: readonly string[]): string | undefined {
  const cleaned = clean(value);
  if (!cleaned) {
    return undefined;
  }

  const separatorIndex = cleaned.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === cleaned.length - 1) {
    return undefined;
  }

  const prefix = cleaned.slice(0, separatorIndex);
  const id = clean(cleaned.slice(separatorIndex + 1));
  if (!id || !allowedPrefixes.includes(prefix)) {
    return undefined;
  }

  return `${prefix}:${id}`;
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanPath(value: string | null | undefined): string | undefined {
  const trimmed = clean(value);
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return undefined;
  }
  return trimmed;
}

function setCleanParam(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value) {
    params.set(key, value);
  }
}
