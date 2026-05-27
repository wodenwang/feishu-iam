import { DownloadOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { AppTable } from '../../components/AppTable';
import { SearchForm } from '../../components/SearchForm';
import { isIamHttpError } from '../../features/iam/httpClient';
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
  'application.diagnostics.copy': '复制诊断包',
  'application.admin.add': '新增应用管理员',
  'application.admin.bind': '绑定应用管理员',
  'application.admin.remove': '移除应用管理员',
  'oauth.redirect_uri.create': '新增 redirect URI',
  'oauth.redirect_uri.disable': '停用 redirect URI',
  'oauth.redirect_uri.enable': '恢复 redirect URI',
  'secret.copy': '复制密钥',
  'secret.rotate': '轮换密钥',
  'role.create': '创建角色',
  'role.update': '管理员操作',
  'role.authorization.update': '更新角色授权',
  'permission.query': '权限查询',
  'sync.run': '同步任务',
  'sync.preflight': '同步预检',
};

const resultLabels: Record<AuditResult, { text: string; color: string }> = {
  success: { text: '成功', color: 'success' },
  failed: { text: '失败', color: 'error' },
};

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

export function AuditLogsPage() {
  const [form] = Form.useForm<AuditSearchValues>();
  const screens = Grid.useBreakpoint();
  const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');
  const isCompact = !isJsdom && (typeof window === 'undefined' ? !screens.lg : window.innerWidth < 1360);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [selectedLog, setSelectedLog] = useState<AuditLog | undefined>();
  const auditLogsQuery = useAuditLogs({ ...filters, page: pagination.page, pageSize: pagination.pageSize });
  const applicationsQuery = useApplications({ page: 1, pageSize: 50 });
  const auditError = auditLogsQuery.error;
  const auditRequestId = isIamHttpError(auditError) ? auditError.requestId : undefined;
  const auditErrorMessage = isIamHttpError(auditError)
    ? auditError.message
    : '请稍后重试，若仍失败可交由管理员排查审计服务。';
  const applicationNameById = useMemo(
    () => new Map((applicationsQuery.data?.items ?? []).map((application) => [application.id, application.name])),
    [applicationsQuery.data?.items],
  );

  const columns = useMemo<ColumnsType<AuditLog>>(() => {
    const timeColumn: ColumnsType<AuditLog>[number] = {
      title: '时间',
      dataIndex: 'createdAt',
      render: formatDateTime,
      width: 190,
    };
    const actionColumn: ColumnsType<AuditLog>[number] = {
      title: '动作类型',
      dataIndex: 'action',
      width: 150,
      render: (action: AuditAction) => <Tag color="blue">{actionLabels[action]}</Tag>,
    };
    const resultColumn: ColumnsType<AuditLog>[number] = {
      title: '结果',
      dataIndex: 'result',
      width: 90,
      render: (result: AuditResult) => <Tag color={resultLabels[result].color}>{resultLabels[result].text}</Tag>,
    };
    const actionButtonColumn: ColumnsType<AuditLog>[number] = {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_, log) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedLog(log)}>
          详情
        </Button>
      ),
    };

    if (isCompact) {
      return [
        timeColumn,
        actionColumn,
        resultColumn,
        actionButtonColumn,
      ];
    }

    return [
      timeColumn,
      actionColumn,
      resultColumn,
      { title: '操作者', dataIndex: 'actorFeishuUserId', width: 170, ellipsis: true },
      {
        title: '应用',
        dataIndex: 'applicationId',
        width: 150,
        render: (applicationId?: string) => (applicationId ? (applicationNameById.get(applicationId) ?? applicationId) : '-'),
      },
      {
        title: '说明',
        dataIndex: 'message',
        width: 260,
        ellipsis: true,
      },
      {
        title: 'Request ID',
        dataIndex: 'requestId',
        width: 180,
        ellipsis: true,
        render: (requestId: string) => <Typography.Text code>{requestId}</Typography.Text>,
      },
      actionButtonColumn,
    ];
  }, [applicationNameById, isCompact]);

  const submitSearch = (values: AuditSearchValues) => {
    setPagination((current) => ({ ...current, page: 1 }));
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
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        审计日志
      </Typography.Title>

      <SearchForm form={form} onFinish={submitSearch}>
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
                setPagination((current) => ({ ...current, page: 1 }));
                setFilters({});
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </SearchForm>

      <AppTable<AuditLog>
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
          </Space>
        }
        isError={auditLogsQuery.isError}
        error={
          <Alert
            type="error"
            showIcon
            title="加载审计日志失败"
            description={
              <Space orientation="vertical" size={4}>
                <Typography.Text>{auditErrorMessage}</Typography.Text>
                {auditRequestId ? <Typography.Text code copyable>{auditRequestId}</Typography.Text> : null}
              </Space>
            }
            action={<Button onClick={() => auditLogsQuery.refetch()}>重试</Button>}
          />
        }
        isEmpty={!auditLogsQuery.isLoading && (auditLogsQuery.data?.items ?? []).length === 0}
        empty={<Empty description="没有匹配的审计日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        tableProps={{
          rowKey: 'id',
          size: 'middle',
          columns,
          dataSource: auditLogsQuery.data?.items ?? [],
          loading: auditLogsQuery.isLoading,
          pagination: {
            total: auditLogsQuery.data?.total ?? 0,
            pageSize: pagination.pageSize,
            current: pagination.page,
            showSizeChanger: false,
            onChange: (page, pageSize) => setPagination({ page, pageSize }),
          },
          scroll: { x: isCompact ? 540 : 1380 },
        }}
      />

      <Drawer
        title="审计日志详情"
        size={620}
        open={Boolean(selectedLog)}
        destroyOnClose
        onClose={() => setSelectedLog(undefined)}
      >
        {selectedLog ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="requestId">{selectedLog.requestId}</Descriptions.Item>
            <Descriptions.Item label="actorFeishuUserId">{selectedLog.actorFeishuUserId}</Descriptions.Item>
            <Descriptions.Item label="应用">
              {selectedLog.applicationId ? (applicationNameById.get(selectedLog.applicationId) ?? selectedLog.applicationId) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="action">{actionLabels[selectedLog.action]}</Descriptions.Item>
            <Descriptions.Item label="message">{selectedLog.message}</Descriptions.Item>
            <Descriptions.Item label="createdAt">{formatDateTime(selectedLog.createdAt)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}
