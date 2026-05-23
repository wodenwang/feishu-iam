import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="403"
      title="403"
      subTitle="无权限访问当前页面，请联系平台管理员确认飞书用户与角色授权。"
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          返回工作台
        </Button>
      }
    />
  );
}
