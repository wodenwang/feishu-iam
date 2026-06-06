# Feishu IAM v0.16.0 生产追踪与接入排障 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v0.16.0`，收口 GitLab `#27/#28/#29/#30/#31`，让终端用户可复制问题信息，管理员可按 `request id`、应用、client、用户和时间窗口追踪生产接入问题。

**Architecture:** 后端新增只读追踪聚合接口 `/api/v1/admin/traces`，以 `audit_logs`、`security_events`、`feishu_sync_runs` 为事实源，`oauth_login_states` 和 `oauth_access_tokens` 只作上下文补充；权限裁剪和脱敏全部在服务端完成。前端在 `系统管理 / 操作审计` 增加「追踪」Tab，复用 shadcn/ui + Tailwind 后台组件，并新增统一问题提示页承载未登录、会话过期、无权限和 OAuth 接入失败。

**Tech Stack:** NestJS、Prisma、PostgreSQL、React、Vite、shadcn/ui、Tailwind、lucide-react、Vitest、Playwright responsive checker、Docker Compose、GitLab、Browser。

---

## Inputs

- Discovery：`docs/superpowers/specs/2026-05-29-feishu-iam-v0.16.0-audit-traceability-discovery.md`
- Pencil 原型：`design/admin-console-v0.16.0.pen`
- 原型说明：`design/v0.16.0-audit-traceability-prototype.md`
- 原型复审：`docs/superpowers/reviews/2026-05-29-feishu-iam-v0.16.0-audit-traceability-prototype-review.md`
- 工程评审：`docs/superpowers/reviews/2026-05-29-feishu-iam-v0.16.0-audit-traceability-eng-review.md`
- 当前 GitLab opened issues：
  - `#27`：未登录提示页需要按 shadcn 风格重做为独立单页
  - `#28`：v0.16.0 追踪聚合接口：按 request id / 应用 / client / 用户生成诊断时间线
  - `#29`：v0.16.0 OAuth 事件补齐：token、userinfo、权限查询失败与关键成功点可追踪
  - `#30`：v0.16.0 操作审计追踪 Tab：诊断摘要、时间线、部分命中和权限不足状态
  - `#31`：v0.16.0 上下文跳转与接入排障文档：应用详情、同步 run、问题提示页闭环

## File Map

- Add: `migrations/V0_16_0__audit_traceability_indexes.sql`
  - 增加 `security_events` 和 `feishu_sync_runs` 的追踪查询索引。
- Modify: `apps/api/prisma/schema.prisma`
  - 补充 Prisma `@@index`，保持 schema 与迁移一致。
- Add: `apps/api/src/admin/admin-trace.service.ts`
  - 实现追踪聚合、权限裁剪、时间窗口、事件归一化、诊断摘要和服务端脱敏。
- Modify: `apps/api/src/admin/admin-audit.controller.ts`
  - 增加 `GET /api/v1/admin/traces`，解析 snake_case / camelCase 查询参数。
- Modify: `apps/api/src/admin/admin.module.ts`
  - 注册 `AdminTraceService`。
- Modify: `apps/api/src/oauth/oauth.service.ts`
  - 补齐 token exchange、userinfo 的最小安全事件元数据。
- Modify: `apps/api/src/oauth/oauth.controller.ts`
  - 把 `requestId` 传入 `getUserinfo()`，使业务失败事件能关联同一 request id。
- Modify: `apps/api/src/oauth/app-permissions.controller.ts`
  - 补齐权限查询成功 / 失败的 `oauth_permission_query` 事件。
- Modify: `apps/api/src/oauth/app-token.guard.ts`
  - 保持 token guard 失败事件，必要时统一事件类型和 request id 读取。
- Modify: `apps/api/src/oauth/oauth-error.filter.ts`
  - 把 OAuth authorize / 飞书回调失败 HTML 改为统一问题提示页样式，稳定展示并复制 request id。
- Add: `apps/api/test/admin-trace.service.spec.ts`
  - 覆盖聚合、权限裁剪、部分命中、无结果、脱敏和时间窗口。
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`
  - 覆盖 `/api/v1/admin/traces` 请求解析、401/403、角色边界。
- Modify: `apps/api/test/oauth.service.spec.ts`
  - 覆盖 token exchange / userinfo 事件补齐。
- Modify: `apps/api/test/oauth.controller.e2e-spec.ts`
  - 覆盖 userinfo request id 贯穿和稳定错误。
- Modify: `apps/api/test/app-permissions.e2e-spec.ts`
  - 覆盖权限查询事件补齐和不记录权限点全集。
- Modify: `apps/admin-web/src/routes/admin-url-state.ts`
  - 增加 `trace` Tab、`clientId`、`feishuUserId`、`from`、`to` 和 trace sheet URL 状态。
- Modify: `apps/admin-web/src/routes/admin-url-state.test.ts`
  - 覆盖 trace URL 解析、序列化和返回上下文。
- Modify: `apps/admin-web/src/api/admin.ts`
  - 增加 `AdminTraceResult` 类型和 `fetchAdminTrace()`。
- Add: `apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx`
  - 统一问题提示页组件，支持复制 request id 和一键复制问题信息。
- Add: `apps/admin-web/src/components/admin/ProblemFeedbackPage.test.tsx`
  - 覆盖未登录、会话过期、无权限、OAuth 接入失败、复制成功和复制失败 fallback。
- Modify: `apps/admin-web/src/App.tsx`
  - 用统一问题提示页替换未登录 / 会话过期 / 无权限状态。
- Modify: `apps/admin-web/src/App.test.tsx`
  - 覆盖 `#27` 未登录页和 390px 关键文案。
- Add: `apps/admin-web/src/features/records/TraceResultPanel.tsx`
  - 展示追踪初始态、诊断摘要、时间线、部分命中、无结果、权限不足和事件详情。
- Add: `apps/admin-web/src/features/records/trace-format.ts`
  - 归一化 trace 文案、阶段标签、下一步建议和复制文本。
- Add: `apps/admin-web/src/features/records/trace-format.test.ts`
  - 覆盖长 request id、长回调 URL、脱敏提示和复制模板。
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
  - 增加「追踪」Tab，调用 `TraceResultPanel`，保留原四个 Tab。
- Modify: `apps/admin-web/src/features/records/RecordQueryView.test.tsx`
  - 覆盖初始态、完整命中、部分命中、无结果、权限不足、长文本和详情。
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
  - 在开发信息 / client / 回调地址区域增加“查看接入追踪”入口和返回上下文。
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
  - 覆盖从应用详情跳转追踪并返回原 Tab。
- Modify: `apps/admin-web/src/features/settings/SystemSyncRunDetailSheet.tsx`
  - 增加同步 run 到追踪视角的入口，仅带 `requestId` 或 run id 可见上下文。
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`
  - 覆盖同步 run 详情跳转追踪入口。
- Add: `docs/oauth-troubleshooting.md`
  - 写入接入排障字段收集指南，并在 README 索引。
- Modify: `README.md`、`CHANGELOG.md`、`AGENTS.md`
  - 更新 v0.16.0 版本历史、当前阶段、issue 列表、文档索引和发布证据。
- Modify: `package.json`、`apps/api/package.json`、`apps/admin-web/package.json`
  - 版本号更新到 `0.16.0`。
- Modify: `apps/api/src/version/version.controller.ts`、`apps/api/test/version.controller.e2e-spec.ts`
  - 版本响应更新到 `0.16.0`。
- Modify: `deploy/docker-compose.yml`、`deploy/install.sh`、`deploy/server.env.example`
  - 默认镜像 tag 和 `APP_VERSION` 更新到 `v0.16.0`。
- Modify: `IMPLEMENTATION_PLAN.md`
  - 切换根目录执行入口到本计划。
- Add: `docs/codex-sessions/2026-05-29-1600-v0.16.0生产追踪实施.md`
  - 记录实现、验证、发布和部署证据。

## Task 1: 数据库索引和 Prisma schema

**Files:**
- Add: `migrations/V0_16_0__audit_traceability_indexes.sql`
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: 写迁移文件**

创建 `migrations/V0_16_0__audit_traceability_indexes.sql`：

```sql
CREATE INDEX IF NOT EXISTS security_events_request_id_idx
  ON security_events (request_id);

CREATE INDEX IF NOT EXISTS security_events_application_created_at_idx
  ON security_events (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_client_created_at_idx
  ON security_events (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_feishu_user_created_at_idx
  ON security_events (feishu_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS feishu_sync_runs_request_id_idx
  ON feishu_sync_runs (request_id);
```

- [ ] **Step 2: 更新 Prisma `SecurityEvent` 索引**

在 `apps/api/prisma/schema.prisma` 的 `model SecurityEvent` 中补充：

```prisma
  @@index([requestId])
  @@index([applicationId, createdAt(sort: Desc)])
  @@index([clientId, createdAt(sort: Desc)])
  @@index([feishuUserId, createdAt(sort: Desc)])
```

保留已有：

```prisma
  @@index([createdAt(sort: Desc)])
  @@index([eventType])
```

- [ ] **Step 3: 更新 Prisma `FeishuSyncRun` 索引**

在 `model FeishuSyncRun` 中补充：

```prisma
  @@index([requestId])
```

- [ ] **Step 4: 格式化并验证 Prisma schema**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:format
pnpm --filter @feishu-iam/api prisma:validate
```

Expected: 两条命令均成功，输出不包含 schema 错误。

- [ ] **Step 5: Commit**

```bash
git add migrations/V0_16_0__audit_traceability_indexes.sql apps/api/prisma/schema.prisma
git commit -m "feat: add trace query indexes"
```

## Task 2: 后端追踪聚合服务

**Files:**
- Add: `apps/api/src/admin/admin-trace.service.ts`
- Modify: `apps/api/src/admin/admin-query.service.ts`
- Add: `apps/api/test/admin-trace.service.spec.ts`

- [ ] **Step 1: 写失败测试：request id 完整命中**

创建 `apps/api/test/admin-trace.service.spec.ts`，先写最小完整命中测试：

```ts
import { describe, expect, it, vi } from 'vitest';
import { AdminTraceService } from '../src/admin/admin-trace.service';
import type { AdminContext } from '../src/admin/admin.types';

function context(roles: AdminContext['roles'], applicationIds: string[] = []): AdminContext {
  return {
    adminUserId: 'admin-1',
    feishuUserId: 'ou_admin',
    displayName: '管理员',
    roles,
    applicationIds
  };
}

function makePrisma() {
  return {
    application: { findFirst: vi.fn().mockResolvedValue({ id: 'app-finance', appKey: 'finance', name: '财务系统' }) },
    auditLog: { findMany: vi.fn().mockResolvedValue([{ id: 'audit-1', requestId: 'req-1', applicationId: 'app-finance', action: 'update', resourceType: 'application_client', resourceId: 'client-finance', result: 'success', createdAt: new Date('2026-05-29T01:00:00.000Z'), before: null, after: { clientSecret: 'hidden' }, actorType: 'admin_user', actorId: 'admin-1', source: 'admin_web', ip: '127.0.0.1', userAgent: 'vitest' }]) },
    securityEvent: { findMany: vi.fn().mockResolvedValue([{ id: 'sec-1', requestId: 'req-1', applicationId: 'app-finance', clientId: 'client-finance', feishuUserId: 'ou_user', eventType: 'oauth_token_exchange', result: 'success', reasonCode: null, summary: '授权码换取 access token 成功', createdAt: new Date('2026-05-29T01:01:00.000Z'), ip: '127.0.0.1', userAgent: 'vitest' }]) },
    feishuSyncRun: { findMany: vi.fn().mockResolvedValue([{ id: 'sync-1', requestId: 'req-1', status: 'success', triggerSource: 'admin_web', triggeredBy: 'admin-1', startedAt: new Date('2026-05-29T00:59:00.000Z'), finishedAt: new Date('2026-05-29T01:00:30.000Z'), errorCode: null, errorMessage: null, errorDetail: null }]) },
    oauthAccessToken: { findMany: vi.fn().mockResolvedValue([]) }
  };
}

describe('AdminTraceService', () => {
  it('按 request id 聚合审计、安全事件和同步 run，并按时间排序', async () => {
    const service = new AdminTraceService(makePrisma() as never);

    const result = await service.getTrace(context(['platform_admin']), { requestId: 'req-1' });

    expect(result.summary.status).toBe('complete');
    expect(result.context.requestId).toBe('req-1');
    expect(result.timeline.map((item) => item.source)).toEqual(['feishu_sync_run', 'audit_log', 'security_event']);
    expect(JSON.stringify(result)).not.toContain('hidden');
    expect(JSON.stringify(result)).toContain('[REDACTED]');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin-trace.service.spec.ts
```

Expected: FAIL，原因是 `AdminTraceService` 文件不存在。

- [ ] **Step 3: 创建 trace 类型和输入归一化**

在 `apps/api/src/admin/admin-trace.service.ts` 写入：

```ts
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminDomainError, type AdminContext } from './admin.types';
import { redactSensitive } from './admin-query.service';

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TIMELINE_ITEMS = 100;

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
```

- [ ] **Step 4: 实现权限和时间窗口 helper**

继续在同文件中加入：

```ts
function canViewGlobal(context: AdminContext): boolean {
  return context.roles.includes('platform_admin') || context.roles.includes('audit_viewer');
}

function canViewTrace(context: AdminContext): boolean {
  return canViewGlobal(context) || context.roles.includes('application_admin') || context.roles.includes('sync_admin');
}

function normalizeWindow(input: AdminTraceQueryInput): { from: Date; to: Date } {
  const to = input.to ? new Date(input.to) : new Date();
  const requestedFrom = input.from ? new Date(input.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS);
  const validTo = Number.isNaN(to.getTime()) ? new Date() : to;
  const validFrom = Number.isNaN(requestedFrom.getTime()) ? new Date(validTo.getTime() - DEFAULT_WINDOW_MS) : requestedFrom;
  const minFrom = new Date(validTo.getTime() - MAX_WINDOW_MS);
  const from = validFrom < minFrom && !input.requestId ? minFrom : validFrom;
  return { from, to: validTo };
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
```

- [ ] **Step 5: 实现 `getTrace()` 主流程**

加入 service class：

```ts
@Injectable()
export class AdminTraceService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrace(context: AdminContext, input: AdminTraceQueryInput): Promise<AdminTraceResult> {
    if (!canViewTrace(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看追踪数据', 403);
    }

    const normalized = {
      requestId: normalizeString(input.requestId),
      applicationId: normalizeString(input.applicationId),
      appKey: normalizeString(input.appKey),
      clientId: normalizeString(input.clientId),
      feishuUserId: normalizeString(input.feishuUserId),
      result: normalizeString(input.result)
    };
    const window = normalizeWindow(input);
    const application = await this.findVisibleApplication(context, normalized.applicationId, normalized.appKey);

    const [auditLogs, securityEvents, syncRuns, oauthContexts] = await Promise.all([
      this.findAuditLogs(context, normalized, window, application?.id),
      this.findSecurityEvents(context, normalized, window, application?.id),
      this.findSyncRuns(context, normalized, window),
      this.findOauthContexts(context, normalized, window, application?.id)
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
```

- [ ] **Step 6: 实现 application_admin 和 sync_admin 裁剪**

在 `AdminTraceService` 内加入：

```ts
  private async findVisibleApplication(
    context: AdminContext,
    applicationId: string | undefined,
    appKey: string | undefined
  ): Promise<{ id: string; appKey: string; name: string } | null> {
    if (!applicationId && !appKey) {
      return null;
    }
    const where = appKey ? { appKey } : { id: applicationId };
    const application = await this.prisma.application.findFirst({
      where,
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
    requestedApplicationId: string | undefined
  ): { applicationId?: string | { in: string[] } } {
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
```

- [ ] **Step 7: 实现数据查询方法**

在 `AdminTraceService` 内加入：

```ts
  private findAuditLogs(
    context: AdminContext,
    input: { requestId?: string; clientId?: string; feishuUserId?: string; result?: string },
    window: { from: Date; to: Date },
    applicationId: string | undefined
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...this.applicationWhere(context, applicationId),
      ...(input.requestId ? { requestId: input.requestId } : { createdAt: { gte: window.from, lte: window.to } }),
      ...(input.result ? { result: input.result } : {})
    };
    if (context.roles.includes('sync_admin') && !canViewGlobal(context)) {
      where.resourceType = { in: ['feishu_sync', 'feishu_sync_run', 'feishu_department', 'feishu_user', 'feishu_user_department'] };
    }
    return this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_TIMELINE_ITEMS });
  }

  private findSecurityEvents(
    context: AdminContext,
    input: { requestId?: string; clientId?: string; feishuUserId?: string; result?: string },
    window: { from: Date; to: Date },
    applicationId: string | undefined
  ) {
    const where: Prisma.SecurityEventWhereInput = {
      ...this.applicationWhere(context, applicationId),
      ...(input.requestId ? { requestId: input.requestId } : { createdAt: { gte: window.from, lte: window.to } }),
      ...(input.clientId ? { clientId: input.clientId } : {}),
      ...(input.feishuUserId ? { feishuUserId: input.feishuUserId } : {}),
      ...(input.result ? { result: input.result } : {})
    };
    return this.prisma.securityEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_TIMELINE_ITEMS });
  }

  private findSyncRuns(
    context: AdminContext,
    input: { requestId?: string; result?: string },
    window: { from: Date; to: Date }
  ) {
    if (!canViewGlobal(context) && !context.roles.includes('sync_admin')) {
      return Promise.resolve([]);
    }
    return this.prisma.feishuSyncRun.findMany({
      where: {
        ...(input.requestId ? { requestId: input.requestId } : { startedAt: { gte: window.from, lte: window.to } }),
        ...(input.result ? { status: input.result } : {})
      },
      orderBy: { startedAt: 'desc' },
      take: MAX_TIMELINE_ITEMS
    });
  }

  private findOauthContexts(
    context: AdminContext,
    input: { clientId?: string; feishuUserId?: string; result?: string },
    window: { from: Date; to: Date },
    applicationId: string | undefined
  ) {
    if (context.roles.includes('sync_admin') && !canViewGlobal(context)) {
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
```

- [ ] **Step 8: 实现 timeline 映射和摘要**

在文件底部加入：

```ts
function toAuditTimelineItem(item: Prisma.AuditLogGetPayload<Record<string, never>>): AdminTraceTimelineItem {
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
    details: redactSensitive({ before: item.before, after: item.after, actorType: item.actorType, actorId: item.actorId, source: item.source, ip: item.ip, userAgent: item.userAgent })
  };
}

function toSecurityTimelineItem(item: Prisma.SecurityEventGetPayload<Record<string, never>>): AdminTraceTimelineItem {
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
    details: redactSensitive({ eventType: item.eventType, reasonCode: item.reasonCode, ip: item.ip, userAgent: item.userAgent })
  };
}

function stageFromEventType(eventType: string): AdminTraceStage {
  if (eventType.includes('authorize')) return 'oauth_authorize';
  if (eventType.includes('login')) return 'oauth_login';
  if (eventType.includes('token_exchange')) return 'token_exchange';
  if (eventType.includes('userinfo')) return 'userinfo';
  if (eventType.includes('permission')) return 'permission_query';
  return 'oauth_token_context';
}
```

补齐 `toSyncTimelineItem()`、`toOauthContextTimelineItem()`、`eventTitle()`、`buildTraceResult()`，规则如下：

```ts
function buildTraceResult(
  input: { requestId?: string; applicationId?: string; appKey?: string; clientId?: string; feishuUserId?: string },
  window: { from: Date; to: Date },
  application: { id: string; appKey: string; name: string } | null,
  timeline: AdminTraceTimelineItem[],
  coverage: AdminTraceResult['coverage']
): AdminTraceResult {
  const failed = timeline.find((item) => item.result === 'failed');
  const missingStages = buildMissingStages(timeline);
  const status = timeline.length === 0 ? 'empty' : missingStages.length > 0 ? 'partial' : 'complete';
  return {
    summary: {
      status,
      diagnosis: failed ? `发现失败阶段：${failed.title}` : status === 'empty' ? '当前条件下没有可见追踪记录' : '已找到可见追踪记录',
      matchedEventCount: timeline.length,
      missingStages,
      nextActions: nextActionsFor(status, failed)
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
```

- [ ] **Step 9: 增加权限、无结果和时间窗口测试**

在 `admin-trace.service.spec.ts` 追加：

```ts
it('application_admin 只能看到授权应用事件', async () => {
  const prisma = makePrisma();
  const service = new AdminTraceService(prisma as never);
  await service.getTrace(context(['application_admin'], ['app-finance']), { applicationId: 'app-hr' });
  expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ applicationId: { in: [] } })
  }));
});

it('sync_admin 不读取应用 OAuth security events', async () => {
  const prisma = makePrisma();
  const service = new AdminTraceService(prisma as never);
  await service.getTrace(context(['sync_admin']), { requestId: 'req-sync' });
  expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ applicationId: { in: [] } })
  }));
});
```

- [ ] **Step 10: 运行服务测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin-trace.service.spec.ts test/admin-query.service.spec.ts
```

Expected: PASS。

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/admin/admin-trace.service.ts apps/api/src/admin/admin-query.service.ts apps/api/test/admin-trace.service.spec.ts
git commit -m "feat: add admin trace aggregation service"
```

## Task 3: Admin trace API endpoint

**Files:**
- Modify: `apps/api/src/admin/admin-audit.controller.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 写 controller 失败测试**

在 `apps/api/test/admin.controller.e2e-spec.ts` 的 admin query mocks 中加入 `getTrace`，并增加：

```ts
it('GET /api/v1/admin/traces 解析追踪查询参数', async () => {
  adminQueries.getTrace.mockResolvedValue({
    summary: { status: 'complete', diagnosis: '已找到可见追踪记录', matchedEventCount: 1, missingStages: [], nextActions: [] },
    context: { requestId: 'req-1', timeWindow: { from: '2026-05-29T00:00:00.000Z', to: '2026-05-29T01:00:00.000Z' } },
    timeline: [],
    coverage: { auditLogs: 0, securityEvents: 1, feishuSyncRuns: 0, oauthContexts: 0 }
  });

  await request(app.getHttpServer())
    .get('/api/v1/admin/traces?request_id=req-1&app_key=finance&client_id=client-finance&feishu_user_id=ou_user&from=2026-05-29T00:00:00.000Z&to=2026-05-29T01:00:00.000Z&result=failed')
    .set('cookie', adminCookie)
    .expect(200);

  expect(adminQueries.getTrace).toHaveBeenCalledWith(
    expect.objectContaining({ roles: expect.any(Array) }),
    {
      requestId: 'req-1',
      appKey: 'finance',
      clientId: 'client-finance',
      feishuUserId: 'ou_user',
      from: '2026-05-29T00:00:00.000Z',
      to: '2026-05-29T01:00:00.000Z',
      result: 'failed'
    }
  );
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts
```

Expected: FAIL，原因是 `/api/v1/admin/traces` 路由不存在。

- [ ] **Step 3: 注入 `AdminTraceService`**

在 `apps/api/src/admin/admin-audit.controller.ts` 修改 constructor：

```ts
constructor(
  @Inject(AdminQueryService) private readonly queries: AdminQueryService,
  @Inject(AdminTraceService) private readonly traces: AdminTraceService
) {}
```

同时新增 import：

```ts
import { AdminTraceService, type AdminTraceQueryInput } from './admin-trace.service';
```

- [ ] **Step 4: 增加 endpoint**

在 `AdminAuditController` 内增加：

```ts
  @Get('/traces')
  async getTrace(@Req() request: Request, @Query() query: Record<string, unknown>): Promise<unknown> {
    return this.traces.getTrace(readRequiredAdminContext(request), {
      requestId: parseStringQueryAlias(query, 'request_id', 'requestId'),
      applicationId: parseStringQueryAlias(query, 'application_id', 'applicationId'),
      appKey: parseStringQueryAlias(query, 'app_key', 'appKey'),
      clientId: parseStringQueryAlias(query, 'client_id', 'clientId'),
      feishuUserId: parseStringQueryAlias(query, 'feishu_user_id', 'feishuUserId'),
      from: parseStringQuery(query.from),
      to: parseStringQuery(query.to),
      result: parseStringQuery(query.result)
    } satisfies AdminTraceQueryInput);
  }
```

- [ ] **Step 5: 注册 service**

在 `apps/api/src/admin/admin.module.ts` 添加 import 和 provider：

```ts
import { AdminTraceService } from './admin-trace.service';
```

```ts
providers: [AdminPermissionService, AdminUserService, AdminAuthService, AdminQueryService, AdminTraceService, AdminSessionGuard],
exports: [AdminPermissionService, AdminUserService, AdminAuthService, AdminQueryService, AdminTraceService, AdminSessionGuard]
```

- [ ] **Step 6: 运行 API 测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts test/admin-trace.service.spec.ts
```

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin/admin-audit.controller.ts apps/api/src/admin/admin.module.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: expose admin trace endpoint"
```

## Task 4: OAuth / userinfo / 权限查询事件补齐

**Files:**
- Modify: `apps/api/src/oauth/oauth.service.ts`
- Modify: `apps/api/src/oauth/oauth.controller.ts`
- Modify: `apps/api/src/oauth/app-permissions.controller.ts`
- Modify: `apps/api/src/oauth/app-token.guard.ts`
- Modify: `apps/api/test/oauth.service.spec.ts`
- Modify: `apps/api/test/oauth.controller.e2e-spec.ts`
- Modify: `apps/api/test/app-permissions.e2e-spec.ts`

- [ ] **Step 1: 写 token exchange 成功事件失败测试**

在 `apps/api/test/oauth.service.spec.ts` 的 `exchangeCode` 成功测试中补充：

```ts
expect(securityEvents.record).toHaveBeenCalledWith(
  expect.objectContaining({
    eventType: 'oauth_token_exchange',
    applicationId: 'app-finance',
    clientId: 'client-finance',
    feishuUserId: 'ou_user',
    result: 'success',
    requestId: 'req-oauth'
  })
);
```

- [ ] **Step 2: 补齐 token exchange success payload**

在 `apps/api/src/oauth/oauth.service.ts` 的 `exchangeCode()` transaction 返回值中加入上下文：

```ts
return {
  response: {
    access_token: accessToken,
    token_type: 'Bearer' as const,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope: authorizationCode.scope
  },
  eventContext: {
    applicationId: authorizationCode.applicationId,
    clientId: client.clientId,
    feishuUserId: authorizationCode.feishuUserId
  }
};
```

transaction 外改为：

```ts
await this.recordSecurityEventBestEffort({
  eventType: 'oauth_token_exchange',
  applicationId: result.eventContext.applicationId,
  clientId: result.eventContext.clientId,
  feishuUserId: result.eventContext.feishuUserId,
  result: 'success',
  summary: '授权码换取 access token 成功',
  ip: context.ip,
  userAgent: context.userAgent,
  requestId: context.requestId
});
return result.response;
```

- [ ] **Step 3: 写 userinfo 失败事件测试**

在 `oauth.service.spec.ts` 增加：

```ts
it('getUserinfo 业务失败时写 oauth_userinfo 安全事件', async () => {
  const prisma = makePrisma();
  const securityEvents = makeSecurityEvents();
  prisma.feishuUser.findUnique.mockResolvedValue({ userId: 'ou_user', isActive: false, isDeleted: false });

  await expect(
    makeService(prisma, makeFeishuClient(), securityEvents).getUserinfo(
      { applicationId: 'app-finance', appKey: 'finance', environmentId: null, clientId: 'client-finance', feishuUserId: 'ou_user', scope: 'openid profile permissions' },
      { requestId: 'req-userinfo', ip: '127.0.0.1', userAgent: 'vitest' }
    )
  ).rejects.toMatchObject({ code: 'OAUTH_TOKEN_USER_UNAVAILABLE' });

  expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({
    eventType: 'oauth_userinfo',
    applicationId: 'app-finance',
    clientId: 'client-finance',
    feishuUserId: 'ou_user',
    result: 'failed',
    reasonCode: 'OAUTH_TOKEN_USER_UNAVAILABLE',
    requestId: 'req-userinfo'
  }));
});
```

- [ ] **Step 4: 改造 `getUserinfo()` 签名并记录事件**

把 `OauthService.getUserinfo()` 改为：

```ts
async getUserinfo(context: AppTokenContext, audit: OauthAuditContext): Promise<UserinfoResponse> {
  try {
    const user = await this.prisma.feishuUser.findUnique({ where: { userId: context.feishuUserId } });
    if (!user || !user.isActive || user.isDeleted) {
      throw new OauthDomainError('OAUTH_TOKEN_USER_UNAVAILABLE', 'access token 关联用户不可用', 401);
    }
    await this.recordSecurityEventBestEffort({
      eventType: 'oauth_userinfo',
      applicationId: context.applicationId,
      clientId: context.clientId,
      feishuUserId: context.feishuUserId,
      result: 'success',
      summary: 'userinfo 查询成功',
      ip: audit.ip,
      userAgent: audit.userAgent,
      requestId: audit.requestId
    });
    return serializeUserinfo(user);
  } catch (error) {
    await this.recordSecurityEventBestEffort({
      eventType: 'oauth_userinfo',
      applicationId: context.applicationId,
      clientId: context.clientId,
      feishuUserId: context.feishuUserId,
      result: 'failed',
      reasonCode: toOauthFailureReasonCode(error),
      summary: `userinfo 查询失败：${toOauthFailureReasonCode(error)}`,
      ip: audit.ip,
      userAgent: audit.userAgent,
      requestId: audit.requestId
    });
    throw error;
  }
}
```

如果当前方法内直接构造 response，把 response 构造抽成 `serializeUserinfo(user)`，避免 try/catch 中重复写返回字段。

- [ ] **Step 5: 修改 controller 传入 request id**

在 `apps/api/src/oauth/oauth.controller.ts`：

```ts
  @Get('userinfo')
  @UseGuards(AppTokenGuard)
  async userinfo(@Req() request: Request): Promise<UserinfoResponse> {
    return this.oauth.getUserinfo(readAppTokenContext(request), buildContext(request));
  }
```

- [ ] **Step 6: 写权限查询事件测试**

在 `apps/api/test/app-permissions.e2e-spec.ts` 的成功测试中补充：

```ts
expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({
  eventType: 'oauth_permission_query',
  applicationId: 'app-finance',
  clientId: 'client-finance',
  feishuUserId: 'ou_user',
  result: 'success',
  reasonCode: null,
  requestId: expect.any(String)
}));
expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('finance.invoice.read');
```

在权限计算失败测试中补充：

```ts
expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({
  eventType: 'oauth_permission_query',
  result: 'failed',
  reasonCode: 'PERMISSION_CALCULATION_FAILED',
  requestId: 'req-permission-error'
}));
```

- [ ] **Step 7: 在权限查询 controller 记录事件**

在 `apps/api/src/oauth/app-permissions.controller.ts` 的 `getPermissions()` 中包裹计算：

```ts
try {
  const result = await this.permissions.calculate(appKey, token.feishuUserId);
  await this.securityEvents.record({
    eventType: 'oauth_permission_query',
    applicationId: token.applicationId,
    clientId: token.clientId,
    feishuUserId: token.feishuUserId,
    result: 'success',
    reasonCode: null,
    summary: `权限查询成功：权限组 ${result.permissionGroups.length} 个，权限点 ${result.permissionPoints.length} 个`,
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null,
    requestId: getOauthRequestId(request)
  });
  return serializePermissions(result);
} catch (error) {
  await this.securityEvents.record({
    eventType: 'oauth_permission_query',
    applicationId: token.applicationId,
    clientId: token.clientId,
    feishuUserId: token.feishuUserId,
    result: 'failed',
    reasonCode: error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'PERMISSION_CALCULATION_FAILED',
    summary: '权限查询失败',
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null,
    requestId: getOauthRequestId(request)
  });
  throw error;
}
```

如果 `securityEvents.record()` 失败，沿用现有 best-effort 模式：记录日志，不阻断原权限查询结果。

- [ ] **Step 8: 收紧 token guard 失败事件**

在 `apps/api/src/oauth/app-token.guard.ts` 确认 access token 缺失、无效、过期、停用和 app key mismatch 分支都使用同一个 request id 读取函数：

```ts
requestId: getOauthRequestId(request)
```

失败事件只允许记录 `applicationId`、`clientId`、`feishuUserId`、`reasonCode`、`ip`、`userAgent` 和 `requestId`，不能记录原始 `Authorization` header、access token、token hash 或权限点全集。

- [ ] **Step 9: 运行 OAuth 和权限查询测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/oauth.service.spec.ts test/oauth.controller.e2e-spec.ts test/app-permissions.e2e-spec.ts
```

Expected: PASS，且测试断言不包含 access token、authorization header、client secret、授权码、token hash 或 state hash。

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/oauth/oauth.service.ts apps/api/src/oauth/oauth.controller.ts apps/api/src/oauth/app-permissions.controller.ts apps/api/src/oauth/app-token.guard.ts apps/api/test/oauth.service.spec.ts apps/api/test/oauth.controller.e2e-spec.ts apps/api/test/app-permissions.e2e-spec.ts
git commit -m "feat: record oauth trace events"
```

## Task 5: 前端 API 类型和 URL 状态

**Files:**
- Modify: `apps/admin-web/src/api/admin.ts`
- Modify: `apps/admin-web/src/routes/admin-url-state.ts`
- Modify: `apps/admin-web/src/routes/admin-url-state.test.ts`

- [ ] **Step 1: 写 URL 状态失败测试**

在 `apps/admin-web/src/routes/admin-url-state.test.ts` 增加：

```ts
it('解析和序列化 trace 查询状态', () => {
  const state = parseRecordSearch(new URLSearchParams('tab=trace&requestId=req-1&clientId=client-finance&feishuUserId=ou_user&from=2026-05-29T00:00:00.000Z&to=2026-05-29T01:00:00.000Z&sheet=trace:sec-1'));

  expect(state).toMatchObject({
    tab: 'trace',
    requestId: 'req-1',
    clientId: 'client-finance',
    feishuUserId: 'ou_user',
    from: '2026-05-29T00:00:00.000Z',
    to: '2026-05-29T01:00:00.000Z',
    sheet: 'trace:sec-1'
  });

  expect(serializeRecordSearch(state).toString()).toContain('tab=trace');
  expect(serializeRecordSearch(state).toString()).toContain('clientId=client-finance');
});
```

- [ ] **Step 2: 扩展 URL 类型**

在 `admin-url-state.ts`：

```ts
export type RecordTab = 'trace' | 'audit' | 'security' | 'sync' | 'tokens';
export type RecordSheet = `trace:${string}` | `audit:${string}` | `security:${string}` | `sync:${string}` | `token:${string}`;
```

扩展 `RecordSearchState`：

```ts
clientId?: string;
feishuUserId?: string;
from?: string;
to?: string;
```

并把 `recordTabs` 调整为：

```ts
const defaultRecordTab: RecordTab = 'trace';
const recordTabs: RecordTab[] = ['trace', 'audit', 'security', 'sync', 'tokens'];
const recordSheetPrefixes = ['trace', 'audit', 'security', 'sync', 'token'] as const;
```

- [ ] **Step 3: 扩展 parse / serialize 字段**

在 `parseRecordSearch()` 增加：

```ts
clientId: clean(params.get('clientId')),
feishuUserId: clean(params.get('feishuUserId')),
from: clean(params.get('from')),
to: clean(params.get('to')),
```

在 `serializeRecordSearch()` 增加：

```ts
const clientId = clean(state.clientId);
const feishuUserId = clean(state.feishuUserId);
const from = clean(state.from);
const to = clean(state.to);
setCleanParam(params, 'clientId', clientId);
setCleanParam(params, 'feishuUserId', feishuUserId);
setCleanParam(params, 'from', from);
setCleanParam(params, 'to', to);
```

- [ ] **Step 4: 增加 trace API 类型**

在 `apps/admin-web/src/api/admin.ts` 增加：

```ts
export type AdminTraceTimelineItem = {
  id: string;
  source: 'audit_log' | 'security_event' | 'feishu_sync_run' | 'oauth_token_context';
  stage: string;
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

export type AdminTraceQuery = {
  requestId?: string;
  applicationId?: string;
  appKey?: string;
  clientId?: string;
  feishuUserId?: string;
  from?: string;
  to?: string;
  result?: string;
};

export async function fetchAdminTrace(query?: AdminTraceQuery): Promise<AdminTraceResult> {
  return readJson<AdminTraceResult>(`/api/v1/admin/traces${buildQuery(query)}`);
}
```

- [ ] **Step 5: 运行前端 URL/API 测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/api/admin.ts apps/admin-web/src/routes/admin-url-state.ts apps/admin-web/src/routes/admin-url-state.test.ts
git commit -m "feat: add trace api client state"
```

## Task 6: 统一问题提示页

**Files:**
- Add: `apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx`
- Add: `apps/admin-web/src/components/admin/ProblemFeedbackPage.test.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`
- Modify: `apps/api/src/oauth/oauth-error.filter.ts`
- Modify: `apps/api/test/oauth.controller.e2e-spec.ts`

- [ ] **Step 1: 写组件测试**

创建 `ProblemFeedbackPage.test.tsx`：

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProblemFeedbackPage } from './ProblemFeedbackPage';

describe('ProblemFeedbackPage', () => {
  it('展示未登录问题并复制 request id 和问题信息', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <ProblemFeedbackPage
        variant="admin-login-required"
        title="需要登录 Feishu IAM 管理后台"
        description="当前浏览器没有有效管理员会话。"
        primaryAction={{ label: '飞书登录', href: '/admin/auth/login' }}
        errorCode="ADMIN_SESSION_REQUIRED"
        requestId="req-admin-401"
        occurredAt="2026-05-29 11:00"
        path="/admin"
      />
    );

    expect(screen.getByRole('link', { name: '飞书登录' })).toHaveAttribute('href', '/admin/auth/login');
    await userEvent.click(screen.getByRole('button', { name: '复制 request id' }));
    expect(writeText).toHaveBeenCalledWith('req-admin-401');
    await userEvent.click(screen.getByRole('button', { name: '复制问题信息' }));
    expect(writeText.mock.calls.at(-1)?.[0]).toContain('Feishu IAM 问题反馈');
    expect(writeText.mock.calls.at(-1)?.[0]).not.toMatch(/secret|token|cookie|authorization/i);
    await waitFor(() => expect(screen.getByText('已复制')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 创建组件实现**

`ProblemFeedbackPage.tsx`：

```tsx
import { AlertCircle, Copy, LogIn } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

type ProblemVariant = 'admin-login-required' | 'session-expired' | 'forbidden' | 'oauth-failed';

type ProblemFeedbackPageProps = {
  variant: ProblemVariant;
  title: string;
  description: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  errorCode: string;
  requestId: string;
  occurredAt: string;
  path: string;
  appKey?: string | null;
  clientId?: string | null;
  userIdentifier?: string | null;
};

export function ProblemFeedbackPage(props: ProblemFeedbackPageProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const feedbackText = useMemo(() => buildFeedbackText(props), [props]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-[640px] rounded-lg border bg-background p-6 shadow-sm" aria-label="Feishu IAM 问题提示">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary"><AlertCircle aria-hidden="true" size={22} /></div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Feishu IAM 管理后台</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{props.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{props.description}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11">
            <a href={props.primaryAction.href}><LogIn aria-hidden="true" size={16} />{props.primaryAction.label}</a>
          </Button>
          {props.secondaryAction ? <Button asChild variant="outline" className="min-h-11"><a href={props.secondaryAction.href}>{props.secondaryAction.label}</a></Button> : null}
        </div>

        <dl className="mt-6 grid gap-3 rounded-md border bg-muted/20 p-4 text-sm">
          <ProblemRow label="错误码" value={props.errorCode} />
          <ProblemRow label="request id" value={props.requestId} copyLabel="复制 request id" onCopy={(value) => copy(value, 'request id')} />
          <ProblemRow label="发生时间" value={props.occurredAt} />
          <ProblemRow label="当前路径" value={props.path} />
          {props.appKey ? <ProblemRow label="应用" value={props.appKey} /> : null}
          {props.clientId ? <ProblemRow label="client" value={props.clientId} /> : null}
          {props.userIdentifier ? <ProblemRow label="用户" value={props.userIdentifier} /> : null}
        </dl>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={() => { void copy(feedbackText, '问题信息'); }}>
            <Copy aria-hidden="true" size={16} />复制问题信息
          </Button>
          <span aria-live="polite" className="text-sm text-muted-foreground">{copied ? '已复制' : '请把问题信息发送给 Feishu IAM 管理员或接入开发者。'}</span>
        </div>
        <Badge variant="secondary" className="mt-4 w-fit">技术信息已脱敏</Badge>
      </section>
    </main>
  );
}
```

同文件补齐 `ProblemRow()` 和 `buildFeedbackText()`：

```tsx
function ProblemRow(props: { label: string; value: string; copyLabel?: string; onCopy?: (value: string) => void }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className="break-all font-mono text-sm text-foreground">{props.value}</dd>
      {props.onCopy ? <Button type="button" variant="ghost" size="sm" aria-label={props.copyLabel} onClick={() => props.onCopy?.(props.value)}>{props.copyLabel}</Button> : null}
    </div>
  );
}

function buildFeedbackText(props: ProblemFeedbackPageProps): string {
  return [
    'Feishu IAM 问题反馈',
    `问题：${props.title}`,
    `错误码：${props.errorCode}`,
    `request id：${props.requestId}`,
    `发生时间：${props.occurredAt}`,
    `页面路径：${props.path}`,
    props.appKey ? `应用：${props.appKey}` : null,
    props.clientId ? `client：${props.clientId}` : null,
    props.userIdentifier ? `用户：${props.userIdentifier}` : null,
    '下一步：请把以上信息发送给 Feishu IAM 管理员或接入开发者排查。'
  ].filter(Boolean).join('\n');
}
```

- [ ] **Step 3: 接入 App 未登录态**

在 `apps/admin-web/src/App.tsx` 目前展示未登录页的位置，用 `ProblemFeedbackPage` 替换简陋提示：

```tsx
<ProblemFeedbackPage
  variant="admin-login-required"
  title="需要登录 Feishu IAM 管理后台"
  description="当前浏览器没有有效管理员会话，请使用飞书登录后继续。"
  primaryAction={{ label: '飞书登录', href: '/admin/auth/login' }}
  errorCode={adminState.errorCode ?? 'ADMIN_SESSION_REQUIRED'}
  requestId={adminState.requestId ?? 'unknown'}
  occurredAt={new Date().toLocaleString('zh-CN')}
  path={window.location.pathname + window.location.search}
/>
```

如果 `adminState` 当前没有 `errorCode` 字段，沿用已有 API error 的 `code` 和 `requestId`，不要新增前端假权限绕过。

- [ ] **Step 4: 增加 App 测试**

在 `apps/admin-web/src/App.test.tsx` 未登录测试中增加断言：

```ts
expect(screen.getByRole('main', { name: 'Feishu IAM 问题提示' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '复制 request id' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '复制问题信息' })).toBeInTheDocument();
expect(screen.getByText(/req-admin-401/)).toBeInTheDocument();
```

- [ ] **Step 5: 更新 OAuth HTML 错误页**

在 `apps/api/src/oauth/oauth-error.filter.ts` 的 `renderHtmlError()` 使用同一套问题提示页信息架构：

```ts
function renderHtmlError(message: string, requestId: string | undefined): string {
  const safeMessage = escapeHtml(message);
  const safeRequestId = escapeHtml(requestId ?? 'unknown');
  const feedbackText = escapeHtml([
    'Feishu IAM 问题反馈',
    '问题：无法完成 OAuth 登录',
    `request id：${requestId ?? 'unknown'}`,
    `错误信息：${message}`,
    '下一步：请把以上信息发送给接入系统负责人或 Feishu IAM 管理员。'
  ].join('\n'));

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>无法完成登录</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #172033; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
    section { width: min(100%, 720px); border: 1px solid #dde3eb; border-radius: 8px; background: #fff; padding: 28px; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06); }
    h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.25; }
    p { margin: 10px 0; line-height: 1.7; }
    dl { display: grid; gap: 12px; margin: 20px 0; }
    dt { color: #64748b; font-size: 13px; }
    dd { margin: 4px 0 0; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    button { border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 8px 12px; cursor: pointer; }
    @media (max-width: 390px) { main { padding: 16px; } section { padding: 20px; } h1 { font-size: 20px; } }
  </style>
</head>
<body>
  <main aria-label="Feishu IAM 问题提示">
    <section>
      <h1>无法完成登录</h1>
      <p>${safeMessage}</p>
      <p>请返回原系统重新发起登录；如果问题持续出现，请复制以下信息反馈。</p>
      <dl>
        <div><dt>request id</dt><dd>${safeRequestId}</dd></div>
        <div><dt>问题信息</dt><dd>OAuth 登录失败</dd></div>
      </dl>
      <button type="button" onclick="navigator.clipboard && navigator.clipboard.writeText(this.dataset.feedback)" data-feedback="${feedbackText}">复制问题信息</button>
    </section>
  </main>
</body>
</html>`;
}
```

在 `apps/api/test/oauth.controller.e2e-spec.ts` 增加断言：

```ts
expect(response.text).toContain('Feishu IAM 问题提示');
expect(response.text).toContain('复制问题信息');
expect(response.text).toContain('request id');
expect(response.text).not.toMatch(/client_secret|Authorization|access_token/i);
```

- [ ] **Step 6: 运行问题页测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/ProblemFeedbackPage.test.tsx src/App.test.tsx
pnpm --filter @feishu-iam/api test -- test/oauth.controller.e2e-spec.ts
```

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx apps/admin-web/src/components/admin/ProblemFeedbackPage.test.tsx apps/admin-web/src/App.tsx apps/admin-web/src/App.test.tsx apps/api/src/oauth/oauth-error.filter.ts apps/api/test/oauth.controller.e2e-spec.ts
git commit -m "feat: add unified problem feedback page"
```

## Task 7: 操作审计追踪 Tab

**Files:**
- Add: `apps/admin-web/src/features/records/TraceResultPanel.tsx`
- Add: `apps/admin-web/src/features/records/trace-format.ts`
- Add: `apps/admin-web/src/features/records/trace-format.test.ts`
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
- Modify: `apps/admin-web/src/features/records/RecordQueryView.test.tsx`

- [ ] **Step 1: 写 trace formatter 测试**

`trace-format.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { buildTraceFeedbackText, stageLabel } from './trace-format';

describe('trace-format', () => {
  it('生成不含敏感字段的问题信息', () => {
    const text = buildTraceFeedbackText({
      requestId: 'req-very-long-20260529',
      diagnosis: '发现失败阶段：授权码换 token 失败',
      application: 'finance',
      clientId: 'client-finance',
      feishuUserId: 'ou_user'
    });

    expect(text).toContain('request id：req-very-long-20260529');
    expect(text).not.toMatch(/secret|token|cookie|authorization/i);
  });

  it('返回中文阶段标签', () => {
    expect(stageLabel('token_exchange')).toBe('换取 token');
    expect(stageLabel('permission_query')).toBe('权限查询');
  });
});
```

- [ ] **Step 2: 实现 formatter**

`trace-format.ts`：

```ts
export function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    admin_change: '后台变更',
    oauth_authorize: 'OAuth authorize',
    oauth_login: '飞书登录',
    token_exchange: '换取 token',
    userinfo: 'userinfo',
    permission_query: '权限查询',
    feishu_sync: '飞书同步',
    oauth_token_context: 'token 上下文'
  };
  return labels[stage] ?? stage;
}

export function resultLabel(result: string): string {
  if (result === 'success') return '成功';
  if (result === 'failed') return '失败';
  if (result === 'running') return '运行中';
  return result;
}

export function buildTraceFeedbackText(input: {
  requestId?: string;
  diagnosis: string;
  application?: string | null;
  clientId?: string | null;
  feishuUserId?: string | null;
}): string {
  return [
    'Feishu IAM 追踪结果',
    `诊断：${input.diagnosis}`,
    input.requestId ? `request id：${input.requestId}` : null,
    input.application ? `应用：${input.application}` : null,
    input.clientId ? `client：${input.clientId}` : null,
    input.feishuUserId ? `用户：${input.feishuUserId}` : null
  ].filter(Boolean).join('\n');
}
```

- [ ] **Step 3: 写追踪 Tab UI 失败测试**

在 `RecordQueryView.test.tsx` mock `fetchAdminTrace()`，增加完整命中测试：

```tsx
vi.mocked(fetchAdminTrace).mockResolvedValue({
  summary: { status: 'complete', diagnosis: '已找到可见追踪记录', matchedEventCount: 2, missingStages: [], nextActions: ['检查第三方回调日志'] },
  context: { requestId: 'req-1', application: { id: 'app-finance', appKey: 'finance', name: '财务系统' }, clientId: 'client-finance', timeWindow: { from: '2026-05-29T00:00:00.000Z', to: '2026-05-29T01:00:00.000Z' } },
  timeline: [
    { id: 'sec-1', source: 'security_event', stage: 'token_exchange', result: 'failed', occurredAt: '2026-05-29T00:30:00.000Z', title: '授权码换 token 失败', summary: '授权码已使用', requestId: 'req-1', applicationId: 'app-finance', clientId: 'client-finance', feishuUserId: 'ou_user', details: { reasonCode: 'OAUTH_CODE_USED', clientSecret: '[REDACTED]' } }
  ],
  coverage: { auditLogs: 0, securityEvents: 1, feishuSyncRuns: 0, oauthContexts: 0 }
});

render(<RecordQueryView />);
expect(await screen.findByRole('tab', { name: '追踪' })).toBeInTheDocument();
expect(await screen.findByText('已找到可见追踪记录')).toBeInTheDocument();
expect(screen.getByText('授权码换 token 失败')).toBeInTheDocument();
expect(screen.getByText('[REDACTED]')).toBeInTheDocument();
```

- [ ] **Step 4: 实现 `TraceResultPanel`**

`TraceResultPanel.tsx`：

```tsx
import { Copy, Search } from 'lucide-react';
import { useState } from 'react';
import type { AdminTraceResult, AdminTraceTimelineItem } from '../../api/admin';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { PageState } from '../../components/admin/PageState';
import { buildTraceFeedbackText, resultLabel, stageLabel } from './trace-format';

export function TraceResultPanel(props: {
  result: AdminTraceResult | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (props.loading) return <PageState type="loading" title="正在查询追踪记录" />;
  if (props.forbidden) return <PageState type="forbidden" title="没有权限查看追踪结果" description="当前管理员只能查看授权范围内的追踪数据。" />;
  if (props.error) return <PageState type="error" title={props.error} description="请检查 request id、应用、client、用户或时间窗口。" />;
  if (!props.result) return <TraceInitialState />;
  if (props.result.summary.status === 'empty') return <TraceEmptyState result={props.result} />;
  const text = buildTraceFeedbackText({
    requestId: props.result.context.requestId,
    diagnosis: props.result.summary.diagnosis,
    application: props.result.context.application?.appKey ?? props.result.context.appKey,
    clientId: props.result.context.clientId,
    feishuUserId: props.result.context.feishuUserId
  });
  return (
    <section className="grid gap-4">
      <div className="rounded-md border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">诊断摘要</h2>
            <p className="mt-1 text-sm text-muted-foreground">{props.result.summary.diagnosis}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied(true)); }}>
            <Copy aria-hidden="true" size={16} />{copied ? '已复制' : '复制追踪摘要'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">命中 {props.result.summary.matchedEventCount} 条</Badge>
          <Badge variant="secondary">审计 {props.result.coverage.auditLogs}</Badge>
          <Badge variant="secondary">安全事件 {props.result.coverage.securityEvents}</Badge>
          <Badge variant="secondary">同步 {props.result.coverage.feishuSyncRuns}</Badge>
        </div>
      </div>
      <ol className="grid gap-3" aria-label="追踪时间线">
        {props.result.timeline.map((item) => <TraceTimelineItem key={`${item.source}:${item.id}`} item={item} />)}
      </ol>
    </section>
  );
}
```

同文件补齐 `TraceInitialState()`、`TraceEmptyState()`、`TraceTimelineItem()`，要求：

```tsx
function TraceInitialState() {
  return <PageState type="empty" title="输入 request id 或上下文开始追踪" description="可以粘贴终端用户复制的问题信息，也可以按应用、client、飞书 user_id 和时间窗口查询。" />;
}

function TraceEmptyState(props: { result: AdminTraceResult }) {
  return <PageState type="empty" title="没有找到可见追踪记录" description={props.result.summary.nextActions.join('；') || '请调整 request id、应用、client、用户或时间窗口。'} />;
}

function TraceTimelineItem({ item }: { item: AdminTraceTimelineItem }) {
  return (
    <li className="rounded-md border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{stageLabel(item.stage)}</Badge>
        <Badge variant={item.result === 'failed' ? 'destructive' : 'secondary'}>{resultLabel(item.result)}</Badge>
        <span className="text-sm text-muted-foreground">{new Date(item.occurredAt).toLocaleString('zh-CN')}</span>
      </div>
      <h3 className="mt-2 text-base font-medium">{item.title}</h3>
      <p className="mt-1 break-words text-sm text-muted-foreground">{item.summary}</p>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <TraceDetail label="request id" value={item.requestId ?? '-'} />
        <TraceDetail label="client" value={item.clientId ?? '-'} />
        <TraceDetail label="飞书 user_id" value={item.feishuUserId ?? '-'} />
        <TraceDetail label="来源" value={item.source} />
      </dl>
      <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs"><code>{JSON.stringify(item.details, null, 2)}</code></pre>
    </li>
  );
}
```

- [ ] **Step 5: 接入 `RecordQueryView` trace Tab**

在 `RecordQueryView.tsx`：

```tsx
import { fetchAdminTrace } from "../../api/admin";
import { TraceResultPanel } from "./TraceResultPanel";
```

扩展 draft：

```ts
type FilterDraft = {
  requestId: string;
  action: string;
  applicationId: string;
  clientId: string;
  feishuUserId: string;
  from: string;
  to: string;
  result: string;
};
```

在 `tabItems` 最前增加：

```ts
{ value: "trace", label: "追踪", emptyText: "暂无追踪记录", detailLabel: "追踪详情" }
```

当 `search.tab === 'trace'` 时调用：

```ts
const result = await fetchAdminTrace({
  requestId: search.requestId,
  applicationId: search.applicationId,
  clientId: search.clientId,
  feishuUserId: search.feishuUserId,
  from: search.from,
  to: search.to,
  result: search.result
});
return { trace: result, rows: [], total: result.timeline.length };
```

若现有 `RecordState` 只支持 rows，扩展为：

```ts
| { status: "loaded"; rows: RecordRow[]; total: number; trace?: AdminTraceResult | null }
```

在 trace Tab 内容区渲染：

```tsx
{search.tab === "trace" ? (
  <TraceResultPanel
    result={state.status === "loaded" ? state.trace ?? null : null}
    loading={state.status === "loading"}
    error={state.status === "failed" && !state.forbidden ? state.message : null}
    forbidden={state.status === "failed" && state.forbidden}
  />
) : (
  <DataTable
    rows={state.status === "loaded" ? state.rows : []}
    total={state.status === "loaded" ? state.total : 0}
    loading={state.status === "loading"}
    onOpenSheet={openRecordSheet}
  />
)}
```

- [ ] **Step 6: 补齐 trace 筛选字段**

在 `FilterBar` 中，trace Tab 显示：

```tsx
{search.tab === "trace" ? (
  <>
    <FilterField label="client id" value={draft.clientId} onChange={(value) => setDraft((current) => ({ ...current, clientId: value }))} />
    <FilterField label="飞书 user_id" value={draft.feishuUserId} onChange={(value) => setDraft((current) => ({ ...current, feishuUserId: value }))} />
    <FilterField label="from" value={draft.from} onChange={(value) => setDraft((current) => ({ ...current, from: value }))} />
    <FilterField label="to" value={draft.to} onChange={(value) => setDraft((current) => ({ ...current, to: value }))} />
  </>
) : null}
```

`handleSubmit()` 同步这些字段到 URL。

- [ ] **Step 7: 运行前端追踪测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web/src/features/records/TraceResultPanel.tsx apps/admin-web/src/features/records/trace-format.ts apps/admin-web/src/features/records/trace-format.test.ts apps/admin-web/src/features/records/RecordQueryView.tsx apps/admin-web/src/features/records/RecordQueryView.test.tsx
git commit -m "feat: add audit trace tab"
```

## Task 8: 应用详情、同步 run 和追踪上下文跳转

**Files:**
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
- Modify: `apps/admin-web/src/features/settings/SystemSyncRunDetailSheet.tsx`
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`

- [ ] **Step 1: 写应用详情跳转测试**

在 `ApplicationManagementView.test.tsx` 增加：

```tsx
expect(within(detail).getByRole('link', { name: '查看接入追踪' })).toHaveAttribute(
  'href',
  expect.stringContaining('/admin/records?tab=trace')
);
expect(within(detail).getByRole('link', { name: '查看接入追踪' })).toHaveAttribute(
  'href',
  expect.stringContaining('applicationId=app-finance')
);
```

- [ ] **Step 2: 在应用详情开发信息加入口**

在 `ApplicationDetailSheet.tsx` 开发信息区域增加：

```tsx
const traceHref = `/admin/records?${new URLSearchParams({
  tab: 'trace',
  applicationId: application.id,
  clientId: primaryClient?.clientId ?? '',
  returnTo: window.location.pathname + window.location.search
}).toString()}`;
```

渲染：

```tsx
<Button asChild variant="outline" size="sm">
  <a href={traceHref}>查看接入追踪</a>
</Button>
```

如果当前代码不允许直接访问 `window`，使用 `useLocation()` 生成 `returnTo`。

- [ ] **Step 3: 写同步 run 跳转测试**

在 `SystemSettingsView.test.tsx` 或 `SystemSyncRunDetailSheet` 对应测试中断言：

```tsx
expect(screen.getByRole('link', { name: '按 request id 追踪' })).toHaveAttribute(
  'href',
  '/admin/records?tab=trace&requestId=req-feishu-1'
);
```

- [ ] **Step 4: 同步 run 详情加入口**

在 `SystemSyncRunDetailSheet.tsx` request id 附近增加：

```tsx
{run.requestId ? (
  <Button asChild variant="outline" size="sm">
    <a href={`/admin/records?tab=trace&requestId=${encodeURIComponent(run.requestId)}`}>按 request id 追踪</a>
  </Button>
) : null}
```

- [ ] **Step 5: 运行跳转测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx apps/admin-web/src/features/settings/SystemSyncRunDetailSheet.tsx apps/admin-web/src/features/settings/SystemSettingsView.test.tsx
git commit -m "feat: link resources to trace view"
```

## Task 9: 接入排障文档和版本材料

**Files:**
- Add: `docs/oauth-troubleshooting.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `IMPLEMENTATION_PLAN.md`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/api/src/version/version.controller.ts`
- Modify: `apps/api/test/version.controller.e2e-spec.ts`
- Modify: `deploy/docker-compose.yml`
- Modify: `deploy/install.sh`
- Modify: `deploy/server.env.example`

- [ ] **Step 1: 新增接入排障文档**

创建 `docs/oauth-troubleshooting.md`：

```markdown
# Feishu IAM 接入排障指南

## 适用场景

第三方系统在登录、OAuth authorize、飞书回调、授权码换 token、userinfo、权限查询或后台权限配置后出现异常时，使用本指南收集字段并进入后台追踪视角。

## 终端用户需要提供

- `request id`
- 错误码
- 发生时间
- 当前页面路径或回调路径
- 第三方系统名称
- 截图

## 接入开发者需要补充

- 应用 `app_key`
- client id
- 回调地址
- 接口路径：`/oauth/authorize`、`/oauth/token`、`/oauth/userinfo` 或 `/api/v1/apps/{app_key}/me/permissions`
- 第三方系统日志中的请求时间

## 管理员排查路径

1. 打开 Feishu IAM 管理后台。
2. 进入 `系统管理 / 操作审计 / 追踪`。
3. 优先粘贴 `request id` 查询。
4. 如果没有结果，补充应用、client、飞书 user_id 和时间窗口。
5. 查看诊断摘要、时间线、缺失阶段和下一步建议。

## 不应收集或转发的信息

- access token
- client secret
- developer API token
- Cookie
- Authorization header
- 授权码
- token hash
- state hash
- 原始敏感 payload
```

- [ ] **Step 2: 更新 README 版本索引**

在 `README.md` 版本历史表新增 `v0.16.0` 行：

```markdown
| `v0.16.0` | 规划中 | 生产追踪与接入排障：统一问题提示页、追踪聚合接口、OAuth/userinfo/权限查询事件补齐、操作审计追踪 Tab、应用详情跳转和接入排障文档。 | 待发布；实施计划见 `docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.0-audit-traceability.md`。 | [接入排障指南](docs/oauth-troubleshooting.md) |
```

- [ ] **Step 3: 更新 CHANGELOG**

在 `CHANGELOG.md` 顶部增加：

```markdown
## v0.16.0 - 生产追踪与接入排障

- 新增统一问题提示页，终端用户可复制 request id 和结构化问题信息。
- 新增后台追踪聚合接口和操作审计「追踪」Tab。
- 补齐 OAuth token、userinfo 和权限查询的最小安全事件。
- 增加 security_events 和 feishu_sync_runs 追踪索引。
- 新增接入排障指南，明确终端用户和接入开发者需要提供的字段。
```

- [ ] **Step 4: 更新 AGENTS 当前阶段**

把 `AGENTS.md` 当前阶段改为 `v0.16.0` 实施中，并增加：

```markdown
- 收口 `v0.16.0` 生产追踪与接入排障：统一问题提示页、追踪聚合接口、最小事件补齐、操作审计追踪 Tab 和应用详情跳转必须服务 request id 排障主旅程。
```

当前阶段不做中加入：

```markdown
- 不在 `v0.16.0` 实现完整 OIDC、refresh token、SAML、ABAC、资源级权限、通用 BI 报表或外部链路追踪基础设施。
```

- [ ] **Step 5: 更新版本号和部署默认 tag**

把以下文件中的 `0.15.2` 或 `v0.15.2` 更新为 `0.16.0` / `v0.16.0`：

```text
package.json
apps/api/package.json
apps/admin-web/package.json
apps/api/src/version/version.controller.ts
apps/api/test/version.controller.e2e-spec.ts
deploy/docker-compose.yml
deploy/install.sh
deploy/server.env.example
```

- [ ] **Step 6: 更新根目录执行入口**

把 `IMPLEMENTATION_PLAN.md` 改为：

````markdown
# Feishu IAM v0.16.0 生产追踪与接入排障实施计划

本文件是当前分支的执行入口。详细工程计划见：

```text
docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.0-audit-traceability.md
```

## 目标

发布 `v0.16.0`，收口 GitLab `#27/#28/#29/#30/#31`，完成统一问题提示页、后端追踪聚合接口、OAuth/userinfo/权限查询事件补齐、操作审计追踪 Tab、应用详情跳转和接入排障文档。

## 第一 vertical slice

1. 新增追踪索引迁移和 `/api/v1/admin/traces`。
2. 补齐最小 OAuth 追踪事件。
3. 操作审计新增「追踪」Tab 并接入聚合接口。
4. 未登录提示页使用统一问题提示页并可复制 request id。

## 验证命令

```bash
pnpm --filter @feishu-iam/api prisma:validate
pnpm --filter @feishu-iam/api test -- test/admin-trace.service.spec.ts test/admin.controller.e2e-spec.ts test/oauth.service.spec.ts test/oauth.controller.e2e-spec.ts test/app-permissions.e2e-spec.ts
pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts src/components/admin/ProblemFeedbackPage.test.tsx src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx src/App.test.tsx
pnpm --filter @feishu-iam/admin-web build
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```

## 完成标准

- `#27/#28/#29/#30/#31` 全部有实现、测试和验收证据。
- 统一问题提示页桌面和 390px 无溢出，复制 request id 和问题信息可用。
- 追踪接口服务端完成权限裁剪和脱敏。
- 操作审计追踪 Tab 支持完整命中、部分命中、无结果和权限不足。
- Browser 自检、gstack design-review、qa、review、GitLab release 和 `192.168.2.112` 部署证据齐全。
````

- [ ] **Step 7: 运行文档和版本测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/version.controller.e2e-spec.ts
rg -n "v0\\.15\\.2|0\\.15\\.2" package.json apps/api/package.json apps/admin-web/package.json deploy apps/api/src/version README.md CHANGELOG.md AGENTS.md
```

Expected: 版本文件不再保留 `0.15.2`，历史文档中的旧版本记录可以保留。

- [ ] **Step 8: Commit**

```bash
git add docs/oauth-troubleshooting.md README.md CHANGELOG.md AGENTS.md IMPLEMENTATION_PLAN.md package.json apps/api/package.json apps/admin-web/package.json apps/api/src/version/version.controller.ts apps/api/test/version.controller.e2e-spec.ts deploy/docker-compose.yml deploy/install.sh deploy/server.env.example
git commit -m "docs: prepare v0.16.0 traceability release"
```

## Task 10: 全量验证、Browser 自检和发布准备

**Files:**
- Add: `docs/codex-sessions/2026-05-29-1600-v0.16.0生产追踪实施.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 运行后端定向验证**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:validate
pnpm --filter @feishu-iam/api test -- test/admin-trace.service.spec.ts test/admin-query.service.spec.ts test/admin.controller.e2e-spec.ts test/oauth.service.spec.ts test/oauth.controller.e2e-spec.ts test/app-permissions.e2e-spec.ts test/version.controller.e2e-spec.ts
```

Expected: PASS。

- [ ] **Step 2: 运行前端定向验证**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts src/components/admin/ProblemFeedbackPage.test.tsx src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx src/App.test.tsx
```

Expected: PASS。

- [ ] **Step 3: 运行全量检查**

Run:

```bash
pnpm check
pnpm --filter @feishu-iam/admin-web build
```

Expected: PASS。

- [ ] **Step 4: 启动本地服务**

Run:

```bash
pnpm --parallel --filter @feishu-iam/api --filter @feishu-iam/admin-web dev
```

Expected: API 和 admin web 均启动。若 `3000` 被占用，使用 Vite 输出的新端口，并在自检记录中写明。

- [ ] **Step 5: Browser 自检**

使用 Browser 打开 `http://localhost:3000/`，覆盖：

```text
1. 未登录提示页桌面：飞书登录、request id、复制 request id、复制问题信息。
2. 390px 未登录态：无横向溢出，主按钮和复制按钮不变形。
3. 操作审计 / 追踪 Tab：初始态、完整命中 mock 或真实数据、部分命中、无结果、权限不足。
4. 追踪详情：长 request id、长回调 URL、脱敏字段、复制成功反馈。
5. 应用详情开发信息跳转追踪，返回原 Tab。
```

Expected: console 无非预期错误，Network 无非预期 5xx，未登录 401 可作为预期噪声记录。

- [ ] **Step 6: 运行 responsive checker**

Run:

```bash
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
```

Expected: PASS，无横向 overflow。

- [ ] **Step 7: gstack 评审门禁**

Run:

```text
gstack /design-review
gstack /qa
gstack /review
```

Expected: 阻塞和重要问题修复；可选问题记录接受原因。

- [ ] **Step 8: GitLab issue 验收**

逐个回填或关闭：

```text
#27 统一问题提示页
#28 追踪聚合接口
#29 OAuth 事件补齐
#30 操作审计追踪 Tab
#31 上下文跳转与接入排障文档
```

每个 issue 需要附验证证据：测试命令、Browser 截图或发布验证链接。

- [ ] **Step 9: 镜像构建和发布材料**

Run:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.0 --push .
```

Expected: registry 出现 `v0.16.0` 多架构镜像。记录 digest。

- [ ] **Step 10: 192.168.2.112 停机升级验证**

按项目稳定路径执行：

```bash
ssh dev@192.168.2.112 'cd ~/feishu-iam && ./upgrade.sh'
curl -fsS http://192.168.2.112/api/health
curl -fsS http://192.168.2.112/api/version
```

如果目标机不能拉取 registry，使用本机 `linux/amd64` tar + 远端 `docker load` + `FEISHU_IAM_PULL_POLICY=never`：

```bash
docker buildx build --platform linux/amd64 -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.0 --load .
docker save dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.0 | gzip > feishu-iam-v0.16.0-linux-amd64.tar.gz
scp feishu-iam-v0.16.0-linux-amd64.tar.gz dev@192.168.2.112:~/feishu-iam/
ssh dev@192.168.2.112 'cd ~/feishu-iam && gunzip -c feishu-iam-v0.16.0-linux-amd64.tar.gz | docker load && FEISHU_IAM_PULL_POLICY=never ./upgrade.sh'
```

Expected: `/api/version` 返回 `0.16.0`，后台未登录页和操作审计追踪入口可访问。

- [ ] **Step 11: 写会话归档**

创建 `docs/codex-sessions/2026-05-29-1600-v0.16.0生产追踪实施.md`，至少包含：

```markdown
# 2026-05-29 16:00 v0.16.0 生产追踪与接入排障实施

## 会话目标

实现并发布 v0.16.0 生产追踪与接入排障。

## GitLab issues

- #27
- #28
- #29
- #30
- #31

## 修改文件

列出本次修改文件。

## 验证命令和结果

列出测试、Browser、review、发布和 112 验证结果。

## 剩余风险

记录索引迁移、事件量、权限裁剪和生产验证风险。
```

- [ ] **Step 12: Commit**

```bash
git add docs/codex-sessions README.md CHANGELOG.md
git commit -m "docs: record v0.16.0 traceability evidence"
```

## Final Verification Checklist

执行完成前逐条确认：

- [ ] `#27` 未登录提示页：桌面和 390px 均可用，复制 request id 和问题信息可用。
- [ ] `#28` 追踪接口：`/api/v1/admin/traces` 通过权限、脱敏、部分命中和无结果测试。
- [ ] `#29` OAuth 事件：token、userinfo、权限查询失败与关键成功点均可追踪。
- [ ] `#30` 追踪 Tab：初始态、完整命中、部分命中、无结果、权限不足、长文本和脱敏展示通过测试。
- [ ] `#31` 上下文跳转：应用详情、同步 run、问题提示页和文档闭环。
- [ ] `security_events` 和 `feishu_sync_runs` 索引迁移存在并通过 Prisma 校验。
- [ ] 服务端脱敏规则覆盖 secret、token、cookie、authorization、client secret、tokenHash、stateHash、raw_payload。
- [ ] Browser 自检覆盖 `http://localhost:3000/` 桌面和 390px。
- [ ] `pnpm check`、前后端定向测试、前端 build、responsive checker 均通过。
- [ ] README、CHANGELOG、AGENTS、部署默认 tag、版本接口均为 `0.16.0`。
- [ ] GitLab issue、release、tag、镜像 digest 和 `192.168.2.112` 验证证据齐全。
