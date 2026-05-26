import { Alert, Breadcrumb, Grid, Layout, Menu, Result, Space, Spin, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { UserMenu } from '../components/UserMenu';
import { getIamApiMode } from '../features/iam/apiMode';
import { isIamHttpError } from '../features/iam/httpClient';
import { isPlatformAdmin } from '../features/iam/permissions';
import { useCurrentSession } from '../features/iam/queries';
import { getMenuSelectedKey, getVisibleMenuItems, matchRouteItem, routeItems } from '../router/routes';

const { Header, Content, Sider } = Layout;
const SIDER_WIDTH = 224;
const SIDER_COLLAPSED_WIDTH = 64;
const HEADER_HEIGHT = 56;

function getViewportWidth() {
  return typeof window === 'undefined' ? 1440 : window.innerWidth;
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const sessionQuery = useCurrentSession();
  const session = sessionQuery.data;
  const apiMode = getIamApiMode();
  const environmentLabel = apiMode === 'http' ? '生产环境' : '本地开发';
  const runtimeLabel = apiMode === 'http' ? 'HTTP runtime' : 'Mock data';
  const defaultAdminPath = apiMode === 'http' ? '/applications' : '/dashboard';
  const isPlatformAdminSession = isPlatformAdmin(session);
  const currentRoute = matchRouteItem(routeItems, location.pathname);
  const selectedMenuKey = getMenuSelectedKey(routeItems, location.pathname);
  const viewportWidth = getViewportWidth();
  const compactShell = viewportWidth < 1024 || screens.xs === true;
  const contentPadding = viewportWidth < 1024 ? 16 : 24;

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
      ? getVisibleMenuItems(routeItems, session).filter((item) =>
          ['/applications', '/roles', '/directory', ...(isPlatformAdminSession ? ['/audit-logs'] : [])].includes(item.path),
        )
      : getVisibleMenuItems(routeItems, session);
  const menuItems: MenuProps['items'] = visibleRoutes.map((item) => ({
    key: item.path,
    icon: item.icon,
    label: item.label,
  }));

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef4f8' }}>
      <Sider
        data-testid="admin-sider"
        theme="light"
        width={SIDER_WIDTH}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        collapsed={compactShell}
        trigger={null}
        style={{ borderRight: '1px solid #d9e2ec', overflow: 'hidden' }}
      >
        <div
          style={{
            height: HEADER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: compactShell ? 'center' : 'flex-start',
            padding: compactShell ? 0 : '0 20px',
          }}
        >
          <BrandLogo variant={compactShell ? 'collapsed' : 'expanded'} />
        </div>
        <Menu
          mode="inline"
          inlineCollapsed={compactShell}
          selectedKeys={[selectedMenuKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 0, paddingInline: compactShell ? 8 : 12 }}
        />
      </Sider>
      <Layout>
        <Header
          data-testid="admin-header"
          style={{
            height: HEADER_HEIGHT,
            lineHeight: `${HEADER_HEIGHT}px`,
            background: '#fff',
            borderBottom: '1px solid #d9e2ec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: compactShell ? '0 16px' : '0 24px',
          }}
        >
          <Space size={12} style={{ flexShrink: 0, minWidth: 0, height: '100%' }}>
            {compactShell ? <MenuUnfoldOutlined style={{ color: '#475569', fontSize: 18 }} /> : <MenuFoldOutlined style={{ color: '#475569', fontSize: 18 }} />}
            {compactShell ? null : <Typography.Text type="secondary">飞书身份与应用访问控制</Typography.Text>}
          </Space>
          <Space size={10} align="center" style={{ minWidth: 0, justifyContent: 'flex-end', overflow: 'hidden', height: '100%' }}>
            {!compactShell ? (
              <Tag color={apiMode === 'http' ? 'success' : 'processing'} style={{ marginInlineEnd: 0 }}>
                {runtimeLabel}
              </Tag>
            ) : null}
            <UserMenu
              session={session}
              environmentName={environmentLabel}
              compact={compactShell}
              onLogoutSuccess={() => navigate('/login', { replace: true })}
            />
          </Space>
        </Header>
        <Content
          data-testid="admin-content"
          style={{
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
            padding: contentPadding,
            background: '#eef4f8',
          }}
        >
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
