import { ApiOutlined, CheckCircleOutlined, EyeOutlined, ReloadOutlined, SafetyCertificateOutlined, SyncOutlined } from '@ant-design/icons';
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
import {
  useCurrentSession,
  useRetrySyncRun,
  useRetrySyncEvent,
  useRunSyncPreflight,
  useStartManualSync,
  useSyncEvents,
  useSyncEventStatus,
  useSyncRuns,
  useSyncStatus,
} from '../../features/iam/queries';
import { canRunSync as canRunSyncForSession } from '../../features/iam/permissions';
import type {
  SyncHealthStatus,
  SyncEvent,
  SyncEventStatus,
  SyncPreflightResult,
  SyncPreflightStageName,
  SyncRun,
  SyncRunStatus,
  SyncTrigger,
} from '../../features/iam/types';

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

const healthLabels: Record<SyncHealthStatus, { text: string; color: string }> = {
  healthy: { text: '健康', color: 'success' },
  warning: { text: '关注', color: 'warning' },
  failed: { text: '异常', color: 'error' },
  unknown: { text: '未知', color: 'default' },
};

const eventStatusLabels: Record<SyncEventStatus, { text: string; color: string }> = {
  pending_sync: { text: '待同步', color: 'warning' },
  processed: { text: '已处理', color: 'success' },
  failed: { text: '失败', color: 'error' },
  ignored: { text: '已忽略', color: 'default' },
};

const preflightStageLabels: Record<SyncPreflightStageName, string> = {
  token: 'Tenant Token',
  departments: '部门读取',
  users: '用户读取',
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

function formatOperator(run: SyncRun) {
  if (run.operatorType === 'system' || !run.operatorFeishuUserId) {
    return '系统任务';
  }

  return run.operatorFeishuUserId;
}

export function SyncPage() {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');
  const isCompact = !isJsdom && (typeof window === 'undefined' ? !screens.lg : window.innerWidth < 1360);
  const [selectedRun, setSelectedRun] = useState<SyncRun | undefined>();
  const [preflightResult, setPreflightResult] = useState<SyncPreflightResult | undefined>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const currentSessionQuery = useCurrentSession();
  const syncStatusQuery = useSyncStatus();
  const syncRunsQuery = useSyncRuns({ page: pagination.page, pageSize: pagination.pageSize });
  const syncEventStatusQuery = useSyncEventStatus();
  const syncEventsQuery = useSyncEvents({ page: 1, pageSize: 8 });
  const startManualSyncMutation = useStartManualSync();
  const retrySyncRunMutation = useRetrySyncRun();
  const retrySyncEventMutation = useRetrySyncEvent();
  const runSyncPreflightMutation = useRunSyncPreflight();
  const syncRuns = syncRunsQuery.data?.items ?? [];
  const syncEvents = syncEventsQuery.data?.items ?? [];
  const latestRun = syncStatusQuery.data?.latestRun ?? syncRuns[0];
  const latestSuccessRun = syncStatusQuery.data?.latestSuccessfulRun ?? syncRuns.find((run) => run.status === 'succeeded');
  const latestFailedRun = syncStatusQuery.data?.latestFailedRun ?? syncRuns.find((run) => run.status === 'failed');
  const latestScheduledRun = syncRuns.find((run) => run.trigger === 'scheduled');
  const health = healthLabels[syncStatusQuery.data?.healthStatus ?? 'unknown'];
  const eventHealth = healthLabels[syncEventStatusQuery.data?.healthStatus ?? 'unknown'];
  const canRunSync = canRunSyncForSession(currentSessionQuery.data);
  const syncRunPermissionTip = '需要 sync:run 权限才能发起同步、预检或重试。';

  const refreshSyncRuntime = async () => {
    await Promise.all([syncStatusQuery.refetch(), syncRunsQuery.refetch(), syncEventStatusQuery.refetch(), syncEventsQuery.refetch()]);
  };

  const startManualSync = async () => {
    if (!canRunSync) {
      message.warning(syncRunPermissionTip);
      return;
    }

    await startManualSyncMutation.mutateAsync();
    message.success('已发起手动同步');
    await refreshSyncRuntime();
  };

  const retrySyncRun = async (run: SyncRun) => {
    if (!canRunSync) {
      message.warning(syncRunPermissionTip);
      return;
    }

    await retrySyncRunMutation.mutateAsync(run.id);
    message.success('已发起重试同步');
    await refreshSyncRuntime();
  };

  const retrySyncEvent = async (event: SyncEvent) => {
    if (!canRunSync) {
      message.warning(syncRunPermissionTip);
      return;
    }

    await retrySyncEventMutation.mutateAsync(event.id);
    message.success('已重新处理飞书事件');
    await refreshSyncRuntime();
  };

  const runSyncPreflight = async () => {
    if (!canRunSync) {
      message.warning(syncRunPermissionTip);
      return;
    }

    const result = await runSyncPreflightMutation.mutateAsync();
    setPreflightResult(result);
    if (result.status === 'passed') {
      message.success('飞书通讯录权限预检通过');
    } else {
      message.warning('飞书通讯录权限预检未通过');
    }
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
      { title: '操作人', key: 'operator', width: 180, ellipsis: true, render: (_, run) => formatOperator(run) },
      actionColumn,
    ];
  }, [canRunSync, isCompact, retrySyncRunMutation.isPending]);

  const eventColumns = useMemo<ColumnsType<SyncEvent>>(
    () => [
      {
        title: 'Event ID',
        dataIndex: 'eventId',
        width: isCompact ? 180 : 240,
        ellipsis: true,
        render: (eventId: string, event) => (
          <Space orientation="vertical" size={0}>
            <Typography.Text code>{eventId}</Typography.Text>
            <Typography.Text type="secondary">{event.eventType}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status: SyncEventStatus) => <Tag color={eventStatusLabels[status].color}>{eventStatusLabels[status].text}</Tag>,
      },
      {
        title: '资源',
        key: 'resource',
        width: isCompact ? 160 : 220,
        render: (_, event) => `${event.resourceType ?? '-'} / ${event.resourceId ?? '-'}`,
      },
      { title: '接收时间', dataIndex: 'receivedAt', width: 180, render: formatDateTime },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 120,
        render: (_, event) =>
          event.status === 'pending_sync' || event.status === 'failed' ? (
            <Button
              type="link"
              size="small"
              disabled={!canRunSync}
              loading={retrySyncEventMutation.isPending}
              onClick={() => retrySyncEvent(event)}
              title={canRunSync ? undefined : syncRunPermissionTip}
            >
              处理事件
            </Button>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          ),
      },
    ],
    [canRunSync, isCompact, retrySyncEventMutation.isPending],
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        飞书同步
      </Typography.Title>

      <Card title="同步状态摘要" extra={<Tag color={health.color}>{health.text}</Tag>}>
        {syncStatusQuery.isError ? (
          <Alert
            type="error"
            showIcon
            title="同步健康状态加载失败"
            action={<Button onClick={() => syncStatusQuery.refetch()}>重试</Button>}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Row gutter={16}>
          <Col xs={24} md={12} xl={4}>
            <Statistic title="最近同步状态" value={latestRun ? statusLabels[latestRun.status].text : '-'} />
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Statistic title="最近成功同步时间" value={formatDateTime(latestSuccessRun?.finishedAt)} />
          </Col>
          <Col xs={12} md={6} xl={3}>
            <Statistic title="用户数量" value={syncStatusQuery.data?.directoryUserCount ?? latestSuccessRun?.successCount ?? 0} />
          </Col>
          <Col xs={12} md={6} xl={3}>
            <Statistic title="部门数量" value={syncStatusQuery.data?.directoryDepartmentCount ?? latestSuccessRun?.departmentChanges ?? 0} />
          </Col>
          <Col xs={24} md={12} xl={4}>
            <Statistic title="最近失败同步时间" value={formatDateTime(latestFailedRun?.finishedAt)} />
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Statistic title="最近定时同步" value={formatDateTime(latestScheduledRun?.finishedAt ?? latestScheduledRun?.startedAt)} />
          </Col>
          <Col xs={24} md={12} xl={24}>
            <Typography.Text type="secondary">最近同步差异</Typography.Text>
            <div>
              新增 {latestRun?.diffSummary.createdUsers ?? 0} / 更新 {latestRun?.diffSummary.updatedUsers ?? 0} / 离职{' '}
              {latestRun?.diffSummary.resignedUsers ?? 0} / 失败 {latestRun?.diffSummary.failedUsers ?? 0}
            </div>
            <Typography.Text type="secondary">
              健康判断：{syncStatusQuery.data?.healthReasons.length ? syncStatusQuery.data.healthReasons.join('；') : '-'}
            </Typography.Text>
          </Col>
        </Row>
      </Card>

      <Card title="飞书事件同步" extra={<Tag color={eventHealth.color}>{eventHealth.text}</Tag>}>
        {syncEventStatusQuery.isError || syncEventsQuery.isError ? (
          <Alert type="error" showIcon title="飞书事件状态加载失败" action={<Button onClick={refreshSyncRuntime}>重试</Button>} />
        ) : (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col xs={12} md={6}>
                <Statistic title="待同步事件" value={syncEventStatusQuery.data?.pendingCount ?? 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="失败事件" value={syncEventStatusQuery.data?.failedCount ?? 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="已处理事件" value={syncEventStatusQuery.data?.processedCount ?? 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="已忽略事件" value={syncEventStatusQuery.data?.ignoredCount ?? 0} />
              </Col>
            </Row>
            <Alert
              type={syncEventStatusQuery.data?.healthStatus === 'failed' ? 'error' : syncEventStatusQuery.data?.healthStatus === 'warning' ? 'warning' : 'info'}
              showIcon
              icon={<ApiOutlined />}
              title="事件订阅回调地址"
              description={
                <Space orientation="vertical" size={4}>
                  <Typography.Text code>/api/feishu/events</Typography.Text>
                  <Typography.Text type="secondary">
                    健康判断：
                    {syncEventStatusQuery.data?.healthReasons.length ? syncEventStatusQuery.data.healthReasons.join('；') : '-'}
                  </Typography.Text>
                </Space>
              }
            />
            {syncEvents.length === 0 && !syncEventsQuery.isLoading ? (
              <Empty description="暂无飞书事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                rowKey="id"
                size="middle"
                columns={eventColumns}
                dataSource={syncEvents}
                loading={syncEventsQuery.isLoading}
                pagination={false}
                scroll={{ x: isCompact ? 660 : 860 }}
              />
            )}
          </Space>
        )}
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
            <Button
              icon={<SafetyCertificateOutlined />}
              disabled={!canRunSync}
              loading={runSyncPreflightMutation.isPending}
              onClick={runSyncPreflight}
              title={canRunSync ? undefined : syncRunPermissionTip}
            >
              运行预检
            </Button>
            <Button icon={<ReloadOutlined />} loading={syncRunsQuery.isFetching || syncStatusQuery.isFetching} onClick={refreshSyncRuntime}>
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
            <Descriptions.Item label="操作人">{formatOperator(selectedRun)}</Descriptions.Item>
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

      <Drawer
        title="飞书通讯录权限预检"
        size={560}
        open={Boolean(preflightResult)}
        destroyOnClose
        onClose={() => setPreflightResult(undefined)}
      >
        {preflightResult ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type={preflightResult.status === 'passed' ? 'success' : 'error'}
              showIcon
              title={preflightResult.status === 'passed' ? '预检通过' : '预检失败'}
              description={preflightResult.message ?? '预检已完成'}
            />
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="检查时间">{formatDateTime(preflightResult.checkedAt)}</Descriptions.Item>
              <Descriptions.Item label="请求批次数">{preflightResult.requestBatchCount}</Descriptions.Item>
              <Descriptions.Item label="Request ID">{preflightResult.requestId}</Descriptions.Item>
              <Descriptions.Item label="错误码">{preflightResult.errorCode ?? '-'}</Descriptions.Item>
            </Descriptions>
            <Table
              rowKey="name"
              size="small"
              pagination={false}
              dataSource={preflightResult.stages}
              columns={[
                { title: '检查项', dataIndex: 'name', render: (name: SyncPreflightStageName) => preflightStageLabels[name] },
                {
                  title: '结果',
                  dataIndex: 'status',
                  width: 110,
                  render: (status) =>
                    status === 'passed' ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">
                        通过
                      </Tag>
                    ) : (
                      <Tag color="error">失败</Tag>
                    ),
                },
                { title: '说明', dataIndex: 'message', render: (value?: string) => value ?? '-' },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
