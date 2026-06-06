# Feishu IAM v0.7.0 Admin IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.7.0 modular admin console with independent routes for workspace, applications, permissions, admin authorization, records, and system settings, plus the required application, IAM role, admin authorization, secret viewing, and record-query closures.

**Architecture:** Keep the existing NestJS domain services where possible and add admin-session wrappers for missing operations. Move the React admin console from one long `App.tsx` surface into route-like page modules with shared state components. Preserve backend authorization as the source of truth; frontend gating only improves usability.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, Vitest, Testing Library, Docker Compose versioned SQL migrations.

---

## File Structure

Backend files:

- Modify `apps/api/prisma/schema.prisma`: add encrypted client secret fields and keep `clientSecretHash`.
- Create `migrations/V0_7_0__admin_ia.sql`: add v0.7.0 schema changes and record schema version.
- Modify `apps/api/src/prisma/prisma.service.ts`: raise readiness marker to `0.7.0` and required tables/columns.
- Create `apps/api/src/oauth/client-secret-vault.ts`: encrypt/decrypt new and rotated client secrets.
- Modify `apps/api/src/oauth/oauth-config.service.ts`: store encrypted secret, expose view secret, write audit and security events for secret view/rotation.
- Modify `apps/api/src/oauth/oauth.module.ts`: provide `ClientSecretVault`.
- Modify `apps/api/src/admin/admin-oauth-config.controller.ts`: expose `POST /api/v1/admin/applications/:appKey/clients/:clientId/view-secret`.
- Modify `apps/api/src/admin/admin-permission.controller.ts`: add admin-session write endpoints for applications, IAM roles, role permission groups, and role subjects.
- Modify `apps/api/src/admin/admin-user.service.ts`: support updating application scopes and setting admin status.
- Modify `apps/api/src/admin/admin-user.controller.ts`: expose admin update/enable/disable endpoints.
- Modify `apps/api/src/admin/admin-feishu.controller.ts`: expose local department search if not already available.
- Modify `apps/api/src/admin/admin.types.ts`: keep UI-facing roles limited to `platform_admin` and `application_admin` while preserving historical role display.
- Modify backend tests under `apps/api/test/`: add coverage for secret view/rotation events, admin permission endpoints, admin user update/disable, and department subject permission calculation.

Frontend files:

- Modify `apps/admin-web/src/App.tsx`: replace long-page rendering with route state and page selection.
- Modify `apps/admin-web/src/components/AdminShell.tsx`: replace hash anchors with route buttons/links.
- Create `apps/admin-web/src/components/PageState.tsx`: common loading/empty/error/forbidden/building states.
- Create `apps/admin-web/src/components/ApplicationSelector.tsx`: reusable application picker.
- Create `apps/admin-web/src/api/applications.ts`: application admin API functions.
- Modify `apps/admin-web/src/api/oauth.ts`: add client secret view and enable APIs.
- Modify `apps/admin-web/src/api/permission.ts`: add IAM role write/binding APIs.
- Modify `apps/admin-web/src/api/admin.ts`: add admin user update/status APIs and department search types.
- Create `apps/admin-web/src/routes/WorkspacePage.tsx`.
- Create `apps/admin-web/src/routes/ApplicationManagementPage.tsx`.
- Create `apps/admin-web/src/routes/PermissionManagementPage.tsx`.
- Create `apps/admin-web/src/routes/AdminAuthorizationPage.tsx`.
- Create `apps/admin-web/src/routes/RecordQueryPage.tsx`.
- Create `apps/admin-web/src/routes/SystemSettingsPage.tsx`.
- Modify `apps/admin-web/src/components/AuditCenter.tsx` and `SecurityEventCenter.tsx`: support embedded record-query tabs and secret event filters.
- Modify `apps/admin-web/src/App.css`: modular admin console layout, page states, forms, tabs, drawers/dialogs.
- Modify `apps/admin-web/src/App.test.tsx`: update from long-page tests to route/page behavior tests.

Version and docs:

- Modify root `package.json`, `apps/api/package.json`, `apps/admin-web/package.json`: bump to `0.7.0`.
- Modify `apps/api/src/version/version.controller.ts`: fallback version `0.7.0-dev`.
- Modify `deploy/docker-compose.yml` and `deploy/server.env.example`: default image/version to v0.7.0.
- Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.7.0-后台信息架构实施.md` during execution.

---

### Task 1: Schema, Version, and Secret Vault Foundation

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `migrations/V0_7_0__admin_ia.sql`
- Modify: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/oauth/client-secret-vault.ts`
- Modify: `apps/api/src/oauth/oauth.module.ts`
- Test: `apps/api/test/client-secret-vault.spec.ts`

- [ ] **Step 1: Write vault tests**

Create `apps/api/test/client-secret-vault.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ClientSecretVault } from '../src/oauth/client-secret-vault';

describe('ClientSecretVault', () => {
  it('encrypts and decrypts client secret without returning plaintext ciphertext', () => {
    const vault = new ClientSecretVault('0123456789abcdef0123456789abcdef');
    const encrypted = vault.encrypt('bics_test_secret');

    expect(encrypted.ciphertext).not.toContain('bics_test_secret');
    expect(encrypted.algorithm).toBe('aes-256-gcm');
    expect(vault.decrypt(encrypted)).toBe('bics_test_secret');
  });

  it('rejects invalid encryption keys', () => {
    expect(() => new ClientSecretVault('short')).toThrow('CLIENT_SECRET_ENCRYPTION_KEY_INVALID');
  });
});
```

- [ ] **Step 2: Run vault test and verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/api exec vitest run test/client-secret-vault.spec.ts
```

Expected: fail because `client-secret-vault.ts` does not exist.

- [ ] **Step 3: Add encrypted secret fields to Prisma schema**

In `apps/api/prisma/schema.prisma`, extend `ApplicationClient`:

```prisma
  clientSecretHash       String                   @map("client_secret_hash")
  clientSecretCiphertext String?                  @map("client_secret_ciphertext")
  clientSecretIv         String?                  @map("client_secret_iv")
  clientSecretAuthTag    String?                  @map("client_secret_auth_tag")
  clientSecretAlgorithm  String?                  @map("client_secret_algorithm")
```

Keep existing relations and indexes unchanged.

- [ ] **Step 4: Add v0.7.0 SQL migration**

Create `migrations/V0_7_0__admin_ia.sql`:

```sql
ALTER TABLE application_clients
  ADD COLUMN IF NOT EXISTS client_secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS client_secret_iv text,
  ADD COLUMN IF NOT EXISTS client_secret_auth_tag text,
  ADD COLUMN IF NOT EXISTS client_secret_algorithm text;

INSERT INTO schema_versions (version, description)
VALUES ('0.7.0', 'admin information architecture and secret vault')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 5: Implement `ClientSecretVault`**

Create `apps/api/src/oauth/client-secret-vault.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedClientSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: 'aes-256-gcm';
};

const ALGORITHM = 'aes-256-gcm' as const;
const KEY_BYTES = 32;
const IV_BYTES = 12;

export class ClientSecretVault {
  private readonly key: Buffer;

  constructor(rawKey = process.env.CLIENT_SECRET_ENCRYPTION_KEY ?? '') {
    if (rawKey.length !== KEY_BYTES) {
      throw new Error('CLIENT_SECRET_ENCRYPTION_KEY_INVALID');
    }
    this.key = Buffer.from(rawKey, 'utf8');
  }

  encrypt(secret: string): EncryptedClientSecret {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      algorithm: ALGORITHM
    };
  }

  decrypt(input: EncryptedClientSecret): string {
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(input.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(input.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(input.ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
  }
}
```

- [ ] **Step 6: Register vault provider**

In `apps/api/src/oauth/oauth.module.ts`, import and add `ClientSecretVault` to providers and exports:

```ts
import { ClientSecretVault } from './client-secret-vault';

@Module({
  imports: [PrismaModule, PermissionModule, FeishuModule],
  controllers: [OauthController, OauthConfigController, AppPermissionsController],
  providers: [OauthService, OauthConfigService, SecurityEventService, ClientSecretVault],
  exports: [OauthService, OauthConfigService, SecurityEventService, ClientSecretVault]
})
export class OauthModule {}
```

- [ ] **Step 7: Update readiness marker**

In `apps/api/src/prisma/prisma.service.ts`, set:

```ts
const REQUIRED_SCHEMA_VERSION = '0.7.0';
const REQUIRED_TABLES = [
  'system_settings',
  'application_clients',
  'oauth_authorization_codes',
  'oauth_access_tokens',
  'security_events',
  'admin_users',
  'iam_roles',
  'iam_role_subjects'
];
```

- [ ] **Step 8: Generate Prisma client and run focused tests**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:generate
pnpm --filter @feishu-iam/api exec vitest run test/client-secret-vault.spec.ts
```

Expected: test passes.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma migrations/V0_7_0__admin_ia.sql apps/api/src/prisma/prisma.service.ts apps/api/src/oauth/client-secret-vault.ts apps/api/src/oauth/oauth.module.ts apps/api/test/client-secret-vault.spec.ts
git commit -m "feat: add client secret vault schema"
```

---

### Task 2: Secret View, Rotation Events, and Application Client Status

**Files:**
- Modify: `apps/api/src/oauth/oauth-config.service.ts`
- Modify: `apps/api/src/admin/admin-oauth-config.controller.ts`
- Modify: `apps/api/test/oauth-config.service.spec.ts`
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: Write failing service tests for encrypted create, view, and rotation events**

In `apps/api/test/oauth-config.service.spec.ts`, add tests that assert:

```ts
it('stores encrypted client secret when creating client and can view it later', async () => {
  const created = await service.createClient('demo', 'env-dev', { name: '服务端' }, adminAuditContext);
  expect(created.clientSecret).toMatch(/^bics_/);

  const row = await prisma.applicationClient.findUniqueOrThrow({ where: { clientId: created.clientId } });
  expect(row.clientSecretHash).toBeTruthy();
  expect(row.clientSecretCiphertext).toBeTruthy();
  expect(row.clientSecretCiphertext).not.toContain(created.clientSecret);

  const viewed = await service.viewClientSecret('demo', created.clientId, adminAuditContext);
  expect(viewed.clientSecret).toBe(created.clientSecret);
});

it('records secret_viewed and secret_rotated security events', async () => {
  const created = await service.createClient('demo', 'env-dev', { name: '服务端' }, adminAuditContext);
  await service.viewClientSecret('demo', created.clientId, adminAuditContext);
  await service.rotateClientSecret('demo', created.clientId, adminAuditContext);

  const events = await prisma.securityEvent.findMany({ orderBy: { createdAt: 'asc' } });
  expect(events.map((event) => event.eventType)).toEqual(
    expect.arrayContaining(['secret_viewed', 'secret_rotated'])
  );
});
```

Use the test's existing Prisma setup and add `process.env.CLIENT_SECRET_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef'` in `beforeEach`.

- [ ] **Step 2: Run service tests and verify failure**

```bash
pnpm --filter @feishu-iam/api exec vitest run test/oauth-config.service.spec.ts
```

Expected: fail because `viewClientSecret` and encrypted columns are not wired.

- [ ] **Step 3: Inject `ClientSecretVault` and `SecurityEventService`**

In `apps/api/src/oauth/oauth-config.service.ts`, update constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly applications: ApplicationService,
  private readonly audit: AuditLogService,
  private readonly vault: ClientSecretVault,
  private readonly securityEvents: SecurityEventService
) {}
```

Add imports:

```ts
import { ClientSecretVault, type EncryptedClientSecret } from './client-secret-vault';
import { SecurityEventService } from './security-event.service';
```

- [ ] **Step 4: Store encrypted secret on create and rotate**

In `createClient` and `rotateClientSecret`, after generating `clientSecret`, add:

```ts
const encryptedSecret = this.vault.encrypt(clientSecret);
```

Set these fields when creating/updating:

```ts
clientSecretCiphertext: encryptedSecret.ciphertext,
clientSecretIv: encryptedSecret.iv,
clientSecretAuthTag: encryptedSecret.authTag,
clientSecretAlgorithm: encryptedSecret.algorithm
```

- [ ] **Step 5: Add `viewClientSecret` service method**

Add method:

```ts
async viewClientSecret(
  appKey: string,
  clientId: string,
  auditContext?: OauthAuditContext
): Promise<{ clientId: string; clientSecret: string }> {
  return this.prisma.$transaction(async (tx) => {
    const application = await this.applications.getApplicationByKey(appKey, tx);
    const client = await this.getClient(application.id, clientId, tx);

    if (
      !client.clientSecretCiphertext ||
      !client.clientSecretIv ||
      !client.clientSecretAuthTag ||
      client.clientSecretAlgorithm !== 'aes-256-gcm'
    ) {
      throw new OauthDomainError('OAUTH_CLIENT_SECRET_NOT_VIEWABLE', '历史 secret 不可查看，请轮换后查看新 secret', 409);
    }

    const clientSecret = this.vault.decrypt({
      ciphertext: client.clientSecretCiphertext,
      iv: client.clientSecretIv,
      authTag: client.clientSecretAuthTag,
      algorithm: 'aes-256-gcm'
    });

    await this.recordAudit(application.id, 'application_client', client.id, 'view_secret', undefined, {
      clientId: client.clientId,
      secretViewed: true
    }, tx, auditContext);
    await this.recordSecurityEvent('secret_viewed', application.id, client.clientId, 'success', 'CLIENT_SECRET_VIEWED', auditContext);

    return { clientId: client.clientId, clientSecret };
  });
}
```

- [ ] **Step 6: Add security event helper and call it on rotate**

Add helper:

```ts
private async recordSecurityEvent(
  eventType: string,
  applicationId: string,
  clientId: string,
  result: 'success',
  reasonCode: string,
  auditContext?: OauthAuditContext
): Promise<void> {
  await this.securityEvents.record({
    eventType,
    applicationId,
    clientId,
    result,
    reasonCode,
    summary: reasonCode,
    ip: auditContext?.ip,
    userAgent: auditContext?.userAgent,
    requestId: auditContext?.requestId
  });
}
```

After rotate audit, call:

```ts
await this.recordSecurityEvent('secret_rotated', application.id, updated.clientId, 'success', 'CLIENT_SECRET_ROTATED', auditContext);
```

- [ ] **Step 7: Add admin view-secret endpoint**

In `apps/api/src/admin/admin-oauth-config.controller.ts`, add:

```ts
@Post('/clients/:clientId/view-secret')
async viewClientSecret(
  @Param('appKey') appKey: string,
  @Param('clientId') clientId: string,
  @Req() request: Request
): Promise<Awaited<ReturnType<OauthConfigService['viewClientSecret']>>> {
  const context = await this.assertCanManageApplication(appKey, request);
  return this.oauthConfig.viewClientSecret(appKey, clientId, buildAdminOauthAuditContext(request, context));
}
```

- [ ] **Step 8: Run focused backend tests**

```bash
CLIENT_SECRET_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef pnpm --filter @feishu-iam/api exec vitest run test/oauth-config.service.spec.ts test/admin.controller.e2e-spec.ts
```

Expected: tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/oauth/oauth-config.service.ts apps/api/src/admin/admin-oauth-config.controller.ts apps/api/test/oauth-config.service.spec.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: support client secret viewing"
```

---

### Task 3: Admin Application, IAM Role, and Admin User Write APIs

**Files:**
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
- Modify: `apps/api/src/permission/iam-role.service.ts`
- Modify: `apps/api/src/admin/admin-user.service.ts`
- Modify: `apps/api/src/admin/admin-user.controller.ts`
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`
- Modify: `apps/api/test/admin-user.service.spec.ts`

- [ ] **Step 1: Write failing admin controller e2e tests**

Add tests in `apps/api/test/admin.controller.e2e-spec.ts` for:

```ts
it('平台管理员可创建 IAM 角色并传入 admin 审计上下文', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/admin/applications/demo/iam-roles')
    .set('Cookie', ['feishu_iam_admin_session=bias_platform'])
    .send({ key: 'demo.admin', name: 'Demo 管理员' })
    .expect(201)
    .expect((response) => {
      expect(getField(response.body, 'key')).toBe('demo.admin');
    });
});

it('授权应用管理员可替换 IAM 角色权限组和成员', async () => {
  await request(app.getHttpServer())
    .put('/api/v1/admin/applications/demo/iam-roles/role-demo-admin/permission-groups')
    .set('Cookie', ['feishu_iam_admin_session=bias_app_demo'])
    .send({ permissionGroupIds: ['group-demo-default'] })
    .expect(200);

  await request(app.getHttpServer())
    .put('/api/v1/admin/applications/demo/iam-roles/role-demo-admin/subjects')
    .set('Cookie', ['feishu_iam_admin_session=bias_app_demo'])
    .send({ subjects: [{ type: 'feishu_user', id: '5be616gc' }, { type: 'feishu_department', id: 'od-demo' }] })
    .expect(200);
});

it('平台管理员可编辑应用管理员范围并禁用管理员', async () => {
  await request(app.getHttpServer())
    .patch('/api/v1/admin/admin-users/admin-app-demo/scopes')
    .set('Cookie', ['feishu_iam_admin_session=bias_platform'])
    .send({ applicationIds: ['app-demo'] })
    .expect(200);

  await request(app.getHttpServer())
    .post('/api/v1/admin/admin-users/admin-app-demo/disable')
    .set('Cookie', ['feishu_iam_admin_session=bias_platform'])
    .expect(200);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin.controller.e2e-spec.ts
```

Expected: fail because endpoints are missing.

- [ ] **Step 3: Fix IAM role audit actor**

In `apps/api/src/permission/iam-role.service.ts`, replace `recordAudit` body spread:

```ts
const actor = {
  actorType: auditContext?.actorType ?? SYSTEM_ACTOR.actorType,
  actorId: auditContext?.actorId ?? SYSTEM_ACTOR.actorId,
  source: auditContext?.source ?? SYSTEM_ACTOR.source
};
await this.audit.record({
  ...actor,
  applicationId,
  resourceType: 'iam_role',
  resourceId,
  action,
  before,
  after,
  result: 'success',
  requestId: auditContext?.requestId,
  ip: auditContext?.ip,
  userAgent: auditContext?.userAgent
}, client);
```

- [ ] **Step 4: Add admin IAM role endpoints**

In `apps/api/src/admin/admin-permission.controller.ts`, add imports:

```ts
import { Body, Patch, Post, Put } from '@nestjs/common';
import { getAdminRequestId } from './admin-request-context';
import type { PermissionAuditContext } from '../permission/permission.types';
```

Add endpoint methods:

```ts
@Post('/:appKey/iam-roles')
async createRole(@Param('appKey') appKey: string, @Body() body: { key: string; name: string; description?: string }, @Req() request: Request): Promise<IamRoleResponse> {
  const context = await this.assertCanManageApplication(appKey, request);
  const role = await this.iamRoles.createRole(appKey, body, buildPermissionAuditContext(request, context));
  return { ...role, app_key: appKey };
}

@Patch('/:appKey/iam-roles/:roleId')
async updateRole(@Param('appKey') appKey: string, @Param('roleId') roleId: string, @Body() body: { name?: string; description?: string | null }, @Req() request: Request): Promise<IamRoleResponse> {
  const context = await this.assertCanManageApplication(appKey, request);
  const role = await this.iamRoles.updateRole(appKey, roleId, body, buildPermissionAuditContext(request, context));
  return { ...role, app_key: appKey };
}

@Post('/:appKey/iam-roles/:roleId/enable')
async enableRole(@Param('appKey') appKey: string, @Param('roleId') roleId: string, @Req() request: Request): Promise<IamRoleResponse> {
  const context = await this.assertCanManageApplication(appKey, request);
  const role = await this.iamRoles.setRoleStatus(appKey, roleId, 'active', buildPermissionAuditContext(request, context));
  return { ...role, app_key: appKey };
}

@Post('/:appKey/iam-roles/:roleId/disable')
async disableRole(@Param('appKey') appKey: string, @Param('roleId') roleId: string, @Req() request: Request): Promise<IamRoleResponse> {
  const context = await this.assertCanManageApplication(appKey, request);
  const role = await this.iamRoles.setRoleStatus(appKey, roleId, 'disabled', buildPermissionAuditContext(request, context));
  return { ...role, app_key: appKey };
}

@Put('/:appKey/iam-roles/:roleId/permission-groups')
async replaceRolePermissionGroups(@Param('appKey') appKey: string, @Param('roleId') roleId: string, @Body() body: { permissionGroupIds: string[] }, @Req() request: Request): Promise<{ ok: true }> {
  const context = await this.assertCanManageApplication(appKey, request);
  await this.iamRoles.replaceRolePermissionGroups(appKey, roleId, body.permissionGroupIds, buildPermissionAuditContext(request, context));
  return { ok: true };
}

@Put('/:appKey/iam-roles/:roleId/subjects')
async replaceRoleSubjects(@Param('appKey') appKey: string, @Param('roleId') roleId: string, @Body() body: { subjects: Array<{ type: 'feishu_user' | 'feishu_department'; id: string }> }, @Req() request: Request): Promise<{ ok: true }> {
  const context = await this.assertCanManageApplication(appKey, request);
  await this.iamRoles.replaceRoleSubjects(appKey, roleId, body.subjects, buildPermissionAuditContext(request, context));
  return { ok: true };
}
```

Add helper:

```ts
function buildPermissionAuditContext(request: Request, context: AdminContext): PermissionAuditContext {
  return {
    actorType: 'admin_user',
    actorId: context.adminUserId,
    source: 'admin_web',
    requestId: getAdminRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}
```

- [ ] **Step 5: Add admin user update/status service methods**

In `apps/api/src/admin/admin-user.service.ts`, add methods:

```ts
async replaceApplicationScopes(adminUserId: string, applicationIds: string[], auditContext?: AdminAuditContext): Promise<AdminUserListItem> {
  const normalizedApplicationIds = normalizeApplicationIds(applicationIds);
  return this.prisma.$transaction(async (tx) => {
    const current = await tx.adminUser.findUnique({ where: { id: adminUserId }, include: { applicationScopes: true } });
    if (!current) {
      throw new AdminDomainError('ADMIN_USER_NOT_FOUND', '管理员不存在', 404);
    }
    await this.assertApplicationsExist(tx, normalizedApplicationIds);
    await tx.adminApplicationScope.deleteMany({ where: { adminUserId } });
    await tx.adminApplicationScope.createMany({
      data: normalizedApplicationIds.map((applicationId) => ({ adminUserId, applicationId })),
      skipDuplicates: true
    });
    await this.audit.record({
      ...(auditContext ?? SYSTEM_AUDIT_CONTEXT),
      resourceType: 'admin_user',
      resourceId: adminUserId,
      action: 'replace_application_scopes',
      before: { applicationIds: current.applicationScopes.map((scope) => scope.applicationId) },
      after: { applicationIds: normalizedApplicationIds },
      result: 'success'
    }, tx);
    return serializeAdminUserListItem(await getAdminUserListRecord(tx, adminUserId));
  });
}

async setAdminUserStatus(adminUserId: string, status: 'active' | 'disabled', auditContext?: AdminAuditContext): Promise<AdminUserListItem> {
  return this.prisma.$transaction(async (tx) => {
    const current = await tx.adminUser.findUnique({ where: { id: adminUserId } });
    if (!current) {
      throw new AdminDomainError('ADMIN_USER_NOT_FOUND', '管理员不存在', 404);
    }
    await tx.adminUser.update({ where: { id: adminUserId }, data: { status } });
    if (status === 'disabled') {
      await tx.adminSession.updateMany({ where: { adminUserId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.record({
      ...(auditContext ?? SYSTEM_AUDIT_CONTEXT),
      resourceType: 'admin_user',
      resourceId: adminUserId,
      action: 'set_status',
      before: { status: current.status },
      after: { status },
      result: 'success'
    }, tx);
    return serializeAdminUserListItem(await getAdminUserListRecord(tx, adminUserId));
  });
}
```

Add helper `getAdminUserListRecord` using the same include shape as `listAdminUsers`.

- [ ] **Step 6: Add admin user controller endpoints**

In `apps/api/src/admin/admin-user.controller.ts`, add imports `Param`, `Patch`.

Add methods:

```ts
@Patch('/:adminUserId/scopes')
async replaceScopes(@Param('adminUserId') adminUserId: string, @Body() body: { applicationIds: string[] }, @Req() request: Request): Promise<unknown> {
  const context = readRequiredAdminContext(request);
  this.permission.assertCanManageAdmins(context);
  return this.adminUsers.replaceApplicationScopes(adminUserId, body.applicationIds, buildAdminUserAuditContext(request, context));
}

@Post('/:adminUserId/enable')
async enable(@Param('adminUserId') adminUserId: string, @Req() request: Request): Promise<unknown> {
  const context = readRequiredAdminContext(request);
  this.permission.assertCanManageAdmins(context);
  return this.adminUsers.setAdminUserStatus(adminUserId, 'active', buildAdminUserAuditContext(request, context));
}

@Post('/:adminUserId/disable')
async disable(@Param('adminUserId') adminUserId: string, @Req() request: Request): Promise<unknown> {
  const context = readRequiredAdminContext(request);
  this.permission.assertCanManageAdmins(context);
  return this.adminUsers.setAdminUserStatus(adminUserId, 'disabled', buildAdminUserAuditContext(request, context));
}
```

- [ ] **Step 7: Run admin tests**

```bash
pnpm --filter @feishu-iam/api exec vitest run test/admin.controller.e2e-spec.ts test/admin-user.service.spec.ts test/iam-role.service.spec.ts test/permission-calculation.service.spec.ts
```

Expected: tests pass, including dynamic department permission calculation.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/admin/admin-permission.controller.ts apps/api/src/permission/iam-role.service.ts apps/api/src/admin/admin-user.service.ts apps/api/src/admin/admin-user.controller.ts apps/api/test/admin.controller.e2e-spec.ts apps/api/test/admin-user.service.spec.ts
git commit -m "feat: add admin role authorization APIs"
```

---

### Task 4: Frontend API Layer and Shared Page States

**Files:**
- Create: `apps/admin-web/src/api/applications.ts`
- Modify: `apps/admin-web/src/api/oauth.ts`
- Modify: `apps/admin-web/src/api/permission.ts`
- Modify: `apps/admin-web/src/api/admin.ts`
- Create: `apps/admin-web/src/components/PageState.tsx`
- Create: `apps/admin-web/src/components/ApplicationSelector.tsx`
- Test: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Add frontend API tests**

In `apps/admin-web/src/App.test.tsx`, add tests that mock `fetch` and assert:

```ts
it('应用 API 使用 admin session 同源接口', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'app-demo', appKey: 'demo', name: 'Demo 应用', status: 'active' }));
  const { updateApplication } = await import('./api/applications');
  await updateApplication('demo', { name: 'Demo 应用' });
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/applications/demo', expect.objectContaining({ credentials: 'include' }));
});

it('secret 查看 API 不把 secret 放进请求 URL', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ clientId: 'bic_demo', clientSecret: 'bics_demo_secret' }));
  const { viewApplicationClientSecret } = await import('./api/oauth');
  await viewApplicationClientSecret('demo', 'bic_demo');
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/applications/demo/clients/bic_demo/view-secret', expect.any(Object));
});
```

- [ ] **Step 2: Run frontend test and verify failure**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: fail because new APIs do not exist.

- [ ] **Step 3: Create `applications.ts`**

Create `apps/admin-web/src/api/applications.ts`:

```ts
import type { Application } from './permission';

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'include' });
  if (!response.ok) {
    throw new Error('应用管理请求失败');
  }
  return response.json() as Promise<T>;
}

function applicationPath(appKey: string): string {
  return `/api/v1/admin/applications/${encodeURIComponent(appKey)}`;
}

export async function createApplication(input: { appKey: string; name: string; description?: string; ownerUserId?: string }): Promise<Application> {
  return readJson<Application>('/api/v1/admin/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function updateApplication(appKey: string, input: { name?: string; description?: string | null; ownerUserId?: string | null }): Promise<Application> {
  return readJson<Application>(applicationPath(appKey), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function enableApplication(appKey: string): Promise<Application> {
  return readJson<Application>(`${applicationPath(appKey)}/enable`, { method: 'POST' });
}

export async function disableApplication(appKey: string): Promise<Application> {
  return readJson<Application>(`${applicationPath(appKey)}/disable`, { method: 'POST' });
}
```

- [ ] **Step 4: Extend OAuth frontend API**

In `apps/admin-web/src/api/oauth.ts`, add:

```ts
export async function viewApplicationClientSecret(
  appKey: string,
  clientId: string
): Promise<{ clientId: string; clientSecret: string }> {
  return writeJson<{ clientId: string; clientSecret: string }>(
    `${applicationPath(appKey)}/clients/${encodeURIComponent(clientId)}/view-secret`
  );
}

export async function enableApplicationClient(appKey: string, clientId: string): Promise<ApplicationClient> {
  return writeJson<ApplicationClient>(`${applicationPath(appKey)}/clients/${encodeURIComponent(clientId)}/enable`);
}
```

- [ ] **Step 5: Extend permission frontend API**

In `apps/admin-web/src/api/permission.ts`, add:

```ts
export type IamRoleSubject = { type: 'feishu_user' | 'feishu_department'; id: string };

export async function createIamRole(appKey: string, input: { key: string; name: string; description?: string }): Promise<IamRole> {
  return readJson<IamRole>(`/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function replaceIamRolePermissionGroups(appKey: string, roleId: string, permissionGroupIds: string[]): Promise<void> {
  await readJson<{ ok: true }>(`/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/permission-groups`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissionGroupIds })
  });
}

export async function replaceIamRoleSubjects(appKey: string, roleId: string, subjects: IamRoleSubject[]): Promise<void> {
  await readJson<{ ok: true }>(`/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/subjects`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjects })
  });
}
```

- [ ] **Step 6: Extend admin frontend API**

In `apps/admin-web/src/api/admin.ts`, add:

```ts
export async function replaceAdminUserScopes(adminUserId: string, applicationIds: string[]): Promise<AdminUser> {
  return readJson<AdminUser>(`/api/v1/admin/admin-users/${encodeURIComponent(adminUserId)}/scopes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationIds })
  });
}

export async function enableAdminUser(adminUserId: string): Promise<AdminUser> {
  return readJson<AdminUser>(`/api/v1/admin/admin-users/${encodeURIComponent(adminUserId)}/enable`, { method: 'POST' });
}

export async function disableAdminUser(adminUserId: string): Promise<AdminUser> {
  return readJson<AdminUser>(`/api/v1/admin/admin-users/${encodeURIComponent(adminUserId)}/disable`, { method: 'POST' });
}
```

- [ ] **Step 7: Add shared page states**

Create `apps/admin-web/src/components/PageState.tsx`:

```tsx
export function PageLoading(props: { text?: string }) {
  return <div className="page-state">{props.text ?? '正在加载...'}</div>;
}

export function PageError(props: { message: string }) {
  return <div className="page-state page-state-error">{props.message}</div>;
}

export function PageEmpty(props: { text: string }) {
  return <div className="page-state page-state-empty">{props.text}</div>;
}

export function PageForbidden(props: { text?: string }) {
  return <div className="page-state page-state-forbidden">{props.text ?? '当前管理员无权访问该模块'}</div>;
}

export function BuildingState(props: { title?: string }) {
  return <div className="page-state page-state-building">{props.title ?? '建设中'}</div>;
}
```

- [ ] **Step 8: Add reusable application selector**

Create `apps/admin-web/src/components/ApplicationSelector.tsx`:

```tsx
import type { Application } from '../api/permission';

export function ApplicationSelector(props: {
  applications: Application[];
  selectedAppKey: string | null;
  onSelect: (appKey: string) => void;
}) {
  if (props.applications.length === 0) {
    return <div className="empty-state">暂无可管理应用</div>;
  }

  return (
    <div className="application-list" aria-label="应用列表">
      {props.applications.map((application) => (
        <button
          className={`application-row ${application.appKey === props.selectedAppKey ? 'application-row-active' : ''}`}
          key={application.id}
          type="button"
          onClick={() => props.onSelect(application.appKey)}
          aria-pressed={application.appKey === props.selectedAppKey}
        >
          <span>
            <strong>{application.appKey}</strong>
            <small>{application.name}</small>
          </span>
          <span className={`status-badge status-badge-${application.status}`}>{application.status}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Run frontend tests**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: tests pass or fail only on route tests still scheduled for later tasks.

- [ ] **Step 10: Commit**

```bash
git add apps/admin-web/src/api/applications.ts apps/admin-web/src/api/oauth.ts apps/admin-web/src/api/permission.ts apps/admin-web/src/api/admin.ts apps/admin-web/src/components/PageState.tsx apps/admin-web/src/components/ApplicationSelector.tsx apps/admin-web/src/App.test.tsx
git commit -m "feat: add admin console api layer"
```

---

### Task 5: Modular Admin Shell and Workspace Route

**Files:**
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/components/AdminShell.tsx`
- Create: `apps/admin-web/src/routes/WorkspacePage.tsx`
- Modify: `apps/admin-web/src/App.css`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write failing route shell test**

In `apps/admin-web/src/App.test.tsx`, add:

```ts
it('一级菜单切换不使用 hash 锚点并展示独立模块', async () => {
  render(<App />);
  expect(await screen.findByRole('button', { name: '应用管理' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '应用管理' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '系统设置' }));
  expect(await screen.findByRole('heading', { name: '系统设置' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '应用与权限' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run route shell test and verify failure**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "一级菜单切换"
```

Expected: fail because shell still uses anchors and long page.

- [ ] **Step 3: Update `AdminShell` to route buttons**

Change props:

```tsx
export type AdminRouteKey = 'workspace' | 'applications' | 'permissions' | 'admins' | 'records' | 'settings';

export function AdminShell(props: {
  admin: AdminMe;
  activeRoute: AdminRouteKey;
  onRouteChange: (route: AdminRouteKey) => void;
  children: ReactNode;
}) {
```

Replace `navigationItems` with route keys:

```tsx
const navigationItems = [
  { route: 'workspace', label: '工作台', icon: LayoutDashboard },
  { route: 'applications', label: '应用管理', icon: AppWindow },
  { route: 'permissions', label: '权限管理', icon: KeyRound },
  { route: 'admins', label: '管理员授权', icon: UsersRound },
  { route: 'records', label: '记录查询', icon: ScrollText },
  { route: 'settings', label: '系统设置', icon: DatabaseZap }
] as const;
```

Render buttons:

```tsx
<button
  className={item.route === props.activeRoute ? 'admin-nav-item admin-nav-item-active' : 'admin-nav-item'}
  type="button"
  onClick={() => props.onRouteChange(item.route)}
  key={item.route}
>
  <Icon aria-hidden="true" size={17} />
  <span>{item.label}</span>
</button>
```

- [ ] **Step 4: Create workspace page**

Create `apps/admin-web/src/routes/WorkspacePage.tsx`:

```tsx
import { Activity, Database, ShieldCheck, Users } from 'lucide-react';
import type { AdminMe } from '../admin-types';
import type { ApiStatus } from '../api/status';
import type { FeishuStatus } from '../api/feishu';

export function WorkspacePage(props: {
  admin: AdminMe;
  apiStatus?: ApiStatus;
  feishuStatus?: FeishuStatus;
  onNavigate: (route: 'applications' | 'permissions' | 'records' | 'settings') => void;
}) {
  return (
    <main className="admin-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>工作台</h1>
        </div>
        <ShieldCheck aria-hidden="true" size={24} />
      </header>
      <section className="status-grid" aria-label="工作台概览">
        <SummaryCard icon={<Activity size={20} />} title="API 状态" value={props.apiStatus?.health ?? '读取中'} />
        <SummaryCard icon={<Database size={20} />} title="数据库" value={props.apiStatus?.ready ?? '读取中'} />
        <SummaryCard icon={<Users size={20} />} title="有效用户" value={String(props.feishuStatus?.counts.activeUsers ?? '读取中')} />
      </section>
      <section className="quick-actions" aria-label="快捷入口">
        <button type="button" onClick={() => props.onNavigate('applications')}>应用管理</button>
        <button type="button" onClick={() => props.onNavigate('permissions')}>权限管理</button>
        <button type="button" onClick={() => props.onNavigate('records')}>记录查询</button>
        <button type="button" onClick={() => props.onNavigate('settings')}>系统设置</button>
      </section>
    </main>
  );
}

function SummaryCard(props: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <article className="status-card">
      <span className="status-icon">{props.icon}</span>
      <div>
        <span>{props.title}</span>
        <strong>{props.value}</strong>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Refactor `App.tsx` to active route state**

Keep existing data loaders, add:

```tsx
const [activeRoute, setActiveRoute] = useState<AdminRouteKey>('workspace');
```

Render:

```tsx
<AdminShell admin={adminState.admin} activeRoute={activeRoute} onRouteChange={setActiveRoute}>
  {activeRoute === 'workspace' ? (
    <WorkspacePage
      admin={adminState.admin}
      apiStatus={state.status === 'loaded' ? state.data : undefined}
      feishuStatus={feishuState.status === 'loaded' ? feishuState.data : undefined}
      onNavigate={setActiveRoute}
    />
  ) : null}
  {activeRoute === 'settings' ? <SystemSettingsPage ... /> : null}
</AdminShell>
```

For routes not created yet, temporarily render `<BuildingState />` until later tasks replace them.

- [ ] **Step 6: Add CSS for button nav**

In `apps/admin-web/src/App.css`, ensure `.admin-nav-item` works for buttons:

```css
.admin-nav-item {
  width: 100%;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
```

- [ ] **Step 7: Run route shell test**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "一级菜单切换"
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web/src/App.tsx apps/admin-web/src/components/AdminShell.tsx apps/admin-web/src/routes/WorkspacePage.tsx apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx
git commit -m "feat: add modular admin shell"
```

---

### Task 6: Application Management Page

**Files:**
- Create: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.css`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write application management tests**

Add tests:

```ts
it('应用管理默认展示应用清单并进入应用详情', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '应用管理' }));
  expect(await screen.findByRole('heading', { name: '应用管理' })).toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: /demo/ }));
  expect(await screen.findByRole('tab', { name: '基础信息' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '环境与回调' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Client' })).toBeInTheDocument();
});

it('查看 client secret 需要二次确认并短时展示', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '应用管理' }));
  await userEvent.click(await screen.findByRole('button', { name: /demo/ }));
  await userEvent.click(screen.getByRole('tab', { name: 'Client' }));
  await userEvent.click(await screen.findByRole('button', { name: '查看 secret' }));
  expect(await screen.findByText('关闭后请不要在文档或日志中记录该 secret')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "应用管理"
```

Expected: fail because page is not implemented.

- [ ] **Step 3: Create `ApplicationManagementPage`**

Create page that:

- Loads applications through existing `fetchApplications`.
- Shows `ApplicationSelector`.
- Maintains selected app and active tab state.
- Uses existing OAuth API functions for environments, redirect URIs, clients.
- Adds secret view button calling `viewApplicationClientSecret` only after `window.confirm`.

Use this component signature:

```tsx
export function ApplicationManagementPage(props: {
  admin: AdminMe;
  initialAppKey?: string | null;
  onManagePermissions: (appKey: string) => void;
  onOpenRecords: (applicationId: string) => void;
}) {
```

- [ ] **Step 4: Implement tabs**

Render tabs:

```tsx
const tabs = ['基础信息', '环境与回调', 'Client', '操作记录'] as const;
```

For `操作记录`, render:

```tsx
<BuildingState title="应用操作记录建设中" />
```

until application-filtered record query is wired.

- [ ] **Step 5: Wire to `App.tsx`**

When active route is `applications`:

```tsx
<ApplicationManagementPage
  admin={adminState.admin}
  onManagePermissions={(appKey) => {
    setSelectedPermissionAppKey(appKey);
    setActiveRoute('permissions');
  }}
  onOpenRecords={() => setActiveRoute('records')}
/>
```

- [ ] **Step 6: Run application page tests**

```bash
CLIENT_SECRET_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "应用管理|client secret"
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-web/src/routes/ApplicationManagementPage.tsx apps/admin-web/src/App.tsx apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx
git commit -m "feat: add application management page"
```

---

### Task 7: Permission Management Page

**Files:**
- Create: `apps/admin-web/src/routes/PermissionManagementPage.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.css`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write permission route tests**

Add:

```ts
it('权限管理按应用展示 IAM 角色并通过弹窗绑定权限组', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '权限管理' }));
  await userEvent.click(await screen.findByRole('button', { name: /demo/ }));
  expect(await screen.findByRole('heading', { name: 'Demo 应用角色授权' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '绑定权限组' }));
  expect(await screen.findByRole('dialog', { name: '绑定权限组' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '权限目录' })).not.toBeInTheDocument();
});

it('权限管理支持绑定飞书用户和部门成员', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '权限管理' }));
  await userEvent.click(await screen.findByRole('button', { name: /demo/ }));
  await userEvent.click(await screen.findByRole('button', { name: '绑定成员' }));
  expect(await screen.findByRole('button', { name: '添加飞书用户' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '添加飞书部门' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "权限管理"
```

Expected: fail because page does not exist.

- [ ] **Step 3: Create permission management page**

Create `apps/admin-web/src/routes/PermissionManagementPage.tsx` with:

- Application selector.
- IAM role list.
- Role detail panel.
- Create/edit role form.
- `绑定权限组` dialog using `fetchPermissionGroups` as candidates.
- `绑定成员` dialog using local user and department search APIs.

Component signature:

```tsx
export function PermissionManagementPage(props: {
  admin: AdminMe;
  initialAppKey?: string | null;
}) {
```

- [ ] **Step 4: Keep permission groups out of persistent catalog UI**

Ensure page only renders:

```tsx
<section aria-label="已绑定权限组">...</section>
```

and does not render persistent `权限目录`.

- [ ] **Step 5: Wire route context from application page**

In `App.tsx`, keep:

```tsx
const [selectedPermissionAppKey, setSelectedPermissionAppKey] = useState<string | null>(null);
```

Render:

```tsx
<PermissionManagementPage admin={adminState.admin} initialAppKey={selectedPermissionAppKey} />
```

- [ ] **Step 6: Run permission tests**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "权限管理"
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-web/src/routes/PermissionManagementPage.tsx apps/admin-web/src/App.tsx apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx
git commit -m "feat: add permission management page"
```

---

### Task 8: Admin Authorization Page

**Files:**
- Create: `apps/admin-web/src/routes/AdminAuthorizationPage.tsx`
- Modify: `apps/admin-web/src/components/AdminUserCenter.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write admin authorization tests**

Add:

```ts
it('管理员授权首页展示管理员列表且新增流程只暴露两类管理员', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '管理员授权' }));
  expect(await screen.findByRole('heading', { name: '管理员授权' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '新增管理员' }));
  expect(screen.getByRole('option', { name: '平台管理员' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '应用管理员' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '审计查看员' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '同步管理员' })).not.toBeInTheDocument();
});

it('非平台管理员进入管理员授权显示权限不足', async () => {
  mockAdminMe({ roles: ['application_admin'], applicationIds: ['app-demo'] });
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '管理员授权' }));
  expect(await screen.findByText('当前管理员无权管理管理员授权')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "管理员授权"
```

Expected: fail.

- [ ] **Step 3: Create `AdminAuthorizationPage`**

Create page that wraps or replaces `AdminUserCenter`:

- Lists admin users.
- Shows historical roles read-only in list.
- New/edit form only allows `platform_admin` and `application_admin`.
- Application admin requires one or more selected applications.
- Supports edit scope, enable, disable.

- [ ] **Step 4: Wire route**

In `App.tsx`, render:

```tsx
{activeRoute === 'admins' ? <AdminAuthorizationPage admin={adminState.admin} /> : null}
```

- [ ] **Step 5: Run admin authorization tests**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "管理员授权"
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/routes/AdminAuthorizationPage.tsx apps/admin-web/src/components/AdminUserCenter.tsx apps/admin-web/src/App.tsx apps/admin-web/src/App.test.tsx
git commit -m "feat: add admin authorization page"
```

---

### Task 9: Record Query and System Settings Pages

**Files:**
- Create: `apps/admin-web/src/routes/RecordQueryPage.tsx`
- Create: `apps/admin-web/src/routes/SystemSettingsPage.tsx`
- Modify: `apps/admin-web/src/components/AuditCenter.tsx`
- Modify: `apps/admin-web/src/components/SecurityEventCenter.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write record/settings tests**

Add:

```ts
it('记录查询以页签入口展示审计日志和安全事件，并支持 secret 事件筛选', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '记录查询' }));
  expect(await screen.findByRole('tab', { name: '审计日志' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: '安全事件' }));
  expect(await screen.findByRole('option', { name: 'secret_viewed' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'secret_rotated' })).toBeInTheDocument();
});

it('系统设置只展示系统层能力', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '系统设置' }));
  expect(await screen.findByRole('heading', { name: '系统设置' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '飞书同步' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '系统运行' })).toBeInTheDocument();
  expect(screen.queryByText('Client')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "记录查询|系统设置"
```

Expected: fail.

- [ ] **Step 3: Create `RecordQueryPage`**

Implement tabs:

- `审计日志` renders `AuditCenter`.
- `安全事件` renders `SecurityEventCenter` with secret event options.
- `同步记录` renders `<BuildingState title="同步记录建设中" />`.
- `登录与 Token 记录` renders `<BuildingState title="登录与 Token 记录建设中" />`.

- [ ] **Step 4: Add secret filters to `SecurityEventCenter`**

Ensure event type select includes:

```tsx
<option value="secret_viewed">secret_viewed</option>
<option value="secret_rotated">secret_rotated</option>
```

- [ ] **Step 5: Create `SystemSettingsPage`**

Render tabs:

- `飞书同步`: existing Feishu status, diagnostics, trigger sync.
- `系统运行`: API health and DB ready.
- `版本信息`: current version.

Keep application-level SSO/client content out of this page.

- [ ] **Step 6: Wire routes and run tests**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "记录查询|系统设置"
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-web/src/routes/RecordQueryPage.tsx apps/admin-web/src/routes/SystemSettingsPage.tsx apps/admin-web/src/components/AuditCenter.tsx apps/admin-web/src/components/SecurityEventCenter.tsx apps/admin-web/src/App.tsx apps/admin-web/src/App.test.tsx
git commit -m "feat: add records and settings pages"
```

---

### Task 10: Version, Docs, Full Verification, and Browser QA

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/api/src/version/version.controller.ts`
- Modify: `deploy/docker-compose.yml`
- Modify: `deploy/server.env.example`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.7.0-后台信息架构实施.md`

- [ ] **Step 1: Bump versions**

Set all package versions to `0.7.0`. In `apps/api/src/version/version.controller.ts`, set fallback to:

```ts
const FALLBACK_VERSION = '0.7.0-dev';
```

Update deploy defaults to `v0.7.0` image tag and `APP_VERSION=0.7.0`.

- [ ] **Step 2: Run full verification**

```bash
CLIENT_SECRET_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef pnpm check
pnpm build
```

Expected: both commands pass.

- [ ] **Step 3: Start local app for browser QA**

```bash
CLIENT_SECRET_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef pnpm compose:up
curl -fsS http://localhost:3000/ready
```

Expected: `/ready` returns ready JSON.

- [ ] **Step 4: Browser QA**

Open `http://localhost:3000/` and verify:

- Menus switch independent modules, no hash anchor behavior.
- Application management shows list and details.
- Client secret view requires confirmation and records event.
- Permission management does not show persistent permission directory.
- Permission group binding uses dialog.
- User and department subjects are available.
- Admin authorization only exposes platform/admin application role choices.
- Record query includes `secret_viewed` and `secret_rotated`.
- System settings contains no client or redirect URI management.

- [ ] **Step 5: Create session archive**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.7.0-后台信息架构实施.md` with:

```md
# v0.7.0 后台信息架构实施

## 会话目标

实施 Feishu IAM v0.7.0 后台信息架构和关键管理闭环。

## 用户关键要求

- 一级菜单独立模块，不再使用长页面锚点。
- 应用管理收拢应用级 SSO 配置。
- 权限管理按 IAM 角色授权，权限组和权限点不在 UI 维护。
- 管理员授权只暴露平台管理员和应用管理员。
- GitLab issue 不纳入本版本。

## 修改文件

记录本次实际修改文件。

## 验证结果

记录 `pnpm check`、`pnpm build`、`curl /ready` 和浏览器 QA 结果。

## 后续事项

记录未完成事项和下一步建议。
```

- [ ] **Step 6: Commit final docs/version**

```bash
git add package.json apps/api/package.json apps/admin-web/package.json apps/api/src/version/version.controller.ts deploy/docker-compose.yml deploy/server.env.example docs/codex-sessions/
git commit -m "chore: prepare v0.7.0 admin ia release"
```

---

## Plan Self-Review

Spec coverage:

- Independent routes and no hash anchors: Tasks 5, 10.
- Application management and SSO/client merge: Tasks 2, 4, 6.
- Secret viewing with safety and security events: Tasks 1, 2, 9.
- Permission management through IAM roles, groups as dialog candidates, users/departments as subjects: Tasks 3, 4, 7.
- Admin authorization two-role UI and enable/disable/scope editing: Tasks 3, 4, 8.
- Record query tabs and secret event filters: Task 9.
- System settings conservative scope: Task 9.
- Version, migration, verification, and session archive: Tasks 1, 10.
- GitLab issue exclusion: captured in spec and not included as an implementation task.

Placeholder scan:

- No unfinished placeholder markers are used.
- “建设中” appears only as an explicit product state required by the spec.

Type consistency:

- `feishu_user` and `feishu_department` match existing `IamSubjectType`.
- Secret event types use `secret_viewed` and `secret_rotated` consistently.
- Admin UI role choices are `platform_admin` and `application_admin`.
