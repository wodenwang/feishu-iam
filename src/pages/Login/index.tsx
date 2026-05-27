import { LoginOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Divider, Space, Spin, Tag, Typography } from 'antd';
import type { CSSProperties } from 'react';

type LoginStatus = 'idle' | 'callbackProcessing' | 'loginRequired' | 'configMissing' | 'authFailed' | 'userNotSynced' | 'noConsoleAccess';

type LoginPageProps = {
  status?: LoginStatus;
  environmentName?: string;
  deploymentUrl?: string;
  apiModeLabel?: string;
  devMockLoginVisible?: boolean;
  devMockLoginLoading?: boolean;
  onLogin?: () => void;
  onDevMockLogin?: () => void;
};

const statusContent: Record<Exclude<LoginStatus, 'idle' | 'callbackProcessing'>, { title: string; subTitle: string; action: string; type: 'info' | 'warning' | 'error' }> = {
  loginRequired: {
    title: '需要通过飞书登录',
    subTitle: '当前浏览器没有有效 IAM 登录态，请重新使用飞书完成身份认证后继续访问第三方应用。',
    action: '使用飞书登录',
    type: 'info',
  },
  configMissing: {
    title: '飞书应用配置缺失',
    subTitle: '当前部署未配置飞书应用，请检查上方环境变量提示',
    action: '重新检查飞书登录',
    type: 'error',
  },
  authFailed: {
    title: '飞书登录失败',
    subTitle: '飞书授权未完成或已失效，请重新发起登录',
    action: '重新使用飞书登录',
    type: 'warning',
  },
  userNotSynced: {
    title: '用户尚未同步',
    subTitle: '已通过飞书认证，但 IAM 中还没有该用户，请联系平台管理员同步通讯录',
    action: '重新使用飞书登录',
    type: 'warning',
  },
  noConsoleAccess: {
    title: '无后台访问权限',
    subTitle: '你已登录，但没有 Admin Console 访问权限',
    action: '重新使用飞书登录',
    type: 'warning',
  },
};

const pageStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: '#eef4f8',
  padding: 24,
} satisfies CSSProperties;

const cardStyle = {
  width: '100%',
  maxWidth: 640,
  borderRadius: 6,
  borderColor: '#d9e2ec',
} satisfies CSSProperties;

function getDefaultDeploymentUrl() {
  if (typeof window === 'undefined') {
    return '当前部署';
  }

  return window.location.origin;
}

export function LoginPage({
  status = 'idle',
  environmentName = '本地部署',
  deploymentUrl,
  apiModeLabel,
  devMockLoginVisible,
  devMockLoginLoading,
  onLogin,
  onDevMockLogin,
}: LoginPageProps) {
  const resolvedDeploymentUrl = deploymentUrl ?? getDefaultDeploymentUrl();

  if (status === 'callbackProcessing') {
    return (
      <main style={pageStyle}>
        <Space orientation="vertical" align="center" size={16} role="status" aria-live="polite">
          <Spin size="large" />
          <Typography.Title level={4} style={{ margin: 0 }}>
            正在验证飞书身份
          </Typography.Title>
          <Typography.Text>请稍候，系统正在处理飞书 OAuth 回调。</Typography.Text>
          <Typography.Text type="secondary">{resolvedDeploymentUrl} · {environmentName}</Typography.Text>
        </Space>
      </main>
    );
  }

  const failure = status === 'idle' ? undefined : statusContent[status];
  const primaryButtonText = failure?.action ?? '使用飞书登录';

  return (
    <main style={pageStyle}>
      <Card style={cardStyle} styles={{ body: { padding: 32 } }}>
        <Space orientation="vertical" size={18} style={{ width: '100%' }}>
          <Space orientation="vertical" size={4}>
            <Typography.Title level={2} style={{ margin: 0, color: '#0f4c81' }}>
              feishu-iam
            </Typography.Title>
            <Typography.Text type="secondary">飞书身份与访问管理 Admin Console</Typography.Text>
          </Space>

          {status === 'configMissing' ? (
            <Alert
              showIcon
              type="error"
              title="当前部署未配置飞书应用"
              description="请检查 FEISHU_APP_ID / FEISHU_APP_SECRET，并确认这些凭证来自专用自建飞书应用。"
            />
          ) : null}

          <Card size="small" style={{ background: '#f8fbff', borderColor: '#d6e4ff' }}>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space orientation="vertical" size={4}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {failure?.title ?? '飞书登录'}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {failure?.subTitle ?? '使用专用自建飞书应用完成身份认证，进入 IAM Admin Console。'}
                </Typography.Text>
              </Space>
              {failure ? <Alert showIcon type={failure.type} title={failure.subTitle} /> : null}
              <Space wrap>
                <Tag color="blue">{environmentName}</Tag>
                {apiModeLabel ? <Tag color="geekblue">{apiModeLabel}</Tag> : null}
                <Typography.Text type="secondary" copyable>
                  {resolvedDeploymentUrl}
                </Typography.Text>
              </Space>
              <Button type="primary" icon={<LoginOutlined aria-hidden="true" />} size="large" onClick={onLogin}>
                {primaryButtonText}
              </Button>
              {devMockLoginVisible ? (
                <>
                  <Divider style={{ margin: '4px 0' }} />
                  <Space size={8}>
                    <Button loading={devMockLoginLoading} onClick={onDevMockLogin}>
                      Mock 开发登录（仅本地）
                    </Button>
                    <Tag color="orange">DEV ONLY</Tag>
                  </Space>
                </>
              ) : null}
            </Space>
          </Card>
        </Space>
      </Card>
    </main>
  );
}
