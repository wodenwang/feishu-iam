import { CopyOutlined, HomeOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Descriptions, Row, Space, Tag, Typography } from 'antd';
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
  const { message } = App.useApp();
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
      <Card>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Space align="start" size={12}>
            <WarningOutlined aria-hidden="true" style={{ color: '#d46b08', fontSize: 22, marginTop: 4 }} />
            <Space orientation="vertical" size={4}>
              <Space wrap>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  全局错误
                </Typography.Title>
                <Tag color="error">需要处理</Tag>
              </Space>
              <Typography.Text type="secondary">
                页面加载失败或访问路径不可用。请记录 Request ID 后重试，或返回工作台继续处理其他事项。
              </Typography.Text>
            </Space>
          </Space>
          <Space wrap>
            <Button type="primary" icon={<ReloadOutlined aria-hidden="true" />} onClick={retry}>
              重试
            </Button>
            <Button icon={<HomeOutlined aria-hidden="true" />} onClick={() => navigate('/dashboard')}>
              返回工作台
            </Button>
          </Space>
        </Row>
      </Card>

      <Card title="错误恢复信息" extra={<Tag color="default">Admin Console 诊断</Tag>}>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Request ID">
            <Space>
              <Typography.Text code>{requestId}</Typography.Text>
              <Button size="small" icon={<CopyOutlined aria-hidden="true" />} onClick={copyRequestId}>
                复制 Request ID
              </Button>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="发生时间">{new Date(occurredAt).toLocaleString('zh-CN', { hour12: false })}</Descriptions.Item>
          <Descriptions.Item label="错误类型">{errorType}</Descriptions.Item>
          <Descriptions.Item label="影响范围">{impactScope}</Descriptions.Item>
          <Descriptions.Item label="排查入口">审计日志 / 系统错误监控 / 浏览器 Console</Descriptions.Item>
        </Descriptions>
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          title="恢复建议"
          description="如果重试后仍失败，请复制 Request ID 并结合审计日志、系统错误监控和浏览器 Console 排查。不要在反馈中附带 secret、token 或飞书应用凭证。"
        />
      </Card>
    </Space>
  );
}
