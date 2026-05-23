import type { Application, AuditLog, CurrentSession } from './types';

export const platformAdminSession: CurrentSession = {
  user: {
    feishuUserId: 'ou_feishu_admin_001',
    displayName: '王文哲',
    departmentPath: '信息化中心 / 平台组',
    status: 'active',
  },
  roles: ['platform_admin'],
  permissions: [
    'dashboard:view',
    'application:view',
    'application:create',
    'application:update',
    'application:disable',
    'application:secret',
    'role:view',
    'role:update',
    'directory:view',
    'sync:view',
    'sync:run',
    'audit:view',
  ],
  applicationIds: ['app_demo_crm'],
};

export const applications: Application[] = [
  {
    id: 'app_demo_crm',
    name: 'Demo CRM',
    code: 'demo-crm',
    status: 'active',
    appKey: 'app_demo_crm_key',
    appSecretPreview: 'sec_****_crm',
    apiKey: 'api_demo_crm_key',
    apiSecretPreview: 'api_****_crm',
    callbackUrls: ['https://demo.example.com/auth/callback'],
    allowedOrigins: ['https://demo.example.com'],
    ownerFeishuUserId: 'ou_feishu_admin_001',
    agentPrompt: '将 IAM_APP_SECRET 和 IAM_API_SECRET 作为环境变量写入 demo 系统，禁止提交到 Git。',
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
  },
];

export const auditLogs: AuditLog[] = [
  {
    id: 'audit_secret_copy_001',
    action: 'secret.copy',
    actorFeishuUserId: 'ou_feishu_admin_001',
    applicationId: 'app_demo_crm',
    message: '复制 Demo CRM API secret',
    requestId: 'req_secret_copy_001',
    createdAt: '2026-05-23T00:10:00.000Z',
  },
];
