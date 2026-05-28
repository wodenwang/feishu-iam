import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Descriptions, Modal, Row, Space, Steps, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApplicationPermissionRegistrations, useApplications, useRecordRuntimeSecretCopy } from '../../features/iam/queries';
import type { Application } from '../../features/iam/types';

const secretWarning =
  '以下内容包含 secret。只允许写入运行时环境变量，不得提交到 Git、AGENTS.md、CLAUDE.md、README 或测试日志。';

const apiDocsUrl = '/docs/application-api';

const codeBlockStyle = {
  background: '#f5f5f5',
  border: '1px solid #d9d9d9',
  borderRadius: 6,
  padding: 16,
  margin: 0,
  whiteSpace: 'pre-wrap',
  fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
  fontSize: 13,
} as const;

type CheckStatus = 'pending' | 'pass' | 'fail';

const checkStatusMeta: Record<CheckStatus, { color: string; text: string; icon: ReactNode }> = {
  pending: { color: 'default', text: '待检查', icon: <SafetyCertificateOutlined aria-hidden="true" /> },
  pass: { color: 'success', text: '通过', icon: <CheckCircleOutlined aria-hidden="true" /> },
  fail: { color: 'error', text: '失败', icon: <CloseCircleOutlined aria-hidden="true" /> },
};

function buildAgentPrompt(application: Application) {
  const callbackUrl = application.callbackUrls[0] ?? 'https://your-app.example.com/auth/callback';

  return [
    '你正在把业务系统接入 feishu-iam。',
    'IAM_BASE_URL=https://iam.example.com',
    `IAM_APP_KEY=${application.appKey}`,
    'IAM_APP_SECRET=IAM_APP_SECRET',
    `OIDC_CALLBACK_URL=${callbackUrl}`,
    'OIDC_AUTHORIZE_ENDPOINT=/oauth/authorize',
    'OIDC_TOKEN_ENDPOINT=/oauth/token',
    `IAM_API_KEY=${application.apiKey}`,
    'IAM_API_SECRET=IAM_API_SECRET',
    'API_DOCS_URL=https://iam.example.com/docs/application-api',
    '权限点命名采用 domain.resource:action，例如 crm.customer:read。',
    '不要把真实 secret 写入 Git、AGENTS.md、CLAUDE.md、README 或测试日志。',
  ].join('\n');
}

function buildRuntimeEnv(application: Application) {
  return [
    `IAM_APP_KEY=${application.appKey}`,
    'IAM_APP_SECRET=IAM_APP_SECRET',
    `IAM_API_KEY=${application.apiKey}`,
    'IAM_API_SECRET=IAM_API_SECRET',
    `IAM_CALLBACK_URL=${application.callbackUrls[0] ?? ''}`,
  ].join('\n');
}

async function copyText(value: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('clipboard unavailable');
  }

  await navigator.clipboard.writeText(value);
}

export function ApplicationOnboardingPage() {
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const requestedApplicationId = searchParams.get('applicationId') ?? undefined;
  const applicationsQuery = useApplications({ page: 1, pageSize: 50 });
  const recordRuntimeSecretCopyMutation = useRecordRuntimeSecretCopy();
  const [currentStep, setCurrentStep] = useState(0);
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [auditFeedback, setAuditFeedback] = useState('');
  const [checksHaveRun, setChecksHaveRun] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState('');
  const application =
    applicationsQuery.data?.items.find((item) => item.id === requestedApplicationId) ?? applicationsQuery.data?.items[0];
  const permissionRegistrationsQuery = useApplicationPermissionRegistrations(application?.id ?? '', { enabled: Boolean(application) });

  const agentPrompt = useMemo(() => (application ? buildAgentPrompt(application) : ''), [application]);
  const runtimeEnv = useMemo(() => (application ? buildRuntimeEnv(application) : ''), [application]);
  const checkItems = useMemo(() => {
    const callbackConfigured = Boolean(application?.callbackUrls.length && application.allowedOrigins.length);
    const promptUsesPlaceholders =
      Boolean(agentPrompt) &&
      !agentPrompt.includes(application?.appSecretPreview ?? '') &&
      !agentPrompt.includes(application?.apiSecretPreview ?? '');

    const hasPermissionRegistrations = Boolean(permissionRegistrationsQuery.data?.length);
    const hasRecentApiCall = Boolean(application?.lastApiCalledAt);

    return [
      {
        key: 'callback',
        title: '回调地址和允许来源',
        description: checksHaveRun ? '已检查应用回调地址与浏览器允许来源配置。' : '等待检查应用配置是否可用于 OIDC 回调。',
        status: checksHaveRun ? (callbackConfigured ? 'pass' : 'fail') : 'pending',
      },
      {
        key: 'secret',
        title: '运行时 secret 分离',
        description: checksHaveRun ? '检查是否已经通过二次确认复制运行时配置。' : '复制 `.env` 前不会在 Agent Prompt 中暴露 secret。',
        status: checksHaveRun ? (auditFeedback ? 'pass' : 'fail') : 'pending',
      },
      {
        key: 'prompt',
        title: 'Agent Prompt 占位符',
        description: checksHaveRun ? 'Agent Prompt 仅包含 app key、端点和占位符。' : '等待检查 Prompt 是否误带 secret 预览值。',
        status: checksHaveRun ? (promptUsesPlaceholders ? 'pass' : 'fail') : 'pending',
      },
      {
        key: 'permissions',
        title: '权限组和权限点注册',
        description: checksHaveRun
          ? hasPermissionRegistrations
            ? `已发现 ${permissionRegistrationsQuery.data?.length ?? 0} 个权限注册项。`
            : '当前页面未发现已注册权限点，请第三方系统按 API 文档注册后复查。'
          : '等待第三方系统调用 Application API 注册权限模型。',
        status: checksHaveRun ? (hasPermissionRegistrations ? 'pass' : 'fail') : 'pending',
      },
      {
        key: 'login',
        title: '登录和权限查询',
        description: checksHaveRun
          ? hasRecentApiCall
            ? '已发现该应用的最近 Application API 调用记录。'
            : '需要 demo 应用完成飞书登录回调或权限查询后再次验证。'
          : '等待实际发起飞书登录和权限查询。',
        status: checksHaveRun ? (hasRecentApiCall ? 'pass' : 'fail') : 'pending',
      },
    ] satisfies Array<{ key: string; title: string; description: string; status: CheckStatus }>;
  }, [agentPrompt, application, auditFeedback, checksHaveRun, permissionRegistrationsQuery.data]);

  const confirmRuntimeEnvCopy = async () => {
    if (!application) {
      return;
    }

    try {
      await copyText(runtimeEnv);
      setSecretModalOpen(false);
      await recordRuntimeSecretCopyMutation.mutateAsync({ applicationId: application.id, kind: 'runtime_env' });
      setAuditFeedback('已复制，并记录审计事件。');
      message.success('已复制，并记录审计事件。');
    } catch {
      message.error('浏览器剪贴板不可用，请手动复制配置。');
    }
  };

  const copyAgentPrompt = async () => {
    try {
      await copyText(agentPrompt);
      if (application) {
        await recordRuntimeSecretCopyMutation.mutateAsync({ applicationId: application.id, kind: 'agent_prompt_placeholder' });
      }
      message.success('Agent Prompt 已复制');
    } catch {
      message.error('浏览器剪贴板不可用，请手动复制 Agent Prompt。');
    }
  };

  const runConnectionCheck = () => {
    setChecksHaveRun(true);
    setCheckFeedback('接入检查已完成，仍有项目需要处理。');
  };

  const stepDetails = [
    {
      title: '配置回调地址',
      content: (
        <Descriptions bordered column={1} size="middle">
          <Descriptions.Item label="应用">{application?.name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="OIDC 回调地址">{application?.callbackUrls.join('、') ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="允许来源">{application?.allowedOrigins.join('、') ?? '-'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      title: '复制运行时环境变量',
      content: (
        <Space orientation="vertical" size={12}>
          <Alert type="warning" showIcon title="运行时密钥只能进入部署环境变量，不能进入仓库、文档或测试日志。" />
          <Button type="primary" icon={<CopyOutlined aria-hidden="true" />} onClick={() => setSecretModalOpen(true)}>
            复制 `.env` 配置
          </Button>
          {auditFeedback ? <Typography.Text type="success">{auditFeedback}</Typography.Text> : null}
        </Space>
      ),
    },
    {
      title: '导出 Agent Prompt',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <pre style={codeBlockStyle}>{agentPrompt}</pre>
          <Space wrap>
            <Button icon={<CopyOutlined aria-hidden="true" />} onClick={copyAgentPrompt}>
              复制 Agent Prompt
            </Button>
            <Button icon={<FileTextOutlined aria-hidden="true" />} href={apiDocsUrl} target="_blank" rel="noreferrer">
              查看 API 文档
            </Button>
          </Space>
        </Space>
      ),
    },
    {
      title: '注册权限组和权限点',
      content: (
        <Alert
          type="info"
          showIcon
          title="第三方系统通过 Application API 注册权限组和权限点。"
          description="权限点命名建议使用 domain.resource:action，并保持与业务菜单、按钮动作一致。注册完成后回到右侧运行接入检查。"
        />
      ),
    },
    {
      title: '验证登录和权限查询',
      content: (
        <Descriptions bordered column={1} size="middle">
          <Descriptions.Item label="登录验证">使用飞书 OIDC 完成授权回调。</Descriptions.Item>
          <Descriptions.Item label="权限查询">调用 Application API 查询当前飞书用户权限点。</Descriptions.Item>
          <Descriptions.Item label="接入检查">点击右侧“运行接入检查”确认当前页面可见配置与接入状态。</Descriptions.Item>
        </Descriptions>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        应用接入向导
      </Typography.Title>

      <Card>
        <Steps
          current={currentStep}
          onChange={setCurrentStep}
          items={stepDetails.map((step) => ({ title: step.title }))}
          responsive={false}
        />
      </Card>

      <Row gutter={16} align="top">
        <Col xs={24} lg={16}>
          <Card title={stepDetails[currentStep].title} loading={applicationsQuery.isLoading}>
            {application ? stepDetails[currentStep].content : <Alert type="error" showIcon title="没有可接入的应用" />}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="接入检查清单"
            extra={
              <Button
                size="small"
                icon={<PlayCircleOutlined aria-hidden="true" />}
                onClick={runConnectionCheck}
                disabled={!application}
              >
                运行接入检查
              </Button>
            }
          >
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {checkItems.map((item) => {
                const meta = checkStatusMeta[item.status];
                return (
                  <Space key={item.key} align="start" size={10} style={{ width: '100%' }}>
                    <Tag icon={meta.icon} color={meta.color} style={{ marginInlineEnd: 0 }}>
                      {meta.text}
                    </Tag>
                    <Space orientation="vertical" size={2}>
                      <Typography.Text strong>{item.title}</Typography.Text>
                      <Typography.Text type="secondary">{item.description}</Typography.Text>
                    </Space>
                  </Space>
                );
              })}
              <Button block icon={<FileTextOutlined aria-hidden="true" />} href={apiDocsUrl} target="_blank" rel="noreferrer">
                查看 API 文档
              </Button>
              {checkFeedback ? <Typography.Text type="warning">{checkFeedback}</Typography.Text> : null}
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title="复制运行时密钥"
        open={secretModalOpen}
        okText="我已理解风险，复制配置"
        cancelText="取消"
        confirmLoading={recordRuntimeSecretCopyMutation.isPending}
        onOk={confirmRuntimeEnvCopy}
        onCancel={() => setSecretModalOpen(false)}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert type="warning" showIcon title={secretWarning} />
          <pre style={codeBlockStyle}>{runtimeEnv}</pre>
        </Space>
      </Modal>
    </Space>
  );
}
