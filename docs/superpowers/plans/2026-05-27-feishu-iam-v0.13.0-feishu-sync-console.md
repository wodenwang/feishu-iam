# Feishu IAM v0.13.0 飞书同步运维控制台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 `系统管理 / 飞书同步` 运维控制台，让管理员能查询本地飞书镜像、定位同步问题、执行用户级和部门级轻量同步，并把全量同步收入口令式强确认。

**Architecture:** 后端在现有 `feishu` 与 `admin` 模块内新增本地镜像查询、权限矩阵、审计封装和局部同步能力，不新增 DDL。前端重构飞书同步页面为紧凑总览 + `组织与用户` / `同步历史` / `字段诊断` / `高级操作` 四标签，复用 shadcn/ui、现有 `PageHeader`、`DataTable`、`DetailSheet`、`ConfirmDialog` 和 URL 状态模式。

**Tech Stack:** NestJS、Prisma、Vitest、React 19、Vite、Tailwind、shadcn/ui、lucide-react、@Browser/gstack browse 验证。

---

## 1. 事实基线和边界

本计划承接以下文件：

- `docs/superpowers/specs/2026-05-27-feishu-iam-v0.13.0-feishu-sync-console.md`
- `docs/superpowers/reviews/2026-05-27-feishu-iam-v0.13.0-feishu-sync-console-eng-review.md`
- `design/v0.13.0-feishu-sync-console-prototype.md`
- `design/admin-console-v0.13.0.pen`

硬边界：

- 不新增 Prisma migration，不改数据库 schema。
- 不恢复前端注入 `PLATFORM_ADMIN_TOKEN` 或破窗 Web 登录。
- 不实现飞书角色同步、用户组同步、ABAC、资源级权限、完整 OIDC、HTTPS、反向代理或高可用。
- 用户级和部门级轻量同步必须真实可用；如果飞书直读接口不可用，采用基于本地关系的部门局部刷新 fallback，并返回稳定失败，不伪造成功。
- 全量同步生产验收默认只验证预确认路径，真实全量同步需要部署时再次明确授权。

## 2. 文件结构

### 后端

- Modify: `apps/api/src/admin/admin-permission.service.ts`
  - 拆分飞书同步查看、镜像查询、轻量同步、全量同步权限。
- Modify: `apps/api/src/admin/admin-feishu.controller.ts`
  - 管理端 API 聚合层，路由、权限、审计上下文、稳定错误。
- Create: `apps/api/src/admin/admin-feishu-audit.ts`
  - 构造飞书同步审计上下文和审计 payload，避免 controller 里复制审计字段。
- Create: `apps/api/src/feishu/feishu-mirror-query.service.ts`
  - 只读本地镜像查询、详情 DTO、脱敏、分页。
- Modify: `apps/api/src/feishu/feishu-status.service.ts`
  - 支持同步历史分页、运行中摘要、preflight 所需最近 run。
- Modify: `apps/api/src/feishu/feishu-sync.service.ts`
  - 增加用户级和部门级轻量同步、全量同步确认校验、局部刷新不全局 cleanup。
- Modify: `apps/api/src/feishu/feishu-client.ts`
  - 增加可选用户详情/部门详情读取接口；若实现阶段确认不可用，则轻量同步使用部门刷新 fallback。
- Modify: `apps/api/src/feishu/feishu-http.client.ts`
  - 实现新增飞书只读接口或保留 fallback 所需的现有列表接口。
- Modify: `apps/api/src/feishu/feishu.module.ts`
  - 注册 `FeishuMirrorQueryService`。
- Test: `apps/api/test/admin-permission.service.spec.ts`
- Test: `apps/api/test/admin-feishu.controller.e2e-spec.ts`
- Test: `apps/api/test/feishu-mirror-query.service.spec.ts`
- Test: `apps/api/test/feishu-sync.service.spec.ts`
- Test: `apps/api/test/feishu-http.client.spec.ts`

### 前端

- Modify: `apps/admin-web/src/api/feishu.ts`
  - 新增 overview、部门、用户、轻量同步、preflight API 类型和方法。
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.tsx`
  - 飞书同步页重构为四标签工作区。
- Create: `apps/admin-web/src/features/settings/FeishuSyncConsole.tsx`
  - 页面主体组合：健康条、标签页、查询、历史、诊断、高级操作。
- Create: `apps/admin-web/src/features/settings/FeishuOrgUsersTab.tsx`
  - 部门树、用户列表、详情工作区、窄屏钻取。
- Create: `apps/admin-web/src/features/settings/FeishuSyncHistoryTab.tsx`
  - 同步历史列表和详情入口。
- Create: `apps/admin-web/src/features/settings/FeishuDiagnosticsTab.tsx`
  - 字段诊断、轻量同步状态、权限提示。
- Create: `apps/admin-web/src/features/settings/FeishuAdvancedOpsTab.tsx`
  - 全量同步预确认和运行中互斥状态。
- Modify: `apps/admin-web/src/features/settings/SystemSyncRunDetailSheet.tsx`
  - 详情展示增强：统计、阶段、request id、审计摘要、诊断建议。
- Modify: `apps/admin-web/src/features/settings/settings-format.ts`
  - 新增镜像状态、同步来源、权限提示、脱敏展示格式化。
- Test: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`
- Test: `apps/admin-web/src/features/settings/settings-format.test.ts`

### 文档和版本

- Modify: `IMPLEMENTATION_PLAN.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Create/Modify: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.13.0飞书同步运维控制台.md`

## 3. Vertical Slice 切分

### Slice 1：只读镜像查询控制台

目标：后端提供 overview、部门/用户查询和详情；前端展示四标签骨架、紧凑健康条、组织与用户只读排障工作区。该 slice 不触发任何同步写操作。

完成后应能：

- `platform_admin` 和 `sync_admin` 查询用户/部门详情。
- `audit_viewer` 只能看总览、历史和诊断，不能看用户/部门 PII 详情。
- 前端不再把全量同步作为默认主操作。

### Slice 2：同步历史、字段诊断和权限/审计边界

目标：同步历史分页与详情增强、字段诊断页增强、触发类审计封装完成。

完成后应能：

- 历史详情展示失败阶段、request id、错误码和诊断建议。
- 403/404/409/400 均有稳定中文错误。
- 审计结构可复用到轻量同步和全量同步。

### Slice 3：用户级和部门级轻量同步

目标：实现真实用户级/部门级局部刷新，写同步 run 和审计，不执行全局 cleanup。

完成后应能：

- 对单个部门刷新直属子部门、直属用户和相关关系。
- 对单个用户通过直读接口或部门 fallback 刷新目标用户。
- 已有运行中时拒绝新同步并返回稳定错误。

### Slice 4：全量同步强确认、窄屏、验证和发布材料

目标：全量同步 preflight + 后端二次确认，完成窄屏钻取、测试、Browser 自检、review、ship、land-and-deploy。

完成后应能：

- 全量同步仅 `platform_admin` 可触发。
- 前端必须输入当前 latest run id 才能提交。
- 生产验收默认不触发真实全量同步。

## 4. 任务清单

### Task 1: 后端权限矩阵

**Files:**
- Modify: `apps/api/src/admin/admin-permission.service.ts`
- Test: `apps/api/test/admin-permission.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/api/test/admin-permission.service.spec.ts` 增加用例，覆盖飞书同步新权限：

```ts
import { describe, expect, it } from 'vitest';
import { AdminPermissionService } from '../src/admin/admin-permission.service';
import type { AdminContext } from '../src/admin/admin.types';

function context(roles: AdminContext['roles']): AdminContext {
  return {
    adminUserId: 'admin-1',
    feishuUserId: 'ou_admin',
    displayName: '管理员',
    roles,
    applicationIds: []
  };
}

describe('AdminPermissionService feishu sync permissions', () => {
  const service = new AdminPermissionService();

  it('allows platform_admin to view mirror, trigger light sync and trigger full sync', () => {
    const admin = context(['platform_admin']);
    expect(service.canViewFeishuSync(admin)).toBe(true);
    expect(service.canQueryFeishuMirror(admin)).toBe(true);
    expect(service.canTriggerFeishuLightSync(admin)).toBe(true);
    expect(service.canTriggerFeishuFullSync(admin)).toBe(true);
  });

  it('allows sync_admin to query mirror and trigger light sync but not full sync', () => {
    const admin = context(['sync_admin']);
    expect(service.canViewFeishuSync(admin)).toBe(true);
    expect(service.canQueryFeishuMirror(admin)).toBe(true);
    expect(service.canTriggerFeishuLightSync(admin)).toBe(true);
    expect(service.canTriggerFeishuFullSync(admin)).toBe(false);
    expect(() => service.assertCanTriggerFeishuFullSync(admin)).toThrow('当前管理员无权触发飞书全量同步');
  });

  it('allows audit_viewer to view sync history but not query PII mirror or trigger sync', () => {
    const admin = context(['audit_viewer']);
    expect(service.canViewFeishuSync(admin)).toBe(true);
    expect(service.canQueryFeishuMirror(admin)).toBe(false);
    expect(service.canTriggerFeishuLightSync(admin)).toBe(false);
    expect(service.canTriggerFeishuFullSync(admin)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-permission.service.spec.ts
```

Expected: FAIL，缺少 `canViewFeishuSync`、`canQueryFeishuMirror`、`canTriggerFeishuLightSync`、`canTriggerFeishuFullSync`。

- [ ] **Step 3: 实现权限方法**

在 `apps/api/src/admin/admin-permission.service.ts` 增加方法：

```ts
  canViewFeishuSync(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'sync_admin') || hasRole(context, 'audit_viewer');
  }

  assertCanViewFeishuSync(context: AdminContext): void {
    if (!this.canViewFeishuSync(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看飞书同步信息', 403);
    }
  }

  canQueryFeishuMirror(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'sync_admin');
  }

  assertCanQueryFeishuMirror(context: AdminContext): void {
    if (!this.canQueryFeishuMirror(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看飞书组织和用户详情', 403);
    }
  }

  canTriggerFeishuLightSync(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'sync_admin');
  }

  assertCanTriggerFeishuLightSync(context: AdminContext): void {
    if (!this.canTriggerFeishuLightSync(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权触发飞书轻量同步', 403);
    }
  }

  canTriggerFeishuFullSync(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin');
  }

  assertCanTriggerFeishuFullSync(context: AdminContext): void {
    if (!this.canTriggerFeishuFullSync(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权触发飞书全量同步', 403);
    }
  }
```

保留旧 `canTriggerFeishuSync()` 作为兼容包装，但内部改为调用 `canTriggerFeishuFullSync()`，避免旧全量同步路径继续允许 `sync_admin`。

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-permission.service.spec.ts
```

Expected: PASS。

### Task 2: 后端本地镜像查询服务

**Files:**
- Create: `apps/api/src/feishu/feishu-mirror-query.service.ts`
- Modify: `apps/api/src/feishu/feishu.module.ts`
- Test: `apps/api/test/feishu-mirror-query.service.spec.ts`

- [ ] **Step 1: 写失败测试**

新增 `apps/api/test/feishu-mirror-query.service.spec.ts`，用内存 fake Prisma 验证 DTO、脱敏和分页：

```ts
import { describe, expect, it } from 'vitest';
import { FeishuMirrorQueryService, maskEmail, maskMobile } from '../src/feishu/feishu-mirror-query.service';

describe('FeishuMirrorQueryService masking', () => {
  it('masks email and mobile for browser DTOs', () => {
    expect(maskEmail('zhangsan@example.com')).toBe('z***n@example.com');
    expect(maskMobile('13800138000')).toBe('138****8000');
    expect(maskEmail(null)).toBeNull();
    expect(maskMobile(null)).toBeNull();
  });
});
```

同文件继续增加 service 行为测试，fake `feishuUser.findMany`、`feishuDepartment.findMany`、`count`、`findUnique`，断言不返回 `rawPayload`。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- feishu-mirror-query.service.spec.ts
```

Expected: FAIL，服务文件不存在。

- [ ] **Step 3: 创建服务和 DTO**

创建 `apps/api/src/feishu/feishu-mirror-query.service.ts`：

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { FeishuDepartment, FeishuUser, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PageInput = {
  page?: number;
  pageSize?: number;
};

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type FeishuMirrorUserSummary = {
  userId: string;
  name: string;
  emailMasked: string | null;
  mobileMasked: string | null;
  isActive: boolean;
  isDeleted: boolean;
  lastSyncedAt: Date;
};

export type FeishuMirrorDepartmentSummary = {
  departmentId: string;
  openDepartmentId: string | null;
  parentDepartmentId: string | null;
  name: string;
  isDeleted: boolean;
  lastSyncedAt: Date;
};

@Injectable()
export class FeishuMirrorQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(input: PageInput & { keyword?: string; departmentId?: string }): Promise<PageResult<FeishuMirrorUserSummary>> {
    const { page, pageSize, skip, take } = normalizePage(input);
    const keyword = normalizeKeyword(input.keyword);
    const where: Prisma.FeishuUserWhereInput = {
      ...(keyword
        ? {
            OR: [
              { userId: { contains: keyword, mode: 'insensitive' } },
              { name: { contains: keyword, mode: 'insensitive' } },
              { email: { contains: keyword, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(input.departmentId
        ? {
            userDepartments: {
              some: { departmentId: input.departmentId, isDeleted: false }
            }
          }
        : {})
    };
    const [total, users] = await Promise.all([
      this.prisma.feishuUser.count({ where }),
      this.prisma.feishuUser.findMany({
        where,
        orderBy: [{ isDeleted: 'asc' }, { name: 'asc' }],
        skip,
        take,
        select: {
          userId: true,
          name: true,
          email: true,
          mobile: true,
          isActive: true,
          isDeleted: true,
          lastSyncedAt: true
        }
      })
    ]);
    return { page, pageSize, total, items: users.map(toUserSummary) };
  }

  async getUser(userId: string) {
    const user = await this.prisma.feishuUser.findUnique({
      where: { userId },
      include: {
        userDepartments: {
          where: { isDeleted: false },
          include: { department: true },
          orderBy: [{ isPrimary: 'desc' }, { departmentId: 'asc' }]
        }
      }
    });
    if (!user) {
      throw new NotFoundException({ error: { code: 'FEISHU_USER_NOT_FOUND', message: '飞书用户不存在' } });
    }
    return {
      ...toUserSummary(user),
      openId: user.openId,
      unionId: user.unionId,
      enName: user.enName,
      employeeNo: user.employeeNo,
      employeeType: user.employeeType,
      jobTitle: user.jobTitle,
      leaderUserId: user.leaderUserId,
      loginEligible: user.isActive && !user.isDeleted,
      loginBlockReason: user.isActive && !user.isDeleted ? null : '该用户在本地镜像中不可登录',
      departments: user.userDepartments.map((relation) => ({
        departmentId: relation.departmentId,
        name: relation.department.name,
        isPrimary: relation.isPrimary,
        isDeleted: relation.department.isDeleted
      }))
    };
  }

  async listDepartments(input: PageInput & { keyword?: string; parentDepartmentId?: string | null }): Promise<PageResult<FeishuMirrorDepartmentSummary>> {
    const { page, pageSize, skip, take } = normalizePage(input);
    const keyword = normalizeKeyword(input.keyword);
    const where: Prisma.FeishuDepartmentWhereInput = {
      ...(keyword
        ? {
            OR: [
              { departmentId: { contains: keyword, mode: 'insensitive' } },
              { name: { contains: keyword, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(input.parentDepartmentId !== undefined ? { parentDepartmentId: input.parentDepartmentId } : {})
    };
    const [total, departments] = await Promise.all([
      this.prisma.feishuDepartment.count({ where }),
      this.prisma.feishuDepartment.findMany({
        where,
        orderBy: [{ isDeleted: 'asc' }, { name: 'asc' }],
        skip,
        take,
        select: {
          departmentId: true,
          openDepartmentId: true,
          parentDepartmentId: true,
          name: true,
          isDeleted: true,
          lastSyncedAt: true
        }
      })
    ]);
    return { page, pageSize, total, items: departments.map(toDepartmentSummary) };
  }
}

export function maskEmail(value: string | null): string | null {
  if (!value) return null;
  const [local, domain] = value.split('@');
  if (!domain || local.length <= 2) return `***@${domain ?? 'unknown'}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function maskMobile(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function toUserSummary(user: Pick<FeishuUser, 'userId' | 'name' | 'email' | 'mobile' | 'isActive' | 'isDeleted' | 'lastSyncedAt'>): FeishuMirrorUserSummary {
  return {
    userId: user.userId,
    name: user.name,
    emailMasked: maskEmail(user.email),
    mobileMasked: maskMobile(user.mobile),
    isActive: user.isActive,
    isDeleted: user.isDeleted,
    lastSyncedAt: user.lastSyncedAt
  };
}

function toDepartmentSummary(department: Pick<FeishuDepartment, 'departmentId' | 'openDepartmentId' | 'parentDepartmentId' | 'name' | 'isDeleted' | 'lastSyncedAt'>): FeishuMirrorDepartmentSummary {
  return {
    departmentId: department.departmentId,
    openDepartmentId: department.openDepartmentId,
    parentDepartmentId: department.parentDepartmentId,
    name: department.name,
    isDeleted: department.isDeleted,
    lastSyncedAt: department.lastSyncedAt
  };
}

function normalizePage(input: PageInput) {
  const page = Math.max(1, Number(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize ?? 20)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function normalizeKeyword(keyword: string | undefined): string {
  return keyword?.trim().slice(0, 80) ?? '';
}
```

后续实现部门详情时在该服务补 `getDepartment()`，返回父部门、直属子部门和直属用户摘要；禁止返回 `rawPayload`。

- [ ] **Step 4: 注册服务并运行测试**

在 `apps/api/src/feishu/feishu.module.ts` providers 中加入 `FeishuMirrorQueryService`。

Run:

```bash
pnpm --filter @feishu-iam/api test -- feishu-mirror-query.service.spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS。

### Task 3: 管理端 Feishu API 升级

**Files:**
- Modify: `apps/api/src/admin/admin-feishu.controller.ts`
- Create: `apps/api/src/admin/admin-feishu-audit.ts`
- Test: `apps/api/test/admin-feishu.controller.e2e-spec.ts`

- [ ] **Step 1: 写 e2e 失败测试**

在 `apps/api/test/admin-feishu.controller.e2e-spec.ts` 覆盖：

```ts
it('allows sync_admin to query local feishu users but denies audit_viewer PII detail', async () => {
  await request(app.getHttpServer())
    .get('/api/v1/admin/feishu/users?keyword=张三')
    .set('Cookie', syncAdminCookie)
    .expect(200)
    .expect((response) => {
      expect(response.body.items[0]).toMatchObject({ userId: 'ou_zhangsan', name: '张三' });
      expect(response.body.items[0].rawPayload).toBeUndefined();
    });

  await request(app.getHttpServer())
    .get('/api/v1/admin/feishu/users/ou_zhangsan')
    .set('Cookie', auditViewerCookie)
    .expect(403)
    .expect((response) => {
      expect(response.body.error.message).toBe('当前管理员无权查看飞书组织和用户详情');
    });
});
```

同文件增加全量同步确认测试：

```ts
it('requires platform_admin and matching latest run id before full sync starts', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/admin/feishu/sync-runs')
    .set('Cookie', syncAdminCookie)
    .send({ confirmLatestRunId: 'run-1' })
    .expect(403);

  await request(app.getHttpServer())
    .post('/api/v1/admin/feishu/sync-runs')
    .set('Cookie', platformAdminCookie)
    .send({})
    .expect(400)
    .expect((response) => {
      expect(response.body.error.code).toBe('FEISHU_FULL_SYNC_CONFIRMATION_REQUIRED');
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-feishu.controller.e2e-spec.ts
```

Expected: FAIL，缺少新 DTO、权限和确认逻辑。

- [ ] **Step 3: 改造 controller**

将 `AdminFeishuController` 注入 `FeishuMirrorQueryService` 和 `AuditLogService`，并调整：

```ts
  @Get('/overview')
  async getOverview(@Req() request: Request) {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanViewFeishuSync(context);
    return sanitizeFeishuStatus(await this.statusService.getStatus());
  }

  @Get('/users')
  async listUsers(@Query() query: { keyword?: string; department_id?: string; page?: string; page_size?: string }, @Req() request: Request) {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanQueryFeishuMirror(context);
    return this.mirrorQuery.listUsers({
      keyword: query.keyword,
      departmentId: query.department_id,
      page: Number(query.page ?? 1),
      pageSize: Number(query.page_size ?? 20)
    });
  }

  @Get('/users/:userId')
  async getUser(@Param('userId') userId: string, @Req() request: Request) {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanQueryFeishuMirror(context);
    return this.mirrorQuery.getUser(userId);
  }
```

对 `/departments` 和 `/departments/:departmentId` 使用同样权限和服务。旧 `assertCanSearchFeishuCandidates()` 删除或仅保留给应用授权候选接口，不再用于系统飞书同步控制台。

- [ ] **Step 4: 全量同步预确认**

增加：

```ts
  @Post('/sync-runs/preflight')
  async preflightFullSync(@Req() request: Request) {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanTriggerFeishuFullSync(context);
    const status = await this.statusService.getStatus();
    return {
      running: status.running,
      latestRun: status.latestRun,
      counts: status.counts,
      requiredLatestRunId: status.latestRun?.id ?? 'NO_SYNC_RUN'
    };
  }
```

修改 `createSyncRun()`：读取 body 中 `confirmLatestRunId`，校验当前 latest run id；缺失返回 `FEISHU_FULL_SYNC_CONFIRMATION_REQUIRED`，不匹配返回 `FEISHU_FULL_SYNC_CONFIRMATION_MISMATCH`。

- [ ] **Step 5: 审计封装**

创建 `apps/api/src/admin/admin-feishu-audit.ts`：

```ts
import type { Request } from 'express';
import type { AdminContext } from './admin.types';

export function buildAdminFeishuAuditContext(request: Request, context: AdminContext) {
  return {
    actorType: 'admin_user',
    actorId: context.adminUserId,
    source: 'admin_web',
    requestId: String(request.headers['x-request-id'] ?? crypto.randomUUID()),
    ip: request.ip,
    userAgent: request.headers['user-agent']
  };
}
```

controller 的触发类操作使用 `AuditLogService.record()` 写成功和失败审计，`after` 只写 run id、目标 ID、统计和稳定错误码。

- [ ] **Step 6: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-feishu.controller.e2e-spec.ts
pnpm --filter @feishu-iam/api test -- admin-permission.service.spec.ts feishu-status.service.spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS。

### Task 4: 轻量同步服务

**Files:**
- Modify: `apps/api/src/feishu/feishu-sync.service.ts`
- Modify: `apps/api/src/feishu/feishu-client.ts`
- Modify: `apps/api/src/feishu/feishu-http.client.ts`
- Test: `apps/api/test/feishu-sync.service.spec.ts`
- Test: `apps/api/test/feishu-http.client.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/api/test/feishu-sync.service.spec.ts` 增加：

```ts
it('runs department light sync without global cleanup', async () => {
  const result = await service.runDepartmentLightSync({
    departmentId: 'od-sales',
    triggeredBy: 'admin-1',
    triggerSource: 'admin_web_department_light'
  });

  expect(result.status).toBe('success');
  expect(prisma.feishuDepartment.updateMany).not.toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ departmentId: { notIn: expect.any(Array) } }) })
  );
  expect(prisma.feishuUser.updateMany).not.toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ userId: { notIn: expect.any(Array) } }) })
  );
});

it('rejects user light sync when another sync is running', async () => {
  prisma.feishuSyncRun.create.mockRejectedValueOnce({ code: 'P2002' });
  await expect(service.runUserLightSync({
    userId: 'ou_zhangsan',
    triggeredBy: 'admin-1',
    triggerSource: 'admin_web_user_light'
  })).rejects.toMatchObject({ code: 'FEISHU_API_ERROR' });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- feishu-sync.service.spec.ts
```

Expected: FAIL，缺少 `runDepartmentLightSync()` 和 `runUserLightSync()`。

- [ ] **Step 3: 抽取局部 upsert 能力**

在 `FeishuSyncService` 内新增 public 方法：

```ts
export type RunDepartmentLightSyncInput = {
  departmentId: string;
  triggeredBy: string;
  triggerSource: FeishuSyncTriggerSource;
};

export type RunUserLightSyncInput = {
  userId: string;
  triggeredBy: string;
  triggerSource: FeishuSyncTriggerSource;
};
```

实现原则：

- 调用现有 `createRunningRun()` 创建运行锁。
- 部门轻量同步调用 `listDepartmentChildren(target)` 和 `listDepartmentUsers(target)`，复用 `upsertDepartment()`、`upsertUser()`、`upsertUserDepartments()`。
- 用户轻量同步优先调用新增 `getUser()`；若未实现，则读取本地用户所属部门并逐个 `listDepartmentUsers()` 过滤目标用户。
- 成功时只更新 run 统计和 `finishedAt`。
- 失败时复用 `toClientError()` 写错误码、阶段和 request id。
- 不调用 `cleanupStaleDataAndMarkSuccess()`。

- [ ] **Step 4: 接入 controller 触发接口**

在 `AdminFeishuController` 增加：

```ts
  @Post('/sync-users/:userId')
  async syncUser(@Param('userId') userId: string, @Req() request: Request) {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanTriggerFeishuLightSync(context);
    return this.syncService.runUserLightSync({
      userId,
      triggeredBy: context.adminUserId,
      triggerSource: 'admin_web_user_light'
    });
  }

  @Post('/sync-departments/:departmentId')
  async syncDepartment(@Param('departmentId') departmentId: string, @Req() request: Request) {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanTriggerFeishuLightSync(context);
    return this.syncService.runDepartmentLightSync({
      departmentId,
      triggeredBy: context.adminUserId,
      triggerSource: 'admin_web_department_light'
    });
  }
```

同时补成功/失败审计。

- [ ] **Step 5: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- feishu-sync.service.spec.ts admin-feishu.controller.e2e-spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS。

### Task 5: 前端 API 和格式化

**Files:**
- Modify: `apps/admin-web/src/api/feishu.ts`
- Modify: `apps/admin-web/src/features/settings/settings-format.ts`
- Test: `apps/admin-web/src/features/settings/settings-format.test.ts`

- [ ] **Step 1: 写失败测试**

在 `settings-format.test.ts` 增加：

```ts
it('formats feishu operation permissions and light sync sources', () => {
  expect(formatFeishuTriggerSource('admin_web_user_light')).toBe('用户级轻量同步');
  expect(formatFeishuTriggerSource('admin_web_department_light')).toBe('部门级轻量同步');
  expect(formatFeishuTriggerSource('admin_web')).toBe('管理后台全量同步');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/settings/settings-format.test.ts
```

Expected: FAIL，缺少格式化方法。

- [ ] **Step 3: 扩展 API 类型**

在 `apps/admin-web/src/api/feishu.ts` 增加：

```ts
export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type FeishuMirrorUserSummary = {
  userId: string;
  name: string;
  emailMasked: string | null;
  mobileMasked: string | null;
  isActive: boolean;
  isDeleted: boolean;
  lastSyncedAt: string;
};

export type FeishuMirrorDepartmentSummary = {
  departmentId: string;
  openDepartmentId: string | null;
  parentDepartmentId: string | null;
  name: string;
  isDeleted: boolean;
  lastSyncedAt: string;
};

export type FeishuFullSyncPreflight = {
  running: boolean;
  latestRun: FeishuSyncRun | null;
  counts: FeishuStatus['counts'];
  requiredLatestRunId: string;
};
```

并新增函数：

```ts
export async function fetchFeishuUsers(query: { keyword?: string; departmentId?: string; page?: number; pageSize?: number }): Promise<PageResult<FeishuMirrorUserSummary>> {
  const params = new URLSearchParams();
  if (query.keyword?.trim()) params.set('keyword', query.keyword.trim());
  if (query.departmentId) params.set('department_id', query.departmentId);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('page_size', String(query.pageSize));
  return readJson<PageResult<FeishuMirrorUserSummary>>(`/api/v1/admin/feishu/users?${params.toString()}`);
}

export async function preflightFeishuFullSync(): Promise<FeishuFullSyncPreflight> {
  return readJson<FeishuFullSyncPreflight>('/api/v1/admin/feishu/sync-runs/preflight', { method: 'POST' });
}
```

原 `triggerFeishuSync()` 改为要求 `confirmLatestRunId` 参数。

- [ ] **Step 4: 扩展格式化并运行测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/settings/settings-format.test.ts
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS。

### Task 6: 前端飞书同步控制台只读骨架

**Files:**
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.tsx`
- Create: `apps/admin-web/src/features/settings/FeishuSyncConsole.tsx`
- Create: `apps/admin-web/src/features/settings/FeishuOrgUsersTab.tsx`
- Test: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `SystemSettingsView.test.tsx` 增加：

```tsx
it('renders compact feishu sync console with four tabs and no daily full sync primary action', async () => {
  render(<SystemSettingsView admin={platformAdmin} apiState={loadedApiState} feishuDetailState={loadedFeishuState} mode="feishu" onRefreshDiagnostics={vi.fn()} onSync={vi.fn()} />);

  expect(screen.getByRole('tab', { name: '组织与用户' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '同步历史' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '字段诊断' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '高级操作' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '全量同步' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '高级操作' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/settings/SystemSettingsView.test.tsx
```

Expected: FAIL，当前页面还不是四标签控制台。

- [ ] **Step 3: 新增 FeishuSyncConsole**

`FeishuSyncConsole.tsx` 接收 `state`、权限、事件回调，渲染：

```tsx
<section className="space-y-4" aria-label="飞书同步运维控制台">
  <div className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-[1fr_auto]">
    <div>
      <h2 className="text-base font-semibold">同步健康</h2>
      <p className="text-sm text-muted-foreground">展示配置、最近同步、运行中状态和本地镜像规模。</p>
    </div>
    <Button variant="outline" onClick={() => setTab('advanced')}>高级操作</Button>
  </div>
  <Tabs value={tab} onValueChange={setTab}>
    <TabsList>
      <TabsTrigger value="org">组织与用户</TabsTrigger>
      <TabsTrigger value="history">同步历史</TabsTrigger>
      <TabsTrigger value="diagnostics">字段诊断</TabsTrigger>
      <TabsTrigger value="advanced">高级操作</TabsTrigger>
    </TabsList>
    <TabsContent value="org"><FeishuOrgUsersTab /></TabsContent>
    <TabsContent value="history"><FeishuSyncHistoryTab /></TabsContent>
    <TabsContent value="diagnostics"><FeishuDiagnosticsTab /></TabsContent>
    <TabsContent value="advanced"><FeishuAdvancedOpsTab /></TabsContent>
  </Tabs>
</section>
```

实际代码要导入 shadcn `Tabs`、`Button`，并使用现有状态数据，不写 mock 数据。

- [ ] **Step 4: 接入 SystemSettingsView**

`SystemSettingsView` 在 `activeTab === "feishu"` 时渲染 `FeishuSyncConsole`，保留原运行信息页、版本页逻辑。

- [ ] **Step 5: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/settings/SystemSettingsView.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS。

### Task 7: 同步历史、字段诊断、高级操作和轻量同步 UI

**Files:**
- Create: `apps/admin-web/src/features/settings/FeishuSyncHistoryTab.tsx`
- Create: `apps/admin-web/src/features/settings/FeishuDiagnosticsTab.tsx`
- Create: `apps/admin-web/src/features/settings/FeishuAdvancedOpsTab.tsx`
- Modify: `apps/admin-web/src/features/settings/SystemSyncRunDetailSheet.tsx`
- Test: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`

- [ ] **Step 1: 写失败测试**

增加测试：

```tsx
it('requires current latest run id before full sync submit is enabled', async () => {
  const user = userEvent.setup();
  render(<SystemSettingsView admin={platformAdmin} apiState={loadedApiState} feishuDetailState={loadedFeishuState} mode="feishu" onRefreshDiagnostics={vi.fn()} onSync={vi.fn()} />);

  await user.click(screen.getByRole('tab', { name: '高级操作' }));
  expect(screen.getByRole('button', { name: '确认触发全量同步' })).toBeDisabled();
  await user.type(screen.getByLabelText('输入当前最新 run id'), loadedFeishuState.data.latestRun!.id);
  expect(screen.getByRole('button', { name: '确认触发全量同步' })).toBeEnabled();
});
```

- [ ] **Step 2: 实现三个 tab**

实现要求：

- `FeishuSyncHistoryTab` 用现有 `DataTable` 展示状态、触发来源、开始时间、结束时间、统计、错误码和详情按钮。
- `FeishuDiagnosticsTab` 展示登录必要字段、阻塞问题、警告、下一步建议，权限不足时禁用刷新。
- `FeishuAdvancedOpsTab` 先调用 preflight，显示影响范围、latest run id 输入、运行中禁用和后端二次确认错误。

- [ ] **Step 3: 接入轻量同步按钮**

用户详情和部门详情中的轻量同步按钮必须：

- `sync_admin` 和 `platform_admin` 可点击。
- `audit_viewer` 不渲染按钮，显示“仅可查看同步历史和诊断”。
- 请求中已有同步运行时显示稳定错误“已有飞书同步正在运行”。
- 成功后刷新对应详情和同步历史。

- [ ] **Step 4: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/settings/SystemSettingsView.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS。

### Task 8: 文档、版本、验证和发布收口

**Files:**
- Modify: `IMPLEMENTATION_PLAN.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify/Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.13.0飞书同步运维控制台.md`

- [ ] **Step 1: 更新根实施入口**

把 `IMPLEMENTATION_PLAN.md` 改为 v0.13.0 执行入口，指向本计划文件，并列出第一 vertical slice。

- [ ] **Step 2: 更新版本材料**

版本收口时把根包、API、admin-web、部署默认 tag、README、CHANGELOG 更新到 `0.13.0` / `v0.13.0`。在实现阶段未完成验证前不要提前声明已发布。

- [ ] **Step 3: 运行自动化验证**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-permission.service.spec.ts admin-feishu.controller.e2e-spec.ts feishu-mirror-query.service.spec.ts feishu-sync.service.spec.ts feishu-status.service.spec.ts feishu-http.client.spec.ts
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/admin-web test -- src/features/settings/SystemSettingsView.test.tsx src/features/settings/settings-format.test.ts
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web build
pnpm check
```

Expected: PASS。若 `pnpm check` 因环境或时间失败，必须记录失败原因和更窄范围替代验证。

- [ ] **Step 4: Browser 自检**

启动本地服务后用 `@Browser` 或 gstack `/browse` 打开：

```text
http://localhost:3000/admin/system/feishu
```

覆盖：

- 桌面宽度下四标签、组织与用户、历史、诊断、高级操作无遮挡。
- 窄屏下单列钻取可用，无按钮文字溢出。
- 用户级和部门级轻量同步按钮权限正确。
- 全量同步不输入 run id 时无法提交。
- Console 无新增错误，Network 无非预期失败。

- [ ] **Step 5: 后续 review loop**

按 harness SOP 继续：

```text
verification-before-completion -> browse verification -> design-review -> qa -> review -> Git closeout -> ship -> land-and-deploy
```

每个 review/QA 环节如发现问题，修复后重新运行同类 review，最多 10 轮；全部清零或人工接受后才能进入下一步。

## 5. 完成标准

- 规格、Pencil 原型、工程评审和本实施计划边界一致。
- `系统管理 / 飞书同步` 采用紧凑总览 + 四标签，不把全量同步放在日常主操作。
- 本地部门/用户查询、详情、同步历史、字段诊断和高级操作均可用。
- 用户级和部门级轻量同步真实触发后端局部刷新，写 run 和审计，不做全局 cleanup。
- 全量同步需要 `platform_admin` 和后端二次确认。
- 权限不足、运行中、目标不存在、飞书 API 错误都有稳定中文错误。
- 自动化验证、Browser 自检、design-review、qa、review 都有新鲜证据。
- README、CHANGELOG、AGENTS、会话归档和版本材料在发布前同步。

## 6. 自检

- Spec coverage：本计划覆盖同步总览、本地组织/用户查询、同步历史详情、字段诊断、轻量同步入口、全量同步强确认、权限/审计、安全错误展示和窄屏后台可用性。
- Placeholder scan：本文不包含 `TBD`、`TODO`、`implement later` 或未定义的占位任务。
- Type consistency：后端触发来源统一使用 `admin_web_user_light`、`admin_web_department_light`、`admin_web_diagnostics` 和 `admin_web`；前端格式化与 API 类型使用同名字段。
