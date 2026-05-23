import { DownloadOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useApplications, useAuditLogs } from '../../features/iam/queries';
import type { AuditAction, AuditLog, AuditResult } from '../../features/iam/types';

const { RangePicker } = DatePicker;

interface DateLike {
  toISOString: () => string;
}

interface AuditSearchValues {
  createdAtRange?: [DateLike, DateLike];
  applicationId?: string;
  action?: AuditAction;
  result?: AuditResult;
  keyword?: string;
}

interface AuditFilters {
  applicationId?: string;
  action?: AuditAction;
  result?: AuditResult;
  keyword?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
}

const actionLabels: Record<AuditAction, string> = {
  login: '用户登录',
  'application.create': '创建应用',
  'application.api_call': '应用 API 调用',
  'secret.copy': '复制密钥',
  'secret.rotate': '轮换密钥',
  'role.update': '管理员操作',
  'permission.query': '权限查询',
  'sync.run': '同步任务',
};

const resultLabels: Record<AuditResult, { text: string; color: string }> = {
  success: { text: '成功', color: 'success' },
  failed: { text: '失败', color: 'error' },
};

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');
const auditLogsErrorRequestId = 'req_audit_error_001';

export function AuditLogsPage() {
  const [form] = Form.useForm<AuditSearchValues>();
  const [filters, setFilters] = useState<AuditFilters>({});
  const [selectedLog, setSelectedLog] = useState<AuditLog | undefined>();
  const auditLogsQuery = useAuditLogs({ ...filters, page: 1, pageSize: 20 });
  const applicationsQuery = useApplications({ page: 1, pageSize: 50 });

  const columns = useMemo<ColumnsType<AuditLog>>(
    () => [
      { title: '时间', dataIndex: 'createdAt', render: formatDateTime, width: 190 },
      { title: '动作类型', dataIndex: 'action', render: (action: AuditAction) => actionLabels[action] },
      {
        title: '结果',
        dataIndex: 'result',
        render: (result: AuditResult) => <Tag color={resultLabels[result].color}>{resultLabels[result].text}</Tag>,
      },
      { title: '操作者', dataIndex: 'actorFeishuUserId' },
      { title: '应用', dataIndex: 'applicationId', render: (applicationId?: string) => applicationId ?? '-' },
      { title: '说明', dataIndex: 'message' },
      { title: 'Request ID', dataIndex: 'requestId' },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 120,
        render: (_, log) => (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedLog(log)}>
            详情
          </Button>
        ),
      },
    ],
    [],
  );

  const submitSearch = (values: AuditSearchValues) => {
    setFilters({
      applicationId: values.applicationId,
      action: values.action,
      result: values.result,
      keyword: values.keyword?.trim() || undefined,
      createdAtFrom: values.createdAtRange?.[0]?.toISOString(),
      createdAtTo: values.createdAtRange?.[1]?.toISOString(),
    });
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        审计日志
      </Typography.Title>

      <Card>
        <Form form={form} layout="inline" onFinish={submitSearch}>
          <Form.Item name="createdAtRange" label="时间范围">
            <RangePicker />
          </Form.Item>
          <Form.Item name="applicationId" label="应用">
            <Select
              allowClear
              aria-label="application"
              placeholder="全部应用"
              style={{ width: 180 }}
              options={(applicationsQuery.data?.items ?? []).map((application) => ({
                value: application.id,
                label: application.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="action" label="动作类型">
            <Select
              allowClear
              aria-label="action"
              placeholder="全部动作"
              style={{ width: 180 }}
              options={Object.entries(actionLabels).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="result" label="结果">
            <Select
              allowClear
              aria-label="result"
              placeholder="全部结果"
              style={{ width: 140 }}
              options={Object.entries(resultLabels).map(([value, config]) => ({ value, label: config.text }))}
            />
          </Form.Item>
          <Form.Item name="keyword" label="关键词">
            <Input allowClear aria-label="keyword" placeholder="requestId / actor / message" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setFilters({});
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="日志列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} loading={auditLogsQuery.isFetching} onClick={() => auditLogsQuery.refetch()}>
              刷新
            </Button>
            <Tooltip title="后续版本支持">
              <Button icon={<DownloadOutlined />} disabled>
                导出当前筛选结果
              </Button>
            </Tooltip>
            <Typography.Text type="secondary">后续版本支持</Typography.Text>
          </Space>
        }
      >
        {auditLogsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="加载审计日志失败"
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>Request ID：{auditLogsErrorRequestId}</Typography.Text>
                <Typography.Text type="secondary">请保留 Request ID 后重试，若仍失败可交由管理员排查审计服务。</Typography.Text>
              </Space>
            }
            action={<Button onClick={() => auditLogsQuery.refetch()}>重试</Button>}
          />
        ) : (
          <Table
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={auditLogsQuery.data?.items ?? []}
            loading={auditLogsQuery.isLoading}
            pagination={{ total: auditLogsQuery.data?.total ?? 0, pageSize: 20, current: 1, showSizeChanger: false }}
            scroll={{ x: 1300 }}
          />
        )}
      </Card>

      <Drawer
        title="审计日志详情"
        width={620}
        open={Boolean(selectedLog)}
        destroyOnClose
        onClose={() => setSelectedLog(undefined)}
      >
        {selectedLog ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="requestId">{selectedLog.requestId}</Descriptions.Item>
            <Descriptions.Item label="actorFeishuUserId">{selectedLog.actorFeishuUserId}</Descriptions.Item>
            <Descriptions.Item label="applicationId">{selectedLog.applicationId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="action">{selectedLog.action}</Descriptions.Item>
            <Descriptions.Item label="message">{selectedLog.message}</Descriptions.Item>
            <Descriptions.Item label="createdAt">{formatDateTime(selectedLog.createdAt)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}
