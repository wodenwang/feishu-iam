# Feishu IAM v0.16.1 追踪闭环、组织用户选择器与按钮治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v0.16.1`，收口 GitLab `#35/#26/#32/#33/#34`，让后台认证/授权失败的 request id 可追踪，让组织用户选择器符合 `v0.16.1` Pencil 原型，并把按钮形态小治理纳入同一补丁。

**Architecture:** 后端复用现有 `security_events` 和 `AdminTraceService`，通过 best-effort 记录后台认证/授权失败事件，不新增 DDL，不改变管理员 session 校验机制。前端在操作审计追踪页增加本地问题信息解析，只提取 request id；组织用户选择器扩展 selected subjects display data contract，已选区展示名称、头像/图标、主体类型、路径和 orphaned 状态；按钮治理只做形态、可访问标签、不换行和轻量检查。

**Tech Stack:** NestJS、Prisma、PostgreSQL、React、Vite、shadcn/ui、Tailwind、lucide-react、Vitest、Browser、Docker Compose、GitLab。

---

## Inputs

- 设计草案：`/Users/tonycheng/.gstack/projects/ai-feishu-iam/tonycheng-main-design-20260529-154007.md`
- CEO review：`/Users/tonycheng/.gstack/projects/ai-feishu-iam/ceo-plans/2026-05-29-feishu-iam-v0.16.1.md`
- Pencil 源文件：`design/admin-console-v0.16.1.pen`
- Pencil 原型说明：`design/v0.16.1-org-user-selector-prototype.md`
- 截图目录：`design/exports/v0.16.1-org-user-selector/`
- 上一版追踪实施计划：`docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.0-audit-traceability.md`
- 上一版组织用户选择器计划：`docs/superpowers/plans/2026-05-28-feishu-iam-v0.15.2-org-user-selector-refine.md`

## Hard Gates

- `#35` 的 `ADMIN_SESSION_REQUIRED`、`ADMIN_SESSION_INVALID`、`ADMIN_SESSION_EXPIRED`、`ADMIN_USER_UNAVAILABLE`、`ADMIN_PERMISSION_DENIED` 必须写入可按 request id 查询的安全事件。
- `#35` 的安全事件写入必须 best-effort：记录失败时，原始 401/403 响应不变，不能变成 500。
- `#35` 的问题信息粘贴解析只能在前端本地提取 request id，不把粘贴原文发给后端，不保存到 URL、state 持久化、审计日志或安全事件。
- 所有追踪详情不得记录或展示 cookie、token、authorization、raw payload、secret、授权码、token hash、state hash。
- `#26` 已选主体不得只展示 ID；刷新后仍必须展示名称、头像/图标、主体类型、路径和 orphaned 状态。
- `#26` 必须覆盖根级组织、逐级下钻、组织/用户同列表、搜索、390px 待选/已选/摘要、加载、空、错误和按钮状态。
- 飞书同步页只读 `OrgBrowser` 不得出现角色绑定的选择、已选、保存或草稿语义。
- `#32/#33/#34` 只做按钮形态、可访问标签、不换行和轻量检查，不做全站 UI 重构。

## NOT in scope

- 不新增 DDL，不迁移 `iam_role_subjects` 表结构，不保存展示快照到数据库。
- 不实现完整外部链路追踪、分布式 trace、告警系统或报表化诊断。
- 不实现完整 OIDC、SAML、ABAC、资源级权限、deny 规则或数据范围权限。
- 不恢复前端注入 `PLATFORM_ADMIN_TOKEN`，不改变管理员 session cookie 机制。
- 不上传、保存或服务端解析整页问题信息原文。
- 不做按钮组件体系迁移，不引入复杂 AST 平台，不全站重排视觉。

## File Map

- Add: `apps/api/src/admin/admin-auth-failure-recorder.ts`
  - 统一把后台认证/授权失败转换成安全事件，写入失败只记录服务端日志。
- Modify: `apps/api/src/admin/admin-error.filter.ts`
  - 在返回稳定错误体前调用 recorder；保持 request id 响应结构不变。
- Modify: `apps/api/src/admin/admin.module.ts`
  - 注册 `AdminAuthFailureRecorder` 和可注入的 `AdminErrorFilter`。
- Modify: `apps/api/src/admin/admin-trace.service.ts`
  - 增加 `admin_auth` 阶段映射、标题、缺失阶段判断和 next action。
- Modify: `apps/api/test/admin-error.filter.spec.ts`
  - 覆盖 401/403 写入安全事件、写入失败不改变响应、敏感字段不进入 payload。
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`
  - 覆盖未登录、非法 session、过期 session、管理员不可用、权限不足 request id 可追踪。
- Modify: `apps/api/test/admin-trace.service.spec.ts`
  - 覆盖 `admin_auth_failure` 时间线、阶段标签和服务端脱敏。
- Modify: `apps/admin-web/src/features/records/trace-format.ts`
  - 增加 `extractTraceRequestIdFromText()` 和 `admin_auth` 阶段标签。
- Modify: `apps/admin-web/src/features/records/trace-format.test.ts`
  - 覆盖本地 request id 提取、多个文本格式、敏感词输入不出现在输出。
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
  - 在追踪 Tab 增加本地问题信息粘贴解析入口，只把 request id 写入查询草稿。
- Modify: `apps/admin-web/src/features/records/RecordQueryView.test.tsx`
  - 覆盖粘贴整页问题信息、提取 request id、查询、清空粘贴框。
- Modify: `apps/admin-web/src/features/records/TraceResultPanel.tsx`
  - 展示 `admin_auth` 阶段的中文标签和 next action。
- Modify: `apps/api/src/permission/iam-role.service.ts`
  - 为角色主体返回展示字段，基于飞书镜像表即时回填，不改 DB。
- Modify: `apps/api/test/iam-role.service.spec.ts`
  - 覆盖组织/用户已选主体名称、头像 label、路径和 orphaned 状态。
- Modify: `apps/admin-web/src/api/permission.ts`
  - 扩展 `IamRoleSubject` display data contract。
- Modify: `apps/admin-web/src/features/org-browser/org-browser-types.ts`
  - 扩展候选项路径元数据和已选主体展示模型。
- Modify: `apps/admin-web/src/features/org-browser/org-browser.tsx`
  - 选择组织/用户时把当前路径传给 `OrgUserSelector`，只读模式保持查看语义。
- Modify: `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
  - 已选区展示名称、头像/图标、主体类型、路径和 orphaned 状态。
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
  - 覆盖角色绑定选择器桌面和 390px 的关键交互。
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`
  - 覆盖飞书同步只读浏览不出现选择/保存语义。
- Add: `apps/admin-web/test/button-governance-check.mjs`
  - 轻量扫描关键 TSX 文件，防止 icon-only 按钮缺少可访问标签、按钮文字换行。
- Modify: `apps/admin-web/package.json`
  - 增加 `test:buttons` 脚本。
- Modify: `apps/admin-web/src/components/ui/button.tsx`
  - 保持按钮基础类 `whitespace-nowrap` 和固定尺寸语义。
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
  - 列表行操作保持纯 icon，非紧凑按钮保持 icon + 文案。
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
  - 应用详情角色管理操作列按钮治理，不改变业务动作。
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.tsx`
  - 飞书同步页按钮治理，不改变同步语义。
- Modify: `README.md`、`CHANGELOG.md`、`AGENTS.md`
  - 更新 v0.16.1 状态、版本历史、设计说明和文档索引。
- Modify: `IMPLEMENTATION_PLAN.md`
  - 指向本计划作为当前执行入口。
- Modify: `package.json`、`apps/api/package.json`、`apps/admin-web/package.json`
  - 版本号更新到 `0.16.1`。
- Modify: `apps/api/src/version/version.controller.ts`、`apps/api/test/version.controller.e2e-spec.ts`
  - 版本接口更新到 `0.16.1`。
- Modify: `deploy/docker-compose.yml`、`deploy/install.sh`、`deploy/server.env.example`
  - 默认镜像 tag 和 `APP_VERSION` 更新到 `v0.16.1`。
- Add: `docs/codex-sessions/2026-05-29-1800-v0.16.1实施收口.md`
  - 执行阶段记录实现、验证、发布和 112 证据。

## Data Flow

```text
后台 401/403
  AdminSessionGuard / AdminPermissionService / readRequiredAdminContext
    -> throw AdminDomainError(code, status)
    -> AdminErrorFilter.catch()
    -> AdminAuthFailureRecorder.recordBestEffort()
       -> security_events(event_type=admin_auth_failure, reason_code=code, request_id)
    -> AdminErrorFilter 返回原 401/403 + request_id
    -> 操作审计追踪 Tab 按 request id 查询
    -> AdminTraceService security_events -> stage=admin_auth
```

```text
问题信息粘贴
  用户粘贴整页问题信息到追踪 Tab textarea
    -> extractTraceRequestIdFromText(text)
    -> 只把 request id 写入 draft.requestId
    -> 清空 textarea
    -> fetchAdminTrace({ requestId })
```

```text
角色组织用户绑定
  IamRoleService.listRoles(appKey)
    -> 读取 iam_role_subjects
    -> 批量读取 feishu_users / feishu_departments / user_departments
    -> 即时生成 displayName / avatarLabel / displayPath / subjectKindLabel
    -> 前端 OrgUserSelector 已选区渲染 display 字段
    -> PUT subjects 仍只提交 org_subjects / user_subjects
```

## Task 1: `#35` 后台认证/授权失败安全事件

**Files:**
- Add: `apps/api/src/admin/admin-auth-failure-recorder.ts`
- Modify: `apps/api/src/admin/admin-error.filter.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/test/admin-error.filter.spec.ts`
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 写失败测试，验证 AdminErrorFilter 记录安全事件**

在 `apps/api/test/admin-error.filter.spec.ts` 增加测试。测试只断言安全事件字段，不断言 cookie 或 header 原文：

```ts
it('ADMIN_SESSION_REQUIRED 返回 401 前 best-effort 写入安全事件', async () => {
  const recorder = {
    recordBestEffort: vi.fn().mockResolvedValue(undefined)
  };
  const host = makeHost('req-admin-401');
  const filter = new AdminErrorFilter(recorder as never);

  filter.catch(new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401), host);

  expect(recorder.recordBestEffort).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'ADMIN_SESSION_REQUIRED',
      status: 401,
      requestId: 'req-admin-401'
    })
  );
  expect(host.response.status).toHaveBeenCalledWith(401);
  expect(JSON.stringify(recorder.recordBestEffort.mock.calls)).not.toMatch(/cookie|authorization|token|raw_payload|secret/i);
});
```

Expected before implementation: TypeScript 或 Vitest 失败，因为 `AdminErrorFilter` 还没有 recorder 构造参数。

- [ ] **Step 2: 新增 `AdminAuthFailureRecorder`**

创建 `apps/api/src/admin/admin-auth-failure-recorder.ts`：

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { SecurityEventService } from '../oauth/security-event.service';
import { getAdminRequestId, readAdminContext } from './admin-request-context';

type AdminAuthFailureInput = {
  code: string;
  status: number;
  message: string;
  request: Request;
};

@Injectable()
export class AdminAuthFailureRecorder {
  private readonly logger = new Logger(AdminAuthFailureRecorder.name);

  constructor(
    @Inject(SecurityEventService)
    private readonly securityEvents: SecurityEventService
  ) {}

  async recordBestEffort(input: AdminAuthFailureInput): Promise<void> {
    const requestId = getAdminRequestId(input.request);
    const context = readAdminContext(input.request);

    try {
      await this.securityEvents.record({
        eventType: 'admin_auth_failure',
        applicationId: null,
        clientId: null,
        feishuUserId: context?.feishuUserId ?? null,
        result: 'failed',
        reasonCode: input.code,
        summary: buildAdminAuthFailureSummary(input.code, input.status),
        ip: readIp(input.request),
        userAgent: readUserAgent(input.request),
        requestId
      });
    } catch (error) {
      this.logger.error(
        `Admin auth failure security event write failed: ${input.code} / request id: ${requestId}`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}

function buildAdminAuthFailureSummary(code: string, status: number): string {
  if (code === 'ADMIN_SESSION_REQUIRED') return '后台访问缺少有效登录态';
  if (code === 'ADMIN_SESSION_INVALID') return '后台访问登录态无效';
  if (code === 'ADMIN_SESSION_EXPIRED') return '后台访问登录态已过期';
  if (code === 'ADMIN_USER_UNAVAILABLE') return '后台管理员或关联飞书用户不可用';
  if (code === 'ADMIN_PERMISSION_DENIED') return '后台管理员权限不足';
  return `后台认证或授权失败，HTTP ${status}`;
}

function readIp(request: Request): string | null {
  return request.ip ?? null;
}

function readUserAgent(request: Request): string | null {
  return request.header('user-agent') ?? null;
}
```

- [ ] **Step 3: 修改 `AdminErrorFilter`**

把 `apps/api/src/admin/admin-error.filter.ts` 改为可注入 recorder，并在响应前触发 best-effort：

```ts
import { ArgumentsHost, Catch, ExceptionFilter, Inject, Optional } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getAdminRequestId } from './admin-request-context';
import { AdminAuthFailureRecorder } from './admin-auth-failure-recorder';
import { AdminDomainError } from './admin.types';

@Catch(AdminDomainError)
export class AdminErrorFilter implements ExceptionFilter {
  constructor(
    @Optional()
    @Inject(AdminAuthFailureRecorder)
    private readonly authFailureRecorder?: AdminAuthFailureRecorder
  ) {}

  catch(exception: AdminDomainError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = getAdminRequestId(request);

    void this.authFailureRecorder?.recordBestEffort({
      code: exception.code,
      status: exception.status,
      message: exception.message,
      request
    });

    response.status(exception.status).json({
      error: {
        code: exception.code,
        message: exception.message,
        request_id: requestId
      }
    });
  }
}
```

这里使用 `void` 是为了保证记录失败不会影响原响应；安全事件写入失败由 recorder 内部记录服务端错误。

- [ ] **Step 4: 注册 provider**

修改 `apps/api/src/admin/admin.module.ts`：

```ts
import { AdminAuthFailureRecorder } from './admin-auth-failure-recorder';
import { AdminErrorFilter } from './admin-error.filter';
```

并在 `providers` 和 `exports` 增加：

```ts
AdminAuthFailureRecorder,
AdminErrorFilter
```

- [ ] **Step 5: 写 e2e 覆盖未登录和权限不足**

在 `apps/api/test/admin.controller.e2e-spec.ts` 增加两个用例：

```ts
it('未登录访问后台 API 返回 request id 且写入 admin_auth_failure 安全事件', async () => {
  securityEvents.record.mockResolvedValue(undefined);

  const response = await request(app.getHttpServer())
    .get('/api/v1/admin/applications')
    .set('x-request-id', 'req-admin-missing-session')
    .expect(401);

  expect(response.body.error.request_id).toBe('req-admin-missing-session');
  expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({
    eventType: 'admin_auth_failure',
    result: 'failed',
    reasonCode: 'ADMIN_SESSION_REQUIRED',
    requestId: 'req-admin-missing-session'
  }));
  expect(JSON.stringify(securityEvents.record.mock.calls)).not.toMatch(/cookie|authorization|token|raw_payload|secret/i);
});

it('安全事件写入失败时仍返回原始 403', async () => {
  securityEvents.record.mockRejectedValue(new Error('security event unavailable'));

  await request(app.getHttpServer())
    .get('/api/v1/admin/admin-users')
    .set('x-request-id', 'req-admin-permission-denied')
    .set('cookie', buildApplicationAdminSessionCookie())
    .expect(403)
    .expect((response) => {
      expect(response.body.error.code).toBe('ADMIN_PERMISSION_DENIED');
      expect(response.body.error.request_id).toBe('req-admin-permission-denied');
    });
});
```

如果测试工具中没有 `buildApplicationAdminSessionCookie()`，复用该文件现有的后台 session mock 方法，不新增登录机制。

- [ ] **Step 6: 运行后端定向测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin-error.filter.spec.ts test/admin.controller.e2e-spec.ts
```

Expected: 两个测试文件 PASS；失败时不能出现敏感字段原文。

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin/admin-auth-failure-recorder.ts apps/api/src/admin/admin-error.filter.ts apps/api/src/admin/admin.module.ts apps/api/test/admin-error.filter.spec.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: trace admin auth failures"
```

## Task 2: `#35` 追踪时间线支持后台认证阶段

**Files:**
- Modify: `apps/api/src/admin/admin-trace.service.ts`
- Modify: `apps/api/test/admin-trace.service.spec.ts`
- Modify: `apps/admin-web/src/features/records/trace-format.ts`
- Modify: `apps/admin-web/src/features/records/trace-format.test.ts`
- Modify: `apps/admin-web/src/features/records/TraceResultPanel.tsx`

- [ ] **Step 1: 写失败测试，安全事件映射为 admin_auth 阶段**

在 `apps/api/test/admin-trace.service.spec.ts` 增加：

```ts
it('把后台认证失败安全事件映射为 admin_auth 阶段', async () => {
  const prisma = makePrisma();
  prisma.securityEvent.findMany.mockResolvedValue([
    {
      id: 'sec-admin-auth-1',
      eventType: 'admin_auth_failure',
      result: 'failed',
      reasonCode: 'ADMIN_SESSION_REQUIRED',
      summary: '后台访问缺少有效登录态',
      requestId: 'req-admin-401',
      applicationId: null,
      clientId: null,
      feishuUserId: null,
      ip: '127.0.0.1',
      userAgent: 'vitest',
      createdAt: new Date('2026-05-29T08:00:00.000Z')
    }
  ]);

  const result = await new AdminTraceService(prisma as never).getTrace(
    context(['platform_admin']),
    { requestId: 'req-admin-401' }
  );

  expect(result.timeline[0]).toMatchObject({
    source: 'security_event',
    stage: 'admin_auth',
    title: '后台认证/授权失败',
    requestId: 'req-admin-401'
  });
  expect(JSON.stringify(result.timeline[0].details)).not.toMatch(/cookie|authorization|token|rawPayload|secret/i);
});
```

- [ ] **Step 2: 扩展 `AdminTraceStage`**

在 `apps/api/src/admin/admin-trace.service.ts` 的 `AdminTraceStage` union 增加：

```ts
| 'admin_auth'
```

在 `stageFromEventType()` 中增加：

```ts
if (eventType === 'admin_auth_failure') return 'admin_auth';
```

在 `eventTitle()` 中增加：

```ts
if (eventType === 'admin_auth_failure') return '后台认证/授权失败';
```

- [ ] **Step 3: 调整 missing stages 和 next actions**

在 `buildTraceResult()` 或现有阶段判断中，把只有 `admin_auth` 的 request id 判定为 `complete` 或明确的 `partial`，诊断文案必须直接说明后台认证/授权失败已命中：

```ts
if (timeline.some((item) => item.stage === 'admin_auth')) {
  return {
    status: 'complete',
    diagnosis: '已定位到后台认证/授权失败事件，请查看 reasonCode 判断是登录态缺失、登录态无效、会话过期、管理员不可用还是权限不足。',
    missingStages: []
  };
}
```

如果现有 `buildTraceResult()` 结构不同，保持原返回类型，只替换 `summary.status`、`diagnosis` 和 `missingStages` 的计算分支。

- [ ] **Step 4: 前端阶段标签测试**

在 `apps/admin-web/src/features/records/trace-format.test.ts` 增加：

```ts
it('labels admin auth stage for trace timeline', () => {
  expect(stageLabel('admin_auth')).toBe('后台认证/授权');
});
```

- [ ] **Step 5: 前端阶段标签实现**

修改 `apps/admin-web/src/features/records/trace-format.ts`：

```ts
const labels: Record<string, string> = {
  admin_auth: '后台认证/授权',
  admin_change: '后台变更',
  oauth_authorize: 'OAuth authorize',
  oauth_login: '飞书登录',
  token_exchange: '换取 token',
  userinfo: 'userinfo',
  permission_query: '权限查询',
  feishu_sync: '飞书同步',
  oauth_token_context: 'token 上下文'
};
```

- [ ] **Step 6: 运行追踪测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin-trace.service.spec.ts
pnpm --filter @feishu-iam/admin-web test -- src/features/records/trace-format.test.ts
```

Expected: 后端和前端阶段标签测试 PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin/admin-trace.service.ts apps/api/test/admin-trace.service.spec.ts apps/admin-web/src/features/records/trace-format.ts apps/admin-web/src/features/records/trace-format.test.ts apps/admin-web/src/features/records/TraceResultPanel.tsx
git commit -m "feat: show admin auth trace stage"
```

## Task 3: `#35` 追踪页本地解析问题信息

**Files:**
- Modify: `apps/admin-web/src/features/records/trace-format.ts`
- Modify: `apps/admin-web/src/features/records/trace-format.test.ts`
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
- Modify: `apps/admin-web/src/features/records/RecordQueryView.test.tsx`

- [ ] **Step 1: 写 request id 提取测试**

在 `apps/admin-web/src/features/records/trace-format.test.ts` 增加：

```ts
import { extractTraceRequestIdFromText } from './trace-format';

it('extracts request id from copied problem feedback without returning raw text', () => {
  const text = [
    'Feishu IAM 问题反馈',
    '错误码：ADMIN_SESSION_REQUIRED',
    'request id：req-admin-401-20260529',
    '页面路径：/admin/applications',
    'cookie: should-not-be-kept',
    'authorization: should-not-be-kept'
  ].join('\n');

  expect(extractTraceRequestIdFromText(text)).toBe('req-admin-401-20260529');
});

it('returns null when pasted text has no request id', () => {
  expect(extractTraceRequestIdFromText('没有 request id 的普通说明')).toBeNull();
});
```

- [ ] **Step 2: 实现纯函数**

在 `apps/admin-web/src/features/records/trace-format.ts` 增加：

```ts
const REQUEST_ID_PATTERNS = [
  /request\s*id[：:\s]+([a-zA-Z0-9][a-zA-Z0-9._:-]{5,127})/i,
  /request_id[：:\s]+([a-zA-Z0-9][a-zA-Z0-9._:-]{5,127})/i
];

export function extractTraceRequestIdFromText(text: string): string | null {
  for (const pattern of REQUEST_ID_PATTERNS) {
    const matched = text.match(pattern);
    const value = matched?.[1]?.trim();
    if (value) {
      return value.replace(/[，,。.;；]+$/, '');
    }
  }
  return null;
}
```

函数只返回 request id 字符串，不返回原文、不返回其他字段。

- [ ] **Step 3: 写追踪页 UI 测试**

在 `apps/admin-web/src/features/records/RecordQueryView.test.tsx` 增加：

```tsx
it('parses pasted problem feedback locally and queries by request id only', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchAdminTrace).mockResolvedValue(traceResult);
  render(<RecordQueryView admin={platformAdmin} />);

  await user.click(screen.getByRole('tab', { name: '追踪' }));
  await user.type(
    screen.getByLabelText('粘贴问题信息'),
    'Feishu IAM 问题反馈\nrequest id：req-admin-401\ncookie: not-sent'
  );
  await user.click(screen.getByRole('button', { name: '提取 request id' }));
  await user.click(screen.getByRole('button', { name: '查询' }));

  expect(fetchAdminTrace).toHaveBeenCalledWith(expect.objectContaining({
    requestId: 'req-admin-401'
  }));
  expect(JSON.stringify(fetchAdminTrace.mock.calls)).not.toContain('not-sent');
});
```

- [ ] **Step 4: 实现追踪页本地解析入口**

在 `apps/admin-web/src/features/records/RecordQueryView.tsx`：

```tsx
import { Textarea } from '../../components/ui/textarea';
import { extractTraceRequestIdFromText } from './trace-format';
```

在组件 state 增加：

```tsx
const [problemText, setProblemText] = useState('');
const [problemTextError, setProblemTextError] = useState<string | null>(null);
```

在追踪 Tab 的筛选区域增加：

```tsx
{search.tab === 'trace' ? (
  <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
    <label className="text-sm font-medium" htmlFor="trace-problem-text">
      粘贴问题信息
    </label>
    <Textarea
      id="trace-problem-text"
      aria-label="粘贴问题信息"
      value={problemText}
      onChange={(event) => {
        setProblemText(event.target.value);
        setProblemTextError(null);
      }}
      placeholder="粘贴 Feishu IAM 问题提示页复制出的文本；系统只在浏览器本地提取 request id。"
    />
    {problemTextError ? (
      <p className="text-sm text-destructive">{problemTextError}</p>
    ) : (
      <p className="text-xs text-muted-foreground">
        只提取 request id，不上传、不保存粘贴原文。
      </p>
    )}
    <div>
      <Button
        className="whitespace-nowrap"
        type="button"
        variant="outline"
        onClick={() => {
          const requestId = extractTraceRequestIdFromText(problemText);
          if (!requestId) {
            setProblemTextError('未识别到 request id，请检查粘贴内容。');
            return;
          }
          setDraft((current) => ({ ...current, requestId }));
          setProblemText('');
          setProblemTextError(null);
        }}
      >
        <Search aria-hidden="true" size={16} />
        提取 request id
      </Button>
    </div>
  </div>
) : null}
```

- [ ] **Step 5: 运行前端定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx
```

Expected: 测试 PASS；`fetchAdminTrace` 调用参数中只有 request id，不包含粘贴原文。

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/features/records/trace-format.ts apps/admin-web/src/features/records/trace-format.test.ts apps/admin-web/src/features/records/RecordQueryView.tsx apps/admin-web/src/features/records/RecordQueryView.test.tsx
git commit -m "feat: parse trace request id locally"
```

## Task 4: `#26` 后端 selected subjects display data contract

**Files:**
- Modify: `apps/api/src/permission/iam-role.service.ts`
- Modify: `apps/api/test/iam-role.service.spec.ts`
- Modify: `apps/admin-web/src/api/permission.ts`

- [ ] **Step 1: 写后端失败测试**

在 `apps/api/test/iam-role.service.spec.ts` 的 `listRoles` 相关 describe 中增加：

```ts
it('listRoles 为已选组织和用户返回展示名称、头像 label、类型和路径', async () => {
  prisma.iamRole.findMany.mockResolvedValue([
    roleRow({
      subjects: [
        { subjectType: 'feishu_department', subjectId: 'dept_finance', isOrphaned: false },
        { subjectType: 'feishu_user', subjectId: 'ou_zhangsan', isOrphaned: false },
        { subjectType: 'feishu_user', subjectId: 'ou_missing', isOrphaned: true }
      ]
    })
  ]);
  prisma.feishuDepartment.findMany.mockResolvedValue([
    { departmentId: 'root', name: '唐群座椅', parentDepartmentId: null, isDeleted: false },
    { departmentId: 'dept_finance', name: '财务部', parentDepartmentId: 'root', isDeleted: false }
  ]);
  prisma.feishuUser.findMany.mockResolvedValue([
    {
      userId: 'ou_zhangsan',
      name: '张三',
      isActive: true,
      isDeleted: false,
      userDepartments: [
        { isPrimary: true, department: { departmentId: 'dept_finance', name: '财务部', parentDepartmentId: 'root', isDeleted: false } }
      ]
    }
  ]);

  const [role] = await service.listRoles('finance');

  expect(role.subjects).toEqual([
    expect.objectContaining({
      type: 'feishu_department',
      id: 'dept_finance',
      displayName: '财务部',
      avatarLabel: '财',
      subjectKindLabel: '组织',
      displayPath: '唐群座椅 / 财务部',
      isOrphaned: false
    }),
    expect.objectContaining({
      type: 'feishu_user',
      id: 'ou_zhangsan',
      displayName: '张三',
      avatarLabel: '张',
      subjectKindLabel: '用户',
      displayPath: '唐群座椅 / 财务部',
      isOrphaned: false
    }),
    expect.objectContaining({
      type: 'feishu_user',
      id: 'ou_missing',
      displayName: 'ou_missing',
      subjectKindLabel: '用户',
      displayPath: '已失效或未同步',
      isOrphaned: true
    })
  ]);
});
```

- [ ] **Step 2: 扩展后端类型**

在 `apps/api/src/permission/iam-role.service.ts` 中把 `IamRoleWithBindings.subjects` 扩展为：

```ts
subjects: Array<{
  type: IamSubjectType;
  id: string;
  isOrphaned: boolean;
  displayName: string;
  avatarLabel: string;
  subjectKindLabel: '组织' | '用户';
  displayPath: string;
}>;
```

- [ ] **Step 3: 实现展示字段回填**

在 `listRoles()` 读取 roles 后增加：

```ts
const subjectDisplays = await buildSubjectDisplayMap(this.prisma, roles.flatMap((role) => role.subjects));
```

并把 `subjects` mapping 改为：

```ts
subjects: role.subjects.map((subject) => {
  const type = subject.subjectType as IamSubjectType;
  const key = `${type}:${subject.subjectId}`;
  const display = subjectDisplays.get(key);
  return {
    type,
    id: subject.subjectId,
    isOrphaned: subject.isOrphaned || !display,
    displayName: display?.displayName ?? subject.subjectId,
    avatarLabel: display?.avatarLabel ?? fallbackAvatarLabel(subject.subjectId),
    subjectKindLabel: type === 'feishu_department' ? '组织' : '用户',
    displayPath: display?.displayPath ?? '已失效或未同步'
  };
})
```

在同文件底部增加 helper：

```ts
async function buildSubjectDisplayMap(
  client: IamRoleClient,
  subjects: Array<{ subjectType: string; subjectId: string }>
): Promise<Map<string, { displayName: string; avatarLabel: string; displayPath: string }>> {
  const departmentIds = [...new Set(subjects.filter((item) => item.subjectType === 'feishu_department').map((item) => item.subjectId))];
  const userIds = [...new Set(subjects.filter((item) => item.subjectType === 'feishu_user').map((item) => item.subjectId))];
  const [departments, users, allDepartments] = await Promise.all([
    departmentIds.length === 0
      ? Promise.resolve([])
      : client.feishuDepartment.findMany({
          where: { departmentId: { in: departmentIds }, isDeleted: false },
          select: { departmentId: true, name: true, parentDepartmentId: true }
        }),
    userIds.length === 0
      ? Promise.resolve([])
      : client.feishuUser.findMany({
          where: { userId: { in: userIds }, isDeleted: false },
          select: {
            userId: true,
            name: true,
            userDepartments: {
              where: { isDeleted: false },
              include: { department: true },
              orderBy: [{ isPrimary: 'desc' }, { departmentId: 'asc' }]
            }
          }
        }),
    client.feishuDepartment.findMany({
      where: { isDeleted: false },
      select: { departmentId: true, name: true, parentDepartmentId: true }
    })
  ]);

  const departmentMap = new Map(allDepartments.map((department) => [department.departmentId, department]));
  const displayMap = new Map<string, { displayName: string; avatarLabel: string; displayPath: string }>();

  for (const department of departments) {
    displayMap.set(`feishu_department:${department.departmentId}`, {
      displayName: department.name,
      avatarLabel: fallbackAvatarLabel(department.name),
      displayPath: buildDepartmentPath(department.departmentId, departmentMap)
    });
  }

  for (const user of users) {
    const primaryDepartment = user.userDepartments[0]?.department;
    displayMap.set(`feishu_user:${user.userId}`, {
      displayName: user.name,
      avatarLabel: fallbackAvatarLabel(user.name),
      displayPath: primaryDepartment
        ? buildDepartmentPath(primaryDepartment.departmentId, departmentMap)
        : '未返回所属组织'
    });
  }

  return displayMap;
}

function buildDepartmentPath(
  departmentId: string,
  departmentMap: Map<string, { departmentId: string; name: string; parentDepartmentId: string | null }>
): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null = departmentId;
  while (currentId && !seen.has(currentId) && names.length < 20) {
    seen.add(currentId);
    const current = departmentMap.get(currentId);
    if (!current) break;
    names.unshift(current.name);
    currentId = current.parentDepartmentId;
  }
  return names.length > 0 ? names.join(' / ') : '未返回组织路径';
}

function fallbackAvatarLabel(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1) : '?';
}
```

这个实现读取本地飞书镜像，不读取 `rawPayload`。

- [ ] **Step 4: 扩展前端 API 类型**

在 `apps/admin-web/src/api/permission.ts` 中修改：

```ts
export type IamRoleSubject = {
  type: 'feishu_user' | 'feishu_department';
  id: string;
  isOrphaned?: boolean;
  displayName?: string;
  avatarLabel?: string;
  subjectKindLabel?: '组织' | '用户';
  displayPath?: string;
};
```

- [ ] **Step 5: 运行后端和类型检查**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/iam-role.service.spec.ts
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: `iam-role.service` 测试 PASS；前端类型检查 PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/permission/iam-role.service.ts apps/api/test/iam-role.service.spec.ts apps/admin-web/src/api/permission.ts
git commit -m "feat: return role subject display data"
```

## Task 5: `#26` 前端选择器承接 Pencil 原型

**Files:**
- Modify: `apps/admin-web/src/features/org-browser/org-browser-types.ts`
- Modify: `apps/admin-web/src/features/org-browser/org-browser.tsx`
- Modify: `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`

- [ ] **Step 1: 写已选区展示测试**

在 `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx` 增加：

```tsx
it('组织与用户绑定已选区展示名称、头像、类型、路径和 orphaned 状态', async () => {
  render(<PermissionManagementView admin={applicationAdmin} />);

  await openRoleDetailSubjectsTab('finance', 'role-finance-admin');

  expect(await screen.findByText('财务部')).toBeInTheDocument();
  expect(screen.getByText('组织')).toBeInTheDocument();
  expect(screen.getByText('唐群座椅 / 财务部')).toBeInTheDocument();
  expect(screen.getByText('张三')).toBeInTheDocument();
  expect(screen.getByText('用户')).toBeInTheDocument();
  expect(screen.getByText('已失效或未同步')).toBeInTheDocument();
});
```

如果现有测试 helper 名称不同，复用该文件里打开角色详情和切换 Tab 的 helper，不新增测试框架。

- [ ] **Step 2: 扩展选择回调元数据**

在 `apps/admin-web/src/features/org-browser/org-browser-types.ts` 增加：

```ts
export type OrgBrowserSelectionMeta = {
  displayPath: string;
};
```

在 `OrgBrowserProps` 的选择回调中改为：

```ts
onSelectDepartment?: (department: OrgBrowserDepartment, meta: OrgBrowserSelectionMeta) => void;
onSelectUser?: (user: OrgBrowserUser, meta: OrgBrowserSelectionMeta) => void;
```

- [ ] **Step 3: `OrgBrowser` 传递当前路径**

在 `apps/admin-web/src/features/org-browser/org-browser.tsx` 增加：

```tsx
function currentPathLabel(stack: OrgBrowserDepartment[], activeDepartment: OrgBrowserDepartment | null): string {
  const names = activeDepartment ? stack.map((department) => department.name) : ['顶层组织'];
  return names.join(' / ');
}
```

在选择按钮点击处改为：

```tsx
props.onSelectDepartment?.(department, {
  displayPath: currentPathLabel([...stack, department], department)
});
```

用户选择按钮改为：

```tsx
props.onSelectUser?.(user, {
  displayPath: currentPathLabel(stack, activeDepartment)
});
```

只读模式仍只调用 `onInspectDepartment` / `onInspectUser`，不渲染选择按钮。

- [ ] **Step 4: `OrgUserSelector` 选择时保留展示快照**

在 `apps/admin-web/src/features/org-browser/org-user-selector.tsx` 中：

```tsx
function addDepartment(department: OrgBrowserDepartment, meta: OrgBrowserSelectionMeta) {
  addSubject({
    type: 'feishu_department',
    id: department.departmentId,
    displayName: department.name,
    avatarLabel: department.name.trim().slice(0, 1) || '?',
    subjectKindLabel: '组织',
    displayPath: meta.displayPath
  });
}

function addUser(user: OrgBrowserUser, meta: OrgBrowserSelectionMeta) {
  addSubject({
    type: 'feishu_user',
    id: user.userId,
    displayName: user.name,
    avatarLabel: user.name.trim().slice(0, 1) || '?',
    subjectKindLabel: '用户',
    displayPath: meta.displayPath
  });
}
```

- [ ] **Step 5: 已选区渲染名称、头像、类型和路径**

替换 `SubjectGroup` 中只展示 ID 的部分：

```tsx
<li className="flex items-start justify-between gap-3 rounded-md border bg-background p-3 text-sm" key={subjectKey(subject)}>
  <div className="flex min-w-0 items-start gap-3">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
      {subject.avatarLabel ?? fallbackAvatarLabel(subject.id)}
    </span>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="break-words">{subject.displayName ?? subject.id}</strong>
        <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
          {subject.subjectKindLabel ?? (subject.type === 'feishu_department' ? '组织' : '用户')}
        </span>
        {subject.isOrphaned ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
            已失效或未同步
          </span>
        ) : null}
      </div>
      <p className="mt-1 break-words text-xs text-muted-foreground">
        {subject.displayPath ?? '未返回组织路径'}
      </p>
      <code className="mt-1 block break-all text-xs text-muted-foreground">{subject.id}</code>
    </div>
  </div>
  <Button
    aria-label={`移除${subject.type === 'feishu_department' ? '组织' : '用户'} ${subject.displayName ?? subject.id}`}
    disabled={props.disabled}
    size="icon"
    title="移除"
    type="button"
    variant="ghost"
    onClick={() => props.onRemove(subject)}
  >
    <X aria-hidden="true" size={16} />
  </Button>
</li>
```

- [ ] **Step 6: 390px 分步测试**

在 `PermissionManagementView.test.tsx` 增加：

```tsx
it('390px uses pick selected summary steps without clearing draft', async () => {
  window.resizeTo(390, 920);
  const user = userEvent.setup();
  render(<PermissionManagementView admin={applicationAdmin} />);

  await openRoleDetailSubjectsTab('finance', 'role-finance-admin');
  await user.click(await screen.findByRole('tab', { name: '待选' }));
  await user.click(await screen.findByRole('button', { name: /选择用户/ }));
  await user.click(screen.getByRole('tab', { name: '已选' }));

  expect(screen.getByText('已选用户')).toBeInTheDocument();
  expect(screen.getByText('张三')).toBeInTheDocument();
});
```

- [ ] **Step 7: 飞书同步只读语义测试**

在 `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx` 增加：

```tsx
it('飞书同步组织浏览保持只读，不出现角色绑定选择和保存语义', async () => {
  render(<SystemSettingsView admin={syncAdmin} />);

  await screen.findByText('组织用户浏览');
  expect(screen.queryByRole('button', { name: /选择组织/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /选择用户/ })).not.toBeInTheDocument();
  expect(screen.queryByText('已选组织与用户')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /保存主体绑定/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 8: 运行前端组织选择器测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: 测试 PASS；`OrgBrowser readonly` 不出现绑定动作。

- [ ] **Step 9: Commit**

```bash
git add apps/admin-web/src/features/org-browser/org-browser-types.ts apps/admin-web/src/features/org-browser/org-browser.tsx apps/admin-web/src/features/org-browser/org-user-selector.tsx apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx apps/admin-web/src/features/settings/SystemSettingsView.test.tsx
git commit -m "feat: show org user subject display data"
```

## Task 6: `#32/#33/#34` 按钮轻治理和自动检查

**Files:**
- Add: `apps/admin-web/test/button-governance-check.mjs`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/admin-web/src/components/ui/button.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.tsx`
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`

- [ ] **Step 1: 写轻量按钮检查脚本**

创建 `apps/admin-web/test/button-governance-check.mjs`：

```js
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const files = [
  'src/features/permissions/PermissionManagementView.tsx',
  'src/features/applications/ApplicationDetailSheet.tsx',
  'src/features/settings/SystemSettingsView.tsx',
  'src/features/records/RecordQueryView.tsx',
  'src/features/org-browser/org-browser.tsx',
  'src/features/org-browser/org-user-selector.tsx'
];

const failures = [];

for (const relative of files) {
  const file = path.join(root, relative);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('size="icon"') && !line.includes('aria-label')) {
      failures.push(`${relative}:${index + 1} icon button must have aria-label on the Button line`);
    }
    if (line.includes('<Button') && /保存|查询|重置|返回|选择|加载更多|提取 request id/.test(line) && !line.includes('whitespace-nowrap')) {
      failures.push(`${relative}:${index + 1} command button should include whitespace-nowrap or be proven fixed-size`);
    }
  });
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('button governance check passed');
```

这是轻量检查，不做 AST 平台；误报时优先把按钮类名写清楚，不扩大脚本复杂度。

- [ ] **Step 2: 增加 package script**

修改 `apps/admin-web/package.json`：

```json
"test:buttons": "node test/button-governance-check.mjs"
```

- [ ] **Step 3: 保持 Button 基础不换行**

确认 `apps/admin-web/src/components/ui/button.tsx` 的基础类包含：

```ts
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md"
```

如果已有 `whitespace-nowrap`，只保留现状，不重复添加。

- [ ] **Step 4: 调整关键页面按钮**

逐个处理脚本命中的按钮：

```tsx
<Button className="whitespace-nowrap" type="button" variant="outline">
  <Search aria-hidden="true" size={16} />
  查询
</Button>

<Button
  aria-label="查看详情"
  className="h-8 w-8 min-h-8 p-0"
  size="icon"
  title="详情"
  type="button"
  variant="ghost"
>
  <Eye aria-hidden="true" size={16} />
</Button>
```

列表行操作使用纯 icon；筛选区、详情页主命令、追踪页解析按钮使用 icon + 文案。

- [ ] **Step 5: 运行按钮检查和现有测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test:buttons
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx src/features/records/RecordQueryView.test.tsx
```

Expected: `button governance check passed`；关键页面测试 PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/test/button-governance-check.mjs apps/admin-web/package.json apps/admin-web/src/components/ui/button.tsx apps/admin-web/src/features/permissions/PermissionManagementView.tsx apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx apps/admin-web/src/features/settings/SystemSettingsView.tsx apps/admin-web/src/features/records/RecordQueryView.tsx
git commit -m "test: add button governance checks"
```

## Task 7: 版本、文档和当前执行入口

**Files:**
- Modify: `IMPLEMENTATION_PLAN.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/api/src/version/version.controller.ts`
- Modify: `apps/api/test/version.controller.e2e-spec.ts`
- Modify: `deploy/docker-compose.yml`
- Modify: `deploy/install.sh`
- Modify: `deploy/server.env.example`

- [ ] **Step 1: 更新根目录执行入口**

把 `IMPLEMENTATION_PLAN.md` 改为：

```md
# Feishu IAM v0.16.1 追踪闭环、组织用户选择器与按钮治理实施计划

本文件是当前分支的执行入口。详细工程计划见：

```text
docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.1-trace-selector-buttons.md
```

## 目标

发布 `v0.16.1`，收口 GitLab `#35/#26/#32/#33/#34`：

1. 后台未登录、非法 session、过期 session、管理员不可用、权限不足的 request id 可在追踪页查到。
2. 追踪页支持本地粘贴问题信息并提取 request id，不上传、不保存原文。
3. 组织用户选择器按 `v0.16.1` Pencil 原型展示根级组织、下钻、同列表、已选展示、搜索、390px 和状态矩阵。
4. 按钮治理收口为轻量规则和自动检查。

## 当前版本不做

- 不新增 DDL，不改变管理员 session 校验机制。
- 不上传或保存整页问题信息原文。
- 不做全站 UI 重构，不扩展 SSO 协议面。

## 验证命令

```bash
pnpm --filter @feishu-iam/api test -- test/admin-error.filter.spec.ts test/admin-trace.service.spec.ts test/admin.controller.e2e-spec.ts test/iam-role.service.spec.ts test/version.controller.e2e-spec.ts
pnpm --filter @feishu-iam/admin-web test -- src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx src/features/permissions/PermissionManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx
pnpm --filter @feishu-iam/admin-web test:buttons
pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```
```

- [ ] **Step 2: 更新版本号**

把以下文件中的版本改为 `0.16.1` 或 `v0.16.1`：

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

Run:

```bash
rg -n "v0\\.16\\.0|0\\.16\\.0" package.json apps/api/package.json apps/admin-web/package.json apps/api/src/version deploy
```

Expected: 只允许历史文档命中；当前版本和部署默认值不再是 `0.16.0`。

- [ ] **Step 3: 更新 README / CHANGELOG / AGENTS**

`CHANGELOG.md` 顶部新增：

```md
## v0.16.1

- 收口 GitLab issue `#35/#26/#32/#33/#34`。
- 后台认证/授权失败写入可追踪安全事件，统一问题页 request id 可在追踪页查询。
- 追踪页支持本地粘贴问题信息并提取 request id，不上传、不保存、不记录原文。
- 组织用户选择器按 v0.16.1 Pencil 原型展示已选主体名称、头像/图标、类型、路径和 orphaned 状态。
- 按钮治理新增轻量检查，列表行操作、筛选区、详情页和组织浏览按钮不换行且具备可访问标签。
- 安全边界：不记录或展示 cookie、token、authorization、raw payload、secret、授权码、token hash、state hash。
```

`README.md` 版本历史表新增 `v0.16.1` 行，链接本计划、Pencil 原型说明和截图目录。

`AGENTS.md` 当前阶段改为 `v0.16.1` 实施中或已完成，并补充不回退项。

- [ ] **Step 4: 运行文档敏感词和占位符检查**

Run:

```bash
node - <<'NODE'
const fs = require('node:fs');
const files = [
  'README.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'IMPLEMENTATION_PLAN.md',
  'docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.1-trace-selector-buttons.md'
];
const bad = ['T' + 'ODO', 'TB' + 'D', 'PLACE' + 'HOLDER', '真实' + '密码', '明文' + '密钥'];
const hits = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const word of bad) {
    if (text.includes(word)) hits.push(`${file}: contains ${word}`);
  }
}
if (hits.length > 0) {
  console.error(hits.join('\n'));
  process.exit(1);
}
NODE
rg -n "cookie|token|authorization|raw payload|secret|授权码|token hash|state hash" README.md CHANGELOG.md AGENTS.md IMPLEMENTATION_PLAN.md docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.1-trace-selector-buttons.md
```

Expected: 第一条无命中；第二条只命中安全边界说明，不命中真实凭证值。

- [ ] **Step 5: Commit**

```bash
git add IMPLEMENTATION_PLAN.md README.md CHANGELOG.md AGENTS.md package.json apps/api/package.json apps/admin-web/package.json apps/api/src/version/version.controller.ts apps/api/test/version.controller.e2e-spec.ts deploy/docker-compose.yml deploy/install.sh deploy/server.env.example
git commit -m "chore: prepare v0.16.1 release materials"
```

## Task 8: 全量验证、Browser 自检和 112 验收

**Files:**
- Add: `docs/codex-sessions/2026-05-29-1800-v0.16.1实施收口.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 运行后端定向测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin-error.filter.spec.ts test/admin-trace.service.spec.ts test/admin.controller.e2e-spec.ts test/iam-role.service.spec.ts test/version.controller.e2e-spec.ts
```

Expected: PASS；日志和断言不包含敏感原文。

- [ ] **Step 2: 运行前端定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx src/features/permissions/PermissionManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx src/features/applications/ApplicationManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web test:buttons
```

Expected: PASS；按钮检查输出 `button governance check passed`。

- [ ] **Step 3: 运行全量检查**

Run:

```bash
pnpm check
pnpm --filter @feishu-iam/admin-web build
pnpm --filter @feishu-iam/admin-web test:responsive
```

Expected: 全部 PASS；responsive 检查没有 390px 溢出。

- [ ] **Step 4: 启动本地环境**

Run:

```bash
pnpm dev
```

Expected: API 和 admin-web 启动成功，本地入口可访问。

- [ ] **Step 5: Browser 自检**

使用 Browser 打开 `http://localhost:3000/` 或当前 dev server 实际 URL，检查：

```text
1. 未登录后台问题页展示 request id，可复制。
2. 操作审计 / 追踪 Tab 可粘贴问题信息并只提取 request id。
3. 角色详情 / 组织与用户绑定 Tab 桌面态显示根级组织、下钻、搜索、同列表和已选主体 display 字段。
4. 390px 下显示待选 / 已选 / 摘要分步，不把双栏压进一屏。
5. 飞书同步页组织用户浏览只读，不显示选择、已选或保存主体绑定。
6. 列表行操作 icon-only 有 title 或 tooltip，非紧凑命令按钮 icon + 文案且不换行。
7. Console 无非预期错误，Network 无非预期 5xx。
```

- [ ] **Step 6: 生产构建镜像**

Run:

```bash
docker buildx build --platform linux/amd64 -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.1 --load .
docker save dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.1 | gzip > feishu-iam-v0.16.1-linux-amd64.tar.gz
```

Expected: 镜像构建成功，生成 amd64 离线包。

- [ ] **Step 7: 192.168.2.112 停机升级验证**

Run:

```bash
scp feishu-iam-v0.16.1-linux-amd64.tar.gz dev@192.168.2.112:~/feishu-iam/
ssh dev@192.168.2.112 'cd ~/feishu-iam && gunzip -c feishu-iam-v0.16.1-linux-amd64.tar.gz | docker load && FEISHU_IAM_PULL_POLICY=never ./upgrade.sh'
curl -fsS http://192.168.2.112/api/health
curl -fsS http://192.168.2.112/api/version
```

Expected: `/api/version` 返回 `0.16.1`；后台未登录 request id 可在追踪页查到；角色绑定选择器和飞书同步只读浏览可用。

- [ ] **Step 8: GitLab issue 验收评论**

对 `#35/#26/#32/#33/#34` 分别评论：

```text
已在 v0.16.1 收口。
验证：
- 本地测试：列出相关 pnpm 命令。
- Browser：列出关键页面和 390px 验证。
- 112：列出 /api/health、/api/version 和关键手工验收结果。
安全边界：未记录 cookie、token、authorization、raw payload、secret、授权码、token hash、state hash。
```

- [ ] **Step 9: 会话归档**

创建 `docs/codex-sessions/2026-05-29-1800-v0.16.1实施收口.md`，内容至少包含：

```md
# v0.16.1 实施收口

## 会话目标

实现并验证 Feishu IAM v0.16.1，收口 #35/#26/#32/#33/#34。

## 关键约束

- 不新增 DDL。
- 不记录敏感凭证或 raw payload。
- 组织用户选择器以 v0.16.1 Pencil 原型为验收基线。

## 修改文件

列出本轮实际修改文件。

## 验证结果

列出测试、Browser、按钮检查、responsive、112 验收结果。

## 未完成事项

列出未发布、未部署或 issue 未关闭的事项。
```

- [ ] **Step 10: Commit**

```bash
git add docs/codex-sessions README.md CHANGELOG.md
git commit -m "docs: record v0.16.1 verification"
```

## Parallelization Plan

```text
Lane A 后端追踪：
  Task 1 -> Task 2

Lane B 组织用户选择器：
  Task 4 -> Task 5

Lane C 按钮治理：
  Task 6

Lane D 文档版本：
  Task 7 在 A/B/C 合并后执行
  Task 8 最后执行
```

推荐使用 `superpowers:subagent-driven-development`。Task 1/2、Task 4/5、Task 6 可以分 worktree 并行；Task 7/8 等前面实现和验证结果完成后再执行。

## Verification Matrix

| 需求 | 主要任务 | 验证 |
|---|---|---|
| #35 request id 可追踪 | Task 1, Task 2 | `admin-error.filter.spec.ts`、`admin.controller.e2e-spec.ts`、`admin-trace.service.spec.ts` |
| #35 本地解析问题信息 | Task 3 | `trace-format.test.ts`、`RecordQueryView.test.tsx` |
| #35 敏感信息不泄露 | Task 1, Task 2, Task 3 | JSON stringify 断言、服务端脱敏测试、文档敏感词检查 |
| #26 display data contract | Task 4 | `iam-role.service.spec.ts`、前端 typecheck |
| #26 Pencil 原型交互 | Task 5 | `PermissionManagementView.test.tsx`、Browser 桌面和 390px |
| 飞书同步只读语义 | Task 5 | `SystemSettingsView.test.tsx`、Browser 飞书同步页 |
| #32/#33/#34 按钮治理 | Task 6 | `test:buttons`、关键页面测试、Browser 视觉检查 |
| 版本和发布材料 | Task 7, Task 8 | `rg` 检查、`/api/version`、112 验收 |

## Completion Criteria

- `pnpm check` PASS。
- `pnpm --filter @feishu-iam/admin-web test:buttons` PASS。
- `pnpm --filter @feishu-iam/admin-web test:responsive` PASS。
- Browser 自检覆盖未登录问题页、追踪页、角色组织用户绑定、飞书同步只读浏览和 390px。
- `192.168.2.112` `/api/health` 正常，`/api/version` 返回 `0.16.1`。
- README、CHANGELOG、AGENTS、`IMPLEMENTATION_PLAN.md`、会话归档已更新。
- GitLab `#35/#26/#32/#33/#34` 均有验收评论。
- 最终 diff 不包含真实密钥、token、cookie、authorization、raw payload 或其他敏感凭证。
