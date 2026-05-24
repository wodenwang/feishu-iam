import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PermissionGuard } from '../components/PermissionGuard';
import { getIamApiBaseUrl, getIamApiMode } from '../features/iam/apiMode';
import * as httpApi from '../features/iam/httpApi';
import { AdminLayout } from '../layouts/AdminLayout';
import { ForbiddenPage } from '../pages/Errors/Forbidden';
import { GlobalErrorPage } from '../pages/Errors/GlobalError';
import { InitializePage } from '../pages/Initialize';
import { LoginPage } from '../pages/Login';
import { routeItems } from '../router/routes';

function RuntimeLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const apiMode = getIamApiMode();
  const status = new URLSearchParams(location.search).get('status');
  const loginStatus = status === 'configMissing' || status === 'authFailed' ? status : 'idle';

  return (
    <LoginPage
      status={loginStatus}
      apiModeLabel={apiMode === 'http' ? 'HTTP runtime' : 'Mock data'}
      devMockLoginVisible={apiMode === 'http' && import.meta.env.DEV}
      devMockLoginLoading={loading}
      onLogin={() => {
        if (apiMode === 'http') {
          window.location.href = `${getIamApiBaseUrl()}/api/auth/feishu/start`;
        }
      }}
      onDevMockLogin={async () => {
        setLoading(true);
        try {
          await httpApi.mockFeishuLogin({
            feishuUserId: 'ou_v012_verify_admin',
            name: '本地平台管理员',
            email: 'local-admin@example.com',
          });
          navigate('/initialize');
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}

export function App() {
  const apiMode = getIamApiMode();
  const defaultAdminPath = apiMode === 'http' ? '/applications' : '/dashboard';
  const httpRuntimePaths = ['/applications', '/applications/onboarding', '/applications/:id', '/roles', '/directory', '/audit-logs'];
  const runtimeRouteItems =
    apiMode === 'http'
      ? routeItems.filter((item) => httpRuntimePaths.includes(item.path))
      : routeItems;
  const disabledHttpRouteItems =
    apiMode === 'http'
      ? routeItems.filter((item) => !httpRuntimePaths.includes(item.path))
      : [];

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<RuntimeLoginPage />} />
        <Route path="/initialize" element={<InitializePage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to={defaultAdminPath} replace />} />
          {runtimeRouteItems.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <PermissionGuard
                  permission={item.permission}
                  fallback={<ForbiddenPage />}
                >
                  {item.element}
                </PermissionGuard>
              }
            />
          ))}
          {disabledHttpRouteItems.map((item) => (
            <Route key={`http-disabled-${item.path}`} path={item.path} element={<Navigate to={defaultAdminPath} replace />} />
          ))}
        </Route>
        <Route path="*" element={<GlobalErrorPage />} />
      </Routes>
    </Router>
  );
}
