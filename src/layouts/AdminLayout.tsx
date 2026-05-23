import { Alert, Breadcrumb, Layout, Menu, Result, Space, Spin, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCurrentSession } from '../features/iam/queries';
import type { AdminRole } from '../features/iam/types';
import { getVisibleMenuItems, routeItems } from '../router/routes';

const { Header, Content, Sider } = Layout;

const roleLabels: Record<AdminRole, string> = {
  platform_admin: '平台管理员',
  application_admin: '应用管理员',
};

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionQuery = useCurrentSession();
  const session = sessionQuery.data;
  const currentRoute = routeItems.find((item) => item.path === location.pathname);

  if (sessionQuery.isLoading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ display: 'grid', placeItems: 'center' }}>
          <Spin tip="加载飞书会话" />
        </Content>
      </Layout>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Alert type="error" showIcon message="无法加载当前飞书会话" description="请检查飞书登录态或稍后重试。" />
        </Content>
      </Layout>
    );
  }

  const menuItems: MenuProps['items'] = getVisibleMenuItems(routeItems, session).map((item) => ({
    key: item.path,
    icon: item.icon,
    label: item.label,
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={216} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 20px' }}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            feishu-iam
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentRoute?.path ?? '/dashboard']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}
        >
          <Space size={12}>
            <Typography.Text strong>feishu-iam</Typography.Text>
            <Tag color="blue">本地环境</Tag>
          </Space>
          <Space size={8}>
            <Typography.Text>{session.user.displayName}</Typography.Text>
            <Typography.Text type="secondary">{session.user.feishuUserId}</Typography.Text>
            {session.roles.map((role) => (
              <Tag key={role}>{roleLabels[role]}</Tag>
            ))}
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Breadcrumb
            items={[
              { title: <Link to="/dashboard">首页</Link> },
              { title: currentRoute?.label ?? '页面' },
            ]}
            style={{ marginBottom: 16 }}
          />
          {currentRoute ? <Outlet /> : <Result status="404" title="页面不存在" />}
        </Content>
      </Layout>
    </Layout>
  );
}
