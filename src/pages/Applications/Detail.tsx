import { KeyOutlined, StopOutlined, SyncOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Popconfirm, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useApplication,
  useApplicationPermissionRegistrations,
  useAuditLogs,
  useBatchDisableApplications,
  useCurrentSession,
  useRotateApplicationSecret,
} from '../../features/iam/queries';
import type { ApplicationPermissionRegistration, ApplicationStatus, AuditLog } from '../../features/iam/types';

const statusLabels: Record<ApplicationStatus, { text: string; color: string }> = {
  active: { text: '启用', color: 'success' },
  disabled: { text: '停用', color: 'default' },
  draft: { text: '草稿', color: 'processing' },
};

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

export function ApplicationDetailPage() {
  const { id = 'app_demo_crm' } = useParams();
  const [localStatus, setLocalStatus] = useState<ApplicationStatus | undefined>();
  const applicationQuery = useApplication(id);
  const permissionRegistrationsQuery = useApplicationPermissionRegistrations(id);
  const auditLogsQuery = useAuditLogs({ page: 1, pageSize: 20 });
  const currentSessionQuery = useCurrentSession();
  const disableMutation = useBatchDisableApplications();
  const rotateSecretMutation = useRotateApplicationSecret();

  const permissionColumns = useMemo<ColumnsType<ApplicationPermissionRegistration>>(
    () => [
      {
        title: '权限组 Code',
        dataIndex: 'groupCode',
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
      },
      {
        title: '权限组名称',
        dataIndex: 'groupName',
      },
      {
        title: '权限点 Code',
        dataIndex: 'permissionCode',
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
      },
      {
        title: '权限点名称',
        dataIndex: 'permissionName',
      },
      {
        title: '状态',
        dataIndex: 'status',
        render: (status: ApplicationPermissionRegistration['status']) => (
          <Tag color={status === 'active' ? 'success' : 'default'}>{status === 'active' ? '启用' : '停用'}</Tag>
        ),
      },
      {
        title: '最近注册/更新时间',
        dataIndex: 'updatedAt',
        render: formatDateTime,
      },
    ],
    [],
  );

  const auditColumns = useMemo<ColumnsType<AuditLog>>(
    () => [
      { title: '事件', dataIndex: 'action' },
      { title: '说明', dataIndex: 'message' },
      { title: '请求 ID', dataIndex: 'requestId' },
      { title: '时间', dataIndex: 'createdAt', render: formatDateTime },
    ],
    [],
  );

  if (applicationQuery.isError) {
    return <Alert type="error" showIcon title="加载应用详情失败" description="请确认应用是否存在，或稍后重试。" />;
  }

  const application = applicationQuery.data;
  const effectiveStatus = localStatus ?? application?.status ?? 'draft';
  const statusConfig = statusLabels[effectiveStatus];
  const currentPermissions = currentSessionQuery.data?.permissions ?? [];
  const canDisableApplication = currentPermissions.includes('application:disable');
  const canRotateApplicationSecret = currentPermissions.includes('application:secret');
  const canUseDangerousActions = canDisableApplication || canRotateApplicationSecret;

  const confirmDisable = async () => {
    if (!canDisableApplication) {
      return;
    }

    await disableMutation.mutateAsync([id]);
    setLocalStatus('disabled');
    message.success('已停用应用');
  };

  const confirmRotate = async (secretType: 'appsecret' | 'apiSecret') => {
    if (!canRotateApplicationSecret) {
      return;
    }

    await rotateSecretMutation.mutateAsync({ applicationId: id, secretType });
    message.success(secretType === 'appsecret' ? '已轮换 appsecret' : '已轮换 API secret');
    await applicationQuery.refetch();
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        应用详情
      </Typography.Title>

      <Tabs
        items={[
          {
            key: 'overview',
            label: '概览',
            children: (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Card loading={applicationQuery.isLoading}>
                  {application ? (
                    <Descriptions bordered column={2} size="middle">
                      <Descriptions.Item label="应用名称">{application.name}</Descriptions.Item>
                      <Descriptions.Item label="appkey">{application.appKey}</Descriptions.Item>
                      <Descriptions.Item label="状态">
                        <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="OIDC 回调地址">{application.callbackUrls.join('、')}</Descriptions.Item>
                      <Descriptions.Item label="API key 状态">已签发</Descriptions.Item>
                      <Descriptions.Item label="创建人">{application.ownerName}</Descriptions.Item>
                      <Descriptions.Item label="创建时间">{formatDateTime(application.createdAt)}</Descriptions.Item>
                      <Descriptions.Item label="最近 API 调用">{formatDateTime(application.lastApiCalledAt)}</Descriptions.Item>
                    </Descriptions>
                  ) : null}
                </Card>

                {canUseDangerousActions ? (
                  <Card title="危险操作区">
                    <Space wrap>
                      {canDisableApplication ? (
                        <Popconfirm title="确认停用该应用？" okText="确认停用" cancelText="取消" onConfirm={confirmDisable}>
                          <Button danger icon={<StopOutlined />} loading={disableMutation.isPending}>
                            停用应用
                          </Button>
                        </Popconfirm>
                      ) : null}
                      {canRotateApplicationSecret ? (
                        <>
                          <Popconfirm
                            title="确认轮换 appsecret？"
                            okText="确认轮换"
                            cancelText="取消"
                            onConfirm={() => confirmRotate('appsecret')}
                          >
                            <Button icon={<KeyOutlined />} loading={rotateSecretMutation.isPending}>
                              轮换 appsecret
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title="确认轮换 API secret？"
                            okText="确认轮换"
                            cancelText="取消"
                            onConfirm={() => confirmRotate('apiSecret')}
                          >
                            <Button icon={<SyncOutlined />} loading={rotateSecretMutation.isPending}>
                              轮换 API secret
                            </Button>
                          </Popconfirm>
                        </>
                      ) : null}
                    </Space>
                  </Card>
                ) : null}
              </Space>
            ),
          },
          {
            key: 'config',
            label: '接入配置',
            children: (
              <Card>
                <Descriptions bordered column={1} size="middle">
                  <Descriptions.Item label="appkey">{application?.appKey ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="API key">{application?.apiKey ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="回调地址">{application?.callbackUrls.join('、') ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="允许来源">{application?.allowedOrigins.join('、') ?? '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'permissions',
            label: '权限注册',
            children: (
              <Card>
                <Table
                  rowKey="id"
                  size="middle"
                  columns={permissionColumns}
                  dataSource={permissionRegistrationsQuery.data ?? []}
                  loading={permissionRegistrationsQuery.isLoading}
                  pagination={false}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <Space orientation="vertical" size={4}>
                            <Typography.Text>该应用还没有注册权限点</Typography.Text>
                            <Typography.Text type="secondary">第三方系统需要调用 Application API 注册权限组和权限点。</Typography.Text>
                            <Button type="link">查看接入文档</Button>
                          </Space>
                        }
                      />
                    ),
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'admins',
            label: '应用管理员',
            children: (
              <Card>
                <Descriptions bordered column={1} size="middle">
                  <Descriptions.Item label="管理员">{application?.ownerName ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="飞书 User ID">{application?.ownerFeishuUserId ?? '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'audit',
            label: '审计记录',
            children: (
              <Card>
                <Table
                  rowKey="id"
                  size="middle"
                  columns={auditColumns}
                  dataSource={(auditLogsQuery.data?.items ?? []).filter((item) => item.applicationId === id)}
                  loading={auditLogsQuery.isLoading}
                  pagination={false}
                />
              </Card>
            ),
          },
        ]}
      />
    </Space>
  );
}
