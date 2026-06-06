# Feishu IAM v0.3.0 Permission Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Feishu IAM 的应用、权限组、权限点、IAM 角色、授权关系和权限计算闭环。

**Architecture:** 在 `apps/api/src/permission` 新建独立 NestJS 模块，承载权限模型校验、平台 API、权限计算和审计写入。数据库通过 Prisma schema 与 `migrations/V0_3_0__permission_model.sql` 保持一致，前端在现有管理端新增“应用与权限”区域并通过平台 token 调用 API。

**Tech Stack:** NestJS、Prisma、PostgreSQL、Vitest、React 19、Vite、TypeScript。

---

## 0. 文件结构

新增文件：

- `migrations/V0_3_0__permission_model.sql`：创建应用、权限组、权限点、角色、授权关系和审计日志表。
- `apps/api/src/permission/permission.module.ts`：NestJS 权限模块入口。
- `apps/api/src/permission/permission.types.ts`：共享类型、错误码、状态枚举。
- `apps/api/src/permission/permission.validators.ts`：`app_key`、权限 key、角色 key 和跨应用校验。
- `apps/api/src/permission/permission-error.filter.ts`：把领域错误转换为稳定 API 错误结构。
- `apps/api/src/permission/audit-log.service.ts`：审计日志写入。
- `apps/api/src/permission/application.service.ts`：应用 CRUD 和启禁用。
- `apps/api/src/permission/permission-catalog.service.ts`：权限组、权限点和组内权限点关系。
- `apps/api/src/permission/iam-role.service.ts`：IAM 角色、主体绑定、权限绑定。
- `apps/api/src/permission/permission-calculation.service.ts`：按 `app_key + user_id` 计算权限结果。
- `apps/api/src/permission/permission.controller.ts`：平台 API。
- `apps/api/test/permission.validators.spec.ts`：key 校验单测。
- `apps/api/test/permission-catalog.service.spec.ts`：权限目录服务单测。
- `apps/api/test/iam-role.service.spec.ts`：角色绑定服务单测。
- `apps/api/test/permission-calculation.service.spec.ts`：权限计算单测。
- `apps/api/test/permission.controller.e2e-spec.ts`：平台 API e2e 测试。
- `apps/admin-web/src/api/permission.ts`：前端权限模型 API client。
- `docs/permission-model.md`：人类和 Agent 可读的权限模型说明。

修改文件：

- `apps/api/prisma/schema.prisma`：增加 v0.3.0 Prisma model 和 relation。
- `apps/api/src/app.module.ts`：导入 `PermissionModule`。
- `apps/admin-web/src/App.tsx`：新增应用与权限管理区域。
- `apps/admin-web/src/App.css`：新增权限管理布局样式。
- `apps/admin-web/src/App.test.tsx`：新增权限管理渲染和交互测试。
- `apps/admin-web/src/api/feishu.ts`：如果通用 fetch 逻辑需要复用，抽出到 `apps/admin-web/src/api/http.ts`。
- `README.md`：更新当前状态和下一步。
- `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.3.0-权限模型实施.md`：归档实施会话。

---

## Task 1: 数据库模型和迁移

**Files:**

- Create: `migrations/V0_3_0__permission_model.sql`
- Modify: `apps/api/prisma/schema.prisma`
- Test: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: 确认数据库基线有效**

  先运行 Prisma 校验，确认当前 schema 尚无 v0.3.0 模型时计划中的测试不会被误认为已完成。

  Run:

  ```bash
  pnpm --filter @feishu-iam/api prisma:validate
  ```

  Expected: PASS。当前只是确认基线有效。

- [ ] **Step 2: 新增 SQL 迁移**

  在 `migrations/V0_3_0__permission_model.sql` 写入迁移。关键结构如下，字段名必须与规格文档一致：

  ```sql
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    app_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT applications_status_check CHECK (status IN ('active', 'disabled'))
  );

  CREATE TABLE IF NOT EXISTS permission_groups (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT permission_groups_status_check CHECK (status IN ('active', 'disabled')),
    CONSTRAINT permission_groups_application_key_unique UNIQUE (application_id, key)
  );

  CREATE TABLE IF NOT EXISTS permission_points (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT permission_points_status_check CHECK (status IN ('active', 'disabled')),
    CONSTRAINT permission_points_application_key_unique UNIQUE (application_id, key)
  );

  CREATE TABLE IF NOT EXISTS permission_group_points (
    permission_group_id TEXT NOT NULL REFERENCES permission_groups (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    permission_point_id TEXT NOT NULL REFERENCES permission_points (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (permission_group_id, permission_point_id)
  );
  ```

  同一文件继续创建 `iam_roles`、`iam_role_subjects`、`iam_role_permission_groups`、`iam_role_permission_points`、`audit_logs`，并插入：

  ```sql
  INSERT INTO schema_versions (version, description)
  VALUES ('0.3.0', '应用与权限模型')
  ON CONFLICT (version) DO NOTHING;
  ```

- [ ] **Step 3: 更新 Prisma schema**

  在 `apps/api/prisma/schema.prisma` 增加对应 model。命名使用 PascalCase，例如 `Application`、`PermissionGroup`、`PermissionPoint`、`IamRole`、`AuditLog`。状态字段保持 `String`，避免为当前小版本引入 Prisma enum 迁移复杂度。

  必须包含这些关系：

  ```prisma
  model Application {
    id               String            @id
    appKey           String            @unique @map("app_key")
    name             String
    description      String?
    ownerUserId      String?           @map("owner_user_id")
    status           String            @default("active")
    createdAt        DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
    updatedAt        DateTime          @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
    permissionGroups PermissionGroup[]
    permissionPoints PermissionPoint[]
    iamRoles         IamRole[]
    auditLogs        AuditLog[]

    @@map("applications")
  }
  ```

- [ ] **Step 4: 格式化并校验 Prisma**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api prisma:format
  pnpm --filter @feishu-iam/api prisma:validate
  ```

  Expected: 两个命令均 PASS。

- [ ] **Step 5: 提交数据库模型**

  ```bash
  git add migrations/V0_3_0__permission_model.sql apps/api/prisma/schema.prisma
  git commit -m "feat: add permission model schema"
  ```

---

## Task 2: 权限领域类型、校验和审计服务

**Files:**

- Create: `apps/api/src/permission/permission.types.ts`
- Create: `apps/api/src/permission/permission.validators.ts`
- Create: `apps/api/src/permission/permission-error.filter.ts`
- Create: `apps/api/src/permission/audit-log.service.ts`
- Create: `apps/api/test/permission.validators.spec.ts`

- [ ] **Step 1: 写 key 校验失败测试**

  在 `apps/api/test/permission.validators.spec.ts` 写入：

  ```ts
  import { describe, expect, it } from 'vitest';
  import {
    assertApplicationKey,
    assertPermissionKey,
    assertRoleKey
  } from '../src/permission/permission.validators';

  describe('permission validators', () => {
    it('校验应用 key', () => {
      expect(() => assertApplicationKey('finance')).not.toThrow();
      expect(() => assertApplicationKey('Finance')).toThrow('APPLICATION_KEY_INVALID');
      expect(() => assertApplicationKey('f')).toThrow('APPLICATION_KEY_INVALID');
    });

    it('校验权限 key 必须带应用前缀', () => {
      expect(() => assertPermissionKey('finance', 'finance.invoice.read', 'permission_point')).not.toThrow();
      expect(() => assertPermissionKey('finance', 'invoice.read', 'permission_point')).toThrow(
        'PERMISSION_POINT_KEY_INVALID'
      );
      expect(() => assertPermissionKey('finance', 'crm.customer.read', 'permission_point')).toThrow(
        'PERMISSION_POINT_KEY_INVALID'
      );
    });

    it('校验角色 key', () => {
      expect(() => assertRoleKey('invoice_manager')).not.toThrow();
      expect(() => assertRoleKey('Invoice Manager')).toThrow('IAM_ROLE_KEY_INVALID');
    });
  });
  ```

- [ ] **Step 2: 运行测试确认失败**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- permission.validators.spec.ts
  ```

  Expected: FAIL，原因是 `../src/permission/permission.validators` 尚不存在。

- [ ] **Step 3: 实现类型和领域错误**

  `permission.types.ts` 写入稳定枚举和错误类：

  ```ts
  export type EntityStatus = 'active' | 'disabled';
  export type IamSubjectType = 'feishu_user' | 'feishu_department';
  export type AuditResult = 'success' | 'failed';

  export class PermissionDomainError extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly status = 400
    ) {
      super(message);
      this.name = 'PermissionDomainError';
    }
  }
  ```

- [ ] **Step 4: 实现校验函数**

  `permission.validators.ts` 至少包含：

  ```ts
  import { PermissionDomainError } from './permission.types';

  const APPLICATION_KEY_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
  const ROLE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

  export function assertApplicationKey(appKey: string): void {
    if (!APPLICATION_KEY_PATTERN.test(appKey)) {
      throw new PermissionDomainError('APPLICATION_KEY_INVALID', '应用 key 不符合规则');
    }
  }

  export function assertPermissionKey(appKey: string, key: string, kind: 'permission_group' | 'permission_point'): void {
    const pattern = new RegExp(`^${escapeRegExp(appKey)}\\.[a-z0-9][a-z0-9._-]{0,127}$`);
    if (!pattern.test(key)) {
      throw new PermissionDomainError(
        kind === 'permission_group' ? 'PERMISSION_GROUP_KEY_INVALID' : 'PERMISSION_POINT_KEY_INVALID',
        `${kind === 'permission_group' ? '权限组' : '权限点'} key 必须以 ${appKey}. 开头`
      );
    }
  }

  export function assertRoleKey(key: string): void {
    if (!ROLE_KEY_PATTERN.test(key)) {
      throw new PermissionDomainError('IAM_ROLE_KEY_INVALID', 'IAM 角色 key 不符合规则');
    }
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  ```

- [ ] **Step 5: 实现错误过滤器和审计服务**

  `permission-error.filter.ts` 把 `PermissionDomainError` 转换为：

  ```json
  { "error": { "code": "APPLICATION_KEY_INVALID", "message": "应用 key 不符合规则" } }
  ```

  `audit-log.service.ts` 提供：

  ```ts
  async record(params: {
    actorType: string;
    actorId: string;
    source: string;
    applicationId?: string | null;
    resourceType: string;
    resourceId: string;
    action: string;
    before?: unknown;
    after?: unknown;
    result: 'success' | 'failed';
    requestId?: string | null;
  }): Promise<void>
  ```

  审计写入失败时不要吞掉异常。

- [ ] **Step 6: 运行测试**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- permission.validators.spec.ts
  pnpm --filter @feishu-iam/api typecheck
  ```

  Expected: PASS。

- [ ] **Step 7: 提交基础领域工具**

  ```bash
  git add apps/api/src/permission apps/api/test/permission.validators.spec.ts
  git commit -m "feat: add permission domain validators"
  ```

---

## Task 3: 应用、权限组和权限点服务

**Files:**

- Create: `apps/api/src/permission/application.service.ts`
- Create: `apps/api/src/permission/permission-catalog.service.ts`
- Create: `apps/api/test/permission-catalog.service.spec.ts`

- [ ] **Step 1: 写服务测试**

  `permission-catalog.service.spec.ts` 覆盖：

  - 创建应用时校验 `app_key`。
  - 创建权限点时必须以 `app_key.` 开头。
  - 创建权限组时必须以 `app_key.` 开头。
  - 权限组只能绑定同应用权限点。
  - 禁用权限点后列表仍返回状态，权限计算阶段再过滤。

  测试中的 fake Prisma 至少实现 `application.findUnique`、`application.create`、`permissionPoint.create`、`permissionGroup.create`、`permissionGroupPoint.createMany`。

- [ ] **Step 2: 运行测试确认失败**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- permission-catalog.service.spec.ts
  ```

  Expected: FAIL，原因是服务尚不存在。

- [ ] **Step 3: 实现 ApplicationService**

  核心方法：

  ```ts
  async createApplication(input: {
    appKey: string;
    name: string;
    description?: string;
    ownerUserId?: string;
  }): Promise<Application>

  async listApplications(): Promise<Application[]>
  async getApplicationByKey(appKey: string): Promise<Application>
  async updateApplication(appKey: string, input: { name?: string; description?: string; ownerUserId?: string }): Promise<Application>
  async setApplicationStatus(appKey: string, status: 'active' | 'disabled'): Promise<Application>
  ```

  每个写方法必须调用 `AuditLogService.record()`。

- [ ] **Step 4: 实现 PermissionCatalogService**

  核心方法：

  ```ts
  async createPermissionGroup(appKey: string, input: { key: string; name: string; description?: string }): Promise<PermissionGroup>
  async listPermissionGroups(appKey: string): Promise<PermissionGroup[]>
  async updatePermissionGroup(appKey: string, groupId: string, input: { name?: string; description?: string }): Promise<PermissionGroup>
  async setPermissionGroupStatus(appKey: string, groupId: string, status: EntityStatus): Promise<PermissionGroup>
  async replacePermissionGroupPoints(appKey: string, groupId: string, pointIds: string[]): Promise<void>
  async createPermissionPoint(appKey: string, input: { key: string; name: string; description?: string }): Promise<PermissionPoint>
  async listPermissionPoints(appKey: string): Promise<PermissionPoint[]>
  async updatePermissionPoint(appKey: string, pointId: string, input: { name?: string; description?: string }): Promise<PermissionPoint>
  async setPermissionPointStatus(appKey: string, pointId: string, status: EntityStatus): Promise<PermissionPoint>
  ```

  `replacePermissionGroupPoints()` 必须先读取权限组和权限点的 `applicationId`，发现跨应用时抛 `CROSS_APPLICATION_BINDING_FORBIDDEN`。

- [ ] **Step 5: 运行测试**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- permission-catalog.service.spec.ts
  pnpm --filter @feishu-iam/api typecheck
  ```

  Expected: PASS。

- [ ] **Step 6: 提交权限目录服务**

  ```bash
  git add apps/api/src/permission/application.service.ts apps/api/src/permission/permission-catalog.service.ts apps/api/test/permission-catalog.service.spec.ts
  git commit -m "feat: add application permission catalog services"
  ```

---

## Task 4: IAM 角色和授权绑定服务

**Files:**

- Create: `apps/api/src/permission/iam-role.service.ts`
- Create: `apps/api/test/iam-role.service.spec.ts`

- [ ] **Step 1: 写角色服务测试**

  测试覆盖：

  - 创建角色时校验角色 key。
  - 角色只属于一个应用。
  - 角色主体只接受 `feishu_user` 和 `feishu_department`。
  - 绑定不存在或已删除的飞书主体时写入 `isOrphaned=true`。
  - 角色绑定其他应用权限组时报 `CROSS_APPLICATION_BINDING_FORBIDDEN`。
  - 角色绑定其他应用权限点时报 `CROSS_APPLICATION_BINDING_FORBIDDEN`。
  - 写操作调用审计服务。

- [ ] **Step 2: 运行测试确认失败**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- iam-role.service.spec.ts
  ```

  Expected: FAIL，原因是 `IamRoleService` 尚不存在。

- [ ] **Step 3: 实现 IamRoleService**

  核心方法：

  ```ts
  async createRole(appKey: string, input: { key: string; name: string; description?: string }): Promise<IamRole>
  async listRoles(appKey: string): Promise<IamRole[]>
  async updateRole(appKey: string, roleId: string, input: { name?: string; description?: string }): Promise<IamRole>
  async setRoleStatus(appKey: string, roleId: string, status: EntityStatus): Promise<IamRole>
  async replaceRoleSubjects(appKey: string, roleId: string, subjects: Array<{ type: IamSubjectType; id: string }>): Promise<void>
  async replaceRolePermissionGroups(appKey: string, roleId: string, groupIds: string[]): Promise<void>
  async replaceRolePermissionPoints(appKey: string, roleId: string, pointIds: string[]): Promise<void>
  ```

  `replaceRoleSubjects()` 规则：

  ```ts
  const isOrphaned =
    subject.type === 'feishu_user'
      ? !(await prisma.feishuUser.findFirst({ where: { userId: subject.id, isDeleted: false } }))
      : !(await prisma.feishuDepartment.findFirst({ where: { departmentId: subject.id, isDeleted: false } }));
  ```

- [ ] **Step 4: 确保替换绑定是事务**

  `replaceRoleSubjects()`、`replaceRolePermissionGroups()`、`replaceRolePermissionPoints()` 使用 `prisma.$transaction()`：

  ```ts
  await this.prisma.$transaction([
    this.prisma.iamRoleSubject.deleteMany({ where: { iamRoleId: role.id } }),
    this.prisma.iamRoleSubject.createMany({ data: rows })
  ]);
  ```

  权限组和权限点替换也使用相同模式。

- [ ] **Step 5: 运行测试**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- iam-role.service.spec.ts
  pnpm --filter @feishu-iam/api typecheck
  ```

  Expected: PASS。

- [ ] **Step 6: 提交角色服务**

  ```bash
  git add apps/api/src/permission/iam-role.service.ts apps/api/test/iam-role.service.spec.ts
  git commit -m "feat: add IAM role binding service"
  ```

---

## Task 5: 权限计算服务

**Files:**

- Create: `apps/api/src/permission/permission-calculation.service.ts`
- Create: `apps/api/test/permission-calculation.service.spec.ts`

- [ ] **Step 1: 写权限计算测试**

  测试覆盖：

  - 用户直接绑定角色命中权限组和权限点。
  - 用户通过直接所属部门命中角色。
  - 多个角色命中同一权限组和权限点时去重。
  - 禁用应用返回 `APPLICATION_DISABLED`。
  - 非活跃或已删除用户返回 `FEISHU_USER_NOT_ACTIVE`。
  - 禁用角色、权限组、权限点不进入结果。
  - orphaned 主体不参与计算。
  - 不向上递归父部门。

- [ ] **Step 2: 运行测试确认失败**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- permission-calculation.service.spec.ts
  ```

  Expected: FAIL，原因是计算服务尚不存在。

- [ ] **Step 3: 实现计算服务**

  `PermissionCalculationService.calculate(appKey, userId)` 返回：

  ```ts
  export type PermissionCalculationResult = {
    appKey: string;
    userId: string;
    permissionGroups: Array<{ key: string; name: string }>;
    permissionPoints: Array<{ key: string; name: string }>;
    matchedRoles: Array<{ key: string; name: string }>;
    computedAt: string;
  };
  ```

  查询流程：

  1. 查 `Application`，不存在报 `APPLICATION_NOT_FOUND`，禁用报 `APPLICATION_DISABLED`。
  2. 查 `FeishuUser`，要求 `isActive=true` 且 `isDeleted=false`。
  3. 查用户未删除的直接部门：`feishuUserDepartment.findMany({ where: { userId, isDeleted: false } })`。
  4. 查当前应用 active 角色和绑定。
  5. 命中 `feishu_user:userId` 或 `feishu_department:departmentId` 的角色。
  6. 展开 active 权限组和 active 权限点。
  7. 按 key 排序返回，保证测试稳定。

- [ ] **Step 4: 运行测试**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- permission-calculation.service.spec.ts
  pnpm --filter @feishu-iam/api typecheck
  ```

  Expected: PASS。

- [ ] **Step 5: 提交权限计算服务**

  ```bash
  git add apps/api/src/permission/permission-calculation.service.ts apps/api/test/permission-calculation.service.spec.ts
  git commit -m "feat: calculate application permissions"
  ```

---

## Task 6: 平台 API 和模块接入

**Files:**

- Create: `apps/api/src/permission/permission.module.ts`
- Create: `apps/api/src/permission/permission.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/permission.controller.e2e-spec.ts`

- [ ] **Step 1: 写 e2e 测试**

  覆盖平台 token、应用创建、权限点 key 错误、权限组绑定、角色绑定和权限计算端点。

  请求样例：

  ```ts
  await request(app.getHttpServer())
    .post('/api/v1/platform/applications')
    .set('Authorization', 'Bearer test-platform-token')
    .send({ appKey: 'finance', name: '财务系统' })
    .expect(201);
  ```

- [ ] **Step 2: 运行 e2e 测试确认失败**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- permission.controller.e2e-spec.ts
  ```

  Expected: FAIL，原因是控制器和模块尚不存在。

- [ ] **Step 3: 实现 PermissionController**

  控制器路径：

  ```ts
  @Controller('/api/v1/platform')
  @UseGuards(PlatformTokenGuard)
  @UseFilters(PermissionErrorFilter)
  export class PermissionController {}
  ```

  必须实现规格中的这些端点：

  - `POST /applications`
  - `GET /applications`
  - `GET /applications/:appKey`
  - `PATCH /applications/:appKey`
  - `POST /applications/:appKey/disable`
  - `POST /applications/:appKey/enable`
  - `POST /applications/:appKey/permission-groups`
  - `GET /applications/:appKey/permission-groups`
  - `PATCH /applications/:appKey/permission-groups/:groupId`
  - `POST /applications/:appKey/permission-groups/:groupId/disable`
  - `POST /applications/:appKey/permission-groups/:groupId/enable`
  - `PUT /applications/:appKey/permission-groups/:groupId/points`
  - `POST /applications/:appKey/permission-points`
  - `GET /applications/:appKey/permission-points`
  - `PATCH /applications/:appKey/permission-points/:pointId`
  - `POST /applications/:appKey/permission-points/:pointId/disable`
  - `POST /applications/:appKey/permission-points/:pointId/enable`
  - `POST /applications/:appKey/iam-roles`
  - `GET /applications/:appKey/iam-roles`
  - `PATCH /applications/:appKey/iam-roles/:roleId`
  - `POST /applications/:appKey/iam-roles/:roleId/disable`
  - `POST /applications/:appKey/iam-roles/:roleId/enable`
  - `PUT /applications/:appKey/iam-roles/:roleId/subjects`
  - `PUT /applications/:appKey/iam-roles/:roleId/permission-groups`
  - `PUT /applications/:appKey/iam-roles/:roleId/permission-points`
  - `GET /applications/:appKey/users/:userId/permissions`

- [ ] **Step 4: 注册模块**

  `permission.module.ts` 导出所有服务并导入 `PrismaModule`。

  `app.module.ts` 修改为：

  ```ts
  imports: [PrismaModule, FeishuModule, PermissionModule],
  ```

- [ ] **Step 5: 运行 API 测试**

  Run:

  ```bash
  pnpm --filter @feishu-iam/api test -- permission.controller.e2e-spec.ts
  pnpm --filter @feishu-iam/api test -- permission
  pnpm --filter @feishu-iam/api typecheck
  ```

  Expected: PASS。

- [ ] **Step 6: 提交平台 API**

  ```bash
  git add apps/api/src/app.module.ts apps/api/src/permission apps/api/test/permission.controller.e2e-spec.ts
  git commit -m "feat: expose permission platform APIs"
  ```

---

## Task 7: 管理端 API client 和界面

**Files:**

- Create: `apps/admin-web/src/api/permission.ts`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.css`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 写前端测试**

  在 `App.test.tsx` 增加：

  - 渲染“应用与权限”区域。
  - 应用列表展示 `finance`。
  - 点击应用后显示权限组、权限点和 IAM 角色。
  - 权限预览展示 `finance.invoice.read`。
  - API 错误展示安全中文提示。

- [ ] **Step 2: 运行前端测试确认失败**

  Run:

  ```bash
  pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
  ```

  Expected: FAIL，原因是页面尚未实现权限区域。

- [ ] **Step 3: 新增 permission API client**

  `apps/admin-web/src/api/permission.ts` 定义类型：

  ```ts
  export type ApplicationSummary = {
    id: string;
    appKey: string;
    name: string;
    description?: string | null;
    ownerUserId?: string | null;
    status: 'active' | 'disabled';
  };

  export type PermissionPreview = {
    appKey: string;
    userId: string;
    permissionGroups: Array<{ key: string; name: string }>;
    permissionPoints: Array<{ key: string; name: string }>;
    matchedRoles: Array<{ key: string; name: string }>;
    computedAt: string;
  };
  ```

  实现：

  ```ts
  export async function fetchApplications(): Promise<ApplicationSummary[]>
  export async function fetchPermissionGroups(appKey: string): Promise<PermissionGroup[]>
  export async function fetchPermissionPoints(appKey: string): Promise<PermissionPoint[]>
  export async function fetchIamRoles(appKey: string): Promise<IamRole[]>
  export async function fetchPermissionPreview(appKey: string, userId: string): Promise<PermissionPreview>
  ```

- [ ] **Step 4: 实现页面最小闭环**

  在 `App.tsx` 保留现有飞书同步区，并新增 `<section aria-label="应用与权限">`。

  最小交互：

  - 页面加载读取应用列表。
  - 选择第一个应用后读取权限组、权限点、角色。
  - 提供用户 ID 输入框和“预览权限”按钮。
  - 展示权限组、权限点、命中角色。

  创建和编辑表单可以在本任务实现最小表单；如果文件过大，把权限区域拆成 `apps/admin-web/src/PermissionWorkspace.tsx`，同时更新测试路径。

- [ ] **Step 5: 更新样式**

  `App.css` 增加紧凑后台布局，不使用营销页式大 hero。按钮、输入框、表格需要固定高度和清晰焦点状态。

- [ ] **Step 6: 运行前端检查**

  Run:

  ```bash
  pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
  pnpm --filter @feishu-iam/admin-web typecheck
  pnpm --filter @feishu-iam/admin-web lint
  ```

  Expected: PASS。

- [ ] **Step 7: 提交管理端**

  ```bash
  git add apps/admin-web/src
  git commit -m "feat: add permission management workspace"
  ```

---

## Task 8: 文档、版本说明和会话归档

**Files:**

- Create: `docs/permission-model.md`
- Modify: `README.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.3.0-权限模型实施.md`

- [ ] **Step 1: 编写权限模型文档**

  `docs/permission-model.md` 必须包含：

  - 版本边界。
  - 应用、权限组、权限点、IAM 角色、主体绑定说明。
  - key 命名规则和合法/非法示例。
  - 平台 API curl 示例。
  - 权限计算规则。
  - 管理端操作步骤。
  - Agent 验收 checklist。

  curl 示例必须使用示例 token：

  ```bash
  curl -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
    http://localhost:3000/api/v1/platform/applications
  ```

- [ ] **Step 2: 更新 README**

  当前状态更新为：`v0.3.0` 已实现应用与权限模型闭环。下一步写为：进入 `v0.4.0` SSO Provider 设计和实现。

- [ ] **Step 3: 写 Codex 会话归档**

  归档必须包含：

  - 会话目标。
  - 用户关键要求。
  - 设计边界。
  - 修改文件。
  - 关键命令和结果。
  - 未完成事项。

- [ ] **Step 4: 检查未完成标记和中英文混杂正文**

  Run:

  ```bash
  rg -n "T[B]D|TO[D]O|待[定]|place[holder]|fill[ ]in" README.md docs/permission-model.md docs/codex-sessions
  ```

  Expected: 无输出。

- [ ] **Step 5: 提交文档**

  ```bash
  git add README.md docs/permission-model.md docs/codex-sessions
  git commit -m "docs: document v0.3.0 permission model"
  ```

---

## Task 9: 全量验证和发布准备

**Files:**

- No code ownership for this task; it verifies all previous tasks.

- [ ] **Step 1: 运行全量检查**

  Run:

  ```bash
  pnpm check
  ```

  Expected: PASS。

- [ ] **Step 2: 校验迁移脚本**

  Run:

  ```bash
  pnpm db:migrate
  ```

  Expected: PostgreSQL 容器启动成功，`V0_3_0__permission_model.sql` 执行成功，`schema_versions` 包含 `0.3.0`。

- [ ] **Step 3: 启动服务**

  Run:

  ```bash
  pnpm compose:up
  ```

  Expected: API 镜像构建成功，服务启动成功。

- [ ] **Step 4: 手动 API 验收**

  使用本地 `PLATFORM_ADMIN_TOKEN` 执行：

  ```bash
  curl -sS -H "Authorization: Bearer ${PLATFORM_ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"appKey":"finance","name":"财务系统"}' \
    http://localhost:3000/api/v1/platform/applications
  ```

  然后创建权限组、权限点、角色和绑定，最后调用：

  ```bash
  curl -sS -H "Authorization: Bearer ${PLATFORM_ADMIN_TOKEN}" \
    "http://localhost:3000/api/v1/platform/applications/finance/users/<FEISHU_USER_ID>/permissions"
  ```

  Expected: 返回 `finance.invoice_manager`、`finance.invoice.read`、`finance.invoice.approve`。

- [ ] **Step 5: 检查 Git 状态**

  Run:

  ```bash
  git status --short
  ```

  Expected: 无未提交变更。

- [ ] **Step 6: 准备发布分支**

  如果用户确认发布，按既有流程创建：

  ```bash
  git checkout -b release/v0.3.0
  git push -u origin release/v0.3.0
  ```

  然后创建 GitLab MR。不要直接把 `main` 推到远端发布，除非用户明确要求。

---

## 自检清单

- 规格覆盖：本计划覆盖应用、权限组、权限点、IAM 角色、主体绑定、角色授权、权限计算、平台 API、管理端、审计日志、文档和验收。
- 版本边界：本计划不实现 SSO/OAuth，不同步飞书角色或飞书用户组，不实现 deny、ABAC、资源级权限和硬删除。
- 类型一致性：应用使用 `appKey`，数据库列使用 `app_key`；权限组和权限点使用 `key`；角色主体使用 `subjectType` 和 `subjectId`。
- 测试顺序：每个实现任务先写失败测试，再实现，再运行局部检查。
- 提交节奏：每个任务完成后独立提交，便于 review 和回滚。
