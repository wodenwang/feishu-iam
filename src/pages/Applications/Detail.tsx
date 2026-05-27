import {
  AuditOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAddApplicationAdmin,
  useApplication,
  useApplicationAdmins,
  useApplicationDiagnostics,
  useApplicationPermissionRegistrations,
  useApplicationRedirectUris,
  useAuditLogs,
  useCopyApplicationDiagnostics,
  useCreateApplicationRedirectUri,
  useCurrentSession,
  useDirectoryUsers,
  useRemoveApplicationAdmin,
  useRecordRuntimeSecretCopy,
  useRotateApplicationSecret,
  useUpdateApplicationRedirectUriStatus,
} from '../../features/iam/queries';
import { isIamHttpError } from '../../features/iam/httpClient';
import { isPlatformAdmin } from '../../features/iam/permissions';
import type {
  ApplicationAdmin,
  Application,
  ApplicationDiagnosticEvent,
  ApplicationDiagnosticFinding,
  ApplicationDiagnostics,
  ApplicationPermissionRegistration,
  ApplicationRedirectUri,
  ApplicationStatus,
  AuditAction,
  AuditLog,
  AuditResult,
  RedirectUriEnvironment,
  RedirectUriStatus,
  RotateSecretResult,
  SecretKind,
} from '../../features/iam/types';
import { buildApplicationDiagnosticsMarkdown } from './diagnostics';

const statusLabels: Record<ApplicationStatus, { text: string; color: string }> = {
  active: { text: '启用', color: 'success' },
  disabled: { text: '停用', color: 'default' },
  draft: { text: '草稿', color: 'processing' },
};

const redirectStatusLabels: Record<RedirectUriStatus, { text: string; color: string }> = {
  active: { text: '启用', color: 'success' },
  disabled: { text: '停用', color: 'default' },
};

const diagnosticStatusLabels: Record<ApplicationDiagnostics['status'], { text: string; color: string; alertType: 'success' | 'warning' | 'error' }> = {
  healthy: { text: '健康', color: 'success', alertType: 'success' },
  warning: { text: '需关注', color: 'warning', alertType: 'warning' },
  failed: { text: '失败', color: 'error', alertType: 'error' },
};

const diagnosticSeverityLabels: Record<ApplicationDiagnosticFinding['severity'], { text: string; color: string }> = {
  critical: { text: '阻塞', color: 'error' },
  warning: { text: '警告', color: 'warning' },
  info: { text: '提示', color: 'processing' },
};

const environmentLabels: Record<RedirectUriEnvironment, string> = {
  production: '生产',
  staging: '预发',
  local: '本地',
};

const secretKindLabels: Record<SecretKind, string> = {
  app_secret: 'appSecret',
  api_secret: 'API secret',
};

const auditActionOptions: Array<{ label: string; value: AuditAction }> = [
  { label: '新增 redirect URI', value: 'oauth.redirect_uri.create' },
  { label: '停用 redirect URI', value: 'oauth.redirect_uri.disable' },
  { label: '恢复 redirect URI', value: 'oauth.redirect_uri.enable' },
  { label: '轮换 secret', value: 'secret.rotate' },
  { label: '新增应用管理员', value: 'application.admin.add' },
  { label: '移除应用管理员', value: 'application.admin.remove' },
  { label: '复制 secret', value: 'secret.copy' },
  { label: '复制诊断包', value: 'application.diagnostics.copy' },
];

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

function getIamBaseUrl() {
  if (typeof window === 'undefined') {
    return 'https://iam.example.com';
  }
  return window.location.origin;
}

export function buildApplicationPrompt(input: {
  application: Application;
  redirectUris: ApplicationRedirectUri[];
}) {
  const baseUrl = getIamBaseUrl();
  const activeRedirectUris = input.redirectUris.filter((item) => item.status === 'active').map((item) => item.redirectUri);
  const callbackList = activeRedirectUris.length ? activeRedirectUris : ['https://your-app.example.com/auth/callback'];

  return [
    '你正在把一个第三方业务系统接入 feishu-iam。请在当前第三方项目中创建或维护 AGENTS.md 和 CLAUDE.md，写清楚本项目如何通过 feishu-iam 完成 SSO 登录、权限注册和权限查询。',
    '',
    '硬性约束：',
    '- 只使用 feishu-iam / 飞书 SSO，不新增 username/password、本地超级管理员或绕过 IAM 的权限判断。',
    '- 不把真实 appSecret、apiSecret、token、飞书应用凭证写入 AGENTS.md、CLAUDE.md、README、测试日志或 Git。',
    '- secret 只能从运行时环境变量或 secret manager 读取。',
    '',
    '当前应用接入信息：',
    `- IAM_BASE_URL=${baseUrl}`,
    `- IAM_APP_KEY=${input.application.appKey}`,
    `- OAUTH_CLIENT_ID=${input.application.appKey}`,
    `- OAUTH_AUTHORIZE_ENDPOINT=${baseUrl}/api/oauth/authorize`,
    `- OAUTH_TOKEN_ENDPOINT=${baseUrl}/api/oauth/token`,
    `- APPLICATION_API_BASE=${baseUrl}/api/application`,
    `- CALLBACK_URLS=${callbackList.join(', ')}`,
    '',
    '运行时环境变量约定：',
    `- IAM_APP_KEY=${input.application.appKey}`,
    '- IAM_APP_SECRET=<从 feishu-iam 创建或轮换结果取得，只写入运行时环境>',
    `- IAM_API_KEY=${input.application.apiKey}`,
    '- IAM_API_SECRET=<从 feishu-iam 创建或轮换结果取得，只写入运行时环境>',
    '',
    'SSO 登录要求：',
    '- 登录入口跳转到 OAUTH_AUTHORIZE_ENDPOINT，携带 client_id、redirect_uri、state。',
    '- callback 接收 code 和 state 后调用 OAUTH_TOKEN_ENDPOINT 换取第三方 bearer token。',
    '- 未登录、授权失败、token exchange 失败、无权限时必须提供可恢复提示和重新登录入口。',
    '',
    'Application API HMAC 鉴权要求：',
    '- 请求头包含 x-fiam-app-key、x-fiam-timestamp、x-fiam-nonce、x-fiam-body-sha256、x-fiam-signature。',
    '- body hash 使用原始请求体的 SHA-256 hex。',
    '- signature 使用 IAM_API_SECRET 对 canonical string 做 HMAC-SHA256 hex。',
    '- canonical string 格式：METHOD、path、排序后的 query、timestamp、nonce、bodyHash，以换行拼接。',
    '- timestamp 默认 5 分钟容忍窗口，nonce 不能重放。',
    '',
    '权限接入要求：',
    '- 通过 PUT /api/application/permission-groups 注册权限组。',
    '- 通过 PUT /api/application/permission-points 注册权限点。',
    '- 当前用户权限查询使用 GET /api/application/me/permissions。',
    '- 权限点命名采用 domain.resource:action，例如 crm.customer:read。',
    '- 前端路由、菜单、按钮和后端接口都必须根据权限查询结果做授权判断。',
  ].join('\n');
}

async function copyText(value: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('clipboard unavailable');
  }
  await navigator.clipboard.writeText(value);
}

interface RedirectUriFormValues {
  redirectUri: string;
  environment: RedirectUriEnvironment;
  note?: string;
}

interface RotateSecretFormValues {
  applicationCode: string;
}

interface AdminFormValues {
  feishuUserId: string;
}

export function ApplicationDetailPage() {
  const { message } = App.useApp();
  const { id = 'app_demo_crm' } = useParams();
  const [redirectDrawerOpen, setRedirectDrawerOpen] = useState(false);
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);
  const [rotateKind, setRotateKind] = useState<SecretKind>();
  const [secretResult, setSecretResult] = useState<RotateSecretResult>();
  const [adminError, setAdminError] = useState<string>();
  const [auditFilters, setAuditFilters] = useState<{
    action?: AuditAction;
    result?: AuditResult;
    keyword?: string;
  }>({});
  const [redirectForm] = Form.useForm<RedirectUriFormValues>();
  const [adminForm] = Form.useForm<AdminFormValues>();
  const [rotateForm] = Form.useForm<RotateSecretFormValues>();

  const applicationQuery = useApplication(id);
  const redirectUrisQuery = useApplicationRedirectUris(id);
  const adminsQuery = useApplicationAdmins(id);
  const diagnosticsQuery = useApplicationDiagnostics(id);
  const permissionRegistrationsQuery = useApplicationPermissionRegistrations(id);
  const auditLogsQuery = useAuditLogs({ applicationId: id, page: 1, pageSize: 20, ...auditFilters });
  const currentSessionQuery = useCurrentSession();
  const directoryUsersQuery = useDirectoryUsers({ page: 1, pageSize: 100 });
  const createRedirectUriMutation = useCreateApplicationRedirectUri();
  const updateRedirectUriStatusMutation = useUpdateApplicationRedirectUriStatus();
  const rotateSecretMutation = useRotateApplicationSecret();
  const addAdminMutation = useAddApplicationAdmin();
  const removeAdminMutation = useRemoveApplicationAdmin();
  const recordRuntimeSecretCopyMutation = useRecordRuntimeSecretCopy();
  const copyDiagnosticsMutation = useCopyApplicationDiagnostics();

  const application = applicationQuery.data;
  const diagnostics = diagnosticsQuery.data;
  const canManageApplication = isPlatformAdmin(currentSessionQuery.data);
  const statusConfig = statusLabels[application?.status ?? 'draft'];
  const diagnosticStatusConfig = diagnosticStatusLabels[diagnostics?.status ?? 'failed'];
  const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');
  const applicationPrompt = application
    ? buildApplicationPrompt({ application, redirectUris: redirectUrisQuery.data ?? [] })
    : '';

  const directoryUserOptions = useMemo(
    () =>
      (directoryUsersQuery.data?.items ?? []).map((user) => ({
        label: `${user.displayName} (${user.feishuUserId})`,
        value: user.feishuUserId,
      })),
    [directoryUsersQuery.data?.items],
  );

  const redirectColumns = useMemo<ColumnsType<ApplicationRedirectUri>>(
    () => [
      {
        title: 'Redirect URI',
        dataIndex: 'redirectUri',
        width: 320,
        render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>,
      },
      {
        title: '环境',
        dataIndex: 'environment',
        width: 96,
        render: (environment: RedirectUriEnvironment) => environmentLabels[environment],
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
        render: (status: RedirectUriStatus) => {
          const config = redirectStatusLabels[status];
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      { title: '说明', dataIndex: 'note', width: 180 },
      { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: formatDateTime },
      {
        title: '操作',
        key: 'action',
        width: 104,
        render: (_, row) =>
          canManageApplication ? (
            <Button
              type="link"
              danger={row.status === 'active'}
              size="small"
              onClick={() => confirmRedirectUriStatus(row)}
              loading={updateRedirectUriStatusMutation.isPending}
            >
              {row.status === 'active' ? '停用' : '恢复'}
            </Button>
          ) : (
            <Typography.Text type="secondary">只读</Typography.Text>
          ),
      },
    ],
    [canManageApplication, updateRedirectUriStatusMutation.isPending],
  );

  const adminColumns = useMemo<ColumnsType<ApplicationAdmin>>(
    () => [
      { title: '姓名', dataIndex: 'name' },
      { title: '飞书 User ID', dataIndex: 'feishuUserId', render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
      { title: '邮箱', dataIndex: 'email', render: (value?: string) => value ?? '-' },
      {
        title: '角色',
        dataIndex: 'role',
        render: (role: ApplicationAdmin['role']) => (role === 'primary' ? <Tag color="blue">主管理员</Tag> : <Tag>应用管理员</Tag>),
      },
      {
        title: '飞书状态',
        dataIndex: 'status',
        render: (status: ApplicationAdmin['status']) => (
          <Tag color={status === 'active' ? 'success' : 'default'}>{status === 'active' ? '在职' : status}</Tag>
        ),
      },
      { title: '添加时间', dataIndex: 'createdAt', render: formatDateTime },
      {
        title: '操作',
        key: 'action',
        width: 96,
        render: (_, row) =>
          canManageApplication ? (
            <Button type="link" danger size="small" onClick={() => removeAdmin(row)} loading={removeAdminMutation.isPending}>
              移除
            </Button>
          ) : (
            <Typography.Text type="secondary">只读</Typography.Text>
          ),
      },
    ],
    [canManageApplication, removeAdminMutation.isPending],
  );

  const permissionColumns = useMemo<ColumnsType<ApplicationPermissionRegistration>>(
    () => [
      {
        title: '权限组 Code',
        dataIndex: 'groupCode',
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
      },
      { title: '权限组名称', dataIndex: 'groupName' },
      {
        title: '权限点 Code',
        dataIndex: 'permissionCode',
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
      },
      { title: '权限点名称', dataIndex: 'permissionName' },
      {
        title: '状态',
        dataIndex: 'status',
        render: (status: ApplicationPermissionRegistration['status']) => (
          <Tag color={status === 'active' ? 'success' : 'default'}>{status === 'active' ? '启用' : '停用'}</Tag>
        ),
      },
      { title: '最近注册/更新时间', dataIndex: 'updatedAt', render: formatDateTime },
    ],
    [],
  );

  const auditColumns = useMemo<ColumnsType<AuditLog>>(
    () => [
      { title: '事件', dataIndex: 'action', width: 180 },
      { title: '说明', dataIndex: 'message' },
      { title: '结果', dataIndex: 'result', width: 96, render: (value: AuditResult) => <Tag color={value === 'success' ? 'success' : 'error'}>{value === 'success' ? '成功' : '失败'}</Tag> },
      { title: '操作者', dataIndex: 'actorFeishuUserId', width: 180 },
      { title: '请求 ID', dataIndex: 'requestId', width: 180 },
      { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
    ],
    [],
  );

  const diagnosticFindingColumns = useMemo<ColumnsType<ApplicationDiagnosticFinding>>(
    () => [
      {
        title: '级别',
        dataIndex: 'severity',
        width: 96,
        render: (severity: ApplicationDiagnosticFinding['severity']) => {
          const config = diagnosticSeverityLabels[severity];
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      { title: '编码', dataIndex: 'code', width: 220, render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
      { title: '问题', dataIndex: 'title', width: 180 },
      { title: '处理建议', dataIndex: 'nextAction' },
      { title: '关联请求', dataIndex: 'relatedRequestId', width: 180, render: (value?: string) => value ?? '-' },
    ],
    [],
  );

  const diagnosticEventColumns = useMemo<ColumnsType<ApplicationDiagnosticEvent>>(
    () => [
      { title: '事件', dataIndex: 'action', width: 220 },
      {
        title: '结果',
        dataIndex: 'result',
        width: 96,
        render: (value: ApplicationDiagnosticEvent['result']) => (
          <Tag color={value === 'success' ? 'success' : 'error'}>{value === 'success' ? '成功' : '失败'}</Tag>
        ),
      },
      { title: '请求 ID', dataIndex: 'requestId', width: 180 },
      { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
      { title: '说明', dataIndex: 'message' },
    ],
    [],
  );

  if (applicationQuery.isError) {
    return <Alert type="error" showIcon title="加载应用详情失败" description="请确认应用是否存在，或稍后重试。" />;
  }

  const confirmRedirectUriStatus = (row: ApplicationRedirectUri) => {
    const nextStatus: RedirectUriStatus = row.status === 'active' ? 'disabled' : 'active';
    Modal.confirm({
      title: nextStatus === 'disabled' ? '停用 redirect URI' : '恢复 redirect URI',
      content:
        nextStatus === 'disabled'
          ? '停用后该地址将不能通过 OAuth authorize 校验，已发起的配置变更会写入审计记录。'
          : '恢复后该地址将重新允许 OAuth authorize 校验。',
      okText: nextStatus === 'disabled' ? '确认停用' : '确认恢复',
      okButtonProps: { danger: nextStatus === 'disabled' },
      cancelText: '取消',
      onOk: async () => {
        await updateRedirectUriStatusMutation.mutateAsync({
          applicationId: id,
          input: { redirectUri: row.redirectUri, status: nextStatus },
        });
        message.success(nextStatus === 'disabled' ? '已停用 redirect URI' : '已恢复 redirect URI');
      },
    });
  };

  const submitRedirectUri = async (values: RedirectUriFormValues) => {
    await createRedirectUriMutation.mutateAsync({ applicationId: id, input: values });
    setRedirectDrawerOpen(false);
    redirectForm.resetFields();
    message.success('已新增 redirect URI');
  };

  const submitRotateSecret = async (values: RotateSecretFormValues) => {
    if (!rotateKind || !application) {
      return;
    }
    if (values.applicationCode !== application.code) {
      rotateForm.setFields([{ name: 'applicationCode', errors: ['请输入应用 Code 后再确认轮换'] }]);
      return;
    }

    const result = await rotateSecretMutation.mutateAsync({ applicationId: id, kind: rotateKind });
    setRotateKind(undefined);
    rotateForm.resetFields();
    setSecretResult(result);
  };

  const submitAdmin = async (values: AdminFormValues) => {
    setAdminError(undefined);
    await addAdminMutation.mutateAsync({ applicationId: id, input: values });
    setAdminDrawerOpen(false);
    adminForm.resetFields();
    message.success('已新增应用管理员');
  };

  const copyApplicationPrompt = async () => {
    if (!applicationPrompt || !application) {
      return;
    }
    try {
      await copyText(applicationPrompt);
      await recordRuntimeSecretCopyMutation.mutateAsync({ applicationId: id, kind: 'agent_prompt' });
      message.success('应用提示词已复制，并记录审计事件');
    } catch {
      message.error('浏览器剪贴板不可用，请手动复制应用提示词。');
    }
  };

  const copyApplicationDiagnosticsPackage = async () => {
    if (!application || !diagnostics) {
      return;
    }
    try {
      await copyText(buildApplicationDiagnosticsMarkdown({ application, diagnostics }));
      await copyDiagnosticsMutation.mutateAsync(id);
      message.success('接入诊断包已复制，并记录审计事件');
    } catch {
      message.error('浏览器剪贴板不可用，请手动复制接入诊断包。');
    }
  };

  const removeAdmin = async (admin: ApplicationAdmin) => {
    setAdminError(undefined);
    Modal.confirm({
      title: '移除应用管理员',
      content: `确认移除 ${admin.name}？移除后该用户将不能维护此应用配置。`,
      okText: '确认移除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await removeAdminMutation.mutateAsync({ applicationId: id, feishuUserId: admin.feishuUserId });
          message.success('已移除应用管理员');
        } catch (error) {
          const isLastAdminError =
            (isIamHttpError(error) && error.code === 'LAST_APPLICATION_ADMIN') ||
            (error instanceof Error && error.message.includes('LAST_APPLICATION_ADMIN'));
          const text = isLastAdminError
            ? '至少保留 1 位应用管理员，不能移除最后管理员。'
            : '移除应用管理员失败，请稍后重试。';
          setAdminError(text);
        }
      },
    });
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          应用详情
        </Typography.Title>
        <Typography.Text type="secondary">应用接入生产化配置、管理员维护和配置变更审计。</Typography.Text>
      </Space>

      <Tabs
        animated={false}
        items={[
          {
            key: 'overview',
            label: '概览',
            children: (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Space wrap size={16} style={{ width: '100%' }}>
                  <Card style={{ flex: '1 1 220px' }} loading={applicationQuery.isLoading}>
                    <Statistic title="应用状态" value={statusConfig.text} prefix={<SafetyCertificateOutlined />} />
                  </Card>
                  <Card style={{ flex: '1 1 220px' }} loading={applicationQuery.isLoading}>
                    <Statistic title="启用 redirect URI" value={application?.activeRedirectUriCount ?? 0} suffix={`/ ${application?.redirectUriCount ?? 0}`} prefix={<LinkOutlined />} />
                  </Card>
                  <Card style={{ flex: '1 1 220px' }} loading={applicationQuery.isLoading}>
                    <Statistic title="应用管理员" value={application?.adminCount ?? 0} prefix={<TeamOutlined />} />
                  </Card>
                  <Card style={{ flex: '1 1 220px' }} loading={applicationQuery.isLoading}>
                    <Statistic title="配置审计" value={auditLogsQuery.data?.total ?? 0} prefix={<AuditOutlined />} />
                  </Card>
                </Space>

                <Card loading={applicationQuery.isLoading}>
                  {application ? (
                    <Descriptions bordered column={{ xs: 1, sm: 1, md: 2, lg: 2 }} size="middle">
                      <Descriptions.Item label="应用名称">{application.name}</Descriptions.Item>
                      <Descriptions.Item label="appKey">{application.appKey}</Descriptions.Item>
                      <Descriptions.Item label="应用 Code">{application.code}</Descriptions.Item>
                      <Descriptions.Item label="状态">
                        <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="接入状态">
                        <Tag icon={<CheckCircleOutlined />} color={application.activeRedirectUriCount ? 'success' : 'warning'}>
                          {application.activeRedirectUriCount ? '配置可用' : '待补 redirect URI'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="创建人">{application.ownerName}</Descriptions.Item>
                      <Descriptions.Item label="创建时间">{formatDateTime(application.createdAt)}</Descriptions.Item>
                      <Descriptions.Item label="最近 API 调用">{formatDateTime(application.lastApiCalledAt)}</Descriptions.Item>
                    </Descriptions>
                  ) : null}
                </Card>
              </Space>
            ),
          },
          {
            key: 'config',
            label: '接入配置',
            children: (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Card title="凭证状态">
                  <Descriptions bordered column={{ xs: 1, md: 2 }} size="middle">
                    <Descriptions.Item label="appKey">{application?.appKey ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="API key">{application?.apiKey ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="appSecret 最近轮换">{formatDateTime(application?.appSecretRotatedAt)}</Descriptions.Item>
                    <Descriptions.Item label="API secret 最近轮换">{formatDateTime(application?.apiSecretRotatedAt)}</Descriptions.Item>
                  </Descriptions>
                  {canManageApplication ? (
                    <Space wrap style={{ marginTop: 16 }}>
                      <Button icon={<KeyOutlined />} onClick={() => setRotateKind('app_secret')}>
                        轮换 appSecret
                      </Button>
                      <Button icon={<SyncOutlined />} onClick={() => setRotateKind('api_secret')}>
                        轮换 API secret
                      </Button>
                    </Space>
                  ) : null}
                </Card>

                <Card
                  title="第三方应用接入提示词"
                  extra={
                    <Button
                      icon={<CopyOutlined />}
                      onClick={copyApplicationPrompt}
                      loading={recordRuntimeSecretCopyMutation.isPending}
                      disabled={!application}
                    >
                      复制应用提示词
                    </Button>
                  }
                >
                  <Alert
                    type="info"
                    showIcon
                    title="提示词用于 Codex / Claude Code 创建或维护第三方项目 AGENTS.md / CLAUDE.md。"
                    description="默认只包含 SSO 接入配置、redirect URI、Application API 和 HMAC 规则；真实 secret 仍只能写入运行时环境变量或 secret manager。"
                  />
                </Card>

                <Card
                  title="OAuth redirect URI"
                  extra={
                    canManageApplication ? (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setRedirectDrawerOpen(true)}>
                        新增 redirect URI
                      </Button>
                    ) : null
                  }
                >
                  <Table
                    rowKey={(row) => row.redirectUri}
                    size="middle"
                    columns={redirectColumns}
                    dataSource={redirectUrisQuery.data ?? []}
                    loading={redirectUrisQuery.isLoading}
                    pagination={false}
                    scroll={isJsdom ? undefined : { x: 940 }}
                    locale={{
                      emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未配置 redirect URI" />,
                    }}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'permissions',
            label: '权限注册',
            children: (
              <Card>
                <Table
                  rowKey="id"
                  size="middle"
                  columns={permissionColumns}
                  dataSource={permissionRegistrationsQuery.data ?? []}
                  loading={permissionRegistrationsQuery.isLoading}
                  pagination={false}
                  scroll={isJsdom ? undefined : { x: 920 }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <Space orientation="vertical" size={4}>
                            <Typography.Text>该应用还没有注册权限点</Typography.Text>
                            <Typography.Text type="secondary">第三方系统需要调用 Application API 注册权限组和权限点。</Typography.Text>
                            <Button type="link">查看接入文档</Button>
                          </Space>
                        }
                      />
                    ),
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'diagnostics',
            label: '接入诊断',
            children: (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type={diagnosticStatusConfig.alertType}
                  showIcon
                  icon={diagnostics?.status === 'healthy' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                  title={`接入诊断：${diagnosticStatusConfig.text}`}
                  description={
                    diagnostics
                      ? `最近检查时间：${formatDateTime(diagnostics.checkedAt)}。诊断只展示配置状态、计数、requestId 和接入端点，不展示任何密钥或 token 原文。`
                      : '正在读取应用接入诊断结果。'
                  }
                />

                <Space wrap size={16} style={{ width: '100%' }}>
                  <Card style={{ flex: '1 1 180px' }} loading={diagnosticsQuery.isLoading}>
                    <Statistic title="应用管理员" value={diagnostics?.counts.applicationAdmins ?? 0} />
                  </Card>
                  <Card style={{ flex: '1 1 180px' }} loading={diagnosticsQuery.isLoading}>
                    <Statistic title="权限点" value={diagnostics?.counts.permissionPoints ?? 0} />
                  </Card>
                  <Card style={{ flex: '1 1 180px' }} loading={diagnosticsQuery.isLoading}>
                    <Statistic title="角色授权绑定" value={diagnostics?.counts.roleBindings ?? 0} />
                  </Card>
                  <Card style={{ flex: '1 1 180px' }} loading={diagnosticsQuery.isLoading}>
                    <Statistic title="在职用户" value={diagnostics?.counts.syncedUsers ?? 0} />
                  </Card>
                </Space>

                <Card
                  title="接入端点与配置状态"
                  loading={diagnosticsQuery.isLoading}
                  extra={
                    <Button
                      icon={<CopyOutlined />}
                      onClick={copyApplicationDiagnosticsPackage}
                      loading={copyDiagnosticsMutation.isPending}
                      disabled={!application || !diagnostics}
                    >
                      复制诊断包
                    </Button>
                  }
                >
                  {diagnostics ? (
                    <Descriptions bordered column={{ xs: 1, md: 2 }} size="middle">
                      <Descriptions.Item label="OAuth authorize">{diagnostics.endpoints.oauthAuthorize}</Descriptions.Item>
                      <Descriptions.Item label="OAuth token">{diagnostics.endpoints.oauthToken}</Descriptions.Item>
                      <Descriptions.Item label="权限查询">{diagnostics.endpoints.applicationPermissions}</Descriptions.Item>
                      <Descriptions.Item label="启用 redirect URI">{diagnostics.redirectUris.active.length}</Descriptions.Item>
                      <Descriptions.Item label="appSecret">
                        <Tag color={diagnostics.secrets.appSecret.status === 'issued' ? 'success' : 'error'}>
                          {diagnostics.secrets.appSecret.status === 'issued' ? '已签发' : '缺失'}
                        </Tag>
                        <Typography.Text type="secondary">{formatDateTime(diagnostics.secrets.appSecret.rotatedAt)}</Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="API secret">
                        <Tag color={diagnostics.secrets.apiSecret.status === 'issued' ? 'success' : 'error'}>
                          {diagnostics.secrets.apiSecret.status === 'issued' ? '已签发' : '缺失'}
                        </Tag>
                        <Typography.Text type="secondary">{formatDateTime(diagnostics.secrets.apiSecret.rotatedAt)}</Typography.Text>
                      </Descriptions.Item>
                    </Descriptions>
                  ) : null}
                </Card>

                <Card title="诊断发现">
                  <Table
                    rowKey="code"
                    size="middle"
                    columns={diagnosticFindingColumns}
                    dataSource={diagnostics?.findings ?? []}
                    loading={diagnosticsQuery.isLoading}
                    pagination={false}
                    scroll={isJsdom ? undefined : { x: 1060 }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未发现接入阻塞或风险" /> }}
                  />
                </Card>

                <Card title="最近接入事件">
                  <Table
                    rowKey={(row) => `${row.action}:${row.requestId}:${row.createdAt}`}
                    size="middle"
                    columns={diagnosticEventColumns}
                    dataSource={diagnostics?.recentEvents ?? []}
                    loading={diagnosticsQuery.isLoading}
                    pagination={false}
                    scroll={isJsdom ? undefined : { x: 1060 }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 OAuth 或 Application API 事件" /> }}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'admins',
            label: '应用管理员',
            children: (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                {adminError ? <Alert type="error" showIcon message={adminError} /> : null}
                <Card
                  title="应用管理员"
                  extra={
                    canManageApplication ? (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdminDrawerOpen(true)}>
                        新增应用管理员
                      </Button>
                    ) : null
                  }
                >
                  <Table
                    rowKey={(row) => row.feishuUserId}
                    size="middle"
                    columns={adminColumns}
                    dataSource={adminsQuery.data ?? []}
                    loading={adminsQuery.isLoading}
                    pagination={false}
                    scroll={isJsdom ? undefined : { x: 860 }}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'audit',
            label: '审计记录',
            children: (
              <Card>
                <Space wrap style={{ marginBottom: 16 }}>
                  <Select
                    allowClear
                    placeholder="事件类型"
                    style={{ width: 200 }}
                    options={auditActionOptions}
                    value={auditFilters.action}
                    onChange={(action) => setAuditFilters((prev) => ({ ...prev, action }))}
                  />
                  <Select
                    allowClear
                    placeholder="结果"
                    style={{ width: 120 }}
                    options={[
                      { label: '成功', value: 'success' },
                      { label: '失败', value: 'failed' },
                    ]}
                    value={auditFilters.result}
                    onChange={(result) => setAuditFilters((prev) => ({ ...prev, result }))}
                  />
                  <Input.Search
                    allowClear
                    placeholder="搜索操作者 / 请求 ID"
                    style={{ width: 260 }}
                    onSearch={(keyword) => setAuditFilters((prev) => ({ ...prev, keyword }))}
                  />
                </Space>
                <Table
                  rowKey="id"
                  size="middle"
                  columns={auditColumns}
                  dataSource={auditLogsQuery.data?.items ?? []}
                  loading={auditLogsQuery.isLoading}
                  pagination={false}
                  scroll={isJsdom ? undefined : { x: 1080 }}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无配置变更审计记录" /> }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Drawer
        title="新增 redirect URI"
        size="large"
        open={redirectDrawerOpen}
        onClose={() => setRedirectDrawerOpen(false)}
        destroyOnHidden
      >
        <Form form={redirectForm} layout="vertical" initialValues={{ environment: 'production' }} onFinish={submitRedirectUri}>
          <Form.Item
            label="Redirect URI"
            name="redirectUri"
            rules={[
              { required: true, message: '请输入 redirect URI' },
              { type: 'url', message: '请输入完整 URL' },
            ]}
          >
            <Input placeholder="https://your-app.example.com/auth/callback" />
          </Form.Item>
          <Form.Item label="环境" name="environment" rules={[{ required: true, message: '请选择环境' }]}>
            <Select
              options={[
                { label: '生产', value: 'production' },
                { label: '预发', value: 'staging' },
                { label: '本地', value: 'local' },
              ]}
            />
          </Form.Item>
          <Form.Item label="说明" name="note">
            <Input.TextArea rows={3} maxLength={120} showCount placeholder="例如：生产主域名回调地址" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={createRedirectUriMutation.isPending}>
              保存
            </Button>
            <Button onClick={() => setRedirectDrawerOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer title="新增应用管理员" size="large" open={adminDrawerOpen} onClose={() => setAdminDrawerOpen(false)} destroyOnHidden>
        <Form form={adminForm} layout="vertical" onFinish={submitAdmin}>
          <Form.Item label="飞书用户" name="feishuUserId" rules={[{ required: true, message: '请选择飞书用户' }]}>
            <Select
              showSearch
              placeholder="搜索或选择飞书用户"
              options={directoryUserOptions}
              loading={directoryUsersQuery.isLoading}
              optionFilterProp="label"
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={addAdminMutation.isPending}>
              保存
            </Button>
            <Button onClick={() => setAdminDrawerOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Drawer>

      <Modal
        title={rotateKind ? `轮换 ${secretKindLabels[rotateKind]}` : '轮换 secret'}
        open={Boolean(rotateKind)}
        okText="确认轮换"
        okButtonProps={{ danger: true, loading: rotateSecretMutation.isPending }}
        cancelText="取消"
        onCancel={() => {
          setRotateKind(undefined);
          rotateForm.resetFields();
        }}
        onOk={() => rotateForm.submit()}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="轮换后旧 secret 立即失效，新 secret 仅显示一次。请先确认下游服务可以同步更新。"
        />
        <Form form={rotateForm} layout="vertical" onFinish={submitRotateSecret}>
          <Form.Item
            label={`输入应用 Code：${application?.code ?? '-'}`}
            name="applicationCode"
            rules={[{ required: true, message: '请输入应用 Code 后再确认轮换' }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新 secret 仅显示一次"
        open={Boolean(secretResult)}
        okText="我已保存"
        cancelButtonProps={{ style: { display: 'none' } }}
        onOk={() => setSecretResult(undefined)}
        onCancel={() => setSecretResult(undefined)}
      >
        <Alert type="warning" showIcon message="关闭后无法再次查看，请立即保存到运行环境变量或密钥管理系统。" />
        <Typography.Paragraph style={{ marginTop: 16 }}>
          <Typography.Text strong>{secretResult ? secretKindLabels[secretResult.kind] : 'secret'}</Typography.Text>
        </Typography.Paragraph>
        <Typography.Text code copyable>
          {secretResult?.secret}
        </Typography.Text>
      </Modal>
    </Space>
  );
}
