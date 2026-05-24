import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Grid, Space, Table, Tag, Tree, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import { useMemo, useState } from 'react';
import { isIamHttpError } from '../../features/iam/httpClient';
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
  const screens = Grid.useBreakpoint();
  const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');
  const isCompact = !isJsdom && (typeof window === 'undefined' ? !screens.lg : window.innerWidth < 1360);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | undefined>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | undefined>();
  const [refreshFeedback, setRefreshFeedback] = useState('');
  const departmentsQuery = useFeishuDepartments();
  const usersQuery = useDirectoryUsers({
    departmentId: selectedDepartmentId,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const departmentTree = useMemo(() => buildDepartmentTree(departmentsQuery.data ?? []), [departmentsQuery.data]);
  const directoryError = departmentsQuery.error ?? usersQuery.error;
  const directoryErrorView = getDirectoryErrorView(directoryError);

  const columns = useMemo<ColumnsType<DirectoryUser>>(() => {
    const nameColumn: ColumnsType<DirectoryUser>[number] = {
      title: '姓名',
      dataIndex: 'displayName',
      fixed: 'left',
      width: isCompact ? 220 : 220,
      render: (_, user) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{user.displayName}</Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ maxWidth: isCompact ? 180 : 260 }}>
            飞书 user_id：{user.feishuUserId}
          </Typography.Text>
        </Space>
      ),
    };
    const statusColumn: ColumnsType<DirectoryUser>[number] = {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: DirectoryUser['status']) => <Tag color={statusLabels[status].color}>{statusLabels[status].text}</Tag>,
    };
    const actionColumn: ColumnsType<DirectoryUser>[number] = {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: isCompact ? 110 : 120,
      render: (_, user) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedUser(user)}>
          查看详情
        </Button>
      ),
    };

    if (isCompact) {
      return [
        nameColumn,
        { title: '部门', dataIndex: 'departmentName', width: 140, ellipsis: true },
        statusColumn,
        actionColumn,
      ];
    }

    return [
      nameColumn,
      {
        title: '部门',
        dataIndex: 'departmentName',
        width: 140,
        ellipsis: true,
      },
      statusColumn,
      { title: '邮箱', dataIndex: 'email', width: 220, ellipsis: true, render: (email?: string) => email || '-' },
      { title: '手机遮罩', dataIndex: 'mobile', width: 130, render: maskMobile },
      { title: '最近同步时间', dataIndex: 'syncedAt', render: formatDateTime, width: 180 },
      actionColumn,
    ];
  }, [isCompact]);

  const refreshDirectory = async () => {
    setRefreshFeedback('');
    await Promise.all([departmentsQuery.refetch(), usersQuery.refetch()]);
    setRefreshFeedback('目录投影已刷新');
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        组织与用户
      </Typography.Title>
      <Alert
        showIcon
        type="info"
        title="只读目录投影"
        description="组织结构与用户信息只来自飞书同步结果，本页面不直接编辑飞书组织或用户。"
      />

      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '280px minmax(0, 1fr)', gap: 16 }}>
        <Card title="部门树" style={{ minWidth: 0 }} styles={{ body: { minHeight: 480 } }}>
          <Tree
            defaultExpandAll
            treeData={departmentTree}
            selectedKeys={selectedDepartmentId ? [selectedDepartmentId] : []}
            onSelect={(keys) => {
              setSelectedDepartmentId(keys[0]?.toString());
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          />
        </Card>
        <Card
          title="用户列表"
          style={{ minWidth: 0 }}
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} loading={usersQuery.isFetching} onClick={refreshDirectory}>
                刷新
              </Button>
              {refreshFeedback ? <Typography.Text type="success">{refreshFeedback}</Typography.Text> : null}
            </Space>
          }
        >
          {directoryErrorView ? (
            <Alert
              type="error"
              showIcon
              title={directoryErrorView.title}
              description={
                <Space orientation="vertical" size={4}>
                  <Typography.Text>{directoryErrorView.description}</Typography.Text>
                  {directoryErrorView.requestId ? (
                    <Typography.Text type="secondary">
                      Request ID: <Typography.Text code copyable>{directoryErrorView.requestId}</Typography.Text>
                    </Typography.Text>
                  ) : null}
                </Space>
              }
              action={<Button onClick={refreshDirectory}>重试</Button>}
            />
          ) : !usersQuery.isLoading && (usersQuery.data?.items ?? []).length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={selectedDepartmentId ? '该部门暂无已同步用户' : '暂无飞书用户同步结果'}
            />
          ) : (
            <Table
              rowKey="feishuUserId"
              size="middle"
              columns={columns}
              dataSource={usersQuery.data?.items ?? []}
              loading={usersQuery.isLoading || departmentsQuery.isLoading}
              pagination={{
                total: usersQuery.data?.total ?? 0,
                pageSize: pagination.pageSize,
                current: pagination.page,
                showSizeChanger: false,
                onChange: (page, pageSize) => setPagination({ page, pageSize }),
              }}
              scroll={{ x: isCompact ? 560 : 1120 }}
            />
          )}
        </Card>
      </div>

      <Drawer
        title="用户详情"
        size={560}
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

function getDirectoryErrorView(error: unknown): { title: string; description: string; requestId?: string } | undefined {
  if (!error) {
    return undefined;
  }
  if (isIamHttpError(error)) {
    if (error.status === 401) {
      return {
        title: '会话已过期',
        description: '请重新使用飞书登录后再查看组织目录。',
        requestId: error.requestId,
      };
    }
    if (error.status === 403) {
      return {
        title: '无权查看组织目录',
        description: '当前飞书用户不是平台管理员，无法查看飞书组织与用户投影。',
        requestId: error.requestId,
      };
    }
    return {
      title: '加载飞书目录失败',
      description: error.message || '请稍后重试，或检查飞书应用的通讯录同步权限。',
      requestId: error.requestId,
    };
  }
  return {
    title: '加载飞书目录失败',
    description: error instanceof Error ? error.message : '请稍后重试，或检查飞书应用的通讯录同步权限。',
  };
}
