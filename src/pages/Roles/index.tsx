import { PlusOutlined, ReloadOutlined, SaveOutlined, StopOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tree,
  TreeSelect,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import type { Dayjs } from 'dayjs';
import type { Key } from 'react';
import { useMemo, useState } from 'react';
import { AppTable } from '../../components/AppTable';
import { FormDrawer } from '../../components/FormDrawer';
import { SearchForm } from '../../components/SearchForm';
import {
  canUpdateRoles as canEditRolesForSession,
  getScopedApplicationIds,
  isApplicationAdminOnly as isApplicationAdminOnlySession,
} from '../../features/iam/permissions';
import {
  useApplications,
  useCreateRole,
  useCurrentSession,
  useDirectoryUsers,
  useDisableRoles,
  useFeishuDepartments,
  useIamPermissionTree,
  useRoles,
  useUpdateRole,
  useUpdateRoleAuthorization,
} from '../../features/iam/queries';
import type { IamPermissionNode, IamRole, RoleStatus, UpsertRoleInput } from '../../features/iam/types';

const { RangePicker } = DatePicker;

interface SearchValues {
  keyword?: string;
  applicationId?: string;
  status?: RoleStatus;
  createdAtRange?: [Dayjs, Dayjs];
  createdAtFrom?: string;
  createdAtTo?: string;
}

interface RoleFormValues {
  applicationId: string;
  name: string;
  code: string;
  description?: string;
  status: boolean;
}

const statusLabels: Record<RoleStatus, { text: string; color: string }> = {
  active: { text: '启用', color: 'success' },
  disabled: { text: '停用', color: 'default' },
};

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

const toTreeData = (nodes: IamPermissionNode[]): DataNode[] =>
  nodes.map((node) => ({
    key: node.key,
    title: node.title,
    children: node.children ? toTreeData(node.children) : undefined,
  }));

const countAdded = (current: string[], previous: string[]) => current.filter((item) => !previous.includes(item)).length;
const countRemoved = (current: string[], previous: string[]) => previous.filter((item) => !current.includes(item)).length;

export function RolesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<SearchValues>();
  const [roleForm] = Form.useForm<RoleFormValues>();
  const screens = Grid.useBreakpoint();
  const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');
  const isCompact = !isJsdom && (typeof window === 'undefined' ? !screens.lg : window.innerWidth < 1360);
  const [filters, setFilters] = useState<SearchValues>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [authorizationOpen, setAuthorizationOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<IamRole | undefined>();
  const [checkedPermissionKeys, setCheckedPermissionKeys] = useState<Key[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [refreshFeedback, setRefreshFeedback] = useState('');
  const [batchDisableOpen, setBatchDisableOpen] = useState(false);
  const sessionQuery = useCurrentSession();
  const isApplicationAdminOnly = isApplicationAdminOnlySession(sessionQuery.data);
  const scopedApplicationIds = getScopedApplicationIds(sessionQuery.data);
  const applicationsQuery = useApplications({
    allowedApplicationIds: scopedApplicationIds,
    page: 1,
    pageSize: 50,
  });
  const rolesQuery = useRoles({
    ...filters,
    allowedApplicationIds: scopedApplicationIds,
    enabled: Boolean(sessionQuery.data),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const updateRoleAuthorizationMutation = useUpdateRoleAuthorization();
  const disableRolesMutation = useDisableRoles();
  const permissionTreeQuery = useIamPermissionTree();
  const departmentsQuery = useFeishuDepartments();
  const directoryUsersQuery = useDirectoryUsers({ page: 1, pageSize: 100 });

  const canEditRoles = canEditRolesForSession(sessionQuery.data);
  const applicationOptions = (applicationsQuery.data?.items ?? [])
    .filter((application) => !isApplicationAdminOnly || sessionQuery.data?.applicationIds.includes(application.id))
    .map((application) => ({ value: application.id, label: application.name }));
  const departmentTreeData = (departmentsQuery.data ?? []).map((department) => ({
    value: department.id,
    title: department.path,
  }));
  const userOptions = (directoryUsersQuery.data?.items ?? []).map((user) => ({
    value: user.feishuUserId,
    label: `${user.displayName} / ${user.feishuUserId}`,
  }));
  const selectedPermissionKeyStrings = checkedPermissionKeys.map(String);
  const selectedDepartmentIdStrings = selectedDepartmentIds.map(String);
  const selectedUserIdStrings = selectedUserIds.map(String);
  const authorizationSummary = {
    addedPermissions: countAdded(selectedPermissionKeyStrings, activeRole?.permissionKeys ?? []),
    removedPermissions: countRemoved(selectedPermissionKeyStrings, activeRole?.permissionKeys ?? []),
    addedDepartments: countAdded(selectedDepartmentIdStrings, activeRole?.departmentIds ?? []),
    removedDepartments: countRemoved(selectedDepartmentIdStrings, activeRole?.departmentIds ?? []),
    addedUsers: countAdded(selectedUserIdStrings, activeRole?.userIds ?? []),
    removedUsers: countRemoved(selectedUserIdStrings, activeRole?.userIds ?? []),
  };

  const openRoleDrawer = (role?: IamRole) => {
    setActiveRole(role);
    roleForm.resetFields();
    roleForm.setFieldsValue(
      role
        ? {
            applicationId: role.applicationId,
            name: role.name,
            code: role.code,
            description: role.description,
            status: role.status === 'active',
          }
        : { applicationId: applicationOptions[0]?.value, status: true },
    );
    setRoleDrawerOpen(true);
  };

  const openAuthorization = (role: IamRole) => {
    setActiveRole(role);
    setCheckedPermissionKeys(role.permissionKeys);
    setSelectedDepartmentIds(role.departmentIds);
    setSelectedUserIds(role.userIds);
    setAuthorizationOpen(true);
  };

  const saveRole = async () => {
    const values = await roleForm.validateFields();
    const input: UpsertRoleInput = {
      applicationId: values.applicationId,
      name: values.name,
      code: values.code,
      description: values.description,
      status: values.status ? 'active' : 'disabled',
    };
    if (activeRole) {
      await updateRoleMutation.mutateAsync({ roleId: activeRole.id, input });
    } else {
      await createRoleMutation.mutateAsync(input);
    }
    setRoleDrawerOpen(false);
    message.success(activeRole ? '角色配置已保存' : '角色已创建');
    await rolesQuery.refetch();
  };

  const disableRoles = async (roleIds: string[]) => {
    await disableRolesMutation.mutateAsync(roleIds);
    setSelectedRowKeys((current) => current.filter((key) => !roleIds.includes(String(key))));
    message.success(roleIds.length > 1 ? `已停用 ${roleIds.length} 个角色` : '角色已停用');
    await rolesQuery.refetch();
  };

  const columns = useMemo<ColumnsType<IamRole>>(() => {
    const nameColumn: ColumnsType<IamRole>[number] = {
      title: '角色名称',
      dataIndex: 'name',
      fixed: 'left',
      width: isCompact ? 220 : 220,
      render: (_, role) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{role.name}</Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ maxWidth: isCompact ? 180 : 260 }}>
            {role.description}
          </Typography.Text>
        </Space>
      ),
    };
    const statusColumn: ColumnsType<IamRole>[number] = {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: RoleStatus) => <Tag color={statusLabels[status].color}>{statusLabels[status].text}</Tag>,
    };
    const actionColumn: ColumnsType<IamRole>[number] = {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: isCompact ? 150 : 210,
      render: (_, role) =>
        canEditRoles ? (
          <Space size={8} wrap={isCompact}>
            <Button type="link" size="small" onClick={() => openRoleDrawer(role)}>
              编辑
            </Button>
            <Button type="link" size="small" onClick={() => openAuthorization(role)}>
              配置授权
            </Button>
            {!isCompact ? (
              <Popconfirm title={`停用 ${role.name}？`} okText="停用" cancelText="取消" onConfirm={() => disableRoles([role.id])}>
                <Button type="link" size="small" danger disabled={role.status === 'disabled'}>
                  停用
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ) : (
          <Typography.Text type="secondary">无权限</Typography.Text>
        ),
    };

    if (isCompact) {
      return [
        nameColumn,
        { title: '所属应用', dataIndex: 'applicationName', width: 160, ellipsis: true },
        statusColumn,
        actionColumn,
      ];
    }

    return [
      nameColumn,
      {
        title: '所属应用',
        dataIndex: 'applicationName',
        width: 160,
        ellipsis: true,
      },
      {
        title: '权限数量',
        key: 'permissionCount',
        width: 130,
        render: (_, role) => `${role.permissionGroupCount} 组 / ${role.permissionPointCount} 点`,
      },
      {
        title: '授权对象',
        key: 'bindingCount',
        width: 170,
        render: (_, role) => `${role.departmentBindingCount} 个组织 / ${role.userBindingCount} 个用户`,
      },
      statusColumn,
      { title: '更新时间', dataIndex: 'updatedAt', render: formatDateTime, width: 180 },
      actionColumn,
    ];
  }, [canEditRoles, isCompact]);

  const refreshRoles = async () => {
    setRefreshFeedback('');
    await rolesQuery.refetch();
    setRefreshFeedback('列表已刷新');
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        角色授权
      </Typography.Title>

      <SearchForm
        form={form}
        onFinish={(values) => {
          setPagination((current) => ({ ...current, page: 1 }));
          setFilters({
            keyword: values.keyword?.trim() || undefined,
            applicationId: values.applicationId,
            status: values.status,
            createdAtFrom: values.createdAtRange?.[0]?.startOf('day').toISOString(),
            createdAtTo: values.createdAtRange?.[1]?.endOf('day').toISOString(),
          });
        }}
      >
        <Form.Item name="keyword" label="关键词">
          <Input allowClear aria-label="keyword" placeholder="搜索角色名称 / 编码" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="applicationId" label="应用">
          <Select allowClear aria-label="application" placeholder="全部应用" style={{ width: 180 }} options={applicationOptions} />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select
            allowClear
            aria-label="status"
            placeholder="全部状态"
            style={{ width: 140 }}
            options={[
              { value: 'active', label: '启用' },
              { value: 'disabled', label: '停用' },
            ]}
          />
        </Form.Item>
        <Form.Item name="createdAtRange" label="创建时间">
          <RangePicker placeholder={['开始日期', '结束日期']} />
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
      </SearchForm>

      <AppTable<IamRole>
        title="角色列表"
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canEditRoles} onClick={() => openRoleDrawer()}>
              新建角色
            </Button>
            <Button
              icon={<StopOutlined />}
              disabled={!canEditRoles || selectedRowKeys.length === 0}
              onClick={() => setBatchDisableOpen(true)}
            >
              批量停用
            </Button>
            <Button icon={<ReloadOutlined />} loading={rolesQuery.isFetching} onClick={refreshRoles}>
              刷新
            </Button>
            {refreshFeedback ? <Typography.Text type="success">{refreshFeedback}</Typography.Text> : null}
          </Space>
        }
        isError={rolesQuery.isError}
        error={
          <Alert
            type="error"
            showIcon
            title="加载角色列表失败"
            description="请稍后重试，或检查当前飞书管理员的应用授权范围。"
            action={<Button onClick={() => rolesQuery.refetch()}>重试</Button>}
          />
        }
        isEmpty={!rolesQuery.isLoading && (rolesQuery.data?.items ?? []).length === 0}
        empty={<Empty description={filters.keyword || filters.applicationId || filters.status ? '没有匹配的角色' : '暂无角色'} />}
        tableProps={{
          rowKey: 'id',
          size: 'middle',
          columns,
          dataSource: rolesQuery.data?.items ?? [],
          loading: rolesQuery.isLoading,
          rowSelection: canEditRoles ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined,
          pagination: {
            total: rolesQuery.data?.total ?? 0,
            pageSize: pagination.pageSize,
            current: pagination.page,
            showSizeChanger: false,
            onChange: (page, pageSize) => setPagination({ page, pageSize }),
          },
          scroll: { x: isCompact ? 620 : 1160 },
        }}
      />

      <FormDrawer
        title={activeRole ? '编辑角色' : '新建角色'}
        size={520}
        open={roleDrawerOpen}
        onClose={() => setRoleDrawerOpen(false)}
        submitLoading={createRoleMutation.isPending || updateRoleMutation.isPending}
        onSubmit={saveRole}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="applicationId" label="所属应用" rules={[{ required: true, message: '请选择所属应用' }]}>
            <Select disabled={isApplicationAdminOnly} options={applicationOptions} />
          </Form.Item>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="例如：销售主管" />
          </Form.Item>
          <Form.Item name="code" label="角色编码" rules={[{ required: true, message: '请输入角色编码' }]}>
            <Input placeholder="例如：sales-manager" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="说明角色用途和授权边界" />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </FormDrawer>

      <Drawer
        title={`配置授权${activeRole ? `：${activeRole.name}` : ''}`}
        size={840}
        open={authorizationOpen}
        destroyOnClose
        onClose={() => setAuthorizationOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setAuthorizationOpen(false)}>取消</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => setSummaryOpen(true)}>
              保存授权
            </Button>
          </Space>
        }
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="角色">{activeRole?.name}</Descriptions.Item>
            <Descriptions.Item label="应用">{activeRole?.applicationName}</Descriptions.Item>
          </Descriptions>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="权限选择">
              <Tree
                checkable
                defaultExpandAll
                checkedKeys={checkedPermissionKeys}
                treeData={toTreeData(permissionTreeQuery.data ?? [])}
                onCheck={(keys) => setCheckedPermissionKeys(Array.isArray(keys) ? keys : keys.checked)}
              />
            </Card>
            <Card title="飞书组织 / 用户选择">
              <Form layout="vertical">
                <Form.Item name="departments" label="飞书组织">
                  <TreeSelect
                    aria-label="飞书组织"
                    treeCheckable
                    treeData={departmentTreeData}
                    value={selectedDepartmentIds}
                    placeholder="选择飞书部门"
                    style={{ width: '100%' }}
                    onChange={(value) => setSelectedDepartmentIds(Array.isArray(value) ? value.map(String) : [])}
                  />
                </Form.Item>
                <Form.Item name="users" label="飞书用户">
                  <Select
                    aria-label="飞书用户"
                    mode="multiple"
                    value={selectedUserIds}
                    placeholder="选择飞书用户"
                    options={userOptions}
                    onChange={(value) => setSelectedUserIds(value)}
                  />
                </Form.Item>
              </Form>
            </Card>
          </div>
        </Space>
      </Drawer>

      <Modal
        title="批量停用角色"
        open={batchDisableOpen}
        okText="确认停用"
        cancelText="取消"
        onOk={async () => {
          await disableRoles(selectedRowKeys.map(String));
          setBatchDisableOpen(false);
        }}
        onCancel={() => setBatchDisableOpen(false)}
      >
        <Typography.Text>确认停用已选中的 {selectedRowKeys.length} 个角色？停用后对应授权不会再生效。</Typography.Text>
      </Modal>

      <Modal
        title="授权变更摘要"
        open={summaryOpen}
        okText="确认保存授权"
        cancelText="取消"
        confirmLoading={updateRoleAuthorizationMutation.isPending}
        onOk={async () => {
          if (!activeRole) {
            return;
          }
          await updateRoleAuthorizationMutation.mutateAsync({
            roleId: activeRole.id,
            permissionKeys: selectedPermissionKeyStrings,
            departmentIds: selectedDepartmentIdStrings,
            userIds: selectedUserIdStrings,
          });
          setSummaryOpen(false);
          setAuthorizationOpen(false);
          message.success('授权配置已保存');
          await rolesQuery.refetch();
        }}
        onCancel={() => setSummaryOpen(false)}
      >
        <Space orientation="vertical">
          <Typography.Text>新增权限：{authorizationSummary.addedPermissions} 个</Typography.Text>
          <Typography.Text>移除权限：{authorizationSummary.removedPermissions} 个</Typography.Text>
          <Typography.Text>新增组织：{authorizationSummary.addedDepartments} 个</Typography.Text>
          <Typography.Text>移除组织：{authorizationSummary.removedDepartments} 个</Typography.Text>
          <Typography.Text>新增用户：{authorizationSummary.addedUsers} 个</Typography.Text>
          <Typography.Text>移除用户：{authorizationSummary.removedUsers} 个</Typography.Text>
        </Space>
      </Modal>
    </Space>
  );
}
