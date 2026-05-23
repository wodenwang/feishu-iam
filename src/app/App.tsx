import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { PermissionGuard } from '../components/PermissionGuard';
import { AdminLayout } from '../layouts/AdminLayout';
import { ForbiddenPage } from '../pages/Errors/Forbidden';
import { GlobalErrorPage } from '../pages/Errors/GlobalError';
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
                  fallback={<ForbiddenPage />}
                >
                  {item.element}
                </PermissionGuard>
              }
            />
          ))}
        </Route>
        <Route path="*" element={<GlobalErrorPage />} />
      </Routes>
    </Router>
  );
}
