import { LoginOutlined } from '@ant-design/icons';
import { Alert, Button, Result, Space, Spin, Typography } from 'antd';

type LoginStatus = 'idle' | 'callbackProcessing' | 'configMissing' | 'userNotSynced' | 'noConsoleAccess';

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

const statusContent: Record<Exclude<LoginStatus, 'idle' | 'callbackProcessing'>, { title: string; subTitle: string }> = {
  configMissing: {
    title: '飞书应用配置缺失',
    subTitle: '当前部署未配置飞书应用，请检查上方环境变量提示',
  },
  userNotSynced: {
    title: '用户尚未同步',
    subTitle: '已通过飞书认证，但 IAM 中还没有该用户，请联系平台管理员同步通讯录',
  },
  noConsoleAccess: {
    title: '无后台访问权限',
    subTitle: '你已登录，但没有 Admin Console 访问权限',
  },
};

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
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 24 }}>
        <Space orientation="vertical" align="center" size={16}>
          <Spin size="large" />
          <Typography.Title level={4} style={{ margin: 0 }}>
            正在验证飞书身份...
          </Typography.Title>
          <Typography.Text type="secondary">{resolvedDeploymentUrl} · {environmentName}</Typography.Text>
        </Space>
      </main>
    );
  }

  const failure = status === 'idle' ? undefined : statusContent[status];

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 24 }}>
      <Space orientation="vertical" size={20} style={{ width: '100%', maxWidth: 520 }}>
        {status === 'configMissing' ? (
          <Alert
            showIcon
            type="error"
            title="当前部署未配置飞书应用"
            description="请检查 FEISHU_APP_ID / FEISHU_APP_SECRET，并确认这些凭证来自专用自建飞书应用。"
          />
        ) : null}

        <Result
          status={failure ? 'warning' : 'info'}
          title={failure?.title ?? 'feishu-iam'}
          subTitle={
            failure?.subTitle ?? (
              <Space orientation="vertical" size={4}>
                <Typography.Text>飞书组织与用户驱动的 IAM Admin Console</Typography.Text>
                <Typography.Text type="secondary">{resolvedDeploymentUrl} · {environmentName}</Typography.Text>
              </Space>
            )
          }
          extra={
            <Space orientation="vertical" size={12}>
              <Button type="primary" icon={<LoginOutlined aria-hidden="true" />} size="large" onClick={onLogin}>
                使用飞书登录
              </Button>
              {devMockLoginVisible ? (
                <Button loading={devMockLoginLoading} onClick={onDevMockLogin}>
                  使用本地 mock 飞书登录
                </Button>
              ) : null}
              {apiModeLabel ? <Typography.Text type="secondary">{apiModeLabel}</Typography.Text> : null}
            </Space>
          }
        />
      </Space>
    </main>
  );
}
