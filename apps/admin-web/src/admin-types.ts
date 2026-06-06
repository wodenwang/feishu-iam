export type AdminRoleKey = 'platform_admin' | 'application_admin' | 'audit_viewer' | 'sync_admin';

export type AdminMe = {
  adminUserId: string;
  feishuUserId: string;
  displayName: string;
  roles: AdminRoleKey[];
  applicationIds: string[];
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminEntityStatus = 'active' | 'disabled';
