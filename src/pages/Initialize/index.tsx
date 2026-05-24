import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Result, Space, Spin, Steps, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { isIamHttpError } from '../../features/iam/httpClient';
import { useBindPlatformAdmin, useInitializationStatus } from '../../features/iam/queries';

type InitializePageProps = {
  feishuConfigStatus?: string;
  initialAdminUserId?: string;
  databaseStatus?: string;
  lastBootstrapAttempt?: string;
};

const bootstrapSteps = [
  {
    title: '配置飞书自建应用',
    content: '确认 App ID、App Secret 与回调地址来自专用自建飞书应用。',
  },
  {
    title: '设置 FEISHU_INITIAL_ADMIN_USER_ID',
    content: '首个系统超级管理员必须绑定到真实飞书用户。',
  },
  {
    title: '重启服务',
    content: '让服务重新读取飞书应用配置与初始管理员环境变量。',
  },
  {
    title: '使用飞书登录',
    content: '通过飞书完成认证后进入 Admin Console。',
  },
];

export function InitializePage({
  feishuConfigStatus = '待检测',
  initialAdminUserId = '未设置',
  databaseStatus = '待检测',
  lastBootstrapAttempt = '暂无记录',
}: InitializePageProps) {
  const navigate = useNavigate();
  const initializationQuery = useInitializationStatus();
  const bindPlatformAdminMutation = useBindPlatformAdmin();
  const error = initializationQuery.error ?? bindPlatformAdminMutation.error;
  const errorMessage = isIamHttpError(error) ? error.message : '请确认已通过飞书登录，并检查本地 HTTP runtime 状态。';
  const errorRequestId = isIamHttpError(error) ? error.requestId : undefined;
  const initialized = initializationQuery.data?.initialized ?? false;

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7fb', padding: 24 }}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <section>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            系统初始化
          </Typography.Title>
          <Typography.Text type="secondary">首次部署后绑定首个飞书平台管理员</Typography.Text>
        </section>

        {initializationQuery.isLoading ? <Alert showIcon type="info" title="正在检测初始化状态" /> : null}
        {initialized ? (
          <Alert showIcon type="success" title="系统已完成平台管理员绑定" />
        ) : (
          <Alert showIcon type="warning" title="当前系统尚未完成平台管理员绑定" />
        )}
        {initializationQuery.isError || bindPlatformAdminMutation.isError ? (
          <Alert
            showIcon
            type="error"
            title="初始化操作失败"
            description={
              <Space orientation="vertical" size={4}>
                <Typography.Text>{errorMessage}</Typography.Text>
                {errorRequestId ? <Typography.Text code copyable>{errorRequestId}</Typography.Text> : null}
              </Space>
            }
          />
        ) : null}

        <Descriptions bordered size="middle" column={2}>
          <Descriptions.Item label="飞书应用配置状态">{feishuConfigStatus}</Descriptions.Item>
          <Descriptions.Item label="初始管理员 User ID">{initialAdminUserId}</Descriptions.Item>
          <Descriptions.Item label="数据库连接状态">{initializationQuery.isSuccess ? '已连接' : databaseStatus}</Descriptions.Item>
          <Descriptions.Item label="最近一次 bootstrap 尝试">{lastBootstrapAttempt}</Descriptions.Item>
        </Descriptions>

        {initializationQuery.isLoading ? (
          <Result icon={<Spin size="large" />} title="正在检测初始化状态" />
        ) : initialized ? (
          <Result
            status="success"
            title="初始化已完成"
            subTitle="当前系统已经绑定平台管理员，可以进入 Admin Console。"
            extra={
              <Button type="primary" onClick={() => navigate('/applications')}>
                进入应用管理
              </Button>
            }
          />
        ) : (
          <Result
            status="warning"
            title="等待完成初始化"
            subTitle="完成以下步骤后，系统将只允许通过飞书身份进入 Admin Console。"
            extra={
              <Space wrap>
                <Button
                  type="primary"
                  icon={<ReloadOutlined aria-hidden="true" />}
                  loading={bindPlatformAdminMutation.isPending}
                  onClick={() => bindPlatformAdminMutation.mutate()}
                >
                  绑定当前飞书用户为平台管理员
                </Button>
                <Button onClick={() => initializationQuery.refetch()}>重新检测配置</Button>
                <Button href="/docs/deployment" icon={<FileTextOutlined aria-hidden="true" />}>
                  查看部署文档
                </Button>
              </Space>
            }
          />
        )}

        <Steps orientation="vertical" responsive={false} current={0} items={bootstrapSteps} />
      </Space>
    </main>
  );
}
