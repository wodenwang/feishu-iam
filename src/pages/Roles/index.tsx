import { PlusOutlined, ReloadOutlined, SaveOutlined, StopOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
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
import {
  useApplications,
  useCurrentSession,
  useDirectoryUsers,
  useFeishuDepartments,
  useIamPermissionTree,
  useRoles,
} from '../../features/iam/queries';
import type { IamPermissionNode, IamRole, RoleStatus } from '../../features/iam/types';

const { RangePicker } = DatePicker;

interface SearchValues {
  keyword?: string;
  applicationId?: string;
  status?: RoleStatus;
  createdAtRange?: [Dayjs, Dayjs];
  createdAtFrom?: string;
  createdAtTo?: string;
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
  const [form] = Form.useForm<SearchValues>();
  const [roleForm] = Form.useForm();
  const [filters, setFilters] = useState<SearchValues>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [authorizationOpen, setAuthorizationOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<IamRole | undefined>();
  const [checkedPermissionKeys, setCheckedPermissionKeys] = useState<Key[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [refreshFeedback, setRefreshFeedback] = useState('');
  const sessionQuery = useCurrentSession();
  const isApplicationAdminOnly = Boolean(
    sessionQuery.data?.roles.includes('application_admin') && !sessionQuery.data.roles.includes('platform_admin'),
  );
  const applicationsQuery = useApplications({ page: 1, pageSize: 50 });
  const rolesQuery = useRoles({
    ...filters,
    allowedApplicationIds: isApplicationAdminOnly ? (sessionQuery.data?.applicationIds ?? []) : undefined,
    enabled: Boolean(sessionQuery.data),
    page: 1,
    pageSize: 20,
  });
  const permissionTreeQuery = useIamPermissionTree();
  const departmentsQuery = useFeishuDepartments();
  const directoryUsersQuery = useDirectoryUsers({ page: 1, pageSize: 100 });

  const canUpdateRoles = Boolean(sessionQuery.data?.permissions.includes('role:update'));
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

  const columns = useMemo<ColumnsType<IamRole>>(
    () => [
      {
        title: '角色名称',
        dataIndex: 'name',
        fixed: 'left',
        render: (_, role) => (
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>{role.name}</Typography.Text>
            <Typography.Text type="secondary">{role.description}</Typography.Text>
          </Space>
        ),
      },
      { title: '所属应用', dataIndex: 'applicationName' },
      {
        title: '权限数量',
        key: 'permissionCount',
        render: (_, role) => `${role.permissionGroupCount} 组 / ${role.permissionPointCount} 点`,
      },
      {
        title: '授权对象',
        key: 'bindingCount',
        render: (_, role) => `${role.departmentBindingCount} 个组织 / ${role.userBindingCount} 个用户`,
      },
      {
        title: '状态',
        dataIndex: 'status',
        render: (status: RoleStatus) => <Tag color={statusLabels[status].color}>{statusLabels[status].text}</Tag>,
      },
      { title: '更新时间', dataIndex: 'updatedAt', render: formatDateTime },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 210,
        render: (_, role) => (
          canUpdateRoles ? (
            <Space size={8}>
              <Button type="link" size="small" onClick={() => openRoleDrawer(role)}>
                编辑
              </Button>
              <Button type="link" size="small" onClick={() => openAuthorization(role)}>
                配置授权
              </Button>
              <Button type="link" size="small" danger>
                停用
              </Button>
            </Space>
          ) : (
            <Typography.Text type="secondary">无权限</Typography.Text>
          )
        ),
      },
    ],
    [canUpdateRoles],
  );

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

      <Card>
        <Form
          form={form}
          layout="inline"
          onFinish={(values) =>
            setFilters({
              keyword: values.keyword?.trim() || undefined,
              applicationId: values.applicationId,
              status: values.status,
              createdAtFrom: values.createdAtRange?.[0]?.startOf('day').toISOString(),
              createdAtTo: values.createdAtRange?.[1]?.endOf('day').toISOString(),
            })
          }
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
        title="角色列表"
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canUpdateRoles} onClick={() => openRoleDrawer()}>
              新建角色
            </Button>
            <Button icon={<StopOutlined />} disabled={!canUpdateRoles || selectedRowKeys.length === 0}>
              批量停用
            </Button>
            <Button icon={<ReloadOutlined />} loading={rolesQuery.isFetching} onClick={refreshRoles}>
              刷新
            </Button>
            {refreshFeedback ? <Typography.Text type="success">{refreshFeedback}</Typography.Text> : null}
          </Space>
        }
      >
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={rolesQuery.data?.items ?? []}
          loading={rolesQuery.isLoading}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: rolesQuery.data?.total ?? 0, pageSize: 20, current: 1, showSizeChanger: false }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Drawer
        title={activeRole ? '编辑角色' : '新建角色'}
        size={520}
        open={roleDrawerOpen}
        destroyOnClose
        onClose={() => setRoleDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setRoleDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={() => setRoleDrawerOpen(false)}>
              保存
            </Button>
          </Space>
        }
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
      </Drawer>

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
        title="授权变更摘要"
        open={summaryOpen}
        okText="确认保存授权"
        cancelText="取消"
        onOk={() => {
          setSummaryOpen(false);
          setAuthorizationOpen(false);
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
