import { EyeOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Grid,
  Progress,
  Row,
  Col,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useCurrentSession, useRetrySyncRun, useStartManualSync, useSyncRuns } from '../../features/iam/queries';
import { canRunSync as canRunSyncForSession } from '../../features/iam/permissions';
import type { SyncRun, SyncRunStatus, SyncTrigger } from '../../features/iam/types';

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

const triggerLabels: Record<SyncTrigger, string> = {
  manual: '手动触发',
  scheduled: '定时任务',
  retry: '重试同步',
};

const statusLabels: Record<SyncRunStatus, { text: string; color: string }> = {
  running: { text: '运行中', color: 'processing' },
  succeeded: { text: '成功', color: 'success' },
  failed: { text: '失败', color: 'error' },
};

function SyncRunStatusTag({ run }: { run: SyncRun }) {
  const status = statusLabels[run.status];

  return (
    <Space orientation="vertical" size={4}>
      <Tag color={status.color}>{status.text}</Tag>
      {run.status === 'running' ? <Progress percent={45} size="small" status="active" aria-label="Running Progress" /> : null}
      {run.status === 'failed' && run.errorMessage ? (
        <Typography.Text type="danger">{run.errorMessage}</Typography.Text>
      ) : null}
    </Space>
  );
}

function formatDuration(run: SyncRun) {
  if (run.status === 'running') {
    return '运行中';
  }

  return run.durationSeconds ? `${run.durationSeconds} 秒` : '-';
}

export function SyncPage() {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');
  const isCompact = !isJsdom && (typeof window === 'undefined' ? !screens.lg : window.innerWidth < 1360);
  const [selectedRun, setSelectedRun] = useState<SyncRun | undefined>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const currentSessionQuery = useCurrentSession();
  const syncRunsQuery = useSyncRuns({ page: pagination.page, pageSize: pagination.pageSize });
  const startManualSyncMutation = useStartManualSync();
  const retrySyncRunMutation = useRetrySyncRun();
  const syncRuns = syncRunsQuery.data?.items ?? [];
  const latestRun = syncRuns[0];
  const latestSuccessRun = syncRuns.find((run) => run.status === 'succeeded');
  const canRunSync = canRunSyncForSession(currentSessionQuery.data);
  const syncRunPermissionTip = '需要 sync:run 权限才能发起同步或重试。';

  const startManualSync = async () => {
    if (!canRunSync) {
      message.warning(syncRunPermissionTip);
      return;
    }

    await startManualSyncMutation.mutateAsync();
    message.success('已发起手动同步');
    await syncRunsQuery.refetch();
  };

  const retrySyncRun = async (run: SyncRun) => {
    if (!canRunSync) {
      message.warning(syncRunPermissionTip);
      return;
    }

    await retrySyncRunMutation.mutateAsync(run.id);
    message.success('已发起重试同步');
    await syncRunsQuery.refetch();
  };

  const columns = useMemo<ColumnsType<SyncRun>>(() => {
    const runColumn: ColumnsType<SyncRun>[number] = {
      title: 'Run ID',
      dataIndex: 'id',
      fixed: 'left',
      width: isCompact ? 180 : 200,
      ellipsis: true,
      render: (id: string, run) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text code>{id}</Typography.Text>
          {isCompact ? <Typography.Text type="secondary">{triggerLabels[run.trigger]}</Typography.Text> : null}
        </Space>
      ),
    };
    const statusColumn: ColumnsType<SyncRun>[number] = {
      title: '状态',
      dataIndex: 'status',
      width: isCompact ? 110 : 160,
      render: (_, run) => <SyncRunStatusTag run={run} />,
    };
    const actionColumn: ColumnsType<SyncRun>[number] = {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: isCompact ? 110 : 180,
      render: (_, run) => (
        <Space size={8} wrap={isCompact}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedRun(run)}>
            查看详情
          </Button>
          {run.status === 'failed' && !isCompact ? (
            <Button
              type="link"
              size="small"
              disabled={!canRunSync}
              loading={retrySyncRunMutation.isPending}
              onClick={() => retrySyncRun(run)}
              title={canRunSync ? undefined : syncRunPermissionTip}
            >
              重试同步
            </Button>
          ) : null}
        </Space>
      ),
    };

    if (isCompact) {
      return [
        runColumn,
        statusColumn,
        {
          title: '用户差异',
          key: 'userDiff',
          width: 180,
          render: (_, run) =>
            `新增 ${run.diffSummary.createdUsers} / 更新 ${run.diffSummary.updatedUsers} / 离职 ${run.diffSummary.resignedUsers}`,
        },
        actionColumn,
      ];
    }

    return [
      runColumn,
      { title: '触发方式', dataIndex: 'trigger', width: 110, render: (trigger: SyncTrigger) => triggerLabels[trigger] },
      statusColumn,
      { title: '开始时间', dataIndex: 'startedAt', width: 180, render: formatDateTime },
      { title: '耗时', key: 'duration', width: 90, render: (_, run) => formatDuration(run) },
      {
        title: '用户变化',
        key: 'userChanges',
        width: 210,
        render: (_, run) =>
          `新增 ${run.diffSummary.createdUsers} / 更新 ${run.diffSummary.updatedUsers} / 离职 ${run.diffSummary.resignedUsers} / 失败 ${run.diffSummary.failedUsers}`,
      },
      {
        title: '部门变化',
        key: 'departmentChanges',
        width: 140,
        render: (_, run) => `新增 ${run.diffSummary.createdDepartments} / 更新 ${run.diffSummary.updatedDepartments}`,
      },
      { title: '操作人', dataIndex: 'operatorFeishuUserId', width: 180, ellipsis: true },
      actionColumn,
    ];
  }, [canRunSync, isCompact, retrySyncRunMutation.isPending]);

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        飞书同步
      </Typography.Title>

      <Card title="同步状态摘要">
        <Row gutter={16}>
          <Col xs={24} md={12} xl={4}>
            <Statistic title="最近同步状态" value={latestRun ? statusLabels[latestRun.status].text : '-'} />
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Statistic title="最近成功同步时间" value={formatDateTime(latestSuccessRun?.finishedAt)} />
          </Col>
          <Col xs={12} md={6} xl={3}>
            <Statistic title="用户数量" value={latestSuccessRun?.successCount ?? 0} />
          </Col>
          <Col xs={12} md={6} xl={3}>
            <Statistic title="部门数量" value={latestSuccessRun?.departmentChanges ?? 0} />
          </Col>
          <Col xs={24} md={12} xl={9}>
            <Typography.Text type="secondary">最近同步差异</Typography.Text>
            <div>
              新增 {latestRun?.diffSummary.createdUsers ?? 0} / 更新 {latestRun?.diffSummary.updatedUsers ?? 0} / 离职{' '}
              {latestRun?.diffSummary.resignedUsers ?? 0} / 失败 {latestRun?.diffSummary.failedUsers ?? 0}
            </div>
          </Col>
        </Row>
      </Card>

      <Card
        title="同步任务"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              disabled={!canRunSync}
              loading={startManualSyncMutation.isPending}
              onClick={startManualSync}
              title={canRunSync ? undefined : syncRunPermissionTip}
            >
              手动同步
            </Button>
            <Button icon={<ReloadOutlined />} loading={syncRunsQuery.isFetching} onClick={() => syncRunsQuery.refetch()}>
              刷新
            </Button>
          </Space>
        }
      >
        {!canRunSync ? (
          <Alert type="info" showIcon title={syncRunPermissionTip} style={{ marginBottom: 16 }} />
        ) : null}
        {syncRunsQuery.isError ? (
          <Alert type="error" showIcon title="同步任务加载失败" action={<Button onClick={() => syncRunsQuery.refetch()}>重试</Button>} />
        ) : syncRuns.length === 0 && !syncRunsQuery.isLoading ? (
          <Empty description="暂无同步任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={syncRuns}
            loading={syncRunsQuery.isLoading}
            pagination={{
              total: syncRunsQuery.data?.total ?? 0,
              pageSize: pagination.pageSize,
              current: pagination.page,
              showSizeChanger: false,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
            }}
            scroll={{ x: isCompact ? 580 : 1290 }}
          />
        )}
      </Card>

      <Drawer
        title={selectedRun ? `同步详情：${selectedRun.id}` : '同步详情'}
        size={640}
        open={Boolean(selectedRun)}
        destroyOnClose
        onClose={() => setSelectedRun(undefined)}
      >
        {selectedRun ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="基本信息">
              {triggerLabels[selectedRun.trigger]} / <Tag color={statusLabels[selectedRun.status].color}>{statusLabels[selectedRun.status].text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="请求批次数">{selectedRun.requestBatchCount}</Descriptions.Item>
            <Descriptions.Item label="成功数量">{selectedRun.successCount}</Descriptions.Item>
            <Descriptions.Item label="失败数量">{selectedRun.failedCount}</Descriptions.Item>
            <Descriptions.Item label="差异摘要">
              新增用户 {selectedRun.diffSummary.createdUsers}，更新用户 {selectedRun.diffSummary.updatedUsers}，离职用户{' '}
              {selectedRun.diffSummary.resignedUsers}，失败用户 {selectedRun.diffSummary.failedUsers}，新增部门{' '}
              {selectedRun.diffSummary.createdDepartments}，更新部门 {selectedRun.diffSummary.updatedDepartments}
            </Descriptions.Item>
            <Descriptions.Item label="失败链路 Request ID">{selectedRun.requestId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="错误信息">{selectedRun.errorMessage ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="关联审计日志入口">{selectedRun.auditLogId ?? '-'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}
