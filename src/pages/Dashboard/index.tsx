import { AppstoreAddOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Steps, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useApplications, useAuditLogs, useDashboardSummary } from '../../features/iam/queries';
import type { AuditLog, SyncStatus } from '../../features/iam/types';

const syncStatusLabels: Record<SyncStatus, { text: string; color: string }> = {
  success: { text: '成功', color: 'success' },
  partial_failed: { text: '部分失败', color: 'warning' },
  failed: { text: '失败', color: 'error' },
  running: { text: '运行中', color: 'processing' },
};

const auditActionLabels: Record<AuditLog['action'], string> = {
  login: '飞书登录',
  'application.create': '创建应用',
  'application.api_call': '应用 API 调用',
  'application.admin.add': '新增应用管理员',
  'application.admin.bind': '绑定应用管理员',
  'application.admin.remove': '移除应用管理员',
  'oauth.redirect_uri.create': '新增 redirect URI',
  'oauth.redirect_uri.disable': '停用 redirect URI',
  'oauth.redirect_uri.enable': '恢复 redirect URI',
  'secret.copy': '复制密钥',
  'secret.rotate': '轮换密钥',
  'role.create': '创建角色',
  'role.update': '更新角色',
  'role.authorization.update': '更新角色授权',
  'permission.query': '查询权限',
  'sync.run': '执行同步',
  'sync.preflight': '同步预检',
};

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

const auditColumns: ColumnsType<AuditLog> = [
  {
    title: '事件',
    dataIndex: 'action',
    render: (action: AuditLog['action']) => auditActionLabels[action],
  },
  {
    title: '说明',
    dataIndex: 'message',
  },
  {
    title: '操作者',
    dataIndex: 'actorFeishuUserId',
  },
  {
    title: 'Request ID',
    dataIndex: 'requestId',
  },
  {
    title: '发生时间',
    dataIndex: 'createdAt',
    render: formatDateTime,
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const summaryQuery = useDashboardSummary();
  const applicationsQuery = useApplications({ page: 1, pageSize: 1 });
  const auditLogsQuery = useAuditLogs({ page: 1, pageSize: 5 });
  const summary = summaryQuery.data;
  const syncStatus = summary ? syncStatusLabels[summary.lastSync.status] : undefined;

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        工作台
      </Typography.Title>

      <Row gutter={16}>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="应用数量" value={summary?.applicationCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="已注册权限点数量" value={summary?.permissionPointCount ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="最近一次飞书同步状态" value={syncStatus?.text ?? '-'} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="近 24 小时审计事件数量" value={summary?.auditEventCount24h ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
      </Row>

      {applicationsQuery.data?.total === 0 ? (
        <Card>
          <Empty
            description="还没有接入应用"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => navigate('/applications')}>
              创建应用
            </Button>
          </Empty>
        </Card>
      ) : null}

      <Card title="接入闭环进度">
        <Steps
          size="small"
          current={2}
          items={[
            { title: '完成飞书同步' },
            { title: '创建应用' },
            { title: '导出接入配置' },
            { title: '第三方系统注册权限点' },
            { title: '创建角色授权' },
            { title: '第三方系统查询权限' },
          ]}
        />
      </Card>

      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <Card title="最近审计事件">
            <Table
              rowKey="id"
              size="middle"
              columns={auditColumns}
              dataSource={auditLogsQuery.data?.items ?? []}
              loading={auditLogsQuery.isLoading}
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="最近同步摘要">
            {summary && syncStatus ? (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Space>
                  <Typography.Text>同步状态</Typography.Text>
                  <Tag color={syncStatus.color}>{syncStatus.text}</Tag>
                </Space>
                {summary.lastSync.status === 'partial_failed' ? (
                  <Alert type="warning" showIcon title="部分失败" description={summary.lastSync.message} />
                ) : null}
                <Typography.Text>部门：{summary.lastSync.departmentTotal}</Typography.Text>
                <Typography.Text>用户：{summary.lastSync.userTotal}</Typography.Text>
                <Typography.Text>失败项：{summary.lastSync.failedCount}</Typography.Text>
                <Typography.Text type="secondary">完成时间：{formatDateTime(summary.lastSync.finishedAt)}</Typography.Text>
              </Space>
            ) : (
              <Alert type="info" showIcon title="正在加载同步摘要" />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
