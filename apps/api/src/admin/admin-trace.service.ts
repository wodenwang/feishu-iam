import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminDomainError, type AdminContext } from './admin.types';

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TIMELINE_ITEMS = 100;
const REDACTED = '[REDACTED]';
const NO_VISIBLE_APPLICATION = null;
const FEISHU_SYNC_AUDIT_RESOURCE_TYPES = [
  'feishu_sync',
  'feishu_sync_run',
  'feishu_department',
  'feishu_user',
  'feishu_user_department'
] as const;
const SENSITIVE_KEY_PARTS = [
  'secret',
  'token',
  'cookie',
  'authorization',
  'authorizationcode',
  'clientsecret',
  'developerapitoken',
  'accesstoken',
  'refreshtoken',
  'tokenhash',
  'statehash',
  'codehash',
  'rawpayload',
  'password',
  'apikey',
  'privatekey',
  'credential'
] as const;

export type AdminTraceQueryInput = {
  requestId?: string;
  applicationId?: string;
  appKey?: string;
  clientId?: string;
  feishuUserId?: string;
  from?: string;
  to?: string;
  result?: string;
};

export type AdminTraceStage =
  | 'admin_auth'
  | 'admin_change'
  | 'oauth_authorize'
  | 'oauth_login'
  | 'token_exchange'
  | 'userinfo'
  | 'permission_query'
  | 'feishu_sync'
  | 'oauth_token_context';

export type AdminTraceTimelineItem = {
  id: string;
  source: 'audit_log' | 'security_event' | 'feishu_sync_run' | 'oauth_token_context';
  stage: AdminTraceStage;
  result: string;
  occurredAt: string;
  title: string;
  summary: string;
  requestId?: string | null;
  applicationId?: string | null;
  clientId?: string | null;
  feishuUserId?: string | null;
  details: unknown;
};

export type AdminTraceResult = {
  summary: {
    status: 'complete' | 'partial' | 'empty' | 'forbidden';
    diagnosis: string;
    matchedEventCount: number;
    missingStages: string[];
    nextActions: string[];
  };
  context: {
    requestId?: string;
    application?: { id: string; appKey: string; name: string } | null;
    applicationId?: string;
    appKey?: string;
    clientId?: string;
    feishuUserId?: string;
    timeWindow: { from: string; to: string };
  };
  timeline: AdminTraceTimelineItem[];
  coverage: {
    auditLogs: number;
    securityEvents: number;
    feishuSyncRuns: number;
    oauthContexts: number;
  };
};

type NormalizedTraceInput = Required<Pick<AdminTraceQueryInput, never>> & {
  requestId?: string;
  applicationId?: string;
  appKey?: string;
  clientId?: string;
  feishuUserId?: string;
  result?: string;
};
type VisibleApplication = { id: string; appKey: string; name: string };
type ApplicationFilterId = string | typeof NO_VISIBLE_APPLICATION | undefined;
type AuditLogTraceItem = Prisma.AuditLogGetPayload<Record<string, never>>;
type SecurityEventTraceItem = Prisma.SecurityEventGetPayload<Record<string, never>> & { details?: unknown };
type FeishuSyncRunTraceItem = Prisma.FeishuSyncRunGetPayload<Record<string, never>>;
type OauthTokenTraceItem = Pick<
  Prisma.OauthAccessTokenGetPayload<Record<string, never>>,
  'id' | 'applicationId' | 'clientId' | 'feishuUserId' | 'scope' | 'expiresAt' | 'revokedAt' | 'lastUsedAt' | 'createdAt'
>;

@Injectable()
export class AdminTraceService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrace(context: AdminContext, input: AdminTraceQueryInput): Promise<AdminTraceResult> {
    if (!canViewTrace(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看追踪数据', 403);
    }

    const normalized = normalizeInput(input);
    const window = normalizeWindow(input);
    const application = await this.findVisibleApplication(context, normalized.applicationId, normalized.appKey);
    const applicationFilterId = resolveApplicationFilterId(normalized, application);

    const [auditLogs, securityEvents, syncRuns, oauthContexts] = await Promise.all([
      this.findAuditLogs(context, normalized, window, applicationFilterId),
      this.findSecurityEvents(context, normalized, window, applicationFilterId),
      this.findSyncRuns(context, normalized, window, applicationFilterId),
      this.findOauthContexts(context, normalized, window, applicationFilterId)
    ]);
    const timeline = [
      ...auditLogs.map(toAuditTimelineItem),
      ...securityEvents.map(toSecurityTimelineItem),
      ...syncRuns.map(toSyncTimelineItem),
      ...oauthContexts.map(toOauthContextTimelineItem)
    ]
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
      .slice(0, MAX_TIMELINE_ITEMS);

    return buildTraceResult(normalized, window, application, timeline, {
      auditLogs: auditLogs.length,
      securityEvents: securityEvents.length,
      feishuSyncRuns: syncRuns.length,
      oauthContexts: oauthContexts.length
    });
  }

  private async findVisibleApplication(
    context: AdminContext,
    applicationId: string | undefined,
    appKey: string | undefined
  ): Promise<VisibleApplication | null> {
    if (!applicationId && !appKey) {
      return null;
    }
    const application = await this.prisma.application.findFirst({
      where: appKey ? { appKey } : { id: applicationId },
      select: { id: true, appKey: true, name: true }
    });
    if (!application) {
      return null;
    }
    if (canViewGlobal(context) || context.applicationIds.includes(application.id)) {
      return application;
    }
    return null;
  }

  private applicationWhere(
    context: AdminContext,
    requestedApplicationId: ApplicationFilterId
  ): { applicationId?: string | { in: string[] } } {
    if (requestedApplicationId === NO_VISIBLE_APPLICATION) {
      return { applicationId: { in: [] } };
    }
    if (canViewGlobal(context)) {
      return requestedApplicationId ? { applicationId: requestedApplicationId } : {};
    }
    if (context.roles.includes('application_admin')) {
      const allowed = requestedApplicationId
        ? context.applicationIds.filter((id) => id === requestedApplicationId)
        : context.applicationIds;
      return { applicationId: { in: allowed } };
    }
    return { applicationId: { in: [] } };
  }

  private findAuditLogs(
    context: AdminContext,
    input: NormalizedTraceInput,
    window: { from: Date; to: Date },
    applicationId: ApplicationFilterId
  ): Promise<AuditLogTraceItem[]> {
    const where: Prisma.AuditLogWhereInput = {
      ...this.applicationWhere(context, applicationId),
      ...timeOrRequestFilter('createdAt', input.requestId, window),
      ...(input.result ? { result: input.result } : {})
    };
    if (context.roles.includes('sync_admin') && !canViewGlobal(context)) {
      where.resourceType = { in: [...FEISHU_SYNC_AUDIT_RESOURCE_TYPES] };
    }
    return this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_TIMELINE_ITEMS });
  }

  private findSecurityEvents(
    context: AdminContext,
    input: NormalizedTraceInput,
    window: { from: Date; to: Date },
    applicationId: ApplicationFilterId
  ): Promise<SecurityEventTraceItem[]> {
    const where: Prisma.SecurityEventWhereInput = {
      ...this.applicationWhere(context, applicationId),
      ...timeOrRequestFilter('createdAt', input.requestId, window),
      ...(input.clientId ? { clientId: input.clientId } : {}),
      ...(input.feishuUserId ? { feishuUserId: input.feishuUserId } : {}),
      ...(input.result ? { result: input.result } : {})
    };
    return this.prisma.securityEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_TIMELINE_ITEMS });
  }

  private findSyncRuns(
    context: AdminContext,
    input: NormalizedTraceInput,
    window: { from: Date; to: Date },
    applicationId: ApplicationFilterId
  ): Promise<FeishuSyncRunTraceItem[]> {
    if (!canViewGlobal(context) && !context.roles.includes('sync_admin')) {
      return Promise.resolve([]);
    }
    if (applicationId !== undefined) {
      return Promise.resolve([]);
    }
    return this.prisma.feishuSyncRun.findMany({
      where: {
        ...timeOrRequestFilter('startedAt', input.requestId, window),
        ...(input.result ? { status: input.result } : {})
      },
      orderBy: { startedAt: 'desc' },
      take: MAX_TIMELINE_ITEMS
    });
  }

  private findOauthContexts(
    context: AdminContext,
    input: NormalizedTraceInput,
    window: { from: Date; to: Date },
    applicationId: ApplicationFilterId
  ): Promise<OauthTokenTraceItem[]> {
    if (context.roles.includes('sync_admin') && !canViewGlobal(context)) {
      return Promise.resolve([]);
    }
    if (input.requestId || (input.result && input.result !== 'success')) {
      return Promise.resolve([]);
    }
    return this.prisma.oauthAccessToken.findMany({
      where: {
        ...this.applicationWhere(context, applicationId),
        ...(input.clientId ? { clientId: input.clientId } : {}),
        ...(input.feishuUserId ? { feishuUserId: input.feishuUserId } : {}),
        createdAt: { gte: window.from, lte: window.to }
      },
      select: {
        id: true,
        applicationId: true,
        clientId: true,
        feishuUserId: true,
        scope: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_TIMELINE_ITEMS
    });
  }
}

function canViewGlobal(context: AdminContext): boolean {
  return context.roles.includes('platform_admin') || context.roles.includes('audit_viewer');
}

function canViewTrace(context: AdminContext): boolean {
  return canViewGlobal(context) || context.roles.includes('application_admin') || context.roles.includes('sync_admin');
}

function normalizeInput(input: AdminTraceQueryInput): NormalizedTraceInput {
  return {
    requestId: normalizeString(input.requestId),
    applicationId: normalizeString(input.applicationId),
    appKey: normalizeString(input.appKey),
    clientId: normalizeString(input.clientId),
    feishuUserId: normalizeString(input.feishuUserId),
    result: normalizeString(input.result)
  };
}

function normalizeWindow(input: AdminTraceQueryInput): { from: Date; to: Date } {
  const parsedTo = input.to ? new Date(input.to) : new Date();
  const to = Number.isNaN(parsedTo.getTime()) ? new Date() : parsedTo;
  const parsedFrom = input.from ? new Date(input.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS);
  const requestedFrom = Number.isNaN(parsedFrom.getTime()) ? new Date(to.getTime() - DEFAULT_WINDOW_MS) : parsedFrom;
  if (normalizeString(input.requestId)) {
    return { from: requestedFrom, to };
  }
  const minFrom = new Date(to.getTime() - MAX_WINDOW_MS);
  const from = requestedFrom < minFrom ? minFrom : requestedFrom;
  return { from, to };
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveApplicationFilterId(
  input: NormalizedTraceInput,
  application: VisibleApplication | null
): ApplicationFilterId {
  if (application) {
    return application.id;
  }
  if (input.appKey) {
    return NO_VISIBLE_APPLICATION;
  }
  return input.applicationId;
}

function timeOrRequestFilter(
  field: 'createdAt' | 'startedAt',
  requestId: string | undefined,
  window: { from: Date; to: Date }
): { requestId: string } | { createdAt: { gte: Date; lte: Date } } | { startedAt: { gte: Date; lte: Date } } {
  if (requestId) {
    return { requestId };
  }
  return { [field]: { gte: window.from, lte: window.to } } as
    | { createdAt: { gte: Date; lte: Date } }
    | { startedAt: { gte: Date; lte: Date } };
}

function toAuditTimelineItem(item: AuditLogTraceItem): AdminTraceTimelineItem {
  return {
    id: item.id,
    source: 'audit_log',
    stage: 'admin_change',
    result: item.result,
    occurredAt: item.createdAt.toISOString(),
    title: `后台变更：${item.action}`,
    summary: `${item.resourceType} / ${item.resourceId}`,
    requestId: item.requestId,
    applicationId: item.applicationId,
    details: redactTraceDetails({
      before: item.before,
      after: item.after,
      actorType: item.actorType,
      actorId: item.actorId,
      source: item.source,
      ip: item.ip,
      userAgent: item.userAgent
    })
  };
}

function toSecurityTimelineItem(item: SecurityEventTraceItem): AdminTraceTimelineItem {
  return {
    id: item.id,
    source: 'security_event',
    stage: stageFromEventType(item.eventType),
    result: item.result,
    occurredAt: item.createdAt.toISOString(),
    title: eventTitle(item.eventType, item.result),
    summary: item.summary,
    requestId: item.requestId,
    applicationId: item.applicationId,
    clientId: item.clientId,
    feishuUserId: item.feishuUserId,
    details: redactTraceDetails({
      eventType: item.eventType,
      reasonCode: item.reasonCode,
      ip: item.ip,
      userAgent: item.userAgent,
      details: item.details
    })
  };
}

function toSyncTimelineItem(item: FeishuSyncRunTraceItem): AdminTraceTimelineItem {
  return {
    id: item.id,
    source: 'feishu_sync_run',
    stage: 'feishu_sync',
    result: item.status,
    occurredAt: item.startedAt.toISOString(),
    title: `飞书同步：${item.status}`,
    summary: item.errorCode ? `同步失败：${item.errorCode}` : '飞书同步运行记录',
    requestId: item.requestId,
    details: redactTraceDetails({
      triggerSource: item.triggerSource,
      triggeredBy: item.triggeredBy,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      errorDetail: item.errorDetail
    })
  };
}

function toOauthContextTimelineItem(item: OauthTokenTraceItem): AdminTraceTimelineItem {
  return {
    id: item.id,
    source: 'oauth_token_context',
    stage: 'oauth_token_context',
    result: item.revokedAt ? 'revoked' : 'success',
    occurredAt: item.createdAt.toISOString(),
    title: item.revokedAt ? 'OAuth token 上下文：已撤销' : 'OAuth token 上下文：已签发',
    summary: `scope: ${item.scope}`,
    applicationId: item.applicationId,
    clientId: item.clientId,
    feishuUserId: item.feishuUserId,
    details: redactTraceDetails({
      scope: item.scope,
      expiresAt: item.expiresAt,
      revokedAt: item.revokedAt,
      lastUsedAt: item.lastUsedAt
    })
  };
}

function stageFromEventType(eventType: string): AdminTraceStage {
  if (eventType === 'admin_auth_failure') {
    return 'admin_auth';
  }
  if (eventType.includes('authorize')) {
    return 'oauth_authorize';
  }
  if (eventType.includes('login')) {
    return 'oauth_login';
  }
  if (eventType.includes('token_exchange')) {
    return 'token_exchange';
  }
  if (eventType.includes('userinfo')) {
    return 'userinfo';
  }
  if (eventType.includes('permission')) {
    return 'permission_query';
  }
  return 'oauth_token_context';
}

function eventTitle(eventType: string, result: string): string {
  if (eventType === 'admin_auth_failure') {
    return '后台认证/授权失败';
  }
  return `安全事件：${eventType} / ${result}`;
}

function buildTraceResult(
  input: NormalizedTraceInput,
  window: { from: Date; to: Date },
  application: VisibleApplication | null,
  timeline: AdminTraceTimelineItem[],
  coverage: AdminTraceResult['coverage']
): AdminTraceResult {
  const failed = timeline.find((item) => item.result === 'failed');
  const adminAuthFailure = timeline.find((item) => item.stage === 'admin_auth' && item.result === 'failed');
  const missingStages = buildMissingStages(timeline);
  const status = timeline.length === 0 ? 'empty' : adminAuthFailure ? 'complete' : missingStages.length > 0 ? 'partial' : 'complete';
  return {
    summary: {
      status,
      diagnosis: adminAuthFailure ? buildAdminAuthFailureDiagnosis(adminAuthFailure) : buildDiagnosis(status, failed),
      matchedEventCount: timeline.length,
      missingStages: adminAuthFailure ? [] : missingStages,
      nextActions: adminAuthFailure ? nextActionsForAdminAuthFailure(adminAuthFailure) : nextActionsFor(status, failed)
    },
    context: {
      requestId: input.requestId,
      application,
      applicationId: input.applicationId,
      appKey: input.appKey,
      clientId: input.clientId,
      feishuUserId: input.feishuUserId,
      timeWindow: { from: window.from.toISOString(), to: window.to.toISOString() }
    },
    timeline,
    coverage
  };
}

function buildMissingStages(timeline: AdminTraceTimelineItem[]): string[] {
  const stages = new Set(timeline.map((item) => item.stage));
  if (stages.has('admin_auth')) {
    return [];
  }
  if (stages.has('feishu_sync')) {
    return [];
  }
  const observedOauthStages = ['oauth_authorize', 'oauth_login', 'token_exchange', 'userinfo', 'permission_query'].filter((stage) =>
    stages.has(stage as AdminTraceStage)
  );
  if (observedOauthStages.length === 0) {
    return [];
  }
  return ['token_exchange', 'userinfo', 'permission_query'].filter((stage) => !stages.has(stage as AdminTraceStage));
}

function buildDiagnosis(status: AdminTraceResult['summary']['status'], failed: AdminTraceTimelineItem | undefined): string {
  if (failed) {
    return `发现失败阶段：${failed.title}`;
  }
  if (status === 'empty') {
    return '当前条件下没有可见追踪记录';
  }
  if (status === 'partial') {
    return '已找到部分可见追踪记录，仍缺少关键阶段';
  }
  return '已找到可见追踪记录';
}

function buildAdminAuthFailureDiagnosis(item: AdminTraceTimelineItem): string {
  const reasonCode = readReasonCode(item);
  const reasonText = reasonCode ? `reasonCode=${reasonCode}` : 'reasonCode 为空';
  return `已定位到后台认证/授权失败事件，请查看 ${reasonText} 判断是登录态缺失、登录态无效、会话过期、管理员不可用还是权限不足。`;
}

function nextActionsForAdminAuthFailure(item: AdminTraceTimelineItem): string[] {
  const reasonCode = readReasonCode(item);
  if (reasonCode === 'ADMIN_SESSION_REQUIRED') {
    return ['让用户重新登录 Feishu IAM 管理后台', '确认请求是否携带后台登录 cookie'];
  }
  if (reasonCode === 'ADMIN_SESSION_INVALID' || reasonCode === 'ADMIN_SESSION_EXPIRED') {
    return ['让用户重新登录 Feishu IAM 管理后台', '确认浏览器是否仍使用旧会话'];
  }
  if (reasonCode === 'ADMIN_USER_UNAVAILABLE') {
    return ['检查管理员账号和关联飞书用户状态', '确认飞书用户未禁用、离职或未激活'];
  }
  if (reasonCode === 'ADMIN_PERMISSION_DENIED') {
    return ['检查管理员角色和应用授权范围', '确认该账号具备访问当前后台资源的权限'];
  }
  return ['查看失败事件详情和 reasonCode', '按同一 request id 检查后台访问路径'];
}

function readReasonCode(item: AdminTraceTimelineItem): string | null {
  const details = item.details;
  if (!details || typeof details !== 'object' || !('reasonCode' in details)) {
    return null;
  }
  const value = (details as { reasonCode?: unknown }).reasonCode;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nextActionsFor(status: AdminTraceResult['summary']['status'], failed: AdminTraceTimelineItem | undefined): string[] {
  if (failed) {
    return ['查看失败事件详情和 reasonCode', '按同一 request id 检查调用方日志'];
  }
  if (status === 'empty') {
    return ['确认 request id、应用、client、用户和时间范围是否正确', '扩大时间范围后重试'];
  }
  if (status === 'partial') {
    return ['补充同一 request id 的调用方日志', '检查 OAuth token、userinfo 和权限查询事件是否已接入'];
  }
  return ['根据时间线核对调用顺序和业务上下文'];
}

function redactTraceDetails(value: unknown): unknown {
  return redactValue(value, new WeakSet());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    return value.map((item) => redactValue(item, seen));
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item], index) => {
      if (isSensitiveKey(key)) {
        return [`redactedField${String(index + 1)}`, REDACTED];
      }
      return [key, redactValue(item, seen)];
    })
  );
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part));
}
