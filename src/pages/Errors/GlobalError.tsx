import { Button, Card, Descriptions, Result, Space, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';

interface GlobalErrorPageProps {
  onRetry?: () => void;
  requestId?: string;
  occurredAt?: string;
  errorType?: string;
  impactScope?: string;
  onCopyRequestId?: (requestId: string) => void | Promise<void>;
}

const defaultRequestId = 'req_global_error_001';

export function GlobalErrorPage({
  onRetry,
  requestId = defaultRequestId,
  occurredAt = new Date().toISOString(),
  errorType = '全局运行时错误',
  impactScope = '当前页面不可用，已登录会话和其他页面不受影响。',
  onCopyRequestId,
}: GlobalErrorPageProps) {
  const navigate = useNavigate();

  const retry = () => {
    if (onRetry) {
      onRetry();
      return;
    }

    window.location.reload();
  };

  const copyRequestId = async () => {
    if (onCopyRequestId) {
      await onCopyRequestId(requestId);
    } else {
      await navigator.clipboard?.writeText(requestId);
    }
    message.success('已复制 Request ID');
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Result
        status="500"
        title="全局错误"
        subTitle="页面加载失败或访问的路径不存在，请记录 Request ID 后重试，或返回工作台。"
        extra={
          <Space>
            <Button type="primary" onClick={retry}>
              重试
            </Button>
            <Button onClick={() => navigate('/dashboard')}>返回工作台</Button>
          </Space>
        }
      />

      <Card title="错误恢复信息">
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Request ID">
            <Space>
              <Typography.Text code>{requestId}</Typography.Text>
              <Button size="small" onClick={copyRequestId}>
                复制 Request ID
              </Button>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="发生时间">{new Date(occurredAt).toLocaleString('zh-CN', { hour12: false })}</Descriptions.Item>
          <Descriptions.Item label="错误类型">{errorType}</Descriptions.Item>
          <Descriptions.Item label="影响范围">{impactScope}</Descriptions.Item>
          <Descriptions.Item label="排查入口">审计日志 / 系统错误监控 / 浏览器 Console</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}
