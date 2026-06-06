# Feishu IAM v0.5.0 管理后台与管理员体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Feishu IAM 管理后台从 `PLATFORM_ADMIN_TOKEN` 工具页升级为使用飞书管理员身份、固定后台角色、应用 scope、审计查询和唐群风格 UI 的真实管理员控制台。

**Architecture:** 新增 `admin` 后端模块承载管理员、角色、session、破窗入口、权限校验和审计查询；保留 `/api/v1/platform/*` 给自动化和运维，新增 `/api/v1/admin/*` 给 Web 管理端并复用现有 permission、oauth、feishu 领域服务。前端从注入平台 token 迁移为 cookie session，并采用传统后台布局、唐群深蓝/青绿主题和后续 logo 资产。

**Tech Stack:** NestJS、React + Vite、PostgreSQL、Prisma、Vitest、Supertest、Docker Compose、lucide-react、图像生成工具。

---

## 文件结构

后端新增：

- `migrations/V0_5_0__admin_console.sql`：管理员、后台角色、应用 scope、后台 session 的 DDL 和固定角色初始化。
- `apps/api/src/admin/admin.module.ts`：Admin 模块入口。
- `apps/api/src/admin/admin.types.ts`：管理员角色、错误类型、session 上下文、查询 DTO 类型。
- `apps/api/src/admin/admin-error.filter.ts`：稳定 admin JSON 错误响应。
- `apps/api/src/admin/admin-session-crypto.ts`：后台 session secret 生成、哈希和恒定时间比较。
- `apps/api/src/admin/admin-session.guard.ts`：cookie session 校验，并把 admin context 挂到 request。
- `apps/api/src/admin/admin-request-context.ts`：读取 request id、当前管理员上下文。
- `apps/api/src/admin/admin-permission.service.ts`：固定角色与应用 scope 的后端权限校验。
- `apps/api/src/admin/admin-auth.service.ts`：后台登录、飞书回调、破窗登录、退出。
- `apps/api/src/admin/admin-user.service.ts`：管理员绑定、角色分配、应用 scope 管理。
- `apps/api/src/admin/admin-query.service.ts`：审计日志和安全事件查询、分页、脱敏。
- `apps/api/src/admin/admin-auth.controller.ts`：`/admin/auth/*` 和 `/api/v1/admin/me`。
- `apps/api/src/admin/admin-user.controller.ts`：管理员管理 API。
- `apps/api/src/admin/admin-permission.controller.ts`：Web 管理端应用、权限组、权限点、IAM 角色入口。
- `apps/api/src/admin/admin-oauth-config.controller.ts`：Web 管理端 SSO 环境、回调地址、client 入口。
- `apps/api/src/admin/admin-feishu.controller.ts`：Web 管理端飞书同步入口。
- `apps/api/src/admin/admin-audit.controller.ts`：审计日志和安全事件查询入口。

后端修改：

- `apps/api/prisma/schema.prisma`：新增 Admin Prisma models 和关系。
- `apps/api/src/app.module.ts`：导入 `AdminModule`。
- `apps/api/src/permission/permission.module.ts`：继续导出领域服务，供 admin controllers 复用。
- `apps/api/src/oauth/oauth.module.ts`：继续导出 `OauthConfigService` 和 `SecurityEventService`。
- `apps/api/src/feishu/feishu.module.ts`：继续导出同步与状态服务。
- `package.json`、`apps/api/package.json`、`apps/admin-web/package.json`：版本升级到 `0.5.0`。

后端测试新增：

- `apps/api/test/admin-session-crypto.spec.ts`
- `apps/api/test/admin-permission.service.spec.ts`
- `apps/api/test/admin-auth.service.spec.ts`
- `apps/api/test/admin-user.service.spec.ts`
- `apps/api/test/admin-query.service.spec.ts`
- `apps/api/test/admin.controller.e2e-spec.ts`

前端新增：

- `apps/admin-web/src/api/admin.ts`：admin session、当前用户、管理员、审计查询 API client。
- `apps/admin-web/src/admin-types.ts`：前端管理员、角色、审计、安全事件类型。
- `apps/admin-web/src/theme.ts`：唐群风格主题常量。
- `apps/admin-web/src/components/AdminShell.tsx`：传统后台 shell，左侧菜单、左上 logo、右上用户信息。
- `apps/admin-web/src/components/RoleWorkspace.tsx`：角色工作台首页。
- `apps/admin-web/src/components/AuditCenter.tsx`：审计日志查询。
- `apps/admin-web/src/components/SecurityEventCenter.tsx`：安全事件查询。
- `apps/admin-web/src/components/AdminUserCenter.tsx`：管理员授权页面。
- `apps/admin-web/src/components/ConfirmDialog.tsx`：高风险操作确认。
- `apps/admin-web/src/assets/feishu-iam-logo.svg`：最终 logo 资产，先用临时文字标识，图像生成任务后替换。

前端修改：

- `apps/admin-web/src/App.tsx`：从单页工具工作台改为 admin shell。
- `apps/admin-web/src/App.css`：唐群风格后台主题。
- `apps/admin-web/src/api/permission.ts`、`apps/admin-web/src/api/oauth.ts`、`apps/admin-web/src/api/feishu.ts`：从 `/api/v1/platform/*` 切到 `/api/v1/admin/*`，移除 `VITE_PLATFORM_ADMIN_TOKEN` 注入。
- `apps/admin-web/src/App.test.tsx`：覆盖角色菜单、权限裁剪、审计查询、高风险确认和 secret 不泄露。

文档修改：

- `README.md`
- `CHANGELOG.md`
- `AGENTS.md`
- `docs/sso-provider.md`
- `docs/permission-model.md`
- `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.0-*.md`

## Task 1: 数据库迁移与 Prisma 管理员模型

**Files:**
- Create: `migrations/V0_5_0__admin_console.sql`
- Modify: `apps/api/prisma/schema.prisma`
- Test: `apps/api/test/prisma.service.spec.ts`

- [ ] **Step 1: 写入失败测试，确认 schema version 可识别 v0.5.0**

Update `apps/api/test/prisma.service.spec.ts` with a migration-focused assertion if the file already checks schema versions. If it only validates Prisma lifecycle, add this unit-level constant test:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('v0.5.0 migration', () => {
  it('declares admin console schema version and fixed admin roles', () => {
    const migration = readFileSync(join(process.cwd(), '../../migrations/V0_5_0__admin_console.sql'), 'utf8');
    expect(migration).toContain("VALUES ('0.5.0', '管理后台与管理员体系最小闭环')");
    expect(migration).toContain("'platform_admin'");
    expect(migration).toContain("'application_admin'");
    expect(migration).toContain("'audit_viewer'");
    expect(migration).toContain("'sync_admin'");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/prisma.service.spec.ts
```

Expected: FAIL because `migrations/V0_5_0__admin_console.sql` does not exist.

- [ ] **Step 3: 创建迁移 SQL**

Create `migrations/V0_5_0__admin_console.sql`:

```sql
CREATE TABLE admin_users (
  id text PRIMARY KEY,
  feishu_user_id text NOT NULL REFERENCES feishu_users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_feishu_user_id_unique UNIQUE (feishu_user_id),
  CONSTRAINT admin_users_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE admin_roles (
  id text PRIMARY KEY,
  role_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_roles_role_key_check CHECK (role_key IN ('platform_admin', 'application_admin', 'audit_viewer', 'sync_admin'))
);

CREATE TABLE admin_user_roles (
  admin_user_id text NOT NULL REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  admin_role_id text NOT NULL REFERENCES admin_roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, admin_role_id)
);

CREATE TABLE admin_application_scopes (
  admin_user_id text NOT NULL REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  application_id text NOT NULL REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, application_id)
);

CREATE TABLE admin_sessions (
  id text PRIMARY KEY,
  session_hash text NOT NULL UNIQUE,
  admin_user_id text NOT NULL REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX admin_users_status_idx ON admin_users(status);
CREATE INDEX admin_user_roles_admin_role_id_idx ON admin_user_roles(admin_role_id);
CREATE INDEX admin_application_scopes_application_id_idx ON admin_application_scopes(application_id);
CREATE INDEX admin_sessions_admin_user_id_idx ON admin_sessions(admin_user_id);
CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions(expires_at);

INSERT INTO admin_roles(id, role_key, name, description)
VALUES
  ('admin-role-platform-admin', 'platform_admin', '平台管理员', '管理全部应用、管理员、同步、审计和接入配置'),
  ('admin-role-application-admin', 'application_admin', '应用管理员', '管理被授权应用的权限、角色、回调地址和 client'),
  ('admin-role-audit-viewer', 'audit_viewer', '审计查看员', '只读查看审计日志和安全事件'),
  ('admin-role-sync-admin', 'sync_admin', '同步管理员', '查看和触发飞书同步')
ON CONFLICT (role_key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = now();

INSERT INTO schema_versions(version, description)
VALUES ('0.5.0', '管理后台与管理员体系最小闭环')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 4: 更新 Prisma schema**

Add relations to existing models:

```prisma
model FeishuUser {
  // existing fields...
  adminUsers AdminUser[]
}

model Application {
  // existing fields...
  adminApplicationScopes AdminApplicationScope[]
}
```

Add new models:

```prisma
model AdminUser {
  id           String    @id
  feishuUserId String    @unique @map("feishu_user_id")
  displayName  String    @map("display_name")
  status       String    @default("active")
  lastLoginAt  DateTime? @map("last_login_at") @db.Timestamptz(6)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  feishuUser   FeishuUser @relation(fields: [feishuUserId], references: [userId], onDelete: Restrict, onUpdate: Cascade)
  roles        AdminUserRole[]
  applicationScopes AdminApplicationScope[]
  sessions     AdminSession[]

  @@index([status])
  @@map("admin_users")
}

model AdminRole {
  id          String   @id
  roleKey     String   @unique @map("role_key")
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  users       AdminUserRole[]

  @@map("admin_roles")
}

model AdminUserRole {
  adminUserId String @map("admin_user_id")
  adminRoleId String @map("admin_role_id")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  adminUser   AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  adminRole   AdminRole @relation(fields: [adminRoleId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@id([adminUserId, adminRoleId])
  @@index([adminRoleId])
  @@map("admin_user_roles")
}

model AdminApplicationScope {
  adminUserId   String @map("admin_user_id")
  applicationId String @map("application_id")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  adminUser     AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@id([adminUserId, applicationId])
  @@index([applicationId])
  @@map("admin_application_scopes")
}

model AdminSession {
  id          String    @id
  sessionHash String    @unique @map("session_hash")
  adminUserId String    @map("admin_user_id")
  expiresAt   DateTime  @map("expires_at") @db.Timestamptz(6)
  revokedAt   DateTime? @map("revoked_at") @db.Timestamptz(6)
  ip          String?
  userAgent   String?   @map("user_agent")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  lastUsedAt  DateTime? @map("last_used_at") @db.Timestamptz(6)
  adminUser   AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@index([adminUserId])
  @@index([expiresAt])
  @@map("admin_sessions")
}
```

- [ ] **Step 5: 格式化、验证 Prisma**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:format
pnpm --filter @feishu-iam/api prisma:validate
pnpm --filter @feishu-iam/api exec vitest run test/prisma.service.spec.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma migrations/V0_5_0__admin_console.sql apps/api/test/prisma.service.spec.ts
git commit -m "feat: add admin console schema"
```

## Task 2: Admin 基础类型、错误响应、session crypto 和权限服务

**Files:**
- Create: `apps/api/src/admin/admin.types.ts`
- Create: `apps/api/src/admin/admin-error.filter.ts`
- Create: `apps/api/src/admin/admin-session-crypto.ts`
- Create: `apps/api/src/admin/admin-request-context.ts`
- Create: `apps/api/src/admin/admin-permission.service.ts`
- Create: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/admin-session-crypto.spec.ts`
- Test: `apps/api/test/admin-permission.service.spec.ts`

- [ ] **Step 1: 写 session crypto 测试**

Create `apps/api/test/admin-session-crypto.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAdminSessionSecret, hashAdminSessionSecret, timingSafeEqualAdminHash } from '../src/admin/admin-session-crypto';

describe('admin-session-crypto', () => {
  it('生成带 bias_ 前缀的 session secret，且只比较哈希', () => {
    const secret = createAdminSessionSecret();
    const other = createAdminSessionSecret();
    const hash = hashAdminSessionSecret(secret);

    expect(secret).toMatch(/^bias_[A-Za-z0-9_-]{32,}$/);
    expect(other).not.toBe(secret);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(timingSafeEqualAdminHash(secret, hash)).toBe(true);
    expect(timingSafeEqualAdminHash(`${secret}x`, hash)).toBe(false);
  });
});
```

- [ ] **Step 2: 写权限服务测试**

Create `apps/api/test/admin-permission.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AdminPermissionService } from '../src/admin/admin-permission.service';
import { AdminDomainError, type AdminContext } from '../src/admin/admin.types';

function context(roles: AdminContext['roles'], applicationIds: string[] = []): AdminContext {
  return {
    adminUserId: 'admin-1',
    feishuUserId: 'ou_admin',
    displayName: '管理员',
    roles,
    applicationIds
  };
}

function expectDenied(action: () => void, code = 'ADMIN_PERMISSION_DENIED') {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AdminDomainError);
    expect((error as AdminDomainError).code).toBe(code);
    return;
  }
  throw new Error('Expected AdminDomainError');
}

describe('AdminPermissionService', () => {
  const service = new AdminPermissionService();

  it('平台管理员拥有全部应用管理权限', () => {
    expect(service.canManageApplication(context(['platform_admin']), 'app-finance')).toBe(true);
  });

  it('应用管理员只能管理授权应用', () => {
    expect(service.canManageApplication(context(['application_admin'], ['app-finance']), 'app-finance')).toBe(true);
    expect(service.canManageApplication(context(['application_admin'], ['app-finance']), 'app-hr')).toBe(false);
  });

  it('审计查看员没有写权限', () => {
    expectDenied(() => service.assertCanManageApplication(context(['audit_viewer']), 'app-finance'));
  });

  it('同步管理员只能触发同步', () => {
    expect(service.canTriggerFeishuSync(context(['sync_admin']))).toBe(true);
    expectDenied(() => service.assertCanManageApplication(context(['sync_admin']), 'app-finance'));
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin-session-crypto.spec.ts test/admin-permission.service.spec.ts
```

Expected: FAIL because admin files do not exist.

- [ ] **Step 4: 创建 admin 类型和错误类**

Create `apps/api/src/admin/admin.types.ts`:

```ts
export type AdminRoleKey = 'platform_admin' | 'application_admin' | 'audit_viewer' | 'sync_admin';

export type AdminContext = {
  adminUserId: string;
  feishuUserId: string;
  displayName: string;
  roles: AdminRoleKey[];
  applicationIds: string[];
  bootstrap?: boolean;
};

export type AdminAuditContext = {
  actorType: 'admin_user' | 'bootstrap_super_admin';
  actorId: string;
  source: 'admin_web' | 'bootstrap';
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export class AdminDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'AdminDomainError';
  }
}
```

- [ ] **Step 5: 创建 session crypto**

Create `apps/api/src/admin/admin-session-crypto.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createAdminSessionSecret(): string {
  return `bias_${randomBytes(32).toString('base64url')}`;
}

export function hashAdminSessionSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function timingSafeEqualAdminHash(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashAdminSessionSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
```

- [ ] **Step 6: 创建错误 filter**

Create `apps/api/src/admin/admin-error.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { getAdminRequestId } from './admin-request-context';
import { AdminDomainError } from './admin.types';

@Catch(AdminDomainError)
export class AdminErrorFilter implements ExceptionFilter {
  catch(exception: AdminDomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest();
    response.status(exception.status).json({
      error: {
        code: exception.code,
        message: exception.message,
        request_id: getAdminRequestId(request)
      }
    });
  }
}
```

- [ ] **Step 7: 创建 request context**

Create `apps/api/src/admin/admin-request-context.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { AdminContext } from './admin.types';

type AdminRequest = Request & {
  adminRequestId?: string;
  adminContext?: AdminContext;
};

export function getAdminRequestId(request: Request): string {
  const adminRequest = request as AdminRequest;
  if (!adminRequest.adminRequestId) {
    adminRequest.adminRequestId = readHeader(request, 'x-request-id') ?? randomUUID();
  }
  return adminRequest.adminRequestId;
}

export function setAdminContext(request: Request, context: AdminContext): void {
  (request as AdminRequest).adminContext = context;
}

export function readAdminContext(request: Request): AdminContext | null {
  return (request as AdminRequest).adminContext ?? null;
}

function readHeader(request: Request, name: string): string | null {
  const value = request.header(name);
  return value && value.trim().length > 0 ? value : null;
}
```

- [ ] **Step 8: 创建权限服务和模块**

Create `apps/api/src/admin/admin-permission.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AdminDomainError, type AdminContext } from './admin.types';

@Injectable()
export class AdminPermissionService {
  canManageApplication(context: AdminContext, applicationId: string): boolean {
    return hasRole(context, 'platform_admin') || (hasRole(context, 'application_admin') && context.applicationIds.includes(applicationId));
  }

  assertCanManageApplication(context: AdminContext, applicationId: string): void {
    if (!this.canManageApplication(context, applicationId)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权管理该应用', 403);
    }
  }

  canManageAdmins(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || context.bootstrap === true;
  }

  assertCanManageAdmins(context: AdminContext): void {
    if (!this.canManageAdmins(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权管理管理员授权', 403);
    }
  }

  canTriggerFeishuSync(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'sync_admin');
  }

  assertCanTriggerFeishuSync(context: AdminContext): void {
    if (!this.canTriggerFeishuSync(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权触发飞书同步', 403);
    }
  }

  canViewGlobalAudit(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'audit_viewer');
  }
}

function hasRole(context: AdminContext, role: string): boolean {
  return context.roles.includes(role as never);
}
```

Create `apps/api/src/admin/admin.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPermissionService } from './admin-permission.service';

@Module({
  imports: [PrismaModule],
  providers: [AdminPermissionService],
  exports: [AdminPermissionService]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class AdminModule {}
```

Update `apps/api/src/app.module.ts`:

```ts
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [PrismaModule, FeishuModule, PermissionModule, OauthModule, AdminModule],
  controllers: [HealthController, VersionController]
})
export class AppModule {}
```

- [ ] **Step 9: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin-session-crypto.spec.ts test/admin-permission.service.spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/admin apps/api/src/app.module.ts apps/api/test/admin-session-crypto.spec.ts apps/api/test/admin-permission.service.spec.ts
git commit -m "feat: add admin domain foundation"
```

## Task 3: AdminUserService 管理员绑定、角色和应用 scope

**Files:**
- Create: `apps/api/src/admin/admin-user.service.ts`
- Test: `apps/api/test/admin-user.service.spec.ts`

- [ ] **Step 1: 写服务测试**

Create `apps/api/test/admin-user.service.spec.ts` with focused mocked Prisma tests:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AdminUserService } from '../src/admin/admin-user.service';
import { AdminDomainError } from '../src/admin/admin.types';

function makePrisma() {
  return {
    feishuUser: { findUnique: vi.fn() },
    adminUser: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    adminRole: { findMany: vi.fn() },
    adminUserRole: { deleteMany: vi.fn(), createMany: vi.fn() },
    adminApplicationScope: { deleteMany: vi.fn(), createMany: vi.fn() },
    application: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(makePrisma()))
  };
}

describe('AdminUserService', () => {
  it('拒绝绑定不可用飞书用户', async () => {
    const prisma = makePrisma();
    prisma.feishuUser.findUnique.mockResolvedValue({ userId: 'ou_1', isActive: false, isDeleted: false, name: '张三' });
    const service = new AdminUserService(prisma as never);

    await expect(service.createAdminUser({ feishuUserId: 'ou_1', roleKeys: ['platform_admin'], applicationIds: [] })).rejects.toMatchObject({
      code: 'ADMIN_FEISHU_USER_UNAVAILABLE'
    });
  });

  it('创建管理员时写入角色和应用 scope', async () => {
    const prisma = makePrisma();
    const tx = makePrisma();
    prisma.$transaction.mockImplementation(async (fn: (txArg: unknown) => Promise<unknown>) => fn(tx));
    tx.feishuUser.findUnique.mockResolvedValue({ userId: 'ou_1', isActive: true, isDeleted: false, name: '张三' });
    tx.adminRole.findMany.mockResolvedValue([
      { id: 'role-app', roleKey: 'application_admin' },
      { id: 'role-audit', roleKey: 'audit_viewer' }
    ]);
    tx.application.findMany.mockResolvedValue([{ id: 'app-finance' }]);
    tx.adminUser.create.mockResolvedValue({ id: 'admin-1', feishuUserId: 'ou_1', displayName: '张三' });
    const service = new AdminUserService(prisma as never);

    await service.createAdminUser({
      feishuUserId: 'ou_1',
      roleKeys: ['application_admin', 'audit_viewer'],
      applicationIds: ['app-finance']
    });

    expect(tx.adminUserRole.createMany).toHaveBeenCalledWith({
      data: [
        { adminUserId: 'admin-1', adminRoleId: 'role-app' },
        { adminUserId: 'admin-1', adminRoleId: 'role-audit' }
      ],
      skipDuplicates: true
    });
    expect(tx.adminApplicationScope.createMany).toHaveBeenCalledWith({
      data: [{ adminUserId: 'admin-1', applicationId: 'app-finance' }],
      skipDuplicates: true
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin-user.service.spec.ts
```

Expected: FAIL because `AdminUserService` does not exist.

- [ ] **Step 3: 实现 AdminUserService**

Create `apps/api/src/admin/admin-user.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma, FeishuUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminDomainError, type AdminRoleKey } from './admin.types';

type CreateAdminUserInput = {
  feishuUserId: string;
  roleKeys: AdminRoleKey[];
  applicationIds: string[];
};

type AdminUserClient = Pick<
  Prisma.TransactionClient,
  'feishuUser' | 'adminUser' | 'adminRole' | 'adminUserRole' | 'adminApplicationScope' | 'application'
>;

@Injectable()
export class AdminUserService {
  constructor(private readonly prisma: PrismaService) {}

  async createAdminUser(input: CreateAdminUserInput) {
    assertNonEmptyString(input.feishuUserId, 'ADMIN_FEISHU_USER_ID_REQUIRED', '飞书用户 ID 不能为空');
    assertRoleKeys(input.roleKeys);

    return this.prisma.$transaction(async (tx) => {
      const user = await this.getAvailableFeishuUser(tx, input.feishuUserId);
      const roles = await this.resolveRoles(tx, input.roleKeys);
      await this.assertApplicationsExist(tx, input.applicationIds);

      const admin = await tx.adminUser.create({
        data: {
          id: randomUUID(),
          feishuUserId: user.userId,
          displayName: user.name,
          status: 'active'
        }
      });

      await tx.adminUserRole.createMany({
        data: roles.map((role) => ({ adminUserId: admin.id, adminRoleId: role.id })),
        skipDuplicates: true
      });

      if (input.applicationIds.length > 0) {
        await tx.adminApplicationScope.createMany({
          data: input.applicationIds.map((applicationId) => ({ adminUserId: admin.id, applicationId })),
          skipDuplicates: true
        });
      }

      return admin;
    });
  }

  private async getAvailableFeishuUser(client: AdminUserClient, feishuUserId: string): Promise<FeishuUser> {
    const user = await client.feishuUser.findUnique({ where: { userId: feishuUserId } });
    if (!user) {
      throw new AdminDomainError('ADMIN_FEISHU_USER_NOT_FOUND', '飞书用户不存在', 404);
    }
    if (!user.isActive || user.isDeleted) {
      throw new AdminDomainError('ADMIN_FEISHU_USER_UNAVAILABLE', '飞书用户不可用，不能绑定为管理员', 422);
    }
    return user;
  }

  private async resolveRoles(client: AdminUserClient, roleKeys: AdminRoleKey[]) {
    const roles = await client.adminRole.findMany({ where: { roleKey: { in: roleKeys } } });
    if (roles.length !== new Set(roleKeys).size) {
      throw new AdminDomainError('ADMIN_ROLE_INVALID', '管理员角色不存在', 422);
    }
    return roles;
  }

  private async assertApplicationsExist(client: AdminUserClient, applicationIds: string[]): Promise<void> {
    if (applicationIds.length === 0) {
      return;
    }
    const applications = await client.application.findMany({ where: { id: { in: applicationIds } }, select: { id: true } });
    if (applications.length !== new Set(applicationIds).size) {
      throw new AdminDomainError('ADMIN_APPLICATION_SCOPE_INVALID', '应用授权范围包含不存在的应用', 422);
    }
  }
}

function assertRoleKeys(roleKeys: AdminRoleKey[]): void {
  const allowed = new Set(['platform_admin', 'application_admin', 'audit_viewer', 'sync_admin']);
  if (roleKeys.length === 0 || roleKeys.some((role) => !allowed.has(role))) {
    throw new AdminDomainError('ADMIN_ROLE_INVALID', '管理员角色不合法', 422);
  }
}

function assertNonEmptyString(value: string, code: string, message: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AdminDomainError(code, message, 422);
  }
}
```

- [ ] **Step 4: 导出服务**

Update `apps/api/src/admin/admin.module.ts` providers and exports:

```ts
import { AdminUserService } from './admin-user.service';

@Module({
  imports: [PrismaModule],
  providers: [AdminPermissionService, AdminUserService],
  exports: [AdminPermissionService, AdminUserService]
})
export class AdminModule {}
```

- [ ] **Step 5: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin-user.service.spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin/admin-user.service.ts apps/api/src/admin/admin.module.ts apps/api/test/admin-user.service.spec.ts
git commit -m "feat: add admin user service"
```

## Task 4: 后台 session guard、登录/退出和当前管理员接口

**Files:**
- Create: `apps/api/src/admin/admin-session.guard.ts`
- Create: `apps/api/src/admin/admin-auth.service.ts`
- Create: `apps/api/src/admin/admin-auth.controller.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Test: `apps/api/test/admin-auth.service.spec.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 写 auth service 测试**

Create `apps/api/test/admin-auth.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AdminAuthService } from '../src/admin/admin-auth.service';

function makePrisma() {
  return {
    adminUser: { findFirst: vi.fn(), update: vi.fn() },
    adminSession: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() }
  };
}

describe('AdminAuthService', () => {
  it('为 active 管理员创建后台 session 并返回明文 secret', async () => {
    const prisma = makePrisma();
    prisma.adminUser.findFirst.mockResolvedValue({
      id: 'admin-1',
      feishuUserId: 'ou_1',
      displayName: '张三',
      status: 'active',
      roles: [{ adminRole: { roleKey: 'platform_admin' } }],
      applicationScopes: []
    });
    prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
    const service = new AdminAuthService(prisma as never);

    const result = await service.createSessionForFeishuUser('ou_1', { ip: '127.0.0.1', userAgent: 'vitest' });

    expect(result.sessionSecret).toMatch(/^bias_/);
    expect(result.context.roles).toEqual(['platform_admin']);
    expect(prisma.adminSession.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 写 e2e 测试**

Create or extend `apps/api/test/admin.controller.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { AdminModule } from '../src/admin/admin.module';
import { AdminAuthService } from '../src/admin/admin-auth.service';
import { PrismaModule } from '../src/prisma/prisma.module';

describe('Admin auth controller', () => {
  let app: INestApplication;
  const auth = {
    getContextFromSessionSecret: vi.fn(),
    logout: vi.fn()
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, AdminModule] })
      .overrideProvider(AdminAuthService)
      .useValue(auth)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.resetAllMocks();
  });

  it('GET /api/v1/admin/me 返回当前管理员上下文', async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: 'admin-1',
      feishuUserId: 'ou_1',
      displayName: '张三',
      roles: ['platform_admin'],
      applicationIds: []
    });

    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Cookie', ['feishu_iam_admin_session=bias_test'])
      .expect(200)
      .expect((res) => {
        expect(res.body.displayName).toBe('张三');
        expect(res.body.roles).toEqual(['platform_admin']);
      });
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin-auth.service.spec.ts test/admin.controller.e2e-spec.ts
```

Expected: FAIL because auth service/controller are missing.

- [ ] **Step 4: 实现 AdminAuthService**

Create `apps/api/src/admin/admin-auth.service.ts` with:

```ts
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createAdminSessionSecret, hashAdminSessionSecret } from './admin-session-crypto';
import { AdminDomainError, type AdminContext } from './admin.types';

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createSessionForFeishuUser(feishuUserId: string, meta: { ip?: string | null; userAgent?: string | null }): Promise<{ sessionSecret: string; context: AdminContext }> {
    const admin = await this.prisma.adminUser.findFirst({
      where: {
        feishuUserId,
        status: 'active',
        feishuUser: { isActive: true, isDeleted: false }
      },
      include: {
        roles: { include: { adminRole: true } },
        applicationScopes: true
      }
    });
    if (!admin) {
      throw new AdminDomainError('ADMIN_USER_NOT_BOUND', '当前飞书用户尚未被授权为 Feishu IAM 管理员', 403);
    }

    const sessionSecret = createAdminSessionSecret();
    await this.prisma.adminSession.create({
      data: {
        id: randomUUID(),
        sessionHash: hashAdminSessionSecret(sessionSecret),
        adminUserId: admin.id,
        expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        lastUsedAt: new Date()
      }
    });
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    return { sessionSecret, context: toContext(admin) };
  }

  async getContextFromSessionSecret(sessionSecret: string): Promise<AdminContext> {
    const session = await this.prisma.adminSession.findUnique({
      where: { sessionHash: hashAdminSessionSecret(sessionSecret) },
      include: {
        adminUser: {
          include: {
            feishuUser: true,
            roles: { include: { adminRole: true } },
            applicationScopes: true
          }
        }
      }
    });
    if (!session || session.revokedAt) {
      throw new AdminDomainError('ADMIN_SESSION_INVALID', '后台登录态无效', 401);
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AdminDomainError('ADMIN_SESSION_EXPIRED', '后台登录态已过期', 401);
    }
    if (session.adminUser.status !== 'active' || !session.adminUser.feishuUser.isActive || session.adminUser.feishuUser.isDeleted) {
      throw new AdminDomainError('ADMIN_USER_UNAVAILABLE', '管理员或关联飞书用户不可用', 403);
    }
    await this.prisma.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    return toContext(session.adminUser);
  }

  async logout(sessionSecret: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { sessionHash: hashAdminSessionSecret(sessionSecret), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
}

function toContext(admin: {
  id: string;
  feishuUserId: string;
  displayName: string;
  roles: Array<{ adminRole: { roleKey: string } }>;
  applicationScopes: Array<{ applicationId: string }>;
}): AdminContext {
  return {
    adminUserId: admin.id,
    feishuUserId: admin.feishuUserId,
    displayName: admin.displayName,
    roles: admin.roles.map((role) => role.adminRole.roleKey as never),
    applicationIds: admin.applicationScopes.map((scope) => scope.applicationId)
  };
}
```

- [ ] **Step 5: 实现 guard 和 controller**

Create `apps/api/src/admin/admin-session.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { setAdminContext } from './admin-request-context';
import { AdminDomainError } from './admin.types';

const COOKIE_NAME = 'feishu_iam_admin_session';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(@Inject(AdminAuthService) private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionSecret = readCookie(request, COOKIE_NAME);
    if (!sessionSecret) {
      throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
    }
    setAdminContext(request, await this.auth.getContextFromSessionSecret(sessionSecret));
    return true;
  }
}

export function readAdminSessionCookie(request: Request): string | null {
  return readCookie(request, COOKIE_NAME);
}

function readCookie(request: Request, name: string): string | null {
  const header = request.header('cookie');
  if (!header) return null;
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
```

Create `apps/api/src/admin/admin-auth.controller.ts`:

```ts
import { Controller, Get, Inject, Post, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminErrorFilter } from './admin-error.filter';
import { readAdminContext } from './admin-request-context';
import { AdminSessionGuard, readAdminSessionCookie } from './admin-session.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminDomainError } from './admin.types';

@Controller()
@UseFilters(AdminErrorFilter)
export class AdminAuthController {
  constructor(@Inject(AdminAuthService) private readonly auth: AdminAuthService) {}

  @Get('/api/v1/admin/me')
  @UseGuards(AdminSessionGuard)
  me(@Req() request: Request) {
    const context = readAdminContext(request);
    if (!context) {
      throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
    }
    return context;
  }

  @Post('/admin/auth/logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ ok: true }> {
    const sessionSecret = readAdminSessionCookie(request);
    if (sessionSecret) {
      await this.auth.logout(sessionSecret);
    }
    response.clearCookie('feishu_iam_admin_session', { httpOnly: true, sameSite: 'lax', path: '/' });
    return { ok: true };
  }
}
```

Update `AdminModule` providers/controllers:

```ts
controllers: [AdminAuthController],
providers: [AdminPermissionService, AdminUserService, AdminAuthService, AdminSessionGuard],
exports: [AdminPermissionService, AdminUserService, AdminAuthService, AdminSessionGuard]
```

- [ ] **Step 6: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin-auth.service.spec.ts test/admin.controller.e2e-spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin apps/api/test/admin-auth.service.spec.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: add admin session auth"
```

## Task 5: Admin 管理员授权 API

**Files:**
- Create: `apps/api/src/admin/admin-user.controller.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 增加 e2e 测试**

Append to `apps/api/test/admin.controller.e2e-spec.ts`:

```ts
it('POST /api/v1/admin/admin-users 要求平台管理员权限', async () => {
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-audit',
    feishuUserId: 'ou_audit',
    displayName: '审计员',
    roles: ['audit_viewer'],
    applicationIds: []
  });

  await request(app.getHttpServer())
    .post('/api/v1/admin/admin-users')
    .set('Cookie', ['feishu_iam_admin_session=bias_test'])
    .send({ feishuUserId: 'ou_2', roleKeys: ['application_admin'], applicationIds: [] })
    .expect(403)
    .expect((res) => {
      expect(res.body.error.code).toBe('ADMIN_PERMISSION_DENIED');
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin.controller.e2e-spec.ts
```

Expected: FAIL because route does not exist.

- [ ] **Step 3: 实现 controller**

Create `apps/api/src/admin/admin-user.controller.ts`:

```ts
import { Body, Controller, Get, Inject, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminErrorFilter } from './admin-error.filter';
import { AdminPermissionService } from './admin-permission.service';
import { readAdminContext } from './admin-request-context';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminUserService } from './admin-user.service';
import { AdminDomainError, type AdminRoleKey } from './admin.types';

type CreateAdminUserBody = {
  feishuUserId: string;
  roleKeys: AdminRoleKey[];
  applicationIds?: string[];
};

@Controller('/api/v1/admin/admin-users')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter)
export class AdminUserController {
  constructor(
    @Inject(AdminUserService) private readonly users: AdminUserService,
    @Inject(AdminPermissionService) private readonly permissions: AdminPermissionService
  ) {}

  @Post()
  async createAdminUser(@Req() request: Request, @Body() body: CreateAdminUserBody) {
    const context = readRequiredContext(request);
    this.permissions.assertCanManageAdmins(context);
    return this.users.createAdminUser({
      feishuUserId: body.feishuUserId,
      roleKeys: body.roleKeys,
      applicationIds: body.applicationIds ?? []
    });
  }

  @Get()
  async listAdminUsers(@Req() request: Request) {
    const context = readRequiredContext(request);
    this.permissions.assertCanManageAdmins(context);
    return { items: await this.users.listAdminUsers() };
  }
}

function readRequiredContext(request: Request) {
  const context = readAdminContext(request);
  if (!context) {
    throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
  }
  return context;
}
```

- [ ] **Step 4: 补充 listAdminUsers 服务方法**

Update `AdminUserService`:

```ts
async listAdminUsers() {
  return this.prisma.adminUser.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      roles: { include: { adminRole: true } },
      applicationScopes: { include: { application: true } }
    }
  });
}
```

- [ ] **Step 5: 注册 controller**

Update `AdminModule`:

```ts
controllers: [AdminAuthController, AdminUserController]
```

- [ ] **Step 6: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin.controller.e2e-spec.ts test/admin-user.service.spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: add admin user api"
```

## Task 6: Web 管理端 Admin API 入口复用现有 permission、oauth、feishu 服务

**Files:**
- Create: `apps/api/src/admin/admin-permission.controller.ts`
- Create: `apps/api/src/admin/admin-oauth-config.controller.ts`
- Create: `apps/api/src/admin/admin-feishu.controller.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/permission/permission.module.ts`
- Modify: `apps/api/src/oauth/oauth.module.ts`
- Modify: `apps/api/src/feishu/feishu.module.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 写应用管理员 scope e2e 测试**

Append:

```ts
it('应用管理员不能读取未授权应用权限配置', async () => {
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-app',
    feishuUserId: 'ou_app',
    displayName: '应用管理员',
    roles: ['application_admin'],
    applicationIds: ['app-finance']
  });

  await request(app.getHttpServer())
    .get('/api/v1/admin/applications/hr/permission-points')
    .set('Cookie', ['feishu_iam_admin_session=bias_test'])
    .expect(403)
    .expect((res) => {
      expect(res.body.error.code).toBe('ADMIN_PERMISSION_DENIED');
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin.controller.e2e-spec.ts
```

Expected: FAIL because admin application route is missing.

- [ ] **Step 3: 实现 AdminPermissionController**

Create `apps/api/src/admin/admin-permission.controller.ts`:

```ts
import { Controller, Get, Inject, Param, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApplicationService } from '../permission/application.service';
import { PermissionCatalogService } from '../permission/permission-catalog.service';
import { PermissionErrorFilter } from '../permission/permission-error.filter';
import { AdminErrorFilter } from './admin-error.filter';
import { AdminPermissionService } from './admin-permission.service';
import { readAdminContext } from './admin-request-context';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminDomainError } from './admin.types';

@Controller('/api/v1/admin/applications')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter, PermissionErrorFilter)
export class AdminPermissionController {
  constructor(
    @Inject(ApplicationService) private readonly applications: ApplicationService,
    @Inject(PermissionCatalogService) private readonly catalog: PermissionCatalogService,
    @Inject(AdminPermissionService) private readonly permissions: AdminPermissionService
  ) {}

  @Get()
  async listApplications(@Req() request: Request) {
    const context = readRequiredContext(request);
    const applications = await this.applications.listApplications();
    if (context.roles.includes('platform_admin') || context.roles.includes('audit_viewer')) {
      return { items: applications };
    }
    return { items: applications.filter((app) => context.applicationIds.includes(app.id)) };
  }

  @Get('/:appKey/permission-points')
  async listPermissionPoints(@Req() request: Request, @Param('appKey') appKey: string) {
    const context = readRequiredContext(request);
    const application = await this.applications.getApplicationByKey(appKey);
    this.permissions.assertCanManageApplication(context, application.id);
    return { items: await this.catalog.listPermissionPoints(appKey) };
  }
}

function readRequiredContext(request: Request) {
  const context = readAdminContext(request);
  if (!context) {
    throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
  }
  return context;
}
```

- [ ] **Step 4: 补全 oauth 和 feishu admin controller**

Create `apps/api/src/admin/admin-oauth-config.controller.ts` with the same route shapes as `OauthConfigController`, but under `/api/v1/admin/applications/:appKey/...`, and before each operation:

```ts
const application = await this.applications.getApplicationByKey(appKey);
this.permissions.assertCanManageApplication(context, application.id);
```

Create `apps/api/src/admin/admin-feishu.controller.ts`:

```ts
@Controller('/api/v1/admin/feishu')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter, FeishuErrorFilter)
export class AdminFeishuController {
  @Get('/status') /* allow platform_admin, audit_viewer, sync_admin */
  @Get('/sync-runs') /* allow platform_admin, audit_viewer, sync_admin */
  @Post('/sync-runs') /* allow platform_admin, sync_admin only */
}
```

Use the exact existing `FeishuStatusService`, `FeishuSyncService`, and `FeishuDiagnosticsService` methods rather than duplicating sync logic.

- [ ] **Step 5: 注册模块 imports 和 controllers**

Update `AdminModule`:

```ts
imports: [PrismaModule, PermissionModule, OauthModule, FeishuModule],
controllers: [
  AdminAuthController,
  AdminUserController,
  AdminPermissionController,
  AdminOauthConfigController,
  AdminFeishuController
]
```

- [ ] **Step 6: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin.controller.e2e-spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: add admin web api"
```

## Task 7: 审计日志与安全事件查询 API

**Files:**
- Create: `apps/api/src/admin/admin-query.service.ts`
- Create: `apps/api/src/admin/admin-audit.controller.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Test: `apps/api/test/admin-query.service.spec.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 写查询服务测试**

Create `apps/api/test/admin-query.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AdminQueryService } from '../src/admin/admin-query.service';

describe('AdminQueryService', () => {
  it('应用管理员查询审计日志时强制追加授权应用范围', async () => {
    const prisma = { auditLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } };
    const service = new AdminQueryService(prisma as never);

    await service.listAuditLogs(
      { roles: ['application_admin'], applicationIds: ['app-finance'], adminUserId: 'admin-1', feishuUserId: 'ou_1', displayName: '张三' },
      { page: 1, pageSize: 20 }
    );

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ applicationId: { in: ['app-finance'] } })
    }));
  });

  it('详情脱敏 secret token cookie authorization password 字段', () => {
    const service = new AdminQueryService({} as never);
    expect(service.redactSensitive({ client_secret: 'a', nested: { token: 'b', name: 'ok' } })).toEqual({
      client_secret: '***',
      nested: { token: '***', name: 'ok' }
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin-query.service.spec.ts
```

Expected: FAIL because query service does not exist.

- [ ] **Step 3: 实现查询服务**

Create `apps/api/src/admin/admin-query.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminContext } from './admin.types';

type PageInput = { page?: number; pageSize?: number; appKey?: string; requestId?: string; result?: string };

const SENSITIVE_KEYS = new Set(['client_secret', 'access_token', 'refresh_token', 'authorization', 'cookie', 'token', 'secret', 'password']);

@Injectable()
export class AdminQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(context: AdminContext, input: PageInput) {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const where = {
      ...this.applicationWhere(context),
      requestId: input.requestId,
      result: input.result
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.auditLog.count({ where })
    ]);
    return { items: items.map((item) => ({ ...item, before: this.redactSensitive(item.before), after: this.redactSensitive(item.after) })), total, page, pageSize };
  }

  async listSecurityEvents(context: AdminContext, input: PageInput) {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const where = this.applicationWhere(context);
    const [items, total] = await Promise.all([
      this.prisma.securityEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.securityEvent.count({ where })
    ]);
    return { items, total, page, pageSize };
  }

  redactSensitive(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSensitive(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEYS.has(key.toLowerCase()) ? '***' : this.redactSensitive(item)]));
    }
    return value;
  }

  private applicationWhere(context: AdminContext) {
    if (context.roles.includes('platform_admin') || context.roles.includes('audit_viewer')) {
      return {};
    }
    if (context.roles.includes('application_admin')) {
      return { applicationId: { in: context.applicationIds } };
    }
    if (context.roles.includes('sync_admin')) {
      return { resourceType: { in: ['feishu_sync_run', 'feishu_sync'] } };
    }
    return { applicationId: { in: [] } };
  }
}
```

- [ ] **Step 4: 实现 controller**

Create `apps/api/src/admin/admin-audit.controller.ts`:

```ts
import { Controller, Get, Inject, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminErrorFilter } from './admin-error.filter';
import { AdminQueryService } from './admin-query.service';
import { readAdminContext } from './admin-request-context';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminDomainError } from './admin.types';

@Controller('/api/v1/admin')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter)
export class AdminAuditController {
  constructor(@Inject(AdminQueryService) private readonly queryService: AdminQueryService) {}

  @Get('/audit-logs')
  listAuditLogs(@Req() request: Request, @Query() query: Record<string, string | undefined>) {
    return this.queryService.listAuditLogs(readRequiredContext(request), {
      page: Number(query.page ?? 1),
      pageSize: Number(query.pageSize ?? 20),
      requestId: query.request_id,
      result: query.result
    });
  }

  @Get('/security-events')
  listSecurityEvents(@Req() request: Request, @Query() query: Record<string, string | undefined>) {
    return this.queryService.listSecurityEvents(readRequiredContext(request), {
      page: Number(query.page ?? 1),
      pageSize: Number(query.pageSize ?? 20),
      requestId: query.request_id,
      result: query.result
    });
  }
}

function readRequiredContext(request: Request) {
  const context = readAdminContext(request);
  if (!context) {
    throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
  }
  return context;
}
```

- [ ] **Step 5: 注册 service/controller**

Update `AdminModule` providers/controllers to include `AdminQueryService` and `AdminAuditController`.

- [ ] **Step 6: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin-query.service.spec.ts test/admin.controller.e2e-spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin apps/api/test/admin-query.service.spec.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: add admin audit queries"
```

## Task 8: 前端 Admin API client 和传统后台 shell

**Files:**
- Create: `apps/admin-web/src/api/admin.ts`
- Create: `apps/admin-web/src/admin-types.ts`
- Create: `apps/admin-web/src/theme.ts`
- Create: `apps/admin-web/src/components/AdminShell.tsx`
- Create: `apps/admin-web/src/components/ConfirmDialog.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Test: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 写前端测试**

Append to `apps/admin-web/src/App.test.tsx`:

```tsx
it('显示传统后台布局和当前管理员信息', async () => {
  mockFetch({
    '/api/v1/admin/me': {
      adminUserId: 'admin-1',
      feishuUserId: 'ou_1',
      displayName: '张三',
      roles: ['platform_admin'],
      applicationIds: []
    },
    '/api/v1/admin/applications': { items: [] },
    '/api/v1/admin/audit-logs?page=1&pageSize=20': { items: [], total: 0, page: 1, pageSize: 20 },
    '/api/v1/admin/security-events?page=1&pageSize=20': { items: [], total: 0, page: 1, pageSize: 20 }
  });

  render(<App />);

  expect(await screen.findByText('Feishu IAM')).toBeInTheDocument();
  expect(screen.getByText('唐群内部身份与权限控制台')).toBeInTheDocument();
  expect(screen.getByText('张三 · 平台管理员')).toBeInTheDocument();
  expect(screen.getByRole('navigation')).toHaveTextContent('工作台');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL because admin API/shell do not exist.

- [ ] **Step 3: 创建 admin types 和 API**

Create `apps/admin-web/src/admin-types.ts`:

```ts
export type AdminRoleKey = 'platform_admin' | 'application_admin' | 'audit_viewer' | 'sync_admin';

export type AdminMe = {
  adminUserId: string;
  feishuUserId: string;
  displayName: string;
  roles: AdminRoleKey[];
  applicationIds: string[];
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
```

Create `apps/admin-web/src/api/admin.ts`:

```ts
import type { AdminMe, PageResult } from '../admin-types';

export class AdminApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string, readonly requestId?: string) {
    super([code, message, requestId ? `request id: ${requestId}` : null].filter(Boolean).join(' / '));
    this.name = 'AdminApiError';
  }
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'include' });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<AdminApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; request_id?: string } };
    return new AdminApiError(response.status, body.error?.message ?? '管理后台请求失败', body.error?.code, body.error?.request_id);
  } catch {
    return new AdminApiError(response.status, '管理后台请求失败');
  }
}

export function fetchAdminMe(): Promise<AdminMe> {
  return readJson<AdminMe>('/api/v1/admin/me');
}

export function fetchAdminAuditLogs(): Promise<PageResult<unknown>> {
  return readJson<PageResult<unknown>>('/api/v1/admin/audit-logs?page=1&pageSize=20');
}

export function fetchAdminSecurityEvents(): Promise<PageResult<unknown>> {
  return readJson<PageResult<unknown>>('/api/v1/admin/security-events?page=1&pageSize=20');
}
```

- [ ] **Step 4: 创建主题和 shell**

Create `apps/admin-web/src/theme.ts`:

```ts
export const tangtringTheme = {
  topbar: '#123445',
  sidebar: '#0d2635',
  accentBlue: '#0b67b2',
  accentGreen: '#20b386',
  accentLime: '#9dbf3c',
  pageBackground: '#f6f8fb'
} as const;
```

Create `apps/admin-web/src/components/AdminShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { AdminMe } from '../admin-types';

type Props = {
  admin: AdminMe;
  children: ReactNode;
};

const roleNames: Record<string, string> = {
  platform_admin: '平台管理员',
  application_admin: '应用管理员',
  audit_viewer: '审计查看员',
  sync_admin: '同步管理员'
};

export function AdminShell({ admin, children }: Props) {
  const primaryRole = roleNames[admin.roles[0] ?? ''] ?? '管理员';
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <div className="admin-logo-mark">BI</div>
          <div>
            <strong>Feishu IAM</strong>
            <span>唐群内部身份与权限控制台</span>
          </div>
        </div>
        <div className="admin-user">{admin.displayName} · {primaryRole}</div>
      </header>
      <div className="admin-body">
        <nav className="admin-sidebar" aria-label="主菜单">
          <a className="active">工作台</a>
          <a>应用管理</a>
          <a>权限模型</a>
          <a>SSO 接入</a>
          <a>飞书同步</a>
          <a>审计中心</a>
          <a>安全事件</a>
          <a>管理员授权</a>
        </nav>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 改造 App.tsx 为先加载 admin session**

At top of `App.tsx`, import:

```tsx
import { fetchAdminMe } from './api/admin';
import { AdminShell } from './components/AdminShell';
import type { AdminMe } from './admin-types';
```

In `App`, add admin state and gate existing content:

```tsx
const [adminState, setAdminState] = useState<{ status: 'loading' } | { status: 'loaded'; admin: AdminMe } | { status: 'failed'; message: string }>({ status: 'loading' });

useEffect(() => {
  void fetchAdminMe()
    .then((admin) => setAdminState({ status: 'loaded', admin }))
    .catch((error: unknown) => setAdminState({ status: 'failed', message: error instanceof Error ? error.message : '需要登录 Feishu IAM 管理后台' }));
}, []);

if (adminState.status === 'loading') {
  return <main className="admin-login-state">正在读取管理员身份...</main>;
}
if (adminState.status === 'failed') {
  return <main className="admin-login-state"><h1>需要登录 Feishu IAM 管理后台</h1><p>{adminState.message}</p><a href="/admin/auth/login">使用飞书登录</a></main>;
}

return <AdminShell admin={adminState.admin}>{/* existing dashboard content */}</AdminShell>;
```

- [ ] **Step 6: 写 CSS**

Add to `apps/admin-web/src/App.css`:

```css
.admin-shell {
  min-height: 100vh;
  background: #f6f8fb;
  color: #102a3a;
}

.admin-topbar {
  height: 58px;
  background: #123445;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  border-bottom: 2px solid #20b386;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-logo-mark {
  width: 34px;
  height: 34px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-weight: 800;
}

.admin-brand strong,
.admin-brand span {
  display: block;
}

.admin-brand span {
  color: #a9c8d8;
  font-size: 12px;
}

.admin-body {
  display: grid;
  grid-template-columns: 230px 1fr;
  min-height: calc(100vh - 58px);
}

.admin-sidebar {
  background: #0d2635;
  color: #b8cad4;
  padding: 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-sidebar a {
  color: inherit;
  text-decoration: none;
  padding: 9px 10px;
  border-radius: 7px;
}

.admin-sidebar a.active {
  background: #17445a;
  color: #fff;
  border-left: 3px solid #20b386;
}

.admin-main {
  padding: 22px;
}
```

- [ ] **Step 7: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web/src
git commit -m "feat: add admin console shell"
```

## Task 9: 前端 API 迁移、角色工作台、审计中心和安全事件页

**Files:**
- Modify: `apps/admin-web/src/api/permission.ts`
- Modify: `apps/admin-web/src/api/oauth.ts`
- Modify: `apps/admin-web/src/api/feishu.ts`
- Create: `apps/admin-web/src/components/RoleWorkspace.tsx`
- Create: `apps/admin-web/src/components/AuditCenter.tsx`
- Create: `apps/admin-web/src/components/SecurityEventCenter.tsx`
- Create: `apps/admin-web/src/components/AdminUserCenter.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.css`
- Test: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 写测试覆盖平台 token 移除**

Append:

```tsx
it('管理端 API 不再注入 VITE_PLATFORM_ADMIN_TOKEN', async () => {
  const calls: Request[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    calls.push(new Request(input, init));
    return new Response(JSON.stringify({ adminUserId: 'admin-1', feishuUserId: 'ou_1', displayName: '张三', roles: ['platform_admin'], applicationIds: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  render(<App />);
  await screen.findByText('张三 · 平台管理员');

  expect(calls.some((request) => request.headers.has('Authorization'))).toBe(false);
});
```

- [ ] **Step 2: 运行测试确认失败或暴露旧 token 注入**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL if old API clients are still called with Authorization header.

- [ ] **Step 3: 迁移 API paths**

In `permission.ts`, replace `/api/v1/platform/applications` with `/api/v1/admin/applications` and delete `VITE_PLATFORM_ADMIN_TOKEN` logic. Use:

```ts
async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: init?.headers
  });
  if (!response.ok) {
    throw await readError(response);
  }
  return response.json() as Promise<T>;
}
```

Apply the same pattern in `oauth.ts` and `feishu.ts`.

- [ ] **Step 4: 创建角色工作台**

Create `RoleWorkspace.tsx`:

```tsx
import type { AdminMe } from '../admin-types';

export function RoleWorkspace({ admin }: { admin: AdminMe }) {
  const isPlatform = admin.roles.includes('platform_admin');
  return (
    <section className="role-workspace">
      <div>
        <h1>管理员工作台</h1>
        <p>聚焦待处理风险、接入状态、权限变更和同步健康度。</p>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card"><strong>{isPlatform ? '全部' : admin.applicationIds.length}</strong><span>可管理应用</span></div>
        <div className="kpi-card green"><strong>审计</strong><span>可追溯配置变更</span></div>
        <div className="kpi-card lime"><strong>SSO</strong><span>client 与回调地址治理</span></div>
        <div className="kpi-card warn"><strong>风险</strong><span>高风险操作需确认</span></div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: 创建审计和安全事件组件**

Create `AuditCenter.tsx`:

```tsx
export function AuditCenter() {
  return (
    <section className="admin-panel">
      <header><h2>审计中心</h2><p>按操作者、应用、动作、结果、request id 和时间范围追溯变更。</p></header>
      <div className="filter-row"><input placeholder="request id" /><input placeholder="操作者" /><button>查询</button></div>
      <p className="empty-state">暂无审计记录，或当前管理员没有可查看的审计范围。</p>
    </section>
  );
}
```

Create `SecurityEventCenter.tsx`:

```tsx
export function SecurityEventCenter() {
  return (
    <section className="admin-panel">
      <header><h2>安全事件</h2><p>查询 OAuth、token、client 和登录失败事件。</p></header>
      <div className="filter-row"><input placeholder="reason code" /><input placeholder="client id" /><button>查询</button></div>
      <p className="empty-state">暂无安全事件，或当前筛选条件没有匹配结果。</p>
    </section>
  );
}
```

- [ ] **Step 6: 接入 App**

Render inside `AdminShell`:

```tsx
<RoleWorkspace admin={adminState.admin} />
<AuditCenter />
<SecurityEventCenter />
```

- [ ] **Step 7: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web/src
git commit -m "feat: migrate admin web to admin session"
```

## Task 10: 唐群风格 UI 细化和 logo 资产

**Files:**
- Create/Replace: `apps/admin-web/src/assets/feishu-iam-logo.svg`
- Modify: `apps/admin-web/src/components/AdminShell.tsx`
- Modify: `apps/admin-web/src/App.css`
- Test: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 使用图像生成工具生成 logo 候选**

Use image2 or the available image generation tool with this prompt:

```text
为 Feishu IAM 生成 3 个企业内部身份与权限管理平台 logo 候选。风格参考唐群座椅科技官网的深蓝、青绿、白色、汽车科技和制造业可靠感，但不要复制唐群现有 logo。logo 要适合放在传统后台管理系统左上角，表达身份、权限、连接、可靠、审计。扁平矢量风格，避免 AI 味、玻璃拟态、漂浮光球、紫色渐变。输出白底和深蓝底都可识别的方案。
```

Expected: 2 到 3 个候选方向。用户确认后再落地为 `feishu-iam-logo.svg`。

- [ ] **Step 2: 写 logo 测试**

Append:

```tsx
it('左上角展示 Feishu IAM logo 和平台名称', async () => {
  mockAdminSession();
  render(<App />);
  expect(await screen.findByLabelText('Feishu IAM 标识')).toBeInTheDocument();
  expect(screen.getByText('唐群内部身份与权限控制台')).toBeInTheDocument();
});
```

- [ ] **Step 3: 替换 logo 临时标识**

Create `apps/admin-web/src/assets/feishu-iam-logo.svg` as a simplified selected mark if generated raster cannot be committed directly:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="Feishu IAM 标识">
  <rect width="48" height="48" rx="8" fill="#123445"/>
  <path d="M14 15h20v7c0 8-4.6 14-10 17-5.4-3-10-9-10-17v-7Z" fill="none" stroke="#20B386" stroke-width="3"/>
  <path d="M18 24h12M24 18v12" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
</svg>
```

Update `AdminShell`:

```tsx
import logoUrl from '../assets/feishu-iam-logo.svg';

<img className="admin-logo-image" src={logoUrl} alt="Feishu IAM 标识" aria-label="Feishu IAM 标识" />
```

- [ ] **Step 4: 细化 CSS，保留传统后台习惯**

Ensure:

- 左侧菜单固定。
- 右上角用户信息固定。
- 左上角 logo + 平台名固定。
- 卡片圆角不超过 8px。
- 主色不偏紫，不出现漂浮装饰。

- [ ] **Step 5: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
pnpm --filter @feishu-iam/admin-web build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src
git commit -m "feat: apply tangtring admin theme"
```

## Task 11: 版本、文档、验证和发布准备

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `docs/permission-model.md`
- Modify: `docs/sso-provider.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.0-实施计划.md`

- [ ] **Step 1: 更新版本号**

Set all package versions from `0.4.0` to `0.5.0`.

- [ ] **Step 2: 更新 README**

Add current state:

```markdown
- 实现管理后台与管理员体系最小闭环：飞书管理员登录、固定后台角色、应用管理范围、Web 管理端 admin session、审计日志查询、安全事件查询和唐群风格传统后台布局。
```

- [ ] **Step 3: 更新 CHANGELOG**

Add:

```markdown
## v0.5.0

`v0.5.0` 是管理后台与管理员体系最小闭环版本。

### 新增

- 新增管理员、后台角色、应用管理范围和后台 session 数据模型。
- 新增 `/api/v1/admin/*` Web 管理端 API，使用管理员 session 和固定角色权限校验。
- 新增审计日志和安全事件查询能力。
- 管理端从平台 token 工具页升级为传统后台控制台。
- 管理端视觉参考唐群座椅深蓝、青绿和制造业技术风格。

### 约束

- 保留 `/api/v1/platform/*` 给自动化和运维脚本。
- 不实现完整 OIDC、SAML、refresh token、ABAC、资源级权限、飞书角色或飞书用户组同步。
```

- [ ] **Step 4: 更新 AGENTS 当前阶段**

Set current stage to `v0.5.0` planning/implementation, and note:

```markdown
当前优先事项是实现管理后台与管理员体系最小闭环。Web 管理端应使用管理员 session 和管理员权限校验，不再依赖前端注入 PLATFORM_ADMIN_TOKEN。UI 遵循传统后台布局，并参考唐群座椅深蓝、青绿、白色和制造业技术风格。
```

- [ ] **Step 5: 写会话归档**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.0-实施计划.md` with:

- 会话目标。
- 用户关键要求。
- 关键约束。
- 计划文件路径。
- 执行过的命令。
- 下一步建议。

- [ ] **Step 6: 全量验证**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:validate
pnpm check
docker compose -f deploy/docker-compose.yml config --quiet
git diff --check
```

Expected:

- Prisma schema valid.
- API and admin-web typecheck/lint/test pass.
- Docker Compose config valid.
- No whitespace errors.

- [ ] **Step 7: 敏感信息和未完成标记扫描**

Run:

```bash
rg -n "待补|client_secret\\s*[:=]\\s*[^*<]" README.md CHANGELOG.md AGENTS.md docs apps || true
```

Expected:

- No unresolved placeholders.
- No real secret/token/cookie/password in docs, tests, or source.
- Allow documented field names such as `client_secret` only when values are redacted or explanatory.

- [ ] **Step 8: Commit**

```bash
git add package.json apps/api/package.json apps/admin-web/package.json README.md CHANGELOG.md AGENTS.md docs
git commit -m "docs: update v0.5.0 admin console release notes"
```

## Execution Notes

- Prefer a feature branch such as `codex/v0.5.0-admin-console` before implementation.
- Use `superpowers:subagent-driven-development` for execution if parallel workers are acceptable. Disjoint write scopes:
  - Worker A: database + admin backend foundation.
  - Worker B: admin controllers + audit/security query.
  - Worker C: admin-web API/session migration.
  - Worker D: UI theme + logo + docs.
- Do not delete `/api/v1/platform/*` in this version.
- Do not commit `.env*`, `.superpowers/brainstorm/*`, generated screenshots, or real secrets.
- Before claiming completion, run `pnpm check`, `pnpm --filter @feishu-iam/api prisma:validate`, and `docker compose -f deploy/docker-compose.yml config --quiet`.
