import { PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import type { Key } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApplications, useBatchDisableApplications, useCreateApplication, useCurrentSession } from '../../features/iam/queries';
import type { Application, ApplicationStatus, CreateApplicationInput } from '../../features/iam/types';

const { RangePicker } = DatePicker;

interface SearchValues {
  keyword?: string;
  status?: ApplicationStatus;
  createdAtRange?: [Dayjs, Dayjs];
}

interface ApplicationFilters {
  keyword?: string;
  status?: ApplicationStatus;
  createdAtFrom?: string;
  createdAtTo?: string;
}

interface CreateApplicationFormValues {
  name: string;
  code: string;
  description?: string;
  callbackUrl: string;
  ownerFeishuUserId?: string;
}

const statusLabels: Record<ApplicationStatus, { text: string; color: string }> = {
  active: { text: '启用', color: 'success' },
  disabled: { text: '停用', color: 'default' },
  draft: { text: '草稿', color: 'processing' },
};

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

export function ApplicationsListPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<SearchValues>();
  const [createForm] = Form.useForm<CreateApplicationFormValues>();
  const screens = Grid.useBreakpoint();
  const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');
  const isCompact = !isJsdom && (typeof window === 'undefined' ? !screens.lg : window.innerWidth < 1360);
  const [filters, setFilters] = useState<ApplicationFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [batchDisableOpen, setBatchDisableOpen] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState('');
  const [locallyDisabledApplicationIds, setLocallyDisabledApplicationIds] = useState<string[]>([]);
  const currentSessionQuery = useCurrentSession();
  const isApplicationAdminOnly = Boolean(
    currentSessionQuery.data?.roles.includes('application_admin') && !currentSessionQuery.data.roles.includes('platform_admin'),
  );
  const applicationsQuery = useApplications({
    ...filters,
    allowedApplicationIds: isApplicationAdminOnly ? (currentSessionQuery.data?.applicationIds ?? []) : undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const createApplicationMutation = useCreateApplication();
  const batchDisableApplicationsMutation = useBatchDisableApplications();
  const canManageApplications = Boolean(
    currentSessionQuery.data?.roles.includes('platform_admin') &&
      currentSessionQuery.data.permissions.includes('application:create'),
  );

  const confirmRowDisable = useCallback(
    async (application: Application) => {
      if (!canManageApplications) {
        return;
      }

      await batchDisableApplicationsMutation.mutateAsync([application.id]);
      setLocallyDisabledApplicationIds((current) => Array.from(new Set([...current, application.id])));
      setRefreshFeedback(`已停用 ${application.name}`);
      message.success(`已停用 ${application.name}`);
      await applicationsQuery.refetch();
    },
    [applicationsQuery, batchDisableApplicationsMutation, canManageApplications, message],
  );

  const columns = useMemo<ColumnsType<Application>>(() => {
    const nameColumn: ColumnsType<Application>[number] = {
      title: '应用名称',
      dataIndex: 'name',
      fixed: 'left',
      width: isCompact ? 220 : 180,
      render: (_, application) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{application.name}</Typography.Text>
          <Typography.Text type="secondary">{application.code}</Typography.Text>
        </Space>
      ),
    };
    const statusColumn: ColumnsType<Application>[number] = {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: ApplicationStatus, record) => {
        const effectiveStatus = locallyDisabledApplicationIds.includes(record.id) ? 'disabled' : status;
        const config = statusLabels[effectiveStatus];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    };
    const actionColumn: ColumnsType<Application>[number] = {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: isCompact ? 150 : 180,
      render: (_, record) => (
        <Space size={8} wrap={isCompact}>
          <Button type="link" size="small" onClick={() => navigate(`/applications/${record.id}`)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => navigate(`/applications/onboarding?applicationId=${record.id}`)}>
            接入配置
          </Button>
          {canManageApplications && !isCompact ? (
            <Popconfirm title={`停用 ${record.name}？`} okText="停用" cancelText="取消" onConfirm={() => confirmRowDisable(record)}>
              <Button type="link" size="small" danger>
                停用
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    };

    if (isCompact) {
      return [
        nameColumn,
        statusColumn,
        {
          title: '管理员',
          dataIndex: 'ownerName',
          width: 120,
          ellipsis: true,
        },
        actionColumn,
      ];
    }

    return [
      nameColumn,
      {
        title: 'appkey',
        dataIndex: 'appKey',
        width: 220,
        ellipsis: true,
        render: (appKey: string) => <Typography.Text code>{appKey}</Typography.Text>,
      },
      statusColumn,
      {
        title: '权限组',
        dataIndex: 'permissionGroupCount',
        width: 110,
      },
      {
        title: '权限点',
        dataIndex: 'permissionPointCount',
        width: 110,
      },
      {
        title: '应用管理员',
        dataIndex: 'ownerName',
        width: 130,
      },
      {
        title: '最近 API 调用',
        dataIndex: 'lastApiCalledAt',
        render: formatDateTime,
        width: 180,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        render: formatDateTime,
        width: 180,
      },
      actionColumn,
    ];
  }, [canManageApplications, confirmRowDisable, isCompact, locallyDisabledApplicationIds, navigate]);

  const submitCreateApplication = async (values: CreateApplicationFormValues) => {
    if (!canManageApplications) {
      return;
    }

    const input: CreateApplicationInput = {
      name: values.name,
      code: values.code,
      description: values.description,
      callbackUrls: [values.callbackUrl],
      allowedOrigins: [new URL(values.callbackUrl).origin],
      ownerFeishuUserId: values.ownerFeishuUserId,
    };

    const createdApplication = await createApplicationMutation.mutateAsync(input);
    setDrawerOpen(false);
    createForm.resetFields();
    await applicationsQuery.refetch();
    Modal.success({
      title: '应用已创建',
      content: '请继续查看应用详情并完成接入配置，避免只停留在列表记录。',
      okText: '查看详情',
      onOk: () => navigate(`/applications/${createdApplication.id}`),
    });
  };

  const confirmBatchDisable = async () => {
    if (!canManageApplications) {
      return;
    }

    const applicationIds = selectedRowKeys.map(String);
    setLocallyDisabledApplicationIds((current) => Array.from(new Set([...current, ...applicationIds])));
    setBatchDisableOpen(false);
    setSelectedRowKeys([]);
    await batchDisableApplicationsMutation.mutateAsync(applicationIds);
    message.success('已停用选中的应用');
    await applicationsQuery.refetch();
  };

  const refreshApplications = async () => {
    setRefreshFeedback('');
    await applicationsQuery.refetch();
    setRefreshFeedback('列表已刷新');
  };

  const dataSource = applicationsQuery.data?.items ?? [];
  const isSearchEmpty = !applicationsQuery.isLoading && dataSource.length === 0 && Boolean(filters.keyword || filters.status);

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        应用管理
      </Typography.Title>

      <Card>
        <Form
          form={form}
          layout="inline"
          style={{ rowGap: 12 }}
          onFinish={(values) => {
            setPagination((current) => ({ ...current, page: 1 }));
            setFilters({
              keyword: values.keyword?.trim() || undefined,
              status: values.status,
              createdAtFrom: values.createdAtRange?.[0]?.startOf('day').toISOString(),
              createdAtTo: values.createdAtRange?.[1]?.endOf('day').toISOString(),
            });
          }}
        >
          <Form.Item name="keyword" label="关键词">
            <Input allowClear placeholder="搜索应用名称 / 编码" aria-label="keyword" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              aria-label="status"
              placeholder="全部状态"
              style={{ width: 160 }}
              options={[
                { value: 'active', label: '启用' },
                { value: 'disabled', label: '停用' },
                { value: 'draft', label: '草稿' },
              ]}
            />
          </Form.Item>
          <Form.Item name="createdAtRange" label="创建时间">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setPagination((current) => ({ ...current, page: 1 }));
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
        title="应用列表"
        extra={
          <Space>
            {canManageApplications ? (
              <>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
                  创建应用
                </Button>
                <Button
                  icon={<StopOutlined />}
                  disabled={selectedRowKeys.length === 0}
                  onClick={() => setBatchDisableOpen(true)}
                >
                  批量停用
                </Button>
              </>
            ) : null}
            <Button icon={<ReloadOutlined />} loading={applicationsQuery.isFetching} onClick={refreshApplications}>
              刷新
            </Button>
            {refreshFeedback ? <Typography.Text type="success">{refreshFeedback}</Typography.Text> : null}
          </Space>
        }
      >
        {applicationsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            title="加载应用列表失败"
            description="请稍后重试，或联系平台管理员检查飞书 IAM 服务状态。"
            action={
              <Button size="small" danger onClick={() => applicationsQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : isSearchEmpty ? (
          <Empty description="没有匹配的应用" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={dataSource}
            loading={applicationsQuery.isLoading}
            rowSelection={
              canManageApplications
                ? {
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                  }
                : undefined
            }
            pagination={{
              total: applicationsQuery.data?.total ?? 0,
              pageSize: pagination.pageSize,
              current: pagination.page,
              showSizeChanger: false,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
            }}
            scroll={{ x: isCompact ? 620 : 1280 }}
          />
        )}
      </Card>

      <Drawer
        title="创建应用"
        size={520}
        open={drawerOpen}
        destroyOnClose
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={createApplicationMutation.isPending} onClick={() => createForm.submit()}>
              提交
            </Button>
          </Space>
        }
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={submitCreateApplication}
        >
          <Form.Item
            name="name"
            label="应用名称"
            rules={[
              { required: true, message: '请输入应用名称' },
              { min: 2, max: 50, message: '应用名称需为 2-50 个字符' },
            ]}
          >
            <Input placeholder="例如：Demo CRM" />
          </Form.Item>
          <Form.Item
            name="code"
            label="应用编码"
            rules={[
              { required: true, message: '请输入应用编码' },
              { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字和短横线' },
            ]}
          >
            <Input placeholder="例如：demo-crm" />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ max: 200, message: '描述不能超过 200 个字符' }]}>
            <Input.TextArea rows={3} placeholder="填写应用用途和接入范围" />
          </Form.Item>
          <Form.Item
            name="callbackUrl"
            label="回调地址"
            rules={[
              { required: true, message: '请输入回调地址' },
              { type: 'url', message: '请输入有效 URL' },
            ]}
          >
            <Input placeholder="https://example.com/auth/callback" />
          </Form.Item>
          <Form.Item name="ownerFeishuUserId" label="应用管理员">
            <Select
              allowClear
              placeholder="默认使用当前飞书管理员"
              options={[
                {
                  value: 'ou_feishu_admin_001',
                  label: '王文哲 / ou_feishu_admin_001',
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title="批量停用应用"
        open={batchDisableOpen}
        okText="确认停用"
        cancelText="取消"
        confirmLoading={batchDisableApplicationsMutation.isPending}
        onOk={confirmBatchDisable}
        onCancel={() => setBatchDisableOpen(false)}
      >
        <Typography.Text>确认停用已选中的 {selectedRowKeys.length} 个应用？</Typography.Text>
      </Modal>
    </Space>
  );
}
