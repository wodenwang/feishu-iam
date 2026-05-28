import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockIamStore, setMockCurrentSession } from '../../features/iam/mockApi';
import { applications, platformAdminSession } from '../../features/iam/mockData';
import type { ApplicationDiagnostics, CurrentSession } from '../../features/iam/types';
import { ApplicationDetailPage, buildApplicationPrompt } from './Detail';
import { buildApplicationDiagnosticsMarkdown } from './diagnostics';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const applicationAdminSession: CurrentSession = {
  user: {
    feishuUserId: 'ou_app_admin_001',
    displayName: '应用管理员',
    departmentPath: '业务系统组',
    status: 'active',
  },
  roles: ['application_admin'],
  permissions: ['application:view'],
  applicationIds: ['app_demo_crm'],
};

function renderApplicationDetail(session: CurrentSession = platformAdminSession) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['iam', 'session'], session);

  return render(
    <QueryClientProvider client={queryClient}>
      <AntdApp>
        <MemoryRouter initialEntries={['/applications/app_demo_crm']}>
          <Routes>
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AntdApp>
    </QueryClientProvider>,
  );
}

describe('ApplicationDetailPage', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  it('shows application detail tabs and overview fields', async () => {
    renderApplicationDetail();

    expect(screen.getByText('应用详情')).toBeInTheDocument();
    ['概览', '接入配置', '权限注册', '接入诊断', '应用管理员', '审计记录'].forEach((tab) => {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    });

    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    ['应用名称', 'appKey', '应用 Code', '状态', '接入状态', '创建人', '创建时间', '最近 API 调用'].forEach((field) => {
      expect(screen.getByText(field)).toBeInTheDocument();
    });
    expect(screen.getByText('app_demo_crm_key')).toBeInTheDocument();
    expect(screen.getByText('配置可用')).toBeInTheDocument();
  });

  it('exposes the v0.2 configuration surface from the tab model', async () => {
    renderApplicationDetail();

    await screen.findByText('Demo CRM');
    expect(screen.getByRole('tab', { name: '接入配置' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '接入诊断' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '应用管理员' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计记录' })).toBeInTheDocument();
    expect(screen.getByText('启用 redirect URI')).toBeInTheDocument();
    expect(screen.getAllByText('应用管理员').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('配置审计')).toBeInTheDocument();
  });

  it('shows permission registration empty state or readonly table', async () => {
    const user = userEvent.setup();
    renderApplicationDetail();

    await user.click(screen.getByRole('tab', { name: '权限注册' }));

    expect(await screen.findByText('该应用还没有注册权限点')).toBeInTheDocument();
    expect(screen.getByText('第三方系统需要调用 Application API 注册权限组和权限点。')).toBeInTheDocument();
    ['权限组 Code', '权限组名称', '权限点 Code', '权限点名称', '状态', '最近注册/更新时间'].forEach((column) => {
      expect(screen.getAllByText(column).length).toBeGreaterThan(0);
    });
  });

  it('allows application admins with application:view to inspect readonly detail without dangerous actions', async () => {
    setMockCurrentSession(applicationAdminSession);
    renderApplicationDetail(applicationAdminSession);

    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增 redirect URI/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /轮换 appSecret/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /轮换 API secret/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '接入配置' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '接入诊断' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '应用管理员' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计记录' })).toBeInTheDocument();
    expect(screen.getAllByText('王文哲').length).toBeGreaterThan(0);
  });

  it('keeps v0.2 admin protection and audit behavior covered by service tests', async () => {
    renderApplicationDetail();

    await screen.findByText('Demo CRM');
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '应用管理员' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计记录' })).toBeInTheDocument();
  });

  it('shows and builds a third-party application prompt without secret plaintext', async () => {
    const user = userEvent.setup();
    renderApplicationDetail();

    await screen.findByText('Demo CRM');
    await user.click(screen.getByRole('tab', { name: '接入配置' }));
    await screen.findByText('第三方应用接入提示词');
    const copyButton = screen.getByRole('button', { name: /复制应用提示词/ });
    await waitFor(() => expect(copyButton).not.toBeDisabled());
    const prompt = buildApplicationPrompt({
      application: applications[0],
      redirectUris: [
        {
          applicationId: applications[0].id,
          redirectUri: 'https://demo.example.com/auth/callback',
          environment: 'production',
          status: 'active',
          note: '生产回调地址',
          createdByName: '王文哲',
          createdAt: applications[0].createdAt,
          updatedAt: applications[0].updatedAt,
        },
      ],
    });
    expect(prompt).toContain('AGENTS.md');
    expect(prompt).toContain('CLAUDE.md');
    expect(prompt).toContain('请在第三方项目中创建或更新 AGENTS.md 和 CLAUDE.md');
    expect(prompt).toContain('GET /api/oauth/authorize');
    expect(prompt).toContain('POST /api/oauth/token');
    expect(prompt).toContain('PUT /api/application/permission-groups');
    expect(prompt).toContain('PUT /api/application/permission-points');
    expect(prompt).toContain('GET /api/application/me/permissions');
    expect(prompt).toContain('x-fiam-app-key');
    expect(prompt).toContain(['METHOD', 'PATH', 'NORMALIZED_QUERY', 'TIMESTAMP', 'NONCE', 'BODY_SHA256_HEX'].join('\n'));
    expect(prompt).toContain('HMAC-SHA256');
    expect(prompt).toContain('https://demo.example.com/auth/callback');
    expect(prompt).toContain('IAM_APP_SECRET=<FEISHU_IAM_APP_SECRET>');
    expect(prompt).toContain('IAM_API_SECRET=<FEISHU_IAM_API_SECRET>');
    expect(prompt).not.toContain('sec_****_crm');
    expect(prompt).not.toContain('api_****_crm');
  });

  it('builds one-time prompts with only the provided plaintext secret', () => {
    const appSecretPrompt = buildApplicationPrompt({
      application: applications[0],
      redirectUris: [],
      oneTimeSecrets: { appSecret: 'sec_v040_once' },
    });
    const apiSecretPrompt = buildApplicationPrompt({
      application: applications[0],
      redirectUris: [],
      oneTimeSecrets: { apiSecret: 'api_sec_v040_once' },
    });

    expect(appSecretPrompt).toContain('IAM_APP_SECRET=sec_v040_once');
    expect(appSecretPrompt).toContain('IAM_API_SECRET=<FEISHU_IAM_API_SECRET>');
    expect(apiSecretPrompt).toContain('IAM_APP_SECRET=<FEISHU_IAM_APP_SECRET>');
    expect(apiSecretPrompt).toContain('IAM_API_SECRET=api_sec_v040_once');
  });

  it('shows sanitized access diagnostics and builds a copy package', async () => {
    const user = userEvent.setup();
    renderApplicationDetail();

    await screen.findByText('Demo CRM');
    await user.click(screen.getByRole('tab', { name: '接入诊断' }));

    expect(await screen.findByText('接入诊断：健康')).toBeInTheDocument();
    expect(screen.getByText('接入端点与配置状态')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /复制诊断包/ })).toBeEnabled();
    expect(screen.getByText('未发现接入阻塞或风险')).toBeInTheDocument();

    const diagnostics: ApplicationDiagnostics = {
      applicationId: applications[0].id,
      appKey: applications[0].appKey,
      status: 'healthy',
      checkedAt: '2026-05-28T00:00:00.000Z',
      endpoints: {
        oauthAuthorize: '/api/oauth/authorize',
        oauthToken: '/api/oauth/token',
        applicationPermissions: '/api/application/me/permissions',
      },
      redirectUris: { active: ['https://demo.example.com/auth/callback'], disabled: [] },
      secrets: {
        appSecret: { status: 'issued', rotatedAt: '2026-05-23T00:00:00.000Z' },
        apiSecret: { status: 'issued', rotatedAt: '2026-05-23T00:00:00.000Z' },
      },
      counts: {
        applicationAdmins: 1,
        permissionGroups: 3,
        permissionPoints: 12,
        roles: 1,
        roleBindings: 9,
        syncedUsers: 3,
      },
      findings: [],
      recentEvents: [],
    };
    const markdown = buildApplicationDiagnosticsMarkdown({ application: applications[0], diagnostics });
    expect(markdown).toContain('接入诊断包');
    expect(markdown).toContain('OAuth authorize');
    expect(markdown).toContain('appKey：app_demo_crm_key');
    expect(markdown).not.toContain('sec_****_crm');
    expect(markdown).not.toContain('api_****_crm');
  });
});
