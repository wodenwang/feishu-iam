# Feishu IAM v1.0.5 Permission Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 `v1.0.5` 权限管理重构：角色成为独立资源，角色与应用多对多绑定，权限管理首屏为角色列表，角色配置拆成 `组织与用户` 和 `应用权限` 两个独立工作区，并从应用管理移除角色管理。

**Architecture:** 本版本接受一次干净的数据模型切换：新增 `iam_role_applications`，移除 `iam_roles` 对单个应用的业务归属，把现有 `/api/v1/admin/applications/:appKey/iam-roles` 直接改成“应用上下文下的全局角色绑定”接口。由于 Feishu IAM 当前尚未广泛接入，旧应用角色接口不做长期兼容层；旧前端深链如果失效可以进入新页面或显示稳定错误，不为了旧第三方体验扩展新 API 族。

**Tech Stack:** NestJS、Prisma、PostgreSQL、React 19、Vite 6、React Router 7、shadcn/ui + tweakcn + Tailwind、Vitest、Testing Library、Playwright、Docker Compose。

---

## 版本号和 my-harness 位置

本次迭代版本号锁定为 `v1.0.5`。

版本号落点：

- `package.json`
- `apps/api/package.json`
- `apps/admin-web/package.json`
- API 版本响应或默认版本常量，如现有实现中存在 `APP_VERSION` fallback。
- Docker 镜像 tag：`feishu-iam:v1.0.5`
- Git tag / release：`v1.0.5`
- README / CHANGELOG / 会话归档中的版本历史。

当前 my-harness 步骤：

- 1-4 已完成：需求澄清、Product Design 方案、静态原型、用户定稿。
- 5 已完成：`gstack /plan-eng-review`，用户确认 D1/D2/D3。
- 6 当前执行：`Superpowers writing-plans`，本文即实施计划。
- 7 下一步：`Superpowers executing-plans` 或 `superpowers:subagent-driven-development`。

## 已确认工程决策

| 决策 | 选择 | 含义 |
|---|---|---|
| D1 | A | 新增 `iam_role_applications`，角色成为全局资源，角色与应用多对多绑定。 |
| D2 | B | 不新增并行全局角色 API；直接改变现有 `/applications/:appKey/iam-roles` 语义。 |
| D3 | B | 不做旧深链强兼容；清理应用管理角色管理，旧入口不作为产品负担保留。 |

D2 的具体落地解释：

- `GET /api/v1/admin/applications/:appKey/iam-roles` 返回绑定到该应用的全局角色。
- `POST /api/v1/admin/applications/:appKey/iam-roles` 创建全局角色，并立即绑定当前应用。
- `PATCH /api/v1/admin/applications/:appKey/iam-roles/:roleId` 更新全局角色基础信息。
- `POST /api/v1/admin/applications/:appKey/iam-roles/:roleId/enable|disable` 更新全局角色状态。
- `PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId/subjects` 更新角色级组织 / 用户主体。
- `PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId/permission-groups` 更新该角色在当前应用下绑定的权限组。
- 前端 `权限管理` 首屏如果没有应用筛选，先读取管理员可见应用，再 fan-out 调用各应用角色接口并按 `role.id` 去重。当前只有 demo 和 Base Portal 开发中，这个低成本方案可接受。

## Source Inputs

- `AGENTS.md`
- `DESIGN.md`
- `.my-harness/status.md`
- `docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- `design/v1.0.5-permission-management-sop.md`
- `design/prototypes/v1.0.5-permission-management/index.html`
- `design/prototypes/v1.0.5-permission-management/README.md`

## File Structure

### Database and Prisma

- Modify: `apps/api/prisma/schema.prisma`
  - Add `IamRoleApplication`.
  - Remove `IamRole.applicationId` as the business ownership field.
  - Change role permission group / point relations to require role-application binding.
- Create: `migrations/V1_0_5__role_application_bindings.sql`
  - Backfill every existing `iam_roles.application_id` into `iam_role_applications`.
  - Drop old composite foreign keys that force a role to belong to one application.
  - Keep old data loss-free.

### API

- Modify: `apps/api/src/permission/iam-role.service.ts`
  - Treat roles as global.
  - List roles through `iam_role_applications`.
  - Create global role and bind current app.
  - Replace role subjects at role level.
  - Replace permission groups at role + current application level.
  - Add helpers for role/application binding and summary mapping.
- Modify: `apps/api/src/permission/permission-calculation.service.ts`
  - Calculate permissions from active roles bound to current application.
- Modify: `apps/api/src/permission/permission.controller.ts`
  - Keep the same endpoint paths, but call the new service semantics.
  - Do not add a new `/iam-roles` API family in v1.0.5.
- Modify: `apps/api/src/permission/permission.types.ts`
  - Keep status enum unchanged unless implementation needs typed response additions.
- Test: `apps/api/test/iam-role.service.spec.ts`
- Test: `apps/api/test/permission-calculation.service.spec.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`
- Test: `apps/api/test/permission.controller.e2e-spec.ts`

### Admin Web API Types

- Modify: `apps/admin-web/src/api/permission.ts`
  - Expand `IamRole` with `applications`, `applicationIds`, `appKeys`, per-application permission summaries.
  - Keep existing function names where practical, because D2 changes semantics rather than adding new API family.

### Admin Web Routing and Pages

- Modify: `apps/admin-web/src/routes/admin-url-state.ts`
  - Permission list state keeps `appKey` as optional filter.
  - Remove `sheet=create` and `sheet=role:*` as primary workflow if they are no longer used.
- Modify: `apps/admin-web/src/routes/admin-url-state.test.ts`
  - Update URL state tests.
- Modify: `apps/admin-web/src/App.tsx`
  - Keep `/admin/permissions`.
  - Change role detail route from `/admin/permissions/:appKey/roles/:roleId` to `/admin/permissions/roles/:roleId`.
  - Optional: route old path to a stable error or redirect only if cheap.
- Modify: `apps/admin-web/src/routes/PermissionRoleDetailPage.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
  - Rebuild landing page as global role list.
  - Add create, edit, enable/disable, batch enable/disable actions.
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx`
  - Rebuild as independent role configuration page.
  - Tabs: `组织与用户`、`应用权限`、`变更记录` if feasible in the first slice.
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
  - Stop using it for the v1.0.5 primary path.
  - Either delete after imports are gone or leave as unused historical component only if deletion expands scope too much.
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleCreateDialog.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleEditDialog.tsx`
  - Replace with role list create/edit flows or delete if no imports remain.
- Modify: `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
  - Reuse as the unified organization/user selector.
  - Do not split organization and user into separate selectors.

### Application Management Cleanup

- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
  - Remove `角色管理` Tab.
  - Remove role CRUD state, handlers, `RoleSection`, and role status confirm dialog.
  - Keep application details, development/callback/secret/Codex prompt, permission assets view/query/compare, and danger operations.
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
  - Remove role count emphasis from cards/table if it implies application owns roles.
  - If summary still displays role counts, label as `关联角色` only.
- Test: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`

### Admin Web Permission Tests

- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
- Test: `apps/admin-web/src/App.test.tsx`
- Test: `apps/admin-web/test/run-responsive-overflow-check.mjs`

### Docs and Release

- Modify: `.my-harness/status.md`
- Modify: `.my-harness/runs/2026-06-20-v1.0.5-permission-workbench.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md` if present.
- Modify: `docs/codex-sessions/2026-06-20-1437-permission-management-ux.md`
- Create or modify: `docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.5-permission-workbench-implementation.md`

## Task 1: Database Migration for Role-Application Bindings

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `migrations/V1_0_5__role_application_bindings.sql`
- Test: `apps/api/test/iam-role.service.spec.ts`

- [ ] **Step 1: Add migration file with backfill-first SQL**

Create `migrations/V1_0_5__role_application_bindings.sql`:

```sql
CREATE TABLE IF NOT EXISTS iam_role_applications (
  iam_role_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (iam_role_id, application_id),
  CONSTRAINT iam_role_applications_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT iam_role_applications_iam_role_id_fkey
    FOREIGN KEY (iam_role_id) REFERENCES iam_roles (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT iam_role_applications_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO iam_role_applications (
  iam_role_id,
  application_id,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  application_id,
  'active',
  created_at,
  updated_at
FROM iam_roles
WHERE application_id IS NOT NULL
ON CONFLICT (iam_role_id, application_id) DO NOTHING;

ALTER TABLE iam_role_permission_groups
  DROP CONSTRAINT IF EXISTS iam_role_permission_groups_iam_role_id_fkey;

ALTER TABLE iam_role_permission_points
  DROP CONSTRAINT IF EXISTS iam_role_permission_points_iam_role_id_fkey;

ALTER TABLE iam_role_permission_groups
  ADD CONSTRAINT iam_role_permission_groups_role_application_fkey
  FOREIGN KEY (iam_role_id, application_id)
  REFERENCES iam_role_applications (iam_role_id, application_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE iam_role_permission_points
  ADD CONSTRAINT iam_role_permission_points_role_application_fkey
  FOREIGN KEY (iam_role_id, application_id)
  REFERENCES iam_role_applications (iam_role_id, application_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE iam_roles
  DROP CONSTRAINT IF EXISTS iam_roles_application_key_unique;

ALTER TABLE iam_roles
  DROP CONSTRAINT IF EXISTS iam_roles_application_id_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS iam_roles_key_unique
  ON iam_roles (key);

CREATE INDEX IF NOT EXISTS iam_role_applications_application_id_idx
  ON iam_role_applications (application_id);

CREATE INDEX IF NOT EXISTS iam_role_applications_status_idx
  ON iam_role_applications (status);
```

- [ ] **Step 2: Update Prisma schema**

In `apps/api/prisma/schema.prisma`, replace the `Application` role relations:

```prisma
model Application {
  id                      String                           @id
  appKey                  String                           @unique @map("app_key")
  name                    String
  description             String?
  ownerUserId             String?                          @map("owner_user_id")
  status                  String                           @default("active")
  silentSsoEnabled        Boolean                          @default(false) @map("silent_sso_enabled")
  silentSsoAllowedOrigins String[]                         @default([]) @map("silent_sso_allowed_origins")
  createdAt               DateTime                         @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt               DateTime                         @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  permissionGroups        PermissionGroup[]
  permissionPoints        PermissionPoint[]
  roleApplications        IamRoleApplication[]
  auditLogs               AuditLog[]
  permissionGroupPoints   PermissionGroupPoint[]
  iamRolePermissionGroups IamRolePermissionGroup[]
  iamRolePermissionPoints IamRolePermissionPoint[]
  environments            ApplicationEnvironment[]
  redirectUris            ApplicationRedirectUri[]
  clients                 ApplicationClient[]
  developerCredentials    ApplicationDeveloperCredential[]
  authorizationCodes      OauthAuthorizationCode[]
  accessTokens            OauthAccessToken[]
  securityEvents          SecurityEvent[]
  adminApplicationScopes  AdminApplicationScope[]

  @@map("applications")
}
```

Replace the role models:

```prisma
model IamRole {
  id               String                   @id
  key              String                   @unique
  name             String
  description      String?
  status           String                   @default("active")
  createdAt        DateTime                 @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime                 @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  applications     IamRoleApplication[]
  subjects         IamRoleSubject[]
  permissionGroups IamRolePermissionGroup[]
  permissionPoints IamRolePermissionPoint[]

  @@map("iam_roles")
}

model IamRoleApplication {
  iamRoleId     String      @map("iam_role_id")
  applicationId String      @map("application_id")
  status        String      @default("active")
  createdAt     DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  iamRole       IamRole     @relation(fields: [iamRoleId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@id([iamRoleId, applicationId])
  @@index([applicationId])
  @@index([status])
  @@map("iam_role_applications")
}
```

Update `IamRolePermissionGroup` and `IamRolePermissionPoint` relations:

```prisma
model IamRolePermissionGroup {
  applicationId     String             @map("application_id")
  iamRoleId         String             @map("iam_role_id")
  permissionGroupId String             @map("permission_group_id")
  createdAt         DateTime           @default(now()) @map("created_at") @db.Timestamptz(6)
  application       Application        @relation(fields: [applicationId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  roleApplication   IamRoleApplication @relation(fields: [iamRoleId, applicationId], references: [iamRoleId, applicationId], onDelete: Restrict, onUpdate: Cascade)
  iamRole           IamRole            @relation(fields: [iamRoleId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  permissionGroup   PermissionGroup    @relation(fields: [applicationId, permissionGroupId], references: [applicationId, id], onDelete: Restrict, onUpdate: Cascade)

  @@id([iamRoleId, permissionGroupId])
  @@index([applicationId])
  @@index([permissionGroupId])
  @@map("iam_role_permission_groups")
}

model IamRolePermissionPoint {
  applicationId     String             @map("application_id")
  iamRoleId         String             @map("iam_role_id")
  permissionPointId String             @map("permission_point_id")
  createdAt         DateTime           @default(now()) @map("created_at") @db.Timestamptz(6)
  application       Application        @relation(fields: [applicationId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  roleApplication   IamRoleApplication @relation(fields: [iamRoleId, applicationId], references: [iamRoleId, applicationId], onDelete: Restrict, onUpdate: Cascade)
  iamRole           IamRole            @relation(fields: [iamRoleId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  permissionPoint   PermissionPoint    @relation(fields: [applicationId, permissionPointId], references: [applicationId, id], onDelete: Restrict, onUpdate: Cascade)

  @@id([iamRoleId, permissionPointId])
  @@index([applicationId])
  @@index([permissionPointId])
  @@map("iam_role_permission_points")
}
```

- [ ] **Step 3: Validate Prisma schema**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:format
pnpm --filter @feishu-iam/api prisma:validate
```

Expected:

```text
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid
```

- [ ] **Step 4: Commit database plan slice**

```bash
git add apps/api/prisma/schema.prisma migrations/V1_0_5__role_application_bindings.sql
git commit -m "feat: add role application binding schema"
```

## Task 2: API Role Service and Permission Calculation

**Files:**
- Modify: `apps/api/src/permission/iam-role.service.ts`
- Modify: `apps/api/src/permission/permission-calculation.service.ts`
- Modify: `apps/api/src/permission/permission.controller.ts`
- Test: `apps/api/test/iam-role.service.spec.ts`
- Test: `apps/api/test/permission-calculation.service.spec.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: Write failing service tests for global role plus app binding**

Add tests in `apps/api/test/iam-role.service.spec.ts`:

```ts
it('createRole 创建全局角色并绑定当前应用', async () => {
  applicationService.getApplicationByKey.mockResolvedValue(application);
  prisma.$transaction.mockImplementation(async (callback) => callback(prismaTx));
  prismaTx.iamRole.create.mockResolvedValue({
    id: 'role-global-admin',
    key: 'ROLE_GLOBAL_ADMIN',
    name: '全局管理员',
    description: null,
    status: 'active',
    createdAt: now,
    updatedAt: now
  });

  await service.createRole('finance', {
    key: 'ROLE_GLOBAL_ADMIN',
    name: '全局管理员'
  }, auditContext);

  expect(prismaTx.iamRole.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      key: 'ROLE_GLOBAL_ADMIN',
      name: '全局管理员'
    })
  });
  expect(prismaTx.iamRoleApplication.create).toHaveBeenCalledWith({
    data: {
      iamRoleId: 'role-global-admin',
      applicationId: application.id,
      status: 'active'
    }
  });
});

it('listRoles 返回绑定到当前应用的全局角色和应用摘要', async () => {
  applicationService.getApplicationByKey.mockResolvedValue(application);
  prisma.iamRole.findMany.mockResolvedValue([
    makeRoleWithApplications({
      id: 'role-global-admin',
      key: 'ROLE_GLOBAL_ADMIN',
      applications: [
        { applicationId: 'app-finance', application: { appKey: 'finance', name: '财务系统', status: 'active' } },
        { applicationId: 'app-hr', application: { appKey: 'hr', name: 'HR 系统', status: 'active' } }
      ]
    })
  ]);

  const roles = await service.listRoles('finance');

  expect(prisma.iamRole.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      applications: {
        some: {
          applicationId: application.id
        }
      }
    })
  }));
  expect(roles[0]?.applications).toEqual([
    expect.objectContaining({ appKey: 'finance', name: '财务系统' }),
    expect.objectContaining({ appKey: 'hr', name: 'HR 系统' })
  ]);
});
```

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/iam-role.service.spec.ts
```

Expected: fail because `iamRoleApplication` and global role shape are not implemented.

- [ ] **Step 2: Update service types**

In `apps/api/src/permission/iam-role.service.ts`, change `IamRoleWithBindings`:

```ts
export type IamRoleApplicationSummary = {
  applicationId: string;
  appKey: string;
  name: string;
  status: string;
  bindingStatus: string;
};

export type IamRoleWithBindings = IamRole & {
  applications: IamRoleApplicationSummary[];
  applicationIds: string[];
  appKeys: string[];
  permissionGroups: Array<PermissionGroup & { permissionPoints: PermissionPointSummary[] }>;
  permissionGroupIds: string[];
  permissionPoints: PermissionPointSummary[];
  subjects: Array<{
    type: IamSubjectType;
    id: string;
    isOrphaned: boolean;
    displayName: string;
    avatarLabel: string;
    subjectKindLabel: '组织' | '用户';
    displayPath: string;
  }>;
};
```

- [ ] **Step 3: Change `createRole()` to global role plus app binding**

Replace the create path with:

```ts
async createRole(appKey: string, input: CreateRoleInput, auditContext?: PermissionAuditContext): Promise<IamRole> {
  assertRoleKey(input.key);

  return this.prisma.$transaction(async (tx) => {
    const application = await this.applications.getApplicationByKey(appKey, tx);
    const created = await tx.iamRole.create({
      data: {
        id: randomUUID(),
        key: input.key,
        name: input.name,
        description: input.description ?? null
      }
    });

    await tx.iamRoleApplication.create({
      data: {
        iamRoleId: created.id,
        applicationId: application.id,
        status: 'active'
      }
    });

    await this.recordAudit(application.id, created.id, 'create', undefined, {
      ...created,
      appKey
    }, tx, auditContext);
    return created;
  });
}
```

- [ ] **Step 4: Change `listRoles()` to filter by role-application binding**

Replace the role query:

```ts
const roles = await this.prisma.iamRole.findMany({
  where: {
    applications: {
      some: {
        applicationId: application.id
      }
    }
  },
  include: {
    applications: {
      include: {
        application: true
      },
      orderBy: {
        applicationId: 'asc'
      }
    },
    permissionGroups: {
      where: {
        applicationId: application.id
      },
      include: {
        permissionGroup: {
          include: {
            permissionPoints: {
              include: {
                permissionPoint: true
              },
              orderBy: {
                permissionPointId: 'asc'
              }
            }
          }
        }
      },
      orderBy: {
        permissionGroupId: 'asc'
      }
    },
    permissionPoints: {
      where: {
        applicationId: application.id
      },
      include: {
        permissionPoint: true
      },
      orderBy: {
        permissionPointId: 'asc'
      }
    },
    subjects: {
      orderBy: [
        { subjectType: 'asc' },
        { subjectId: 'asc' }
      ]
    }
  },
  orderBy: {
    key: 'asc'
  }
});
```

Map summaries:

```ts
applications: role.applications.map((binding) => ({
  applicationId: binding.applicationId,
  appKey: binding.application.appKey,
  name: binding.application.name,
  status: binding.application.status,
  bindingStatus: binding.status
})),
applicationIds: role.applications.map((binding) => binding.applicationId),
appKeys: role.applications.map((binding) => binding.application.appKey),
```

- [ ] **Step 5: Change `getRole()` to verify app binding instead of role ownership**

Use:

```ts
private async getRole(client: IamRoleClient, application: Application, roleId: string): Promise<IamRole> {
  const role = await client.iamRole.findFirst({
    where: {
      id: roleId,
      applications: {
        some: {
          applicationId: application.id
        }
      }
    }
  });

  if (!role) {
    throw new PermissionDomainError('IAM_ROLE_NOT_FOUND', 'IAM 角色不存在或未关联当前应用', 404);
  }

  return role;
}
```

- [ ] **Step 6: Update update/status methods to global role writes**

Change updates from `applicationId_id` to `id`:

```ts
const updated = await tx.iamRole.update({
  where: {
    id: roleId
  },
  data: buildUpdateRoleData(input)
});
```

For status:

```ts
const updated = await tx.iamRole.update({
  where: {
    id: roleId
  },
  data: {
    status
  }
});
```

- [ ] **Step 7: Update permission calculation to use role applications**

In `apps/api/src/permission/permission-calculation.service.ts`, replace the role query:

```ts
const roles = await this.prisma.iamRole.findMany({
  where: {
    status: 'active',
    applications: {
      some: {
        applicationId: application.id,
        status: 'active'
      }
    }
  },
  include: ROLE_INCLUDE
});
```

And make `ROLE_INCLUDE.permissionGroups` and `permissionPoints` filter current application:

```ts
const ROLE_INCLUDE = (applicationId: string) => ({
  subjects: true,
  permissionGroups: {
    where: { applicationId },
    include: {
      permissionGroup: {
        include: {
          permissionPoints: {
            include: {
              permissionPoint: true
            }
          }
        }
      }
    }
  },
  permissionPoints: {
    where: { applicationId },
    include: {
      permissionPoint: true
    }
  }
}) satisfies Prisma.IamRoleInclude;
```

Use:

```ts
include: ROLE_INCLUDE(application.id)
```

- [ ] **Step 8: Run focused API tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/iam-role.service.spec.ts test/permission-calculation.service.spec.ts test/admin.controller.e2e-spec.ts test/permission.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit API slice**

```bash
git add apps/api/src/permission/iam-role.service.ts apps/api/src/permission/permission-calculation.service.ts apps/api/src/permission/permission.controller.ts apps/api/test/iam-role.service.spec.ts apps/api/test/permission-calculation.service.spec.ts apps/api/test/admin.controller.e2e-spec.ts apps/api/test/permission.controller.e2e-spec.ts
git commit -m "feat: make IAM roles application-bindable"
```

## Task 3: Admin Web Permission API Types

**Files:**
- Modify: `apps/admin-web/src/api/permission.ts`
- Test: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Update role API types**

In `apps/admin-web/src/api/permission.ts`, replace `IamRole` with:

```ts
export type IamRoleApplicationSummary = {
  applicationId: string;
  appKey: string;
  name: string;
  status: EntityStatus;
  bindingStatus?: EntityStatus;
};

export type IamRole = {
  id: string;
  applicationId?: string;
  appKey?: string;
  applicationIds?: string[];
  appKeys?: string[];
  applications?: IamRoleApplicationSummary[];
  key: string;
  name: string;
  description?: string | null;
  status: EntityStatus;
  permissionGroups?: PermissionGroup[];
  permissionGroupIds?: string[];
  permissionPoints?: PermissionPoint[];
  subjects?: IamRoleSubject[];
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Normalize snake_case role application summaries**

Add raw type fields:

```ts
type RawIamRoleApplicationSummary = IamRoleApplicationSummary & {
  application_id?: string;
  app_key?: string;
  binding_status?: EntityStatus;
};
```

Update `RawIamRole`:

```ts
type RawIamRole = Omit<
  IamRole,
  "appKey" | "applications" | "applicationIds" | "appKeys" | "permissionGroups" | "permissionGroupIds" | "subjects"
> & {
  app_key?: string;
  applications?: RawIamRoleApplicationSummary[];
  application_ids?: string[];
  app_keys?: string[];
  permissionGroups?: PermissionGroup[];
  permission_groups?: PermissionGroup[];
  permissionPoints?: PermissionPoint[];
  permission_points?: PermissionPoint[];
  permissionGroupIds?: string[];
  permission_group_ids?: string[];
  subjects?: IamRoleSubject[];
};
```

Normalize:

```ts
function normalizeIamRole(role: RawIamRole, appKey: string): IamRole {
  const applications = (role.applications ?? []).map(normalizeRoleApplicationSummary);
  return {
    ...role,
    appKey: role.appKey ?? role.app_key ?? appKey,
    applications,
    applicationIds: role.applicationIds ?? role.application_ids ?? applications.map((item) => item.applicationId),
    appKeys: role.appKeys ?? role.app_keys ?? applications.map((item) => item.appKey),
    permissionGroups: (role.permissionGroups ?? role.permission_groups)?.map(normalizePermissionGroup),
    permissionGroupIds: role.permissionGroupIds ?? role.permission_group_ids,
    permissionPoints: role.permissionPoints ?? role.permission_points ?? [],
    subjects: role.subjects,
  };
}

function normalizeRoleApplicationSummary(summary: RawIamRoleApplicationSummary): IamRoleApplicationSummary {
  return {
    applicationId: summary.applicationId ?? summary.application_id ?? "",
    appKey: summary.appKey ?? summary.app_key ?? "",
    name: summary.name,
    status: summary.status,
    bindingStatus: summary.bindingStatus ?? summary.binding_status,
  };
}
```

- [ ] **Step 3: Add role fan-out helper**

Add:

```ts
export async function fetchIamRolesForApplications(appKeys: string[]): Promise<IamRole[]> {
  const batches = await Promise.all(appKeys.map((appKey) => fetchIamRoles(appKey)));
  const rolesById = new Map<string, IamRole>();

  for (const role of batches.flat()) {
    const existing = rolesById.get(role.id);
    if (!existing) {
      rolesById.set(role.id, role);
      continue;
    }

    const applications = mergeRoleApplications(existing.applications, role.applications);
    rolesById.set(role.id, {
      ...existing,
      ...role,
      applications,
      applicationIds: applications.map((item) => item.applicationId),
      appKeys: applications.map((item) => item.appKey),
    });
  }

  return [...rolesById.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function mergeRoleApplications(
  left: IamRoleApplicationSummary[] = [],
  right: IamRoleApplicationSummary[] = [],
): IamRoleApplicationSummary[] {
  const map = new Map<string, IamRoleApplicationSummary>();
  for (const item of [...left, ...right]) {
    map.set(item.appKey, item);
  }
  return [...map.values()].sort((a, b) => a.appKey.localeCompare(b.appKey));
}
```

- [ ] **Step 4: Run admin-web typecheck**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

## Task 4: Permission Management Landing Page

**Files:**
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
- Modify: `apps/admin-web/src/features/permissions/permission-columns.tsx`
- Modify: `apps/admin-web/src/routes/admin-url-state.ts`
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`

- [ ] **Step 1: Write failing tests for global role list**

In `PermissionManagementView.test.tsx`, add tests:

```tsx
it("权限管理首屏展示全局角色列表，不强制选择应用", async () => {
  vi.mocked(fetchApplications).mockResolvedValue([financeApplication, basePortalApplication]);
  vi.mocked(fetchIamRoles).mockImplementation(async (appKey) => {
    if (appKey === "finance") {
      return [financeRole];
    }
    return [basePortalRole, financeRoleWithBasePortalBinding];
  });

  renderWithRouter(<PermissionManagementView admin={admin} />);

  expect(await screen.findByRole("table", { name: "IAM 角色清单" })).toBeInTheDocument();
  expect(screen.getByText("财务管理员")).toBeInTheDocument();
  expect(screen.getByText("Base Portal 运维")).toBeInTheDocument();
  expect(screen.queryByText("请选择应用后查看 IAM 角色")).not.toBeInTheDocument();
});

it("角色列表点击配置进入独立角色配置页", async () => {
  vi.mocked(fetchApplications).mockResolvedValue([financeApplication]);
  vi.mocked(fetchIamRoles).mockResolvedValue([financeRole]);

  renderWithRouter(<PermissionManagementView admin={admin} />);

  await user.click(await screen.findByRole("button", { name: /配置 ROLE_FINANCE_ADMIN/ }));

  expect(mockNavigate).toHaveBeenCalledWith(
    expect.stringContaining("/admin/permissions/roles/role-finance-admin"),
  );
});
```

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
```

Expected: FAIL because list still requires `appKey`.

- [ ] **Step 2: Load roles by optional app filter**

In `PermissionManagementView.tsx`, replace the app auto-select effect with no-op removal:

```ts
// v1.0.5: appKey is an optional filter. Do not auto-select the first app.
```

Replace data loading with:

```ts
const visibleAppKeys =
  applicationsState.status === "loaded"
    ? search.appKey
      ? [search.appKey]
      : applicationsState.applications.map((application) => application.appKey)
    : [];

void Promise.all([
  search.appKey ? fetchPermissionGroups(search.appKey) : Promise.resolve([]),
  fetchIamRolesForApplications(visibleAppKeys),
])
```

- [ ] **Step 3: Update header copy and filters**

Use:

```tsx
<PageHeader
  breadcrumbs={[
    { label: "后台", href: "/admin/workspace" },
    { label: "权限管理", current: true },
  ]}
  description="查看 IAM 角色，维护角色状态，并进入工作台配置组织、用户、应用权限组和权限。"
  title="权限管理"
/>
```

The `应用` select first option must be:

```tsx
<option value="">全部应用</option>
```

- [ ] **Step 4: Navigate to independent role route**

Change:

```ts
void navigate(
  `/admin/permissions/roles/${encodeURIComponent(action.role.id)}?from=${encodeURIComponent(from)}`,
);
```

- [ ] **Step 5: Update columns for configure/status/application summary**

In `permission-columns.tsx`, add columns:

```tsx
{
  id: "applications",
  header: "关联应用",
  cell: (role) => role.applications?.length ? `${role.applications.length} 个` : "未关联应用",
},
{
  id: "subjects",
  header: "授权对象",
  cell: (role) => `${role.subjects?.filter((item) => item.type === "feishu_department").length ?? 0} 组织 / ${role.subjects?.filter((item) => item.type === "feishu_user").length ?? 0} 用户`,
},
```

Rename row action button accessible name to:

```tsx
aria-label={`配置 ${role.key}`}
```

- [ ] **Step 6: Run frontend focused test**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
```

Expected: PASS.

## Task 5: Independent Role Configuration Workbench

**Files:**
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/routes/PermissionRoleDetailPage.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx`
- Modify: `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- Test: `apps/admin-web/src/App.test.tsx`
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`

- [ ] **Step 1: Update route**

In `App.tsx`, replace:

```tsx
<Route
  path="/admin/permissions/:appKey/roles/:roleId"
  element={<PermissionRoleDetailPage admin={adminState.admin} />}
/>
```

with:

```tsx
<Route
  path="/admin/permissions/roles/:roleId"
  element={<PermissionRoleDetailPage admin={adminState.admin} />}
/>
```

Optionally add old route as stable error redirect:

```tsx
<Route
  path="/admin/permissions/:appKey/roles/:roleId"
  element={<Navigate replace to="/admin/permissions" />}
/>
```

- [ ] **Step 2: Rebuild route params**

In `PermissionRoleDetailPage.tsx`, read only `roleId`:

```ts
const { roleId } = useParams<{ roleId: string }>();
const initialAppKey = searchParams.get("appKey") ?? undefined;
```

Load apps, fan-out roles, find role by `roleId`, and select current app:

```ts
const appKeys = applications.map((application) => application.appKey);
const roles = await fetchIamRolesForApplications(appKeys);
const role = roles.find((item) => item.id === roleId);
const activeAppKey = initialAppKey ?? role?.appKeys?.[0] ?? applications[0]?.appKey;
const groups = activeAppKey ? await fetchPermissionGroups(activeAppKey) : [];
```

- [ ] **Step 3: Split workbench tabs**

Use visible tabs:

```tsx
const roleWorkbenchTabs = ["subjects", "permissions", "audit"] as const;
```

Render labels:

```tsx
<TabsList>
  <TabsTrigger value="subjects">组织与用户</TabsTrigger>
  <TabsTrigger value="permissions">应用权限</TabsTrigger>
  <TabsTrigger value="audit">变更记录</TabsTrigger>
</TabsList>
```

- [ ] **Step 4: Keep `OrgUserSelector` as the single selector**

The `subjects` tab must render one `OrgUserSelector` only:

```tsx
<OrgUserSelector
  disabled={readOnly}
  error={subjectError}
  loadDepartments={loadDepartments}
  loadUsers={loadUsers}
  originalSubjects={role.subjects ?? []}
  saving={subjectSaving}
  subjects={subjectDraft}
  onSave={() => void saveSubjects()}
  onSubjectsChange={setSubjectDraft}
/>
```

- [ ] **Step 5: Build application permission tab**

The `permissions` tab must include:

```tsx
<select
  aria-label="当前应用"
  value={activeAppKey}
  onChange={(event) => setActiveAppKey(event.target.value)}
>
  {role.applications?.map((application) => (
    <option key={application.appKey} value={application.appKey}>
      {application.name} / {application.appKey}
    </option>
  ))}
</select>
```

Permission groups are limited to `activeAppKey`, and saving calls:

```ts
await replaceIamRolePermissionGroups(activeAppKey, role.id, permissionGroupDraft);
```

- [ ] **Step 6: Preserve permission point comparison**

Create a local `PermissionComparePanel` inside the permissions feature if no component exists:

```tsx
function PermissionComparePanel(props: { groups: PermissionGroup[]; selectedGroupIds: string[] }) {
  const selectedGroups = props.groups.filter((group) => props.selectedGroupIds.includes(group.id));
  const rows = collectPermissionCompareRows(selectedGroups);
  return (
    <section aria-label="权限点对比" className="rounded-md border bg-background p-4">
      <h3 className="text-base font-semibold">权限点对比</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">权限点 key</th>
              <th className="px-3 py-2 text-left">权限点名称</th>
              {selectedGroups.map((group) => (
                <th className="px-3 py-2 text-center" key={group.id}>{group.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-2"><code>{row.key}</code></td>
                <td className="px-3 py-2">{row.name}</td>
                {selectedGroups.map((group) => (
                  <td className="px-3 py-2 text-center" key={group.id}>
                    {row.groupIds.has(group.id) ? "✓" : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Test route and tabs**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/App.test.tsx src/features/permissions/PermissionManagementView.test.tsx
```

Expected: PASS.

## Task 6: Remove Role Management from Application Management

**Files:**
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
- Test: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`

- [ ] **Step 1: Write failing test that role tab is gone**

In `ApplicationManagementView.test.tsx`, replace old role-tab assertions with:

```tsx
it("应用详情不再展示角色管理 Tab", async () => {
  renderApplicationManagement();

  const table = await screen.findByRole("table", { name: "应用清单" });
  await user.click(within(table).getByRole("button", { name: "查看 crm 详情" }));

  const dialog = await screen.findByRole("dialog", { name: /应用详情/ });
  expect(within(dialog).getByRole("tab", { name: "详细资料" })).toBeInTheDocument();
  expect(within(dialog).getByRole("tab", { name: "开发信息" })).toBeInTheDocument();
  expect(within(dialog).getByRole("tab", { name: "危险操作" })).toBeInTheDocument();
  expect(within(dialog).queryByRole("tab", { name: "角色管理" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "新增角色" })).not.toBeInTheDocument();
});
```

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx
```

Expected: FAIL while role tab still exists.

- [ ] **Step 2: Remove role imports and state**

In `ApplicationDetailSheet.tsx`, remove imports:

```ts
import type { IamRole } from "../../api/permission";
import {
  createIamRole,
  disableIamRole,
  enableIamRole,
  fetchIamRoles,
  updateIamRole,
} from "../../api/permission";
```

Remove `RoleState`, `RoleFormState`, `RoleStatusConfirmation`, role `useState`, `loadRoles`, `handleRoleSubmit`, `handleRoleStatusConfirm`.

- [ ] **Step 3: Remove role tab trigger and content**

Remove:

```tsx
<TabsTrigger value="roles">角色管理</TabsTrigger>
```

Remove:

```tsx
<TabsContent value="roles" className="mt-4 min-w-0">
  <Section title="角色管理">
    <RoleSection ... />
  </Section>
</TabsContent>
```

- [ ] **Step 4: Remove role confirmation dialog and `RoleSection`**

Delete the `RoleSection` function and the role status `ConfirmDialog`.

- [ ] **Step 5: Run app management tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx
```

Expected: PASS.

## Task 7: Version, Docs, and Harness State

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md` if present
- Modify: `.my-harness/status.md`
- Modify: `.my-harness/runs/2026-06-20-v1.0.5-permission-workbench.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.5-permission-workbench-implementation.md`

- [ ] **Step 1: Update package versions**

Set all package versions to:

```json
"version": "1.0.5"
```

Files:

```text
package.json
apps/api/package.json
apps/admin-web/package.json
```

- [ ] **Step 2: Update README version history**

Add a `v1.0.5` entry:

```markdown
### v1.0.5

- 权限管理首屏调整为全局角色列表。
- 角色从应用从属资源调整为独立 IAM 资源，并通过角色-应用绑定支持多应用授权。
- 角色配置拆成 `组织与用户` 和 `应用权限` 两个工作区。
- 应用权限工作区保留权限点对比能力。
- 应用管理移除原 `角色管理` Tab 和角色 CRUD，角色新增、编辑、启停、删除和授权配置统一归入 `权限管理`。
```

- [ ] **Step 3: Update my-harness status**

In `.my-harness/status.md`, mark:

```markdown
| ✅ | 5 | gstack `/plan-eng-review` | 已完成 | D1=A、D2=B、D3=B；版本号锁定 v1.0.5 |
| ✅ | 6 | Superpowers `writing-plans` | 已完成 | `docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md` |
| 🎯 | 7 | Superpowers `executing-plans` | 当前下一步 | 从数据库和 API vertical slice 开始 |
```

- [ ] **Step 4: Add session archive**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.5-permission-workbench-implementation.md`:

```markdown
# v1.0.5 权限管理实施计划会话

## 会话目标

确认版本号并按 my-harness 第 6 步生成实施计划。

## 关键要求

- 版本号锁定为 `v1.0.5`。
- D1=A：新增角色-应用绑定表。
- D2=B：直接改变现有应用角色接口语义，不新增并行全局角色 API。
- D3=B：不做旧深链强兼容。

## 修改文件

- `docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- `.my-harness/status.md`

## 验证

- 本阶段只写计划，不运行实现测试。

## 下一步

进入 my-harness 第 7 步，使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 实现第一个 vertical slice。
```

## Task 8: Verification Gate

**Files:**
- No source edits unless verification exposes failures.

- [ ] **Step 1: Run API validation and tests**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:validate
pnpm --filter @feishu-iam/api test -- test/iam-role.service.spec.ts test/permission-calculation.service.spec.ts test/admin.controller.e2e-spec.ts test/permission.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run Admin Web tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx src/routes/admin-url-state.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full check**

Run:

```bash
pnpm check
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Browser self-check**

Start local app:

```bash
pnpm dev
```

Open `http://localhost:3000/` or the configured local admin URL. Check:

- `/admin/permissions` shows role list without requiring an app.
- Role list filters by application, name/key, and status.
- Create/edit/status actions are visible in permissions module.
- `配置` opens an independent page.
- `组织与用户` uses one selector for organizations and users.
- `应用权限` switches application and shows permission point comparison.
- Application detail no longer shows `角色管理`.
- Console has no unexpected errors.
- Network has no unexpected failed requests.

## Self-Review Checklist

- Spec coverage:
  - Role as independent resource: Task 1, Task 2, Task 4, Task 5.
  - Role-app many-to-many: Task 1, Task 2.
  - Permission landing page as role list: Task 4.
  - Organization/user unified selector: Task 5.
  - Application permission binding and point comparison: Task 5.
  - Remove application role management: Task 6.
  - Version `v1.0.5`: Task 7.
- Placeholder scan:
  - 未发现未定稿占位词。
  - 未使用待补办事项词作为实施占位符。
  - Each task names exact files and commands.
- Type consistency:
  - API uses `IamRoleApplicationSummary`.
  - Frontend uses `IamRoleApplicationSummary`.
  - Role list fan-out uses current `fetchIamRoles(appKey)` path per D2=B.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Recommended next action: choose option 1 and start Task 1 as the first vertical slice.
