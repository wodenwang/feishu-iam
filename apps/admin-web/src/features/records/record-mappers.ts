import type { AdminAuditLog, AdminSecurityEvent } from '../../api/admin';
import type { FeishuSyncRun } from '../../api/feishu';

export type RecordRow =
  | {
      kind: 'audit';
      id: string;
      createdAt: string;
      actor: string;
      action: string;
      target: string;
      requestId?: string | null;
      result: string;
      raw: AdminAuditLog;
    }
  | {
      kind: 'security';
      id: string;
      createdAt: string;
      actor: string;
      action: string;
      target: string;
      requestId?: string | null;
      result: string;
      raw: AdminSecurityEvent;
    }
  | {
      kind: 'sync';
      id: string;
      createdAt: string;
      actor: string;
      action: string;
      target: string;
      requestId?: string | null;
      result: string;
      raw: FeishuSyncRun;
    };

export function mapAuditLog(item: AdminAuditLog): RecordRow {
  return {
    kind: 'audit',
    id: item.id,
    createdAt: item.createdAt,
    actor: `${item.actorType}:${item.actorId}`,
    action: item.action,
    target: `${item.resourceType}:${item.resourceId}`,
    requestId: item.requestId,
    result: item.result,
    raw: item
  };
}

export function mapSecurityEvent(item: AdminSecurityEvent): RecordRow {
  return {
    kind: 'security',
    id: item.id,
    createdAt: item.createdAt,
    actor: formatFeishuUserId(item.feishuUserId),
    action: item.eventType,
    target: item.clientId ? `client:${item.clientId}` : (item.applicationId ?? '-'),
    requestId: item.requestId,
    result: item.result,
    raw: item
  };
}

export function mapSyncRun(item: FeishuSyncRun): RecordRow {
  return {
    kind: 'sync',
    id: item.id,
    createdAt: item.startedAt,
    actor: item.triggerSource,
    action: 'feishu.sync',
    target: item.id,
    requestId: item.requestId,
    result: item.status,
    raw: item
  };
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

export function formatRunStatus(status: FeishuSyncRun['status']): string {
  const labels: Record<FeishuSyncRun['status'], string> = {
    running: '运行中',
    success: '成功',
    failed: '失败'
  };
  return labels[status];
}

export function formatRunChange(created: number, updated: number, deleted: number): string {
  return `+${String(created)} / ~${String(updated)} / -${String(deleted)}`;
}

export function formatRecordValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(redactSensitiveValue(value), null, 2);
}

export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? '[已隐藏]' : redactSensitiveValue(item)
    ])
  );
}

function isSensitiveKey(key: string): boolean {
  return /(secret|token|password|cookie|authorization)/i.test(key);
}

function formatFeishuUserId(value: string | null | undefined): string {
  return value ? `飞书 user_id: ${value}` : '-';
}
