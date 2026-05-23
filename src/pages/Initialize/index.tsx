import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Result, Space, Steps, Typography } from 'antd';

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
  return (
    <main style={{ minHeight: '100vh', background: '#f5f7fb', padding: 24 }}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <section>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            系统初始化
          </Typography.Title>
          <Typography.Text type="secondary">首次部署后绑定首个飞书平台管理员</Typography.Text>
        </section>

        <Alert showIcon type="warning" title="当前系统尚未完成平台管理员绑定" />

        <Descriptions bordered size="middle" column={2}>
          <Descriptions.Item label="飞书应用配置状态">{feishuConfigStatus}</Descriptions.Item>
          <Descriptions.Item label="初始管理员 User ID">{initialAdminUserId}</Descriptions.Item>
          <Descriptions.Item label="数据库连接状态">{databaseStatus}</Descriptions.Item>
          <Descriptions.Item label="最近一次 bootstrap 尝试">{lastBootstrapAttempt}</Descriptions.Item>
        </Descriptions>

        <Result
          status="warning"
          title="等待完成初始化"
          subTitle="完成以下步骤后，系统将只允许通过飞书身份进入 Admin Console。"
          extra={
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined aria-hidden="true" />}>
                重新检测配置
              </Button>
              <Button href="/docs/deployment" icon={<FileTextOutlined aria-hidden="true" />}>
                查看部署文档
              </Button>
            </Space>
          }
        />

        <Steps orientation="vertical" responsive={false} current={0} items={bootstrapSteps} />
      </Space>
    </main>
  );
}
