# Feishu IAM v0.2.0 飞书身份镜像同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `v0.2.0` 飞书身份镜像闭环，让 Feishu IAM 使用真实飞书只读通讯录 API 同步部门、用户和用户部门关系，并通过平台 API、管理端状态页、run log 和测试完成验收。

**Architecture:** API 新增 `feishu` 模块，模块内部以 `FeishuClient` 接口隔离真实飞书 HTTP 访问和 mock 测试数据；`FeishuSyncService` 只负责编排全量同步、幂等 upsert、失效标记和 run log。管理端继续沿用当前 React 单页骨架，增加飞书同步状态、触发按钮和历史表；数据库通过版本化 DDL 与 Prisma schema 同步扩展。

**Tech Stack:** pnpm、TypeScript、NestJS、Prisma、PostgreSQL、React、Vite、Vitest、Supertest、Docker Compose。

---

## 范围说明

本计划只覆盖 `docs/superpowers/specs/2026-05-15-feishu-iam-v0.2.0-feishu-identity-sync-design.md` 中确认的身份镜像闭环。

必须实现：

- 飞书部门、用户、用户部门关系落库。
- 真实飞书只读 API 客户端。
- mock 飞书客户端和自动化测试。
- 手动全量同步。
- 同步 run log。
- 平台 API token 保护。
- 管理端同步状态页。
- 文档和会话归档。
- 静态扫描，确认没有飞书通讯录写接口路径。

明确不实现：

- 飞书角色。
- 飞书用户组。
- SSO/OAuth 登录。
- IAM 内部角色。
- 权限组、权限点、权限绑定。
- 定时同步、事件订阅、增量同步。
- 管理端编辑飞书密钥。

---

## 文件结构与职责

- `migrations/V0_2_0__feishu_identity_sync.sql`：创建飞书身份镜像表、索引和 schema 版本记录。
- `apps/api/prisma/schema.prisma`：新增 Prisma 模型，与 DDL 保持一致。
- `.env.example`：补充 `PLATFORM_ADMIN_TOKEN` 和飞书只读同步相关变量。
- `deploy/docker-compose.yml`：确保 API 容器可接收飞书和平台 token 环境变量。
- `apps/api/src/app.module.ts`：注册 `FeishuModule`。
- `apps/api/src/feishu/feishu.module.ts`：飞书同步模块。
- `apps/api/src/feishu/feishu.types.ts`：飞书同步领域类型、API DTO 类型和错误码。
- `apps/api/src/feishu/feishu-client.ts`：`FeishuClient` 接口和 provider token。
- `apps/api/src/feishu/feishu-http.client.ts`：真实飞书只读 HTTP 客户端。
- `apps/api/src/feishu/mock-feishu.client.ts`：测试和本地 mock 客户端。
- `apps/api/src/feishu/feishu-sync.service.ts`：全量同步编排、upsert、失效标记和 run log。
- `apps/api/src/feishu/feishu-status.service.ts`：同步状态和镜像统计查询。
- `apps/api/src/platform/platform-token.guard.ts`：最小平台 API token guard。
- `apps/api/src/feishu/feishu-error.filter.ts`：将飞书同步错误转换为稳定平台 API 错误响应。
- `apps/api/src/feishu/feishu.controller.ts`：平台 API 端点。
- `apps/api/test/feishu-sync.service.spec.ts`：同步服务单元测试，使用 fake Prisma 和 mock client。
- `apps/api/test/feishu.controller.e2e-spec.ts`：平台 API e2e 测试。
- `apps/api/test/feishu-readonly.spec.ts`：静态只读接口扫描测试。
- `apps/admin-web/src/api/feishu.ts`：管理端飞书 API 调用。
- `apps/admin-web/src/App.tsx`：增加飞书同步工作台。
- `apps/admin-web/src/App.css`：补充同步状态页样式。
- `apps/admin-web/src/App.test.tsx`：覆盖同步状态、历史和手动触发。
- `docs/feishu-identity-sync.md`：飞书只读应用权限、环境变量、字段映射、开发测试和手动验证说明。
- `docs/codex-sessions/2026-05-15-1553-v0.2.0-飞书身份镜像实施.md`：实施结束归档。

---

### Task 1: 数据库迁移与 Prisma 模型

**Files:**
- Create: `migrations/V0_2_0__feishu_identity_sync.sql`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `.env.example`
- Modify: `deploy/docker-compose.yml`

- [ ] **Step 1: 写入版本化 DDL**

创建 `migrations/V0_2_0__feishu_identity_sync.sql`：

```sql
CREATE TABLE IF NOT EXISTS feishu_departments (
  department_id TEXT PRIMARY KEY,
  open_department_id TEXT UNIQUE,
  parent_department_id TEXT,
  name TEXT NOT NULL,
  i18n_name JSONB,
  leader_user_id TEXT,
  "order" TEXT,
  status JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feishu_departments_parent_department_id_idx
  ON feishu_departments (parent_department_id);

CREATE INDEX IF NOT EXISTS feishu_departments_is_deleted_idx
  ON feishu_departments (is_deleted);

CREATE TABLE IF NOT EXISTS feishu_users (
  user_id TEXT PRIMARY KEY,
  open_id TEXT UNIQUE,
  union_id TEXT UNIQUE,
  name TEXT NOT NULL,
  en_name TEXT,
  email TEXT,
  mobile TEXT,
  mobile_visible BOOLEAN,
  avatar JSONB,
  employee_no TEXT,
  employee_type INTEGER,
  job_title TEXT,
  leader_user_id TEXT,
  status JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feishu_users_is_active_idx
  ON feishu_users (is_active);

CREATE INDEX IF NOT EXISTS feishu_users_is_deleted_idx
  ON feishu_users (is_deleted);

CREATE TABLE IF NOT EXISTS feishu_user_departments (
  user_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  user_order INTEGER,
  department_order INTEGER,
  last_synced_at TIMESTAMPTZ NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, department_id),
  CONSTRAINT feishu_user_departments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES feishu_users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT feishu_user_departments_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES feishu_departments (department_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS feishu_user_departments_department_id_idx
  ON feishu_user_departments (department_id);

CREATE INDEX IF NOT EXISTS feishu_user_departments_is_deleted_idx
  ON feishu_user_departments (is_deleted);

CREATE TABLE IF NOT EXISTS feishu_sync_runs (
  id TEXT PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  department_created_count INTEGER NOT NULL DEFAULT 0,
  department_updated_count INTEGER NOT NULL DEFAULT 0,
  department_deleted_count INTEGER NOT NULL DEFAULT 0,
  user_created_count INTEGER NOT NULL DEFAULT 0,
  user_updated_count INTEGER NOT NULL DEFAULT 0,
  user_deleted_count INTEGER NOT NULL DEFAULT 0,
  relation_created_count INTEGER NOT NULL DEFAULT 0,
  relation_updated_count INTEGER NOT NULL DEFAULT 0,
  relation_deleted_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  error_detail JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feishu_sync_runs_status_check
    CHECK (status IN ('running', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS feishu_sync_runs_started_at_idx
  ON feishu_sync_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS feishu_sync_runs_status_idx
  ON feishu_sync_runs (status);

INSERT INTO schema_versions (version, description)
VALUES ('0.2.0', '飞书组织与用户身份镜像同步')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 2: 扩展 Prisma schema**

在 `apps/api/prisma/schema.prisma` 的 `SchemaVersion` 后追加：

```prisma
model FeishuDepartment {
  departmentId       String                    @id @map("department_id")
  openDepartmentId   String?                   @unique @map("open_department_id")
  parentDepartmentId String?                   @map("parent_department_id")
  name               String
  i18nName           Json?                     @map("i18n_name")
  leaderUserId       String?                   @map("leader_user_id")
  order              String?
  status             Json                      @default("{}")
  rawPayload         Json                      @map("raw_payload")
  lastSyncedAt       DateTime                  @map("last_synced_at") @db.Timestamptz(6)
  isDeleted          Boolean                   @default(false) @map("is_deleted")
  createdAt          DateTime                  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime                  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  userDepartments    FeishuUserDepartment[]

  @@index([parentDepartmentId])
  @@index([isDeleted])
  @@map("feishu_departments")
}

model FeishuUser {
  userId          String                   @id @map("user_id")
  openId          String?                  @unique @map("open_id")
  unionId         String?                  @unique @map("union_id")
  name            String
  enName          String?                  @map("en_name")
  email           String?
  mobile          String?
  mobileVisible   Boolean?                 @map("mobile_visible")
  avatar          Json?
  employeeNo      String?                  @map("employee_no")
  employeeType    Int?                     @map("employee_type")
  jobTitle        String?                  @map("job_title")
  leaderUserId    String?                  @map("leader_user_id")
  status          Json                     @default("{}")
  rawPayload      Json                     @map("raw_payload")
  lastSyncedAt    DateTime                 @map("last_synced_at") @db.Timestamptz(6)
  isActive        Boolean                  @default(false) @map("is_active")
  isDeleted       Boolean                  @default(false) @map("is_deleted")
  createdAt       DateTime                 @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime                 @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  userDepartments FeishuUserDepartment[]

  @@index([isActive])
  @@index([isDeleted])
  @@map("feishu_users")
}

model FeishuUserDepartment {
  userId          String            @map("user_id")
  departmentId    String            @map("department_id")
  isPrimary       Boolean           @default(false) @map("is_primary")
  userOrder       Int?              @map("user_order")
  departmentOrder Int?              @map("department_order")
  lastSyncedAt    DateTime          @map("last_synced_at") @db.Timestamptz(6)
  isDeleted       Boolean           @default(false) @map("is_deleted")
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime          @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  user            FeishuUser        @relation(fields: [userId], references: [userId])
  department      FeishuDepartment  @relation(fields: [departmentId], references: [departmentId])

  @@id([userId, departmentId])
  @@index([departmentId])
  @@index([isDeleted])
  @@map("feishu_user_departments")
}

model FeishuSyncRun {
  id                     String    @id
  triggeredBy            String    @map("triggered_by")
  triggerSource          String    @map("trigger_source")
  status                 String
  startedAt              DateTime  @default(now()) @map("started_at") @db.Timestamptz(6)
  finishedAt             DateTime? @map("finished_at") @db.Timestamptz(6)
  departmentCreatedCount Int       @default(0) @map("department_created_count")
  departmentUpdatedCount Int       @default(0) @map("department_updated_count")
  departmentDeletedCount Int       @default(0) @map("department_deleted_count")
  userCreatedCount       Int       @default(0) @map("user_created_count")
  userUpdatedCount       Int       @default(0) @map("user_updated_count")
  userDeletedCount       Int       @default(0) @map("user_deleted_count")
  relationCreatedCount   Int       @default(0) @map("relation_created_count")
  relationUpdatedCount   Int       @default(0) @map("relation_updated_count")
  relationDeletedCount   Int       @default(0) @map("relation_deleted_count")
  errorCode              String?   @map("error_code")
  errorMessage           String?   @map("error_message")
  errorDetail            Json?     @map("error_detail")
  requestId              String?   @map("request_id")
  createdAt              DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt              DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([startedAt])
  @@index([status])
  @@map("feishu_sync_runs")
}
```

- [ ] **Step 3: 更新 `.env.example`**

确保 `.env.example` 包含以下变量，且所有值都是占位值：

```dotenv
PLATFORM_ADMIN_TOKEN=replace-with-local-admin-token
FEISHU_APP_ID=cli_replace_me
FEISHU_APP_SECRET=replace_me
```

如果文件里已有 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`，只补充 `PLATFORM_ADMIN_TOKEN`，不要写真实凭证。

- [ ] **Step 4: 更新 Docker Compose 环境变量**

在 `deploy/docker-compose.yml` 的 API 服务环境变量中补充：

```yaml
      PLATFORM_ADMIN_TOKEN: ${PLATFORM_ADMIN_TOKEN:-replace-with-local-admin-token}
      FEISHU_APP_ID: ${FEISHU_APP_ID:-}
      FEISHU_APP_SECRET: ${FEISHU_APP_SECRET:-}
```

- [ ] **Step 5: 校验 Prisma schema**

运行：

```bash
pnpm --filter @feishu-iam/api prisma:format
pnpm --filter @feishu-iam/api prisma:validate
```

预期：两个命令都成功退出，Prisma schema 没有格式或约束错误。

- [ ] **Step 6: 提交数据库和配置变更**

运行：

```bash
git add migrations/V0_2_0__feishu_identity_sync.sql apps/api/prisma/schema.prisma .env.example deploy/docker-compose.yml
git commit -m "feat: add feishu identity sync schema"
```

预期：生成 schema 相关提交。

---

### Task 2: 飞书类型、只读客户端接口和真实 HTTP 客户端

**Files:**
- Create: `apps/api/src/feishu/feishu.types.ts`
- Create: `apps/api/src/feishu/feishu-client.ts`
- Create: `apps/api/src/feishu/feishu-http.client.ts`
- Create: `apps/api/src/feishu/mock-feishu.client.ts`
- Create: `apps/api/src/feishu/feishu.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/feishu-readonly.spec.ts`

- [ ] **Step 1: 写入领域类型**

创建 `apps/api/src/feishu/feishu.types.ts`：

```ts
export type FeishuSyncRunStatus = 'running' | 'success' | 'failed';

export type FeishuSyncTriggerSource = 'platform_api' | 'admin_web' | 'test';

export type FeishuConnectionStatus =
  | 'not_configured'
  | 'configured'
  | 'connected'
  | 'failed';

export type FeishuUserStatus = {
  is_frozen?: boolean;
  is_resigned?: boolean;
  is_activated?: boolean;
  is_exited?: boolean;
  is_unjoin?: boolean;
};

export type FeishuDepartmentItem = {
  department_id: string;
  open_department_id?: string;
  parent_department_id?: string;
  name: string;
  i18n_name?: Record<string, unknown>;
  leader_user_id?: string;
  order?: string;
  status?: Record<string, unknown>;
};

export type FeishuUserOrder = {
  department_id?: string;
  user_order?: number;
  department_order?: number;
  is_primary_dept?: boolean;
};

export type FeishuUserItem = {
  user_id: string;
  open_id?: string;
  union_id?: string;
  name: string;
  en_name?: string;
  email?: string;
  mobile?: string;
  mobile_visible?: boolean;
  avatar?: Record<string, unknown>;
  employee_no?: string;
  employee_type?: number;
  job_title?: string;
  leader_user_id?: string;
  status?: FeishuUserStatus;
  department_ids?: string[];
  orders?: FeishuUserOrder[];
};

export type FeishuPage<T> = {
  items: T[];
  hasMore: boolean;
  pageToken?: string;
  requestId?: string;
};

export type FeishuClientErrorCode =
  | 'FEISHU_CONFIG_MISSING'
  | 'FEISHU_PERMISSION_DENIED'
  | 'FEISHU_API_ERROR'
  | 'FEISHU_NETWORK_ERROR';

export class FeishuClientError extends Error {
  constructor(
    public readonly code: FeishuClientErrorCode,
    message: string,
    public readonly detail?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function isFeishuUserActive(status: FeishuUserStatus | undefined): boolean {
  return (
    status?.is_frozen !== true &&
    status?.is_resigned !== true &&
    status?.is_activated === true &&
    status?.is_exited !== true &&
    status?.is_unjoin !== true
  );
}
```

- [ ] **Step 2: 写入 FeishuClient 接口**

创建 `apps/api/src/feishu/feishu-client.ts`：

```ts
import type { FeishuDepartmentItem, FeishuPage, FeishuUserItem } from './feishu.types';

export const FEISHU_CLIENT = Symbol('FEISHU_CLIENT');

export type ListDepartmentChildrenParams = {
  departmentId: string;
  pageSize?: number;
  pageToken?: string;
};

export type ListDepartmentUsersParams = {
  departmentId: string;
  pageSize?: number;
  pageToken?: string;
};

export interface FeishuClient {
  getTenantAccessToken(): Promise<string>;
  listDepartmentChildren(
    params: ListDepartmentChildrenParams
  ): Promise<FeishuPage<FeishuDepartmentItem>>;
  listDepartmentUsers(params: ListDepartmentUsersParams): Promise<FeishuPage<FeishuUserItem>>;
}
```

- [ ] **Step 3: 写入真实只读 HTTP 客户端**

创建 `apps/api/src/feishu/feishu-http.client.ts`：

```ts
import { Injectable } from '@nestjs/common';
import type {
  FeishuClient,
  ListDepartmentChildrenParams,
  ListDepartmentUsersParams
} from './feishu-client';
import {
  FeishuClientError,
  type FeishuDepartmentItem,
  type FeishuPage,
  type FeishuUserItem
} from './feishu.types';

type TenantTokenResponse = {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
};

type FeishuListResponse<T> = {
  code: number;
  msg: string;
  data?: T;
};

type DepartmentChildrenData = {
  items?: FeishuDepartmentItem[];
  has_more?: boolean;
  page_token?: string;
};

type DepartmentUsersData = {
  items?: FeishuUserItem[];
  has_more?: boolean;
  page_token?: string;
};

@Injectable()
export class FeishuHttpClient implements FeishuClient {
  private cachedToken: { value: string; expiresAt: number } | undefined;
  private readonly baseUrl = 'https://open.feishu.cn/open-apis';

  async getTenantAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt - now > 30 * 60 * 1000) {
      return this.cachedToken.value;
    }

    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    if (!appId || !appSecret) {
      throw new FeishuClientError('FEISHU_CONFIG_MISSING', '飞书应用配置缺失');
    }

    const response = await this.postJson<TenantTokenResponse>(
      '/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret
      }
    );

    if (response.code !== 0 || !response.tenant_access_token || !response.expire) {
      throw this.toClientError(response.code, response.msg, '/auth/v3/tenant_access_token/internal');
    }

    this.cachedToken = {
      value: response.tenant_access_token,
      expiresAt: now + response.expire * 1000
    };
    return response.tenant_access_token;
  }

  async listDepartmentChildren(
    params: ListDepartmentChildrenParams
  ): Promise<FeishuPage<FeishuDepartmentItem>> {
    const data = await this.getPaged<DepartmentChildrenData>(
      `/contact/v3/departments/${encodeURIComponent(params.departmentId)}/children`,
      {
        department_id_type: 'department_id',
        user_id_type: 'user_id',
        page_size: String(params.pageSize ?? 50),
        page_token: params.pageToken
      }
    );

    return {
      items: data.items ?? [],
      hasMore: data.has_more === true,
      pageToken: data.page_token
    };
  }

  async listDepartmentUsers(params: ListDepartmentUsersParams): Promise<FeishuPage<FeishuUserItem>> {
    const data = await this.getPaged<DepartmentUsersData>('/contact/v3/users/find_by_department', {
      department_id: params.departmentId,
      department_id_type: 'department_id',
      user_id_type: 'user_id',
      page_size: String(params.pageSize ?? 50),
      page_token: params.pageToken
    });

    return {
      items: data.items ?? [],
      hasMore: data.has_more === true,
      pageToken: data.page_token
    };
  }

  private async getPaged<T>(path: string, query: Record<string, string | undefined>): Promise<T> {
    const token = await this.getTenantAccessToken();
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value.length > 0) {
        url.searchParams.set(key, value);
      }
    });

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      throw new FeishuClientError('FEISHU_NETWORK_ERROR', '飞书接口网络请求失败', {
        path,
        cause: error instanceof Error ? error.message : String(error)
      });
    }

    const payload = (await response.json()) as FeishuListResponse<T>;
    if (!response.ok || payload.code !== 0 || !payload.data) {
      throw this.toClientError(payload.code, payload.msg, path, response.headers.get('x-request-id'));
    }
    return payload.data;
  }

  private async postJson<T>(path: string, body: Record<string, string>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new FeishuClientError('FEISHU_NETWORK_ERROR', '飞书 token 请求失败', {
        path,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
    return response.json() as Promise<T>;
  }

  private toClientError(
    feishuCode: number,
    message: string,
    path: string,
    requestId?: string | null
  ): FeishuClientError {
    const code = feishuCode === 99991663 || feishuCode === 99991664 ? 'FEISHU_PERMISSION_DENIED' : 'FEISHU_API_ERROR';
    return new FeishuClientError(code, message || '飞书接口返回错误', {
      feishu_code: feishuCode,
      path,
      request_id: requestId ?? undefined
    });
  }
}
```

- [ ] **Step 4: 写入 mock 客户端**

创建 `apps/api/src/feishu/mock-feishu.client.ts`：

```ts
import type {
  FeishuClient,
  ListDepartmentChildrenParams,
  ListDepartmentUsersParams
} from './feishu-client';
import type { FeishuDepartmentItem, FeishuPage, FeishuUserItem } from './feishu.types';

export class MockFeishuClient implements FeishuClient {
  constructor(
    private readonly departmentsByParent: Record<string, FeishuDepartmentItem[]> = {},
    private readonly usersByDepartment: Record<string, FeishuUserItem[]> = {}
  ) {}

  async getTenantAccessToken(): Promise<string> {
    return 'mock-tenant-access-token';
  }

  async listDepartmentChildren(
    params: ListDepartmentChildrenParams
  ): Promise<FeishuPage<FeishuDepartmentItem>> {
    return this.page(this.departmentsByParent[params.departmentId] ?? [], params.pageSize, params.pageToken);
  }

  async listDepartmentUsers(params: ListDepartmentUsersParams): Promise<FeishuPage<FeishuUserItem>> {
    return this.page(this.usersByDepartment[params.departmentId] ?? [], params.pageSize, params.pageToken);
  }

  private page<T>(items: T[], pageSize = 50, pageToken?: string): FeishuPage<T> {
    const start = pageToken ? Number(pageToken) : 0;
    const end = start + pageSize;
    const nextItems = items.slice(start, end);
    return {
      items: nextItems,
      hasMore: end < items.length,
      pageToken: end < items.length ? String(end) : undefined
    };
  }
}
```

- [ ] **Step 5: 写入模块骨架并注册到 AppModule**

创建 `apps/api/src/feishu/feishu.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FEISHU_CLIENT } from './feishu-client';
import { FeishuHttpClient } from './feishu-http.client';

@Module({
  providers: [
    PrismaService,
    {
      provide: FEISHU_CLIENT,
      useClass: FeishuHttpClient
    }
  ],
  exports: [FEISHU_CLIENT]
})
export class FeishuModule {}
```

修改 `apps/api/src/app.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { FeishuModule } from './feishu/feishu.module';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';
import { VersionController } from './version/version.controller';

@Module({
  imports: [FeishuModule],
  controllers: [HealthController, VersionController],
  providers: [PrismaService]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class AppModule {}
```

- [ ] **Step 6: 写入只读静态扫描测试**

创建 `apps/api/test/feishu-readonly.spec.ts`：

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(__dirname, '../src/feishu');
const forbiddenPatterns = [
  /\/contact\/v3\/users(?!\/find_by_department)/,
  /\/contact\/v3\/departments\/[^'"]+\/(?:patch|update|delete)/,
  /\/contact\/v3\/group\/[^'"]*\/(?:create|patch|delete|member\/(?:add|batch_add|remove|batch_remove))/,
  /\/contact\/v3\/functional_roles?\/[^'"]*(?:create|update|delete|batch_create|batch_delete)/,
  /method:\s*['"](?:PATCH|PUT|DELETE)['"]/,
  /batch_add|batch_remove/
];

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return listTsFiles(path);
    }
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('飞书客户端只读约束', () => {
  it('feishu 模块不包含通讯录写接口路径或写 HTTP 方法', () => {
    const violations = listTsFiles(sourceRoot).flatMap((file) => {
      const content = readFileSync(file, 'utf8');
      return forbiddenPatterns
        .filter((pattern) => pattern.test(content))
        .map((pattern) => `${file} matched ${pattern.toString()}`);
    });

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 7: 运行客户端相关检查**

运行：

```bash
pnpm --filter @feishu-iam/api test -- feishu-readonly.spec.ts
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/api lint
```

预期：只读静态扫描测试、类型检查和 lint 全部通过。

- [ ] **Step 8: 提交飞书客户端边界**

运行：

```bash
git add apps/api/src/app.module.ts apps/api/src/feishu apps/api/test/feishu-readonly.spec.ts
git commit -m "feat: add readonly feishu client boundary"
```

预期：生成客户端边界提交。

---

### Task 3: 同步服务和状态查询

**Files:**
- Modify: `apps/api/src/feishu/feishu.module.ts`
- Create: `apps/api/src/feishu/feishu-sync.service.ts`
- Create: `apps/api/src/feishu/feishu-status.service.ts`
- Test: `apps/api/test/feishu-sync.service.spec.ts`

- [ ] **Step 1: 写同步服务测试基架**

创建 `apps/api/test/feishu-sync.service.spec.ts`，先写 fake Prisma、mock 数据和第一个失败测试：

```ts
import { describe, expect, it } from 'vitest';
import { MockFeishuClient } from '../src/feishu/mock-feishu.client';
import { FeishuSyncService } from '../src/feishu/feishu-sync.service';

type Row = Record<string, unknown>;

class FakeModel {
  rows = new Map<string, Row>();

  constructor(private readonly keyOf: (data: Row) => string) {}

  async create(args: { data: Row }): Promise<Row> {
    const row = { ...args.data };
    this.rows.set(this.keyOf(row), row);
    return row;
  }

  async findFirst(args?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }): Promise<Row | null> {
    const rows = Array.from(this.rows.values());
    if (args?.where?.status) {
      return rows.find((row) => row.status === args.where?.status) ?? null;
    }
    if (args?.orderBy) {
      return rows.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0] ?? null;
    }
    return rows[0] ?? null;
  }

  async findMany(): Promise<Row[]> {
    return Array.from(this.rows.values());
  }

  async count(args?: { where?: Record<string, unknown> }): Promise<number> {
    if (!args?.where) {
      return this.rows.size;
    }
    return Array.from(this.rows.values()).filter((row) =>
      Object.entries(args.where ?? {}).every(([key, value]) => row[key] === value)
    ).length;
  }

  async upsert(args: { where: Record<string, unknown>; create: Row; update: Row }): Promise<Row> {
    const key = this.keyOf(args.create);
    const existing = this.rows.get(key);
    const row = existing ? { ...existing, ...args.update } : { ...args.create };
    this.rows.set(key, row);
    return row;
  }

  async update(args: { where: Record<string, unknown>; data: Row }): Promise<Row> {
    const key = String(args.where.id ?? args.where.departmentId ?? args.where.userId);
    const existing = this.rows.get(key);
    if (!existing) {
      throw new Error(`missing row ${key}`);
    }
    const row = { ...existing, ...args.data };
    this.rows.set(key, row);
    return row;
  }

  async updateMany(args: { where: Record<string, unknown>; data: Row }): Promise<{ count: number }> {
    let count = 0;
    for (const [key, row] of this.rows) {
      const notIn = args.where.departmentId && typeof args.where.departmentId === 'object'
        ? (args.where.departmentId as { notIn?: string[] }).notIn
        : args.where.userId && typeof args.where.userId === 'object'
          ? (args.where.userId as { notIn?: string[] }).notIn
          : undefined;
      const rowKey = String(row.departmentId ?? row.userId ?? key);
      if (!notIn || !notIn.includes(rowKey)) {
        this.rows.set(key, { ...row, ...args.data });
        count += 1;
      }
    }
    return { count };
  }
}

class FakePrisma {
  feishuDepartment = new FakeModel((row) => String(row.departmentId));
  feishuUser = new FakeModel((row) => String(row.userId));
  feishuUserDepartment = new FakeModel((row) => `${String(row.userId)}:${String(row.departmentId)}`);
  feishuSyncRun = new FakeModel((row) => String(row.id));
}

describe('FeishuSyncService', () => {
  it('同步部门、用户和用户部门关系', async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      {
        '0': [
          {
            department_id: 'D001',
            open_department_id: 'od-001',
            parent_department_id: '0',
            name: '总部',
            status: { is_deleted: false }
          }
        ]
      },
      {
        D001: [
          {
            user_id: 'u001',
            open_id: 'ou_001',
            union_id: 'on_001',
            name: '张三',
            status: {
              is_frozen: false,
              is_resigned: false,
              is_activated: true,
              is_exited: false,
              is_unjoin: false
            },
            department_ids: ['D001'],
            orders: [
              {
                department_id: 'D001',
                user_order: 10,
                department_order: 20,
                is_primary_dept: true
              }
            ]
          }
        ]
      }
    );

    const service = new FeishuSyncService(prisma as never, client);
    const result = await service.runFullSync({ triggeredBy: 'test', triggerSource: 'test' });

    expect(result.status).toBe('success');
    expect(prisma.feishuDepartment.rows.has('D001')).toBe(true);
    expect(prisma.feishuUser.rows.get('u001')?.isActive).toBe(true);
    expect(prisma.feishuUserDepartment.rows.has('u001:D001')).toBe(true);
  });
});
```

运行：

```bash
pnpm --filter @feishu-iam/api test -- feishu-sync.service.spec.ts
```

预期：失败，错误包含 `Cannot find module '../src/feishu/feishu-sync.service'`。

- [ ] **Step 2: 实现同步服务**

创建 `apps/api/src/feishu/feishu-sync.service.ts`：

```ts
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FEISHU_CLIENT, type FeishuClient } from './feishu-client';
import { FeishuClientError, isFeishuUserActive, type FeishuUserItem } from './feishu.types';

type RunFullSyncInput = {
  triggeredBy: string;
  triggerSource: 'platform_api' | 'admin_web' | 'test';
};

type SyncCounters = {
  departmentCreatedCount: number;
  departmentUpdatedCount: number;
  departmentDeletedCount: number;
  userCreatedCount: number;
  userUpdatedCount: number;
  userDeletedCount: number;
  relationCreatedCount: number;
  relationUpdatedCount: number;
  relationDeletedCount: number;
};

type SyncResult = SyncCounters & {
  id: string;
  status: 'success' | 'failed';
};

@Injectable()
export class FeishuSyncService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FEISHU_CLIENT) private readonly feishuClient: FeishuClient
  ) {}

  async runFullSync(input: RunFullSyncInput): Promise<SyncResult> {
    const running = await this.prisma.feishuSyncRun.findFirst({ where: { status: 'running' } });
    if (running) {
      throw new FeishuClientError('FEISHU_API_ERROR', '已有飞书同步正在运行', {
        error_code: 'FEISHU_SYNC_ALREADY_RUNNING'
      });
    }

    const runId = randomUUID();
    await this.prisma.feishuSyncRun.create({
      data: {
        id: runId,
        triggeredBy: input.triggeredBy,
        triggerSource: input.triggerSource,
        status: 'running'
      }
    });

    const counters = this.emptyCounters();
    const seenDepartmentIds = new Set<string>();
    const seenUserIds = new Set<string>();
    const seenRelationKeys = new Set<string>();

    try {
      const departmentIds = await this.syncDepartments(counters, seenDepartmentIds);
      for (const departmentId of departmentIds) {
        await this.syncUsersForDepartment(departmentId, counters, seenUserIds, seenRelationKeys);
      }

      counters.departmentDeletedCount = (
        await this.prisma.feishuDepartment.updateMany({
          where: { departmentId: { notIn: Array.from(seenDepartmentIds) } },
          data: { isDeleted: true }
        })
      ).count;
      counters.userDeletedCount = (
        await this.prisma.feishuUser.updateMany({
          where: { userId: { notIn: Array.from(seenUserIds) } },
          data: { isDeleted: true }
        })
      ).count;

      await this.prisma.feishuSyncRun.update({
        where: { id: runId },
        data: {
          status: 'success',
          finishedAt: new Date(),
          ...counters
        }
      });
      return { id: runId, status: 'success', ...counters };
    } catch (error) {
      const clientError =
        error instanceof FeishuClientError
          ? error
          : new FeishuClientError('FEISHU_API_ERROR', '飞书同步失败', {
              cause: error instanceof Error ? error.message : String(error)
            });

      await this.prisma.feishuSyncRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorCode: clientError.code,
          errorMessage: clientError.message,
          errorDetail: clientError.detail ?? {}
        }
      });
      throw clientError;
    }
  }

  private async syncDepartments(
    counters: SyncCounters,
    seenDepartmentIds: Set<string>
  ): Promise<string[]> {
    const pending = ['0'];
    const syncedDepartmentIds: string[] = [];

    while (pending.length > 0) {
      const parentId = pending.shift() ?? '0';
      let pageToken: string | undefined;
      do {
        const page = await this.feishuClient.listDepartmentChildren({
          departmentId: parentId,
          pageSize: 50,
          pageToken
        });

        for (const department of page.items) {
          const existing = await this.prisma.feishuDepartment.findFirst({
            where: { departmentId: department.department_id }
          });
          await this.prisma.feishuDepartment.upsert({
            where: { departmentId: department.department_id },
            create: {
              departmentId: department.department_id,
              openDepartmentId: department.open_department_id,
              parentDepartmentId: department.parent_department_id,
              name: department.name,
              i18nName: department.i18n_name,
              leaderUserId: department.leader_user_id,
              order: department.order,
              status: department.status ?? {},
              rawPayload: department,
              lastSyncedAt: new Date(),
              isDeleted: false
            },
            update: {
              openDepartmentId: department.open_department_id,
              parentDepartmentId: department.parent_department_id,
              name: department.name,
              i18nName: department.i18n_name,
              leaderUserId: department.leader_user_id,
              order: department.order,
              status: department.status ?? {},
              rawPayload: department,
              lastSyncedAt: new Date(),
              isDeleted: false
            }
          });
          if (existing) {
            counters.departmentUpdatedCount += 1;
          } else {
            counters.departmentCreatedCount += 1;
          }
          seenDepartmentIds.add(department.department_id);
          syncedDepartmentIds.push(department.department_id);
          pending.push(department.department_id);
        }
        pageToken = page.pageToken;
      } while (pageToken);
    }

    return syncedDepartmentIds;
  }

  private async syncUsersForDepartment(
    departmentId: string,
    counters: SyncCounters,
    seenUserIds: Set<string>,
    seenRelationKeys: Set<string>
  ): Promise<void> {
    let pageToken: string | undefined;
    do {
      const page = await this.feishuClient.listDepartmentUsers({
        departmentId,
        pageSize: 50,
        pageToken
      });

      for (const user of page.items) {
        await this.upsertUser(user, counters, seenUserIds);
        await this.upsertUserDepartments(user, departmentId, counters, seenRelationKeys);
      }
      pageToken = page.pageToken;
    } while (pageToken);
  }

  private async upsertUser(
    user: FeishuUserItem,
    counters: SyncCounters,
    seenUserIds: Set<string>
  ): Promise<void> {
    const existing = await this.prisma.feishuUser.findFirst({ where: { userId: user.user_id } });
    const data = {
      openId: user.open_id,
      unionId: user.union_id,
      name: user.name,
      enName: user.en_name,
      email: user.email,
      mobile: user.mobile,
      mobileVisible: user.mobile_visible,
      avatar: user.avatar,
      employeeNo: user.employee_no,
      employeeType: user.employee_type,
      jobTitle: user.job_title,
      leaderUserId: user.leader_user_id,
      status: user.status ?? {},
      rawPayload: user,
      lastSyncedAt: new Date(),
      isActive: isFeishuUserActive(user.status),
      isDeleted: false
    };

    await this.prisma.feishuUser.upsert({
      where: { userId: user.user_id },
      create: { userId: user.user_id, ...data },
      update: data
    });

    if (existing) {
      counters.userUpdatedCount += 1;
    } else {
      counters.userCreatedCount += 1;
    }
    seenUserIds.add(user.user_id);
  }

  private async upsertUserDepartments(
    user: FeishuUserItem,
    fallbackDepartmentId: string,
    counters: SyncCounters,
    seenRelationKeys: Set<string>
  ): Promise<void> {
    const departmentIds = user.department_ids && user.department_ids.length > 0
      ? user.department_ids
      : [fallbackDepartmentId];

    for (const departmentId of departmentIds) {
      const relationKey = `${user.user_id}:${departmentId}`;
      const order = user.orders?.find((item) => item.department_id === departmentId);
      const existing = await this.prisma.feishuUserDepartment.findFirst({
        where: { userId: user.user_id, departmentId }
      });

      await this.prisma.feishuUserDepartment.upsert({
        where: {
          userId_departmentId: {
            userId: user.user_id,
            departmentId
          }
        },
        create: {
          userId: user.user_id,
          departmentId,
          isPrimary: order?.is_primary_dept === true,
          userOrder: order?.user_order,
          departmentOrder: order?.department_order,
          lastSyncedAt: new Date(),
          isDeleted: false
        },
        update: {
          isPrimary: order?.is_primary_dept === true,
          userOrder: order?.user_order,
          departmentOrder: order?.department_order,
          lastSyncedAt: new Date(),
          isDeleted: false
        }
      });

      if (existing) {
        counters.relationUpdatedCount += 1;
      } else {
        counters.relationCreatedCount += 1;
      }
      seenRelationKeys.add(relationKey);
    }
  }

  private emptyCounters(): SyncCounters {
    return {
      departmentCreatedCount: 0,
      departmentUpdatedCount: 0,
      departmentDeletedCount: 0,
      userCreatedCount: 0,
      userUpdatedCount: 0,
      userDeletedCount: 0,
      relationCreatedCount: 0,
      relationUpdatedCount: 0,
      relationDeletedCount: 0
    };
  }
}
```

- [ ] **Step 3: 写状态服务**

创建 `apps/api/src/feishu/feishu-status.service.ts`：

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { FeishuConnectionStatus } from './feishu.types';

@Injectable()
export class FeishuStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<{
    configStatus: FeishuConnectionStatus;
    running: boolean;
    latestRun: unknown;
    counts: {
      departments: number;
      activeDepartments: number;
      users: number;
      activeUsers: number;
      relations: number;
    };
  }> {
    const configured = Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET);
    const [runningRun, latestRun, departments, activeDepartments, users, activeUsers, relations] =
      await Promise.all([
        this.prisma.feishuSyncRun.findFirst({ where: { status: 'running' } }),
        this.prisma.feishuSyncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
        this.prisma.feishuDepartment.count(),
        this.prisma.feishuDepartment.count({ where: { isDeleted: false } }),
        this.prisma.feishuUser.count(),
        this.prisma.feishuUser.count({ where: { isDeleted: false, isActive: true } }),
        this.prisma.feishuUserDepartment.count({ where: { isDeleted: false } })
      ]);

    return {
      configStatus: configured ? 'configured' : 'not_configured',
      running: runningRun !== null,
      latestRun,
      counts: {
        departments,
        activeDepartments,
        users,
        activeUsers,
        relations
      }
    };
  }

  async listRuns(): Promise<unknown[]> {
    return this.prisma.feishuSyncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50
    });
  }

  async getRun(id: string): Promise<unknown | null> {
    return this.prisma.feishuSyncRun.findUnique({ where: { id } });
  }
}
```

- [ ] **Step 4: 注册服务**

修改 `apps/api/src/feishu/feishu.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FEISHU_CLIENT } from './feishu-client';
import { FeishuHttpClient } from './feishu-http.client';
import { FeishuStatusService } from './feishu-status.service';
import { FeishuSyncService } from './feishu-sync.service';

@Module({
  providers: [
    PrismaService,
    FeishuSyncService,
    FeishuStatusService,
    {
      provide: FEISHU_CLIENT,
      useClass: FeishuHttpClient
    }
  ],
  exports: [FEISHU_CLIENT, FeishuSyncService, FeishuStatusService]
})
export class FeishuModule {}
```

- [ ] **Step 5: 扩展同步服务测试**

在 `apps/api/test/feishu-sync.service.spec.ts` 继续追加这些测试：

```ts
  it('重复同步使用 upsert 更新已有镜像', async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      { '0': [{ department_id: 'D001', name: '总部' }] },
      { D001: [{ user_id: 'u001', name: '张三', status: { is_activated: true }, department_ids: ['D001'] }] }
    );

    const service = new FeishuSyncService(prisma as never, client);
    await service.runFullSync({ triggeredBy: 'test', triggerSource: 'test' });
    await service.runFullSync({ triggeredBy: 'test', triggerSource: 'test' });

    expect(prisma.feishuDepartment.rows.size).toBe(1);
    expect(prisma.feishuUser.rows.size).toBe(1);
    expect(prisma.feishuUserDepartment.rows.size).toBe(1);
  });

  it('用户冻结后 isActive 为 false', async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      { '0': [{ department_id: 'D001', name: '总部' }] },
      {
        D001: [
          {
            user_id: 'u001',
            name: '张三',
            status: { is_frozen: true, is_activated: true },
            department_ids: ['D001']
          }
        ]
      }
    );

    const service = new FeishuSyncService(prisma as never, client);
    await service.runFullSync({ triggeredBy: 'test', triggerSource: 'test' });

    expect(prisma.feishuUser.rows.get('u001')?.isActive).toBe(false);
  });
```

运行：

```bash
pnpm --filter @feishu-iam/api test -- feishu-sync.service.spec.ts
```

预期：同步服务测试通过。如果 TypeScript 因 fake Prisma 类型报错，优先在测试内用 `as never` 收窄，不降低生产代码类型严格度。

- [ ] **Step 6: 运行 API 检查**

运行：

```bash
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/api lint
pnpm --filter @feishu-iam/api test
```

预期：API 类型检查、lint、测试全部通过。

- [ ] **Step 7: 提交同步服务**

运行：

```bash
git add apps/api/src/feishu apps/api/test/feishu-sync.service.spec.ts
git commit -m "feat: implement feishu identity sync service"
```

预期：生成同步服务提交。

---

### Task 4: 平台 API 和 token guard

**Files:**
- Create: `apps/api/src/platform/platform-token.guard.ts`
- Create: `apps/api/src/feishu/feishu-error.filter.ts`
- Create: `apps/api/src/feishu/feishu.controller.ts`
- Modify: `apps/api/src/feishu/feishu.module.ts`
- Test: `apps/api/test/feishu.controller.e2e-spec.ts`

- [ ] **Step 1: 写平台 token guard**

创建 `apps/api/src/platform/platform-token.guard.ts`：

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class PlatformTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.PLATFORM_ADMIN_TOKEN;
    if (!expected) {
      throw new UnauthorizedException({
        error: {
          code: 'PLATFORM_TOKEN_NOT_CONFIGURED',
          message: '平台管理 token 未配置'
        }
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    if (authorization !== `Bearer ${expected}`) {
      throw new UnauthorizedException({
        error: {
          code: 'PLATFORM_TOKEN_INVALID',
          message: '平台管理 token 无效'
        }
      });
    }
    return true;
  }
}
```

- [ ] **Step 2: 写飞书错误响应 filter**

创建 `apps/api/src/feishu/feishu-error.filter.ts`：

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { FeishuClientError } from './feishu.types';

@Catch(FeishuClientError)
export class FeishuErrorFilter implements ExceptionFilter {
  catch(exception: FeishuClientError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const nestedCode =
      typeof exception.detail?.error_code === 'string' ? exception.detail.error_code : undefined;
    const code = nestedCode ?? exception.code;
    const status = this.httpStatusFor(code);

    response.status(status).json({
      error: {
        code,
        message: exception.message,
        request_id:
          typeof exception.detail?.request_id === 'string' ? exception.detail.request_id : undefined
      }
    });
  }

  private httpStatusFor(code: string): number {
    if (code === 'FEISHU_SYNC_ALREADY_RUNNING') {
      return HttpStatus.CONFLICT;
    }
    if (code === 'FEISHU_PERMISSION_DENIED') {
      return HttpStatus.FORBIDDEN;
    }
    if (code === 'FEISHU_CONFIG_MISSING') {
      return HttpStatus.BAD_REQUEST;
    }
    return HttpStatus.BAD_GATEWAY;
  }
}
```

- [ ] **Step 3: 写平台 API controller**

创建 `apps/api/src/feishu/feishu.controller.ts`：

```ts
import { Controller, Get, NotFoundException, Param, Post, UseFilters, UseGuards } from '@nestjs/common';
import { PlatformTokenGuard } from '../platform/platform-token.guard';
import { FeishuErrorFilter } from './feishu-error.filter';
import { FeishuStatusService } from './feishu-status.service';
import { FeishuSyncService } from './feishu-sync.service';

@Controller('/api/v1/platform/feishu')
@UseGuards(PlatformTokenGuard)
@UseFilters(FeishuErrorFilter)
export class FeishuController {
  constructor(
    private readonly syncService: FeishuSyncService,
    private readonly statusService: FeishuStatusService
  ) {}

  @Post('/sync-runs')
  async createSyncRun(): Promise<unknown> {
    return this.syncService.runFullSync({
      triggeredBy: 'platform-admin-token',
      triggerSource: 'platform_api'
    });
  }

  @Get('/sync-runs')
  async listSyncRuns(): Promise<{ items: unknown[] }> {
    return { items: await this.statusService.listRuns() };
  }

  @Get('/sync-runs/:id')
  async getSyncRun(@Param('id') id: string): Promise<unknown> {
    const run = await this.statusService.getRun(id);
    if (!run) {
      throw new NotFoundException({
        error: {
          code: 'FEISHU_SYNC_RUN_NOT_FOUND',
          message: '飞书同步记录不存在'
        }
      });
    }
    return run;
  }

  @Get('/status')
  async getStatus(): Promise<unknown> {
    return this.statusService.getStatus();
  }
}
```

- [ ] **Step 4: 注册 controller、guard 和 filter**

修改 `apps/api/src/feishu/feishu.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformTokenGuard } from '../platform/platform-token.guard';
import { FEISHU_CLIENT } from './feishu-client';
import { FeishuController } from './feishu.controller';
import { FeishuErrorFilter } from './feishu-error.filter';
import { FeishuHttpClient } from './feishu-http.client';
import { FeishuStatusService } from './feishu-status.service';
import { FeishuSyncService } from './feishu-sync.service';

@Module({
  controllers: [FeishuController],
  providers: [
    PrismaService,
    PlatformTokenGuard,
    FeishuErrorFilter,
    FeishuSyncService,
    FeishuStatusService,
    {
      provide: FEISHU_CLIENT,
      useClass: FeishuHttpClient
    }
  ],
  exports: [FEISHU_CLIENT, FeishuSyncService, FeishuStatusService]
})
export class FeishuModule {}
```

- [ ] **Step 5: 写 e2e 测试**

创建 `apps/api/test/feishu.controller.e2e-spec.ts`：

```ts
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { FeishuStatusService } from '../src/feishu/feishu-status.service';
import { FeishuSyncService } from '../src/feishu/feishu-sync.service';
import { FeishuClientError } from '../src/feishu/feishu.types';
import { PrismaService } from '../src/prisma/prisma.service';

describe('飞书平台 API', () => {
  let app: INestApplication;
  const syncService = {
    runFullSync: vi.fn()
  };
  const statusService = {
    getStatus: vi.fn(),
    listRuns: vi.fn(),
    getRun: vi.fn()
  };

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_TOKEN = 'test-token';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: vi.fn(), $disconnect: vi.fn() })
      .overrideProvider(FeishuSyncService)
      .useValue(syncService)
      .overrideProvider(FeishuStatusService)
      .useValue(statusService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('拒绝未携带平台 token 的请求', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer).get('/api/v1/platform/feishu/status').expect(401);
  });

  it('返回飞书同步状态', async () => {
    statusService.getStatus.mockResolvedValue({
      configStatus: 'configured',
      running: false,
      latestRun: null,
      counts: { departments: 0, activeDepartments: 0, users: 0, activeUsers: 0, relations: 0 }
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/feishu/status')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        expect(response.body.configStatus).toBe('configured');
      });
  });

  it('触发手动同步', async () => {
    syncService.runFullSync.mockResolvedValue({ id: 'run-1', status: 'success' });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/feishu/sync-runs')
      .set('Authorization', 'Bearer test-token')
      .expect(201)
      .expect((response) => {
        expect(response.body.id).toBe('run-1');
      });
  });

  it('同步运行中时返回稳定错误码', async () => {
    syncService.runFullSync.mockRejectedValue(
      new FeishuClientError('FEISHU_API_ERROR', '已有飞书同步正在运行', {
        error_code: 'FEISHU_SYNC_ALREADY_RUNNING'
      })
    );

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/feishu/sync-runs')
      .set('Authorization', 'Bearer test-token')
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe('FEISHU_SYNC_ALREADY_RUNNING');
      });
  });
});
```

- [ ] **Step 6: 运行平台 API 测试和检查**

运行：

```bash
pnpm --filter @feishu-iam/api test -- feishu.controller.e2e-spec.ts
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/api lint
```

预期：平台 API 测试、类型检查和 lint 全部通过。

- [ ] **Step 7: 提交平台 API**

运行：

```bash
git add apps/api/src/platform apps/api/src/feishu apps/api/test/feishu.controller.e2e-spec.ts
git commit -m "feat: expose feishu sync platform api"
```

预期：生成平台 API 提交。

---

### Task 5: 管理端飞书同步状态页

**Files:**
- Create: `apps/admin-web/src/api/feishu.ts`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.css`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 写管理端 API 客户端**

创建 `apps/admin-web/src/api/feishu.ts`：

```ts
export type FeishuSyncRun = {
  id: string;
  status: 'running' | 'success' | 'failed';
  triggerSource: string;
  startedAt: string;
  finishedAt?: string | null;
  departmentCreatedCount: number;
  departmentUpdatedCount: number;
  departmentDeletedCount: number;
  userCreatedCount: number;
  userUpdatedCount: number;
  userDeletedCount: number;
  relationCreatedCount: number;
  relationUpdatedCount: number;
  relationDeletedCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type FeishuStatus = {
  configStatus: 'not_configured' | 'configured' | 'connected' | 'failed';
  running: boolean;
  latestRun: FeishuSyncRun | null;
  counts: {
    departments: number;
    activeDepartments: number;
    users: number;
    activeUsers: number;
    relations: number;
  };
};

const platformToken = import.meta.env.VITE_PLATFORM_ADMIN_TOKEN as string | undefined;

function authHeaders(): HeadersInit {
  return platformToken ? { Authorization: `Bearer ${platformToken}` } : {};
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...init?.headers
    }
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${String(response.status)}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchFeishuStatus(): Promise<FeishuStatus> {
  return readJson<FeishuStatus>('/api/v1/platform/feishu/status');
}

export async function fetchFeishuSyncRuns(): Promise<FeishuSyncRun[]> {
  const result = await readJson<{ items: FeishuSyncRun[] }>('/api/v1/platform/feishu/sync-runs');
  return result.items;
}

export async function triggerFeishuSync(): Promise<FeishuSyncRun> {
  return readJson<FeishuSyncRun>('/api/v1/platform/feishu/sync-runs', { method: 'POST' });
}
```

- [ ] **Step 2: 更新 App 组件**

修改 `apps/admin-web/src/App.tsx`，保留现有系统状态卡，再增加飞书同步区域。建议文件内容改为：

```tsx
import { Activity, Database, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchApiStatus } from './api/status';
import type { ApiStatus } from './api/status';
import { fetchFeishuStatus, fetchFeishuSyncRuns, triggerFeishuSync } from './api/feishu';
import type { FeishuStatus, FeishuSyncRun } from './api/feishu';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; data: ApiStatus }
  | { status: 'failed'; message: string };

type FeishuState =
  | { status: 'loading' }
  | { status: 'loaded'; data: FeishuStatus; runs: FeishuSyncRun[]; syncing: boolean }
  | { status: 'failed'; message: string };

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [feishuState, setFeishuState] = useState<FeishuState>({ status: 'loading' });

  useEffect(() => {
    void fetchApiStatus()
      .then((data) => {
        setState({ status: 'loaded', data });
      })
      .catch((error: unknown) => {
        setState({
          status: 'failed',
          message: error instanceof Error ? error.message : '无法读取 API 状态'
        });
      });
  }, []);

  useEffect(() => {
    void loadFeishu();
  }, []);

  async function loadFeishu(): Promise<void> {
    try {
      const [data, runs] = await Promise.all([fetchFeishuStatus(), fetchFeishuSyncRuns()]);
      setFeishuState({ status: 'loaded', data, runs, syncing: false });
    } catch (error) {
      setFeishuState({
        status: 'failed',
        message: error instanceof Error ? error.message : '无法读取飞书同步状态'
      });
    }
  }

  async function handleSync(): Promise<void> {
    if (feishuState.status !== 'loaded') {
      return;
    }
    setFeishuState({ ...feishuState, syncing: true });
    try {
      await triggerFeishuSync();
      await loadFeishu();
    } catch (error) {
      setFeishuState({
        status: 'failed',
        message: error instanceof Error ? error.message : '无法触发飞书同步'
      });
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Feishu IAM</p>
          <h1>身份镜像工作台</h1>
        </div>
        <ShieldCheck aria-hidden="true" size={28} />
      </header>

      <section className="status-grid" aria-label="系统状态">
        <StatusCard
          icon={<Activity aria-hidden="true" size={22} />}
          title="API 进程"
          value={state.status === 'loaded' ? state.data.health : state.status}
        />
        <StatusCard
          icon={<Database aria-hidden="true" size={22} />}
          title="数据库就绪"
          value={state.status === 'loaded' ? state.data.ready : state.status}
        />
        <StatusCard
          icon={<ShieldCheck aria-hidden="true" size={22} />}
          title="版本"
          value={state.status === 'loaded' ? state.data.version : '读取中'}
        />
      </section>

      {state.status === 'failed' ? <p className="error">{state.message}</p> : null}

      <section className="panel" aria-label="飞书同步">
        <div className="section-header">
          <div>
            <p className="eyebrow">Feishu Directory</p>
            <h2>飞书组织与用户同步</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => void handleSync()}
            disabled={feishuState.status !== 'loaded' || feishuState.syncing}
            aria-label="触发飞书同步"
          >
            <RefreshCw aria-hidden="true" size={18} />
          </button>
        </div>

        {feishuState.status === 'loaded' ? (
          <>
            <div className="sync-summary">
              <StatusCard
                icon={<Users aria-hidden="true" size={22} />}
                title="配置状态"
                value={feishuState.data.configStatus}
              />
              <StatusCard
                icon={<Users aria-hidden="true" size={22} />}
                title="有效用户"
                value={String(feishuState.data.counts.activeUsers)}
              />
              <StatusCard
                icon={<Database aria-hidden="true" size={22} />}
                title="有效部门"
                value={String(feishuState.data.counts.activeDepartments)}
              />
            </div>
            <SyncHistory runs={feishuState.runs} />
          </>
        ) : feishuState.status === 'failed' ? (
          <p className="error">{feishuState.message}</p>
        ) : (
          <p className="muted">正在读取飞书同步状态</p>
        )}
      </section>
    </main>
  );
}

function StatusCard(props: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <article className="status-card">
      <div className="status-icon">{props.icon}</div>
      <div>
        <h2>{props.title}</h2>
        <p>{props.value}</p>
      </div>
    </article>
  );
}

function SyncHistory(props: { runs: FeishuSyncRun[] }) {
  return (
    <div className="history">
      <h3>同步历史</h3>
      {props.runs.length === 0 ? (
        <p className="muted">暂无同步记录</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>状态</th>
              <th>开始时间</th>
              <th>部门</th>
              <th>用户</th>
              <th>关系</th>
              <th>错误</th>
            </tr>
          </thead>
          <tbody>
            {props.runs.map((run) => (
              <tr key={run.id}>
                <td>{run.status}</td>
                <td>{new Date(run.startedAt).toLocaleString()}</td>
                <td>{run.departmentCreatedCount + run.departmentUpdatedCount}</td>
                <td>{run.userCreatedCount + run.userUpdatedCount}</td>
                <td>{run.relationCreatedCount + run.relationUpdatedCount}</td>
                <td>{run.errorMessage ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 更新样式**

在 `apps/admin-web/src/App.css` 末尾追加：

```css
.panel {
  max-width: 1120px;
  margin: 24px auto 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 22px;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid #c8d3df;
  border-radius: 8px;
  color: #155eef;
  background: #ffffff;
  cursor: pointer;
}

.icon-button:disabled {
  color: #98a2b3;
  cursor: not-allowed;
}

.sync-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.history {
  margin-top: 18px;
  overflow-x: auto;
}

.history h3 {
  margin: 0 0 10px;
  font-size: 16px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
}

th,
td {
  padding: 12px;
  border-bottom: 1px solid #e4eaf1;
  text-align: left;
  font-size: 14px;
}

th {
  color: #526172;
  font-weight: 600;
}

.muted {
  color: #667085;
}

@media (max-width: 760px) {
  .sync-summary {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: 更新前端测试**

在 `apps/admin-web/src/App.test.tsx` 的 fetch mock 中增加飞书 API 响应：

```ts
      if (input === '/api/v1/platform/feishu/status') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              configStatus: 'configured',
              running: false,
              latestRun: null,
              counts: {
                departments: 1,
                activeDepartments: 1,
                users: 1,
                activeUsers: 1,
                relations: 1
              }
            })
          )
        );
      }
      if (input === '/api/v1/platform/feishu/sync-runs') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'run-1',
                  status: 'success',
                  triggerSource: 'platform_api',
                  startedAt: '2026-05-15T00:00:00.000Z',
                  finishedAt: '2026-05-15T00:00:01.000Z',
                  departmentCreatedCount: 1,
                  departmentUpdatedCount: 0,
                  departmentDeletedCount: 0,
                  userCreatedCount: 1,
                  userUpdatedCount: 0,
                  userDeletedCount: 0,
                  relationCreatedCount: 1,
                  relationUpdatedCount: 0,
                  relationDeletedCount: 0
                }
              ]
            })
          )
        );
      }
```

并在断言中追加：

```ts
    expect(screen.getByText('飞书组织与用户同步')).toBeInTheDocument();
    expect(screen.getByText('同步历史')).toBeInTheDocument();
    expect(screen.getByText('configured')).toBeInTheDocument();
```

- [ ] **Step 5: 运行管理端检查**

运行：

```bash
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
```

预期：管理端测试、类型检查和 lint 全部通过。

- [ ] **Step 6: 提交管理端页面**

运行：

```bash
git add apps/admin-web/src
git commit -m "feat: add feishu sync admin status page"
```

预期：生成管理端提交。

---

### Task 6: 文档、只读权限说明和最终验证

**Files:**
- Create: `docs/feishu-identity-sync.md`
- Create: `docs/codex-sessions/2026-05-15-1553-v0.2.0-飞书身份镜像实施.md`
- Modify: `README.md`

- [ ] **Step 1: 写飞书身份同步文档**

创建 `docs/feishu-identity-sync.md`：

```markdown
# 飞书身份镜像同步

本文说明 Feishu IAM `v0.2.0` 的飞书组织与用户同步能力。

## 同步范围

Feishu IAM 只同步飞书部门、用户和用户部门关系。系统不同步飞书角色，不同步飞书用户组，也不会写入飞书通讯录。

## 只读安全边界

Feishu IAM 调用飞书通讯录时只使用只读接口：

- 获取自建应用 `tenant_access_token`。
- 查询子部门列表。
- 查询部门直属用户列表。

代码不封装创建、更新、删除飞书用户或部门的接口。飞书应用也只应授予只读权限，形成权限侧和代码侧双保险。

## 环境变量

```dotenv
DATABASE_URL=<postgresql_database_url>
PLATFORM_ADMIN_TOKEN=replace-with-local-admin-token
FEISHU_APP_ID=cli_replace_me
FEISHU_APP_SECRET=replace_me
```

不要把真实 `FEISHU_APP_SECRET`、平台 token、cookie 或密码提交到仓库。

## 飞书应用权限

建议只申请以下只读权限：

- 获取通讯录基本信息。
- 获取通讯录部门组织架构信息。
- 以应用身份读取通讯录。
- 获取部门基础信息。
- 获取用户基本信息。
- 获取用户组织架构信息。
- 获取用户 user ID。
- 获取用户受雇信息。
- 获取用户邮箱信息。
- 获取用户手机号。
- 查看成员工号。

禁止申请或使用通讯录写权限，包括创建、更新、删除用户或部门。

## 平台 API

所有平台 API 请求需要携带：

```text
Authorization: Bearer <PLATFORM_ADMIN_TOKEN>
```

接口：

- `POST /api/v1/platform/feishu/sync-runs`：触发一次手动同步。
- `GET /api/v1/platform/feishu/sync-runs`：查询同步历史。
- `GET /api/v1/platform/feishu/sync-runs/:id`：查询单次同步详情。
- `GET /api/v1/platform/feishu/status`：查询配置状态、运行状态、最近同步和镜像数据统计。

## 本地验证

运行自动化检查：

```bash
pnpm check
```

运行 Docker Compose：

```bash
pnpm compose:up
```

真实飞书手动验证：

1. 在本地环境配置真实 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`。
2. 确认飞书应用只授予只读通讯录权限。
3. 启动 API 和数据库。
4. 调用 `POST /api/v1/platform/feishu/sync-runs`。
5. 查询 `GET /api/v1/platform/feishu/status`。
6. 确认数据库中存在 `feishu_departments`、`feishu_users`、`feishu_user_departments` 数据。

## 常见错误

- `FEISHU_CONFIG_MISSING`：缺少 `FEISHU_APP_ID` 或 `FEISHU_APP_SECRET`。
- `FEISHU_PERMISSION_DENIED`：飞书应用缺少通讯录只读权限或通讯录可见范围不足。
- `FEISHU_SYNC_ALREADY_RUNNING`：已有同步 run 正在执行。
```

- [ ] **Step 2: 更新 README**

在 `README.md` 的“下一步”之后增加：

```markdown
## 飞书身份镜像同步

`v0.2.0` 规划和实现聚焦飞书组织与用户镜像。同步范围、只读权限要求、环境变量、平台 API 和手动验证方式见：

- [飞书身份镜像同步](docs/feishu-identity-sync.md)
```

- [ ] **Step 3: 写会话归档**

创建 `docs/codex-sessions/2026-05-15-1553-v0.2.0-飞书身份镜像实施.md`：

```markdown
# Codex 会话归档：v0.2.0 飞书身份镜像实施

## 会话目标

实施 `v0.2.0` 飞书身份镜像同步。

## 用户原始关键要求摘要

- 只同步飞书组织架构和用户。
- 不同步飞书角色和飞书用户组。
- 获取飞书通讯录数据必须只使用只读接口。

## 本次会话使用或形成的关键提示词/约束

- 遵守 `AGENTS.md`。
- 遵守 `docs/superpowers/specs/2026-05-15-feishu-iam-v0.2.0-feishu-identity-sync-design.md`。
- 不记录明文密钥、token、cookie 或密码。

## 重要设计决策和原因

- 使用 `FeishuClient` 隔离真实飞书 HTTP 客户端和 mock 客户端。
- 自动化测试默认使用 mock，不依赖真实飞书凭证。
- 失败 run 不执行失效标记，避免半截同步误伤历史数据。

## 修改过的文件

- `migrations/V0_2_0__feishu_identity_sync.sql`
- `apps/api/prisma/schema.prisma`
- `.env.example`
- `deploy/docker-compose.yml`
- `apps/api/src/app.module.ts`
- `apps/api/src/feishu/feishu.module.ts`
- `apps/api/src/feishu/feishu.types.ts`
- `apps/api/src/feishu/feishu-client.ts`
- `apps/api/src/feishu/feishu-http.client.ts`
- `apps/api/src/feishu/mock-feishu.client.ts`
- `apps/api/src/feishu/feishu-sync.service.ts`
- `apps/api/src/feishu/feishu-status.service.ts`
- `apps/api/src/feishu/feishu-error.filter.ts`
- `apps/api/src/feishu/feishu.controller.ts`
- `apps/api/src/platform/platform-token.guard.ts`
- `apps/api/test/feishu-readonly.spec.ts`
- `apps/api/test/feishu-sync.service.spec.ts`
- `apps/api/test/feishu.controller.e2e-spec.ts`
- `apps/admin-web/src/api/feishu.ts`
- `apps/admin-web/src/App.tsx`
- `apps/admin-web/src/App.css`
- `apps/admin-web/src/App.test.tsx`
- `README.md`
- `docs/feishu-identity-sync.md`
- `docs/codex-sessions/2026-05-15-1553-v0.2.0-飞书身份镜像实施.md`

## 执行过的关键命令和验证结果

- `pnpm --filter @feishu-iam/api prisma:validate`：通过。
- `pnpm check`：通过。
- `docker compose -f deploy/docker-compose.yml config --quiet`：通过。
- 敏感信息扫描：未发现真实密钥或 token。
- `rg -n "/contact/v3/.*/(create|patch|update|delete|batch_add|batch_remove)|method: ['\\\"](PATCH|PUT|DELETE)['\\\"]" apps/api/src/feishu apps/api/test`：生产代码未发现飞书通讯录写接口调用路径；测试规则中的 forbidden pattern 不计为违规。

## 未完成事项和下一步建议

- 真实飞书接入作为手动验证项，需要在本地或部署环境配置真实 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 后执行。
- 下一阶段建议基于本地飞书用户和部门镜像设计 IAM 内部角色、第三方应用、权限组和权限点。
```

- [ ] **Step 4: 全量检查**

运行：

```bash
pnpm --filter @feishu-iam/api prisma:validate
pnpm check
docker compose -f deploy/docker-compose.yml config --quiet
rg -n "<secret-scan-pattern>" .
rg -n "/contact/v3/.*/(create|patch|update|delete|batch_add|batch_remove)|method: ['\\\"](PATCH|PUT|DELETE)['\\\"]" apps/api/src/feishu apps/api/test
```

预期：

- Prisma 校验通过。
- `pnpm check` 通过。
- Docker Compose 配置校验通过。
- 敏感信息扫描没有真实密钥命中。
- 飞书写接口扫描没有命中；如果命中的是只读约束测试里的 forbidden pattern 字符串，说明该路径在测试规则中，不能算生产代码违规。

- [ ] **Step 5: 可选 Docker 启动验证**

如果 Docker Desktop 可用，运行：

```bash
pnpm compose:up
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready
pnpm compose:down
```

预期：

- `/health` 返回 `{"status":"ok","service":"feishu-iam-api"}`。
- `/ready` 返回数据库就绪。
- 如果 Docker 不可用，在会话归档和最终回复中说明未运行原因。

- [ ] **Step 6: 提交文档和最终验证记录**

运行：

```bash
git add README.md docs/feishu-identity-sync.md docs/codex-sessions
git commit -m "docs: document feishu identity sync"
```

预期：生成文档提交。

---

## 最终验收清单

- [ ] `pnpm --filter @feishu-iam/api prisma:validate` 通过。
- [ ] `pnpm check` 通过。
- [ ] `docker compose -f deploy/docker-compose.yml config --quiet` 通过。
- [ ] mock 自动化测试覆盖同步成功、幂等、状态变化、权限失败、平台 API token 和只读扫描。
- [ ] 管理端展示飞书配置状态、有效用户、有效部门和同步历史。
- [ ] 文档没有真实密钥、token、cookie 或密码。
- [ ] 生产代码没有飞书通讯录写接口调用路径。
- [ ] 会话归档已写入 `docs/codex-sessions/`。
