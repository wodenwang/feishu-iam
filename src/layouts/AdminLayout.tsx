import { Alert, Breadcrumb, Grid, Layout, Menu, Result, Space, Spin, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getIamApiMode } from '../features/iam/apiMode';
import { isIamHttpError } from '../features/iam/httpClient';
import { useCurrentSession } from '../features/iam/queries';
import type { AdminRole } from '../features/iam/types';
import { getMenuSelectedKey, getVisibleMenuItems, matchRouteItem, routeItems } from '../router/routes';

const { Header, Content, Sider } = Layout;

const roleLabels: Record<AdminRole, string> = {
  platform_admin: '平台管理员',
  application_admin: '应用管理员',
};

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const sessionQuery = useCurrentSession();
  const session = sessionQuery.data;
  const apiMode = getIamApiMode();
  const environmentTag = apiMode === 'http' ? 'HTTP runtime' : 'Mock data';
  const defaultAdminPath = apiMode === 'http' ? '/applications' : '/dashboard';
  const currentRoute = matchRouteItem(routeItems, location.pathname);
  const selectedMenuKey = getMenuSelectedKey(routeItems, location.pathname);
  const compactHeader = !screens.lg;

  if (sessionQuery.isLoading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ display: 'grid', placeItems: 'center' }}>
          <Spin description="加载飞书会话" />
        </Content>
      </Layout>
    );
  }

  if (sessionQuery.isError || !session) {
    const error = sessionQuery.error;
    const isHttpError = isIamHttpError(error);
    const isUnauthenticatedSession = error instanceof Error && error.message === 'UNAUTHENTICATED_SESSION';
    const title = (isHttpError && error.status === 401) || isUnauthenticatedSession ? '会话已过期' : '无法加载当前飞书会话';
    const description = isHttpError
      ? `${error.message}${error.requestId ? `（Request ID: ${error.requestId}）` : ''}`
      : isUnauthenticatedSession
        ? '请先通过飞书登录后再访问 Admin Console。'
        : '请检查飞书登录态或稍后重试。';

    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Alert
            type={(isHttpError && error.status === 401) || isUnauthenticatedSession ? 'warning' : 'error'}
            showIcon
            title={title}
            description={description}
            action={(isHttpError && error.status === 401) || isUnauthenticatedSession ? <Link to="/login">重新登录</Link> : undefined}
          />
        </Content>
      </Layout>
    );
  }

  const visibleRoutes =
    apiMode === 'http'
      ? routeItems.filter((item) => item.path === '/applications' || item.path === '/audit-logs')
      : getVisibleMenuItems(routeItems, session);
  const menuItems: MenuProps['items'] = visibleRoutes.map((item) => ({
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
          selectedKeys={[selectedMenuKey]}
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
            gap: 16,
            padding: compactHeader ? '0 16px' : '0 24px',
          }}
        >
          <Space size={12} style={{ flexShrink: 0, minWidth: 0 }}>
            {!compactHeader ? <Typography.Text strong>feishu-iam</Typography.Text> : null}
            <Tag color={apiMode === 'http' ? 'green' : 'blue'}>{environmentTag}</Tag>
          </Space>
          <Space size={8} style={{ minWidth: 0, justifyContent: 'flex-end', overflow: 'hidden' }}>
            <Typography.Text style={{ whiteSpace: 'nowrap' }}>{session.user.displayName}</Typography.Text>
            {!compactHeader ? (
              <Typography.Text type="secondary" ellipsis={{ tooltip: session.user.feishuUserId }} style={{ maxWidth: 220 }}>
                {session.user.feishuUserId}
              </Typography.Text>
            ) : null}
            {session.roles.map((role) => (
              <Tag key={role}>{roleLabels[role]}</Tag>
            ))}
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Breadcrumb
            items={[
              { title: <Link to={defaultAdminPath}>首页</Link> },
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
