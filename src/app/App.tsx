import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Result } from 'antd';
import { PermissionGuard } from '../components/PermissionGuard';
import { AdminLayout } from '../layouts/AdminLayout';
import { routeItems } from '../router/routes';

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Result title="飞书登录" subTitle="使用飞书登录占位页" />} />
        <Route path="/initialize" element={<Result title="首次初始化" subTitle="飞书超级管理员绑定占位页" />} />
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
