import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Result } from 'antd';
import { PermissionGuard } from '../components/PermissionGuard';
import { AdminLayout } from '../layouts/AdminLayout';
import { InitializePage } from '../pages/Initialize';
import { LoginPage } from '../pages/Login';
import { routeItems } from '../router/routes';

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/initialize" element={<InitializePage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          {routeItems.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <PermissionGuard
                  permission={item.permission}
                  fallback={<Result status="403" title="无权限" subTitle={`缺少权限码：${item.permission}`} />}
                >
                  {item.element}
                </PermissionGuard>
              }
            />
          ))}
        </Route>
        <Route path="*" element={<Result status="404" title="页面不存在" />} />
      </Routes>
    </Router>
  );
}
