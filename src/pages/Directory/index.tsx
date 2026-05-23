import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Drawer, Space, Table, Tag, Tree, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import { useMemo, useState } from 'react';
import { useDirectoryUsers, useFeishuDepartments } from '../../features/iam/queries';
import type { DirectoryUser, FeishuDepartment } from '../../features/iam/types';

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

const maskMobile = (mobile?: string) => (mobile ? `${mobile.slice(0, 3)}****${mobile.slice(-4)}` : '-');

const statusLabels: Record<DirectoryUser['status'], { text: string; color: string }> = {
  active: { text: '在职', color: 'success' },
  disabled: { text: '停用', color: 'default' },
  resigned: { text: '离职', color: 'error' },
};

function buildDepartmentTree(departments: FeishuDepartment[]): DataNode[] {
  const childrenByParent = new Map<string | undefined, FeishuDepartment[]>();
  departments.forEach((department) => {
    const siblings = childrenByParent.get(department.parentId) ?? [];
    siblings.push(department);
    childrenByParent.set(department.parentId, siblings);
  });

  const build = (parentId?: string): DataNode[] =>
    (childrenByParent.get(parentId) ?? []).map((department) => ({
      key: department.id,
      title: `${department.name} (${department.userCount})`,
      children: build(department.id),
    }));

  return build(undefined);
}

export function DirectoryPage() {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | undefined>();
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | undefined>();
  const [refreshFeedback, setRefreshFeedback] = useState('');
  const departmentsQuery = useFeishuDepartments();
  const usersQuery = useDirectoryUsers({ departmentId: selectedDepartmentId, page: 1, pageSize: 20 });
  const departmentTree = useMemo(() => buildDepartmentTree(departmentsQuery.data ?? []), [departmentsQuery.data]);

  const columns = useMemo<ColumnsType<DirectoryUser>>(
    () => [
      {
        title: '姓名',
        dataIndex: 'displayName',
        fixed: 'left',
        render: (_, user) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{user.displayName}</Typography.Text>
            <Typography.Text type="secondary">飞书 user_id：{user.feishuUserId}</Typography.Text>
          </Space>
        ),
      },
      { title: '部门', dataIndex: 'departmentName' },
      {
        title: '状态',
        dataIndex: 'status',
        render: (status: DirectoryUser['status']) => <Tag color={statusLabels[status].color}>{statusLabels[status].text}</Tag>,
      },
      { title: '邮箱', dataIndex: 'email', render: (email?: string) => email || '-' },
      { title: '手机遮罩', dataIndex: 'mobile', render: maskMobile },
      { title: '最近同步时间', dataIndex: 'syncedAt', render: formatDateTime },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 120,
        render: (_, user) => (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedUser(user)}>
            查看详情
          </Button>
        ),
      },
    ],
    [],
  );

  const refreshDirectory = async () => {
    setRefreshFeedback('');
    await Promise.all([departmentsQuery.refetch(), usersQuery.refetch()]);
    setRefreshFeedback('目录投影已刷新');
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        组织与用户
      </Typography.Title>
      <Alert
        showIcon
        type="info"
        message="只读目录投影"
        description="组织结构与用户信息只来自飞书同步结果，本页面不直接编辑飞书组织或用户。"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16 }}>
        <Card title="部门树" bodyStyle={{ minHeight: 480 }}>
          <Tree
            defaultExpandAll
            treeData={departmentTree}
            selectedKeys={selectedDepartmentId ? [selectedDepartmentId] : []}
            onSelect={(keys) => setSelectedDepartmentId(keys[0]?.toString())}
          />
        </Card>
        <Card
          title="用户列表"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} loading={usersQuery.isFetching} onClick={refreshDirectory}>
                刷新
              </Button>
              {refreshFeedback ? <Typography.Text type="success">{refreshFeedback}</Typography.Text> : null}
            </Space>
          }
        >
          <Table
            rowKey="feishuUserId"
            size="middle"
            columns={columns}
            dataSource={usersQuery.data?.items ?? []}
            loading={usersQuery.isLoading || departmentsQuery.isLoading}
            pagination={{ total: usersQuery.data?.total ?? 0, pageSize: 20, current: 1, showSizeChanger: false }}
            scroll={{ x: 1100 }}
          />
        </Card>
      </div>

      <Drawer
        title="用户详情"
        width={560}
        open={Boolean(selectedUser)}
        destroyOnClose
        onClose={() => setSelectedUser(undefined)}
      >
        {selectedUser ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="基础信息">
              {selectedUser.displayName} / 飞书 user_id：{selectedUser.feishuUserId}
            </Descriptions.Item>
            <Descriptions.Item label="所属部门">{selectedUser.departmentPath}</Descriptions.Item>
            <Descriptions.Item label="飞书状态">
              <Tag color={statusLabels[selectedUser.status].color}>{statusLabels[selectedUser.status].text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">{selectedUser.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机">{maskMobile(selectedUser.mobile)}</Descriptions.Item>
            <Descriptions.Item label="本地角色绑定摘要">{selectedUser.localRoleSummary}</Descriptions.Item>
            <Descriptions.Item label="最近登录时间">{formatDateTime(selectedUser.lastLoginAt)}</Descriptions.Item>
            <Descriptions.Item label="最近权限查询时间">{formatDateTime(selectedUser.lastPermissionQueriedAt)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}
