import { CheckCircleOutlined, CopyOutlined, FileTextOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Modal, Row, Space, Steps, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import { useApplications, useRecordRuntimeSecretCopy } from '../../features/iam/queries';
import type { Application } from '../../features/iam/types';

const secretWarning =
  '以下内容包含 secret。只允许写入运行时环境变量，不得提交到 Git、AGENTS.md、CLAUDE.md、README 或测试日志。';

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
    `IAM_APP_SECRET=${application.appSecretPreview}`,
    `IAM_API_KEY=${application.apiKey}`,
    `IAM_API_SECRET=${application.apiSecretPreview}`,
    `IAM_CALLBACK_URL=${application.callbackUrls[0] ?? ''}`,
  ].join('\n');
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  }
}

export function ApplicationOnboardingPage() {
  const applicationsQuery = useApplications({ page: 1, pageSize: 1 });
  const recordRuntimeSecretCopyMutation = useRecordRuntimeSecretCopy();
  const [currentStep, setCurrentStep] = useState(0);
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [auditFeedback, setAuditFeedback] = useState('');
  const application = applicationsQuery.data?.items[0];

  const agentPrompt = useMemo(() => (application ? buildAgentPrompt(application) : ''), [application]);
  const runtimeEnv = useMemo(() => (application ? buildRuntimeEnv(application) : ''), [application]);

  const confirmRuntimeEnvCopy = async () => {
    if (!application) {
      return;
    }

    setSecretModalOpen(false);
    await copyText(runtimeEnv);
    await recordRuntimeSecretCopyMutation.mutateAsync(application.id);
    setAuditFeedback('已复制，并记录审计事件。');
    message.success('已复制，并记录审计事件。');
  };

  const copyAgentPrompt = async () => {
    await copyText(agentPrompt);
    message.success('Agent Prompt 已复制');
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
          <Button type="primary" icon={<CopyOutlined />} onClick={() => setSecretModalOpen(true)}>
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
          <Button icon={<FileTextOutlined />} onClick={copyAgentPrompt}>
            复制 Agent Prompt
          </Button>
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
          description="权限点命名建议使用 domain.resource:action，并保持与业务菜单、按钮动作一致。"
        />
      ),
    },
    {
      title: '验证登录和权限查询',
      content: (
        <Descriptions bordered column={1} size="middle">
          <Descriptions.Item label="登录验证">使用飞书 OIDC 完成授权回调。</Descriptions.Item>
          <Descriptions.Item label="权限查询">调用 Application API 查询当前飞书用户权限点。</Descriptions.Item>
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
          <Card title="接入检查清单">
            <Space orientation="vertical" size={12}>
              <Typography.Text>
                <CheckCircleOutlined /> 回调地址已配置
              </Typography.Text>
              <Typography.Text>
                <SafetyCertificateOutlined /> 运行时 secret 单独复制
              </Typography.Text>
              <Typography.Text>
                <CheckCircleOutlined /> Agent Prompt 使用占位符
              </Typography.Text>
              <Typography.Text>
                <CheckCircleOutlined /> 权限组和权限点待注册
              </Typography.Text>
              <Tag color="processing">待验证登录和权限查询</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Agent Prompt">
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <pre style={codeBlockStyle}>{agentPrompt}</pre>
          <Button icon={<CopyOutlined />} onClick={copyAgentPrompt}>
            复制 Agent Prompt
          </Button>
        </Space>
      </Card>

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
