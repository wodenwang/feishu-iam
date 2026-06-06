# Feishu IAM v0.8.1 Application Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.8.1 application onboarding package: no application environments, application-level redirect URIs and OAuth credentials, application developer API credentials, copyable Codex integration prompts, one-liner deployment docs, upgrade improvements, and multi-architecture image publishing.

**Architecture:** Move the SSO configuration model from environment-scoped records to application-scoped records while preserving existing OAuth semantics. Add a small application onboarding domain service that composes application creation, redirect URI creation, OAuth credential creation, developer credential creation, prompt generation, and audit logging in one transaction. Keep admin-session authorization as the source of truth for the UI and add a separate developer API guard whose credentials can only manage permission points, permission groups, and group-point bindings for one application.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, TypeScript, Vitest, Supertest, Docker Compose, Bash, Docker Buildx.

---

## Scope Check

The design includes model changes, OAuth behavior, admin UI, developer API, deployment docs, and image publishing. These are not independent enough to split into separate specs because the central `application_environments` removal changes all of them. This plan keeps one version plan and splits it into small verification tasks.

GitLab issue #1 is explicitly out of scope for this version.

## File Structure

Backend schema and migration:

- Modify `apps/api/prisma/schema.prisma`: remove new-flow dependence on `ApplicationEnvironment`, make redirect URIs and OAuth credentials application-scoped, add `ApplicationDeveloperCredential`.
- Create `migrations/V0_8_1__application_onboarding.sql`: migrate existing environment-scoped data to application-scoped data, add developer credentials, and record schema version `0.8.1`.
- Modify `apps/api/src/prisma/prisma.service.ts`: update required schema marker and required tables/columns.

Backend OAuth and onboarding:

- Modify `apps/api/src/oauth/oauth.validators.ts`: replace environment-aware redirect validation with application-level URL validation.
- Modify `apps/api/src/oauth/oauth.types.ts`: add onboarding, developer credential, and integration prompt response types.
- Modify `apps/api/src/oauth/oauth-config.service.ts`: replace environment APIs with application-level redirect URI and OAuth credential APIs.
- Create `apps/api/src/oauth/integration-prompt.service.ts`: generate full and safe Codex integration prompts.
- Create `apps/api/src/oauth/application-onboarding.service.ts`: create application, redirect URIs, OAuth credential, developer credential, and prompt in one flow.
- Create `apps/api/src/oauth/developer-credential.service.ts`: create, rotate, verify, and record usage for application developer credentials.
- Create `apps/api/src/oauth/developer-api.guard.ts`: authenticate `Authorization: Bearer <developer_api_token>`.
- Create `apps/api/src/oauth/developer-permission.controller.ts`: expose developer API endpoints for permission points, permission groups, and group-point bindings.
- Modify `apps/api/src/oauth/oauth.service.ts`: remove environment checks from authorize, token, revoke, userinfo, and access token creation while preserving application and credential checks.
- Modify `apps/api/src/oauth/app-token.guard.ts`: parse app tokens without requiring environment context.
- Modify `apps/api/src/oauth/app-permissions.controller.ts`: keep `/api/v1/apps/{app_key}/me/permissions` response unchanged.
- Modify `apps/api/src/oauth/oauth.module.ts`: provide onboarding, prompt, developer credential, guard, and developer API controller.

Backend admin wrappers:

- Modify `apps/api/src/admin/admin-permission.controller.ts`: make `POST /api/v1/admin/applications` call onboarding service and expose application-level redirect URI, OAuth credential, developer credential, and prompt endpoints.
- Modify `apps/api/src/admin/admin-oauth-config.controller.ts`: remove environment routes from the admin-facing API or keep them returning stable 410 responses during the compatibility window.
- Modify `apps/api/test/admin.controller.e2e-spec.ts`: cover application onboarding package, prompt generation, credential rotation, removed environment endpoints, and authorization boundaries.
- Modify `apps/api/test/oauth.controller.e2e-spec.ts`: cover no-environment OAuth flow.
- Create `apps/api/test/application-onboarding.service.spec.ts`: service-level onboarding tests.
- Create `apps/api/test/developer-credential.service.spec.ts`: credential hashing, rotation, and verification tests.
- Create `apps/api/test/developer-permission.controller.e2e-spec.ts`: developer API auth and cross-application denial tests.

Frontend:

- Modify `apps/admin-web/src/api/permission.ts`: make `createApplication` call the onboarding endpoint and return prompts and credentials.
- Modify `apps/admin-web/src/api/oauth.ts`: remove environment API types and add application-level redirect URI, OAuth credential, developer credential, and prompt API functions.
- Modify `apps/admin-web/src/routes/ApplicationManagementPage.tsx`: add `新增应用`, create onboarding flow, new tabs, prompt copy flow, and remove environment/client UI.
- Modify `apps/admin-web/src/App.test.tsx`: cover create app, prompt copy, safe prompt, tab labels, and removed environment/client wording.
- Modify `apps/admin-web/src/App.css`: add onboarding modal/result, credential callout, prompt textarea, and developer API styles.

Docs, deployment, and release:

- Modify `docs/sso-provider.md`: remove environment concept and document application-level callback rules.
- Modify `docs/permission-model.md`: document developer API credential boundary.
- Modify `README.md`: add v0.8.1 status, one-liner install, upgrade command, and multi-arch image pull/inspect commands.
- Modify `deploy/upgrade.sh`: keep current flow and improve version, backup, pull-policy, and error messages for v0.8.1.
- Modify `deploy/server.env.example`: update defaults and comments for v0.8.1.
- Create `deploy/install.sh`: one-liner bootstrap script that downloads compose, env example, and upgrade script without embedding secrets.
- Modify `deploy/docker-compose.yml`: default image tag and `APP_VERSION` to `v0.8.1` / `0.8.1`.
- Modify `package.json`, `apps/api/package.json`, `apps/admin-web/package.json`: bump version to `0.8.1`.
- Modify `apps/api/src/version/version.controller.ts`: fallback version `0.8.1-dev`.
- Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.8.1-应用接入包实施.md`: implementation session archive during execution.

---

### Task 1: Schema and Migration Foundation

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `migrations/V0_8_1__application_onboarding.sql`
- Modify: `apps/api/src/prisma/prisma.service.ts`
- Test: `apps/api/test/prisma.service.spec.ts`

- [ ] **Step 1: Confirm baseline schema state**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:validate
```

Expected: PASS before changes. This confirms current schema is valid before the migration edit.

- [ ] **Step 2: Add the v0.8.1 migration**

Create `migrations/V0_8_1__application_onboarding.sql` with this structure:

```sql
ALTER TABLE application_redirect_uris
  ADD COLUMN IF NOT EXISTS source_environment_id text;

UPDATE application_redirect_uris
SET source_environment_id = environment_id
WHERE source_environment_id IS NULL;

ALTER TABLE application_clients
  ADD COLUMN IF NOT EXISTS source_environment_id text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

UPDATE application_clients
SET source_environment_id = environment_id
WHERE source_environment_id IS NULL;

WITH ranked_clients AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY application_id
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        last_used_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM application_clients
  WHERE revoked_at IS NULL
)
UPDATE application_clients c
SET is_primary = ranked_clients.rn = 1
FROM ranked_clients
WHERE ranked_clients.id = c.id;

ALTER TABLE application_redirect_uris
  ALTER COLUMN environment_id DROP NOT NULL;

ALTER TABLE application_clients
  ALTER COLUMN environment_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS application_redirect_uris_application_uri_unique
  ON application_redirect_uris(application_id, redirect_uri);

CREATE UNIQUE INDEX IF NOT EXISTS application_clients_primary_unique
  ON application_clients(application_id)
  WHERE is_primary = true AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS application_developer_credentials (
  id text PRIMARY KEY,
  application_id text NOT NULL REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_developer_credentials_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS application_developer_credentials_application_id_idx
  ON application_developer_credentials(application_id);

CREATE INDEX IF NOT EXISTS application_developer_credentials_status_idx
  ON application_developer_credentials(status);

INSERT INTO schema_versions(version, description)
VALUES ('0.8.1', 'application onboarding without environments')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 3: Update Prisma models**

In `apps/api/prisma/schema.prisma`, update the existing models with these shape changes:

```prisma
model Application {
  id                         String                           @id
  appKey                     String                           @unique @map("app_key")
  name                       String
  description                String?
  ownerUserId                String?                          @map("owner_user_id")
  status                     String                           @default("active")
  createdAt                  DateTime                         @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt                  DateTime                         @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  permissionGroups           PermissionGroup[]
  permissionPoints           PermissionPoint[]
  iamRoles                   IamRole[]
  auditLogs                  AuditLog[]
  permissionGroupPoints      PermissionGroupPoint[]
  iamRolePermissionGroups    IamRolePermissionGroup[]
  iamRolePermissionPoints    IamRolePermissionPoint[]
  environments               ApplicationEnvironment[]
  redirectUris               ApplicationRedirectUri[]
  clients                    ApplicationClient[]
  developerCredentials       ApplicationDeveloperCredential[]
  authorizationCodes         OauthAuthorizationCode[]
  accessTokens               OauthAccessToken[]
  securityEvents             SecurityEvent[]
  adminApplicationScopes     AdminApplicationScope[]

  @@map("applications")
}

model ApplicationRedirectUri {
  id                  String                  @id
  applicationId       String                  @map("application_id")
  environmentId       String?                 @map("environment_id")
  sourceEnvironmentId String?                 @map("source_environment_id")
  redirectUri          String                 @map("redirect_uri")
  status              String                  @default("active")
  createdAt           DateTime                @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt           DateTime                @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  application         Application             @relation(fields: [applicationId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  environment         ApplicationEnvironment? @relation(fields: [applicationId, environmentId], references: [applicationId, id], onDelete: Restrict, onUpdate: Cascade)

  @@unique([applicationId, redirectUri])
  @@index([applicationId])
  @@index([status])
  @@map("application_redirect_uris")
}

model ApplicationClient {
  id                     String                  @id
  applicationId          String                  @map("application_id")
  environmentId          String?                 @map("environment_id")
  sourceEnvironmentId    String?                 @map("source_environment_id")
  clientId               String                  @unique @map("client_id")
  clientSecretHash       String                  @map("client_secret_hash")
  clientSecretCiphertext String?                 @map("client_secret_ciphertext")
  clientSecretIv         String?                 @map("client_secret_iv")
  clientSecretAuthTag    String?                 @map("client_secret_auth_tag")
  clientSecretAlgorithm  String?                 @map("client_secret_algorithm")
  name                   String
  status                 String                  @default("active")
  isPrimary              Boolean                 @default(false) @map("is_primary")
  revokedAt              DateTime?               @map("revoked_at") @db.Timestamptz(6)
  lastUsedAt             DateTime?               @map("last_used_at") @db.Timestamptz(6)
  createdAt              DateTime                @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt              DateTime                @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  application            Application             @relation(fields: [applicationId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  environment            ApplicationEnvironment? @relation(fields: [applicationId, environmentId], references: [applicationId, id], onDelete: Restrict, onUpdate: Cascade)
  loginStates            OauthLoginState[]
  authorizationCodes     OauthAuthorizationCode[]
  accessTokens           OauthAccessToken[]

  @@unique([applicationId, clientId])
  @@index([applicationId])
  @@index([status])
  @@map("application_clients")
}

model ApplicationDeveloperCredential {
  id             String      @id
  applicationId  String      @map("application_id")
  tokenHash      String      @unique @map("token_hash")
  name           String
  status         String      @default("active")
  lastUsedAt     DateTime?   @map("last_used_at") @db.Timestamptz(6)
  rotatedAt      DateTime?   @map("rotated_at") @db.Timestamptz(6)
  createdAt      DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  application    Application @relation(fields: [applicationId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@index([applicationId])
  @@index([status])
  @@map("application_developer_credentials")
}
```

- [ ] **Step 4: Update readiness schema marker**

In `apps/api/src/prisma/prisma.service.ts`, update the required schema version and table list:

```ts
const REQUIRED_SCHEMA_VERSION = '0.8.1';
const REQUIRED_TABLES = [
  'schema_versions',
  'applications',
  'application_redirect_uris',
  'application_clients',
  'application_developer_credentials',
  'oauth_authorization_codes',
  'oauth_access_tokens',
  'permission_groups',
  'permission_points',
  'permission_group_points',
  'iam_roles',
  'admin_users',
  'audit_logs',
  'security_events'
] as const;
```

- [ ] **Step 5: Run schema validation**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:generate
pnpm --filter @feishu-iam/api prisma:validate
```

Expected: both commands pass.

- [ ] **Step 6: Commit schema foundation**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/prisma/prisma.service.ts migrations/V0_8_1__application_onboarding.sql
git commit -m "feat: add v0.8.1 onboarding schema"
```

---

### Task 2: Application-Level OAuth Config Service

**Files:**
- Modify: `apps/api/src/oauth/oauth.validators.ts`
- Modify: `apps/api/src/oauth/oauth.types.ts`
- Modify: `apps/api/src/oauth/oauth-config.service.ts`
- Test: `apps/api/test/oauth-config.service.spec.ts`

- [ ] **Step 1: Add failing redirect validator tests**

In `apps/api/test/oauth.validators.spec.ts`, replace environment-specific redirect assertions with application-level assertions:

```ts
import { describe, expect, it } from 'vitest';
import { assertRedirectUri } from '../src/oauth/oauth.validators';
import { OauthDomainError } from '../src/oauth/oauth.types';

describe('assertRedirectUri', () => {
  it('allows exact http and https URLs without environment policy', () => {
    expect(() => assertRedirectUri('http://localhost:5173/auth/callback')).not.toThrow();
    expect(() => assertRedirectUri('http://192.168.2.112:3000/callback')).not.toThrow();
    expect(() => assertRedirectUri('https://app.example.com/auth/callback')).not.toThrow();
  });

  it('rejects invalid, wildcard, and non-http callback URLs', () => {
    const invalidValues = [
      'not-a-url',
      'ftp://example.com/callback',
      'https://*.example.com/callback',
      'https://example.com/*',
      '/auth/callback'
    ];

    for (const value of invalidValues) {
      expect(() => assertRedirectUri(value)).toThrow(OauthDomainError);
    }
  });
});
```

- [ ] **Step 2: Implement application-level redirect validation**

In `apps/api/src/oauth/oauth.validators.ts`, use this function signature:

```ts
export function assertRedirectUri(redirectUri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new OauthDomainError('OAUTH_REDIRECT_URI_INVALID', '回调地址必须是完整 URL', 400);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OauthDomainError('OAUTH_REDIRECT_URI_INVALID', '回调地址只支持 HTTP 或 HTTPS', 400);
  }

  if (parsed.hostname.includes('*') || parsed.pathname.includes('*') || parsed.search.includes('*')) {
    throw new OauthDomainError('OAUTH_REDIRECT_URI_WILDCARD_UNSUPPORTED', '回调地址不支持通配符', 400);
  }
}
```

Keep `assertEnvironmentKey` exported only if old compatibility tests still import it; do not call it from new application-level code.

- [ ] **Step 3: Add service tests for application-level redirect and credential APIs**

Create or update `apps/api/test/oauth-config.service.spec.ts` with these behavior tests:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OauthConfigService } from '../src/oauth/oauth-config.service';

describe('OauthConfigService application-level config', () => {
  const prisma = {
    $transaction: vi.fn(),
    applicationRedirectUri: {
      findMany: vi.fn()
    },
    applicationClient: {
      findFirst: vi.fn()
    }
  };
  const applications = {
    getApplicationByKey: vi.fn()
  };
  const audit = { record: vi.fn() };
  const vault = {
    encrypt: vi.fn(() => ({
      ciphertext: 'ciphertext',
      iv: 'iv',
      authTag: 'tag',
      algorithm: 'aes-256-gcm'
    })),
    decrypt: vi.fn(() => 'bics_test_secret')
  };
  const securityEvents = { record: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    applications.getApplicationByKey.mockResolvedValue({
      id: 'app-finance',
      appKey: 'finance',
      status: 'active'
    });
  });

  it('creates an application-level redirect URI without environment id', async () => {
    const tx = {
      applicationRedirectUri: {
        create: vi.fn().mockResolvedValue({
          id: 'redirect-1',
          applicationId: 'app-finance',
          environmentId: null,
          redirectUri: 'http://localhost:5173/callback',
          status: 'active'
        })
      },
      auditLog: { create: vi.fn() }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const service = new OauthConfigService(prisma as never, applications as never, audit as never, vault as never, securityEvents as never);
    const result = await service.createRedirectUri('finance', { redirectUri: 'http://localhost:5173/callback' });

    expect(result.environmentId).toBeNull();
    expect(tx.applicationRedirectUri.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-finance',
        environmentId: null,
        redirectUri: 'http://localhost:5173/callback'
      })
    });
  });
});
```

- [ ] **Step 4: Replace `OauthConfigService` public methods**

In `apps/api/src/oauth/oauth-config.service.ts`, keep the class name and replace new-flow methods with these signatures:

```ts
type CreateRedirectUriInput = {
  redirectUri: string;
};

type CreateOauthCredentialInput = {
  name?: string;
};

async createRedirectUri(
  appKey: string,
  input: CreateRedirectUriInput,
  auditContext?: OauthAuditContext
): Promise<ApplicationRedirectUri> {
  assertRedirectUri(input.redirectUri);
  return this.prisma.$transaction(async (tx) => {
    const application = await this.applications.getApplicationByKey(appKey, tx);
    const created = await tx.applicationRedirectUri.create({
      data: {
        id: randomUUID(),
        applicationId: application.id,
        environmentId: null,
        redirectUri: input.redirectUri
      }
    });
    await this.recordAudit(application.id, 'application_redirect_uri', created.id, 'create', undefined, created, tx, auditContext);
    return created;
  });
}

async listRedirectUris(appKey: string): Promise<ApplicationRedirectUri[]> {
  const application = await this.applications.getApplicationByKey(appKey);
  return this.prisma.applicationRedirectUri.findMany({
    where: {
      applicationId: application.id
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
}

async createPrimaryOauthCredential(
  appKey: string,
  input: CreateOauthCredentialInput,
  auditContext?: OauthAuditContext
): Promise<ApplicationClient & { clientSecret: string }> {
  const clientSecret = createOauthSecret('bics');
  const encryptedSecret = this.clientSecretVault.encrypt(clientSecret);
  return this.prisma.$transaction(async (tx) => {
    const application = await this.applications.getApplicationByKey(appKey, tx);
    await tx.applicationClient.updateMany({
      where: {
        applicationId: application.id,
        isPrimary: true,
        revokedAt: null
      },
      data: {
        isPrimary: false
      }
    });
    const created = await tx.applicationClient.create({
      data: {
        id: randomUUID(),
        applicationId: application.id,
        environmentId: null,
        clientId: createClientId(),
        clientSecretHash: hashOauthSecret(clientSecret),
        clientSecretCiphertext: encryptedSecret.ciphertext,
        clientSecretIv: encryptedSecret.iv,
        clientSecretAuthTag: encryptedSecret.authTag,
        clientSecretAlgorithm: encryptedSecret.algorithm,
        name: input.name ?? '默认登录凭证',
        isPrimary: true
      }
    });
    await this.recordAudit(application.id, 'application_oauth_credential', created.id, 'create', undefined, removeClientSecretMaterial(created), tx, auditContext);
    return { ...created, clientSecret };
  });
}
```

Adjust `disableRedirectUri`, `listClients`, `rotateClientSecret`, `viewClientSecret`, and `setClientStatus` to find records by `applicationId` and `clientId` without checking an environment id.

- [ ] **Step 5: Run OAuth config tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- oauth.validators.spec.ts oauth-config.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit OAuth config service**

```bash
git add apps/api/src/oauth/oauth.validators.ts apps/api/src/oauth/oauth.types.ts apps/api/src/oauth/oauth-config.service.ts apps/api/test/oauth.validators.spec.ts apps/api/test/oauth-config.service.spec.ts
git commit -m "feat: make oauth config application scoped"
```

---

### Task 3: OAuth Runtime Without Environments

**Files:**
- Modify: `apps/api/src/oauth/oauth.service.ts`
- Modify: `apps/api/src/oauth/app-token.guard.ts`
- Modify: `apps/api/src/oauth/app-permissions.controller.ts`
- Test: `apps/api/test/oauth.controller.e2e-spec.ts`
- Test: `apps/api/test/app-permissions.e2e-spec.ts`

- [ ] **Step 1: Add no-environment OAuth e2e coverage**

In `apps/api/test/oauth.controller.e2e-spec.ts`, add a test that seeds an active application, an active primary application client with `environmentId: null`, and an active redirect URI with `environmentId: null`:

```ts
it('completes authorize and token exchange without application environment', async () => {
  await seedApplication({
    id: 'app-no-env',
    appKey: 'noenv',
    name: 'No Env App',
    status: 'active'
  });
  await seedApplicationClient({
    id: 'client-no-env',
    applicationId: 'app-no-env',
    environmentId: null,
    clientId: 'bic_noenv',
    clientSecretHash: hashOauthSecret('secret-noenv'),
    name: '默认登录凭证',
    status: 'active',
    isPrimary: true
  });
  await seedRedirectUri({
    id: 'redirect-no-env',
    applicationId: 'app-no-env',
    environmentId: null,
    redirectUri: 'http://localhost:5173/auth/callback',
    status: 'active'
  });

  const authorize = await request(app.getHttpServer())
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: 'bic_noenv',
      redirect_uri: 'http://localhost:5173/auth/callback',
      state: 'state-no-env',
      scope: 'openid profile permissions'
    })
    .expect(302);

  expect(authorize.headers.location).toContain('accounts.feishu');

  const callback = await request(app.getHttpServer())
    .get('/oauth/feishu/callback')
    .query({ code: 'feishu-code-no-env', state: extractLoginState(authorize.headers.location) })
    .expect(302);

  const callbackUrl = new URL(callback.headers.location);
  const code = callbackUrl.searchParams.get('code');
  expect(code).toBeTruthy();

  const token = await request(app.getHttpServer())
    .post('/oauth/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:5173/auth/callback',
      client_id: 'bic_noenv',
      client_secret: 'secret-noenv'
    })
    .expect(200);

  expect(token.body).toEqual(expect.objectContaining({
    token_type: 'Bearer',
    expires_in: expect.any(Number),
    scope: 'openid profile permissions'
  }));
});
```

If helper names differ in the current test file, add local helpers with these names in the test file so this test stays readable.

- [ ] **Step 2: Update OAuth client context type**

In `apps/api/src/oauth/oauth.service.ts`, change `OauthClientWithContext`:

```ts
type OauthClientWithContext = {
  applicationId: string;
  environmentId: string | null;
  clientId: string;
  clientSecretHash: string;
  status: string;
  application?: { status: string } | null;
};
```

- [ ] **Step 3: Remove environment includes and checks from credential lookup**

In `exchangeCode` and `revokeToken`, change the Prisma client lookup to:

```ts
const client = await this.prisma.applicationClient.findUnique({
  where: {
    clientId: normalizedInput.clientId
  },
  include: {
    application: true
  }
});
```

Update `assertActiveClientContext`:

```ts
private assertActiveClientContext(client: OauthClientWithContext): void {
  if (client.status !== 'active') {
    throw new OauthDomainError('OAUTH_CLIENT_DISABLED', '登录凭证已停用', 403);
  }
  if (!client.application || client.application.status !== 'active') {
    throw new OauthDomainError('OAUTH_APPLICATION_DISABLED', '应用已停用', 403);
  }
}
```

- [ ] **Step 4: Store access tokens without requiring environment**

In `exchangeCode`, update token creation:

```ts
await tx.oauthAccessToken.create({
  data: {
    id: randomUUID(),
    tokenHash: hashOauthSecret(accessToken),
    applicationId: authorizationCode.applicationId,
    environmentId: authorizationCode.environmentId ?? null,
    clientId: client.clientId,
    feishuUserId: authorizationCode.feishuUserId,
    scope: authorizationCode.scope,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS)
  }
});
```

- [ ] **Step 5: Update authorize redirect URI lookup**

In `doStartAuthorization`, replace environment-scoped redirect checks with:

```ts
const client = await this.prisma.applicationClient.findUnique({
  where: { clientId: input.clientId },
  include: { application: true }
});
if (!client) {
  throw new OauthDomainError('OAUTH_CLIENT_NOT_FOUND', '登录凭证不存在', 404);
}
this.assertActiveClientContext(client);

const redirectUri = await this.prisma.applicationRedirectUri.findFirst({
  where: {
    applicationId: client.applicationId,
    redirectUri: input.redirectUri,
    status: 'active'
  }
});
if (!redirectUri) {
  throw new OauthDomainError('OAUTH_REDIRECT_URI_UNTRUSTED', '回调地址未登记或已禁用', 400);
}
```

When creating `oauthLoginState` and `oauthAuthorizationCode`, write `environmentId: client.environmentId ?? null`.

- [ ] **Step 6: Update token guard context**

In `apps/api/src/oauth/app-token.guard.ts`, remove environment status checks. The active token query should include application and user status only:

```ts
const token = await this.prisma.oauthAccessToken.findFirst({
  where: {
    tokenHash,
    revokedAt: null,
    expiresAt: {
      gt: new Date()
    }
  },
  include: {
    application: true,
    feishuUser: true
  }
});
```

Reject disabled applications and inactive users with the existing stable error path.

- [ ] **Step 7: Run OAuth runtime tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- oauth.controller.e2e-spec.ts app-permissions.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit OAuth runtime**

```bash
git add apps/api/src/oauth/oauth.service.ts apps/api/src/oauth/app-token.guard.ts apps/api/src/oauth/app-permissions.controller.ts apps/api/test/oauth.controller.e2e-spec.ts apps/api/test/app-permissions.e2e-spec.ts
git commit -m "feat: remove environments from oauth runtime"
```

---

### Task 4: Onboarding Package and Integration Prompt

**Files:**
- Create: `apps/api/src/oauth/integration-prompt.service.ts`
- Create: `apps/api/src/oauth/application-onboarding.service.ts`
- Modify: `apps/api/src/oauth/oauth.module.ts`
- Modify: `apps/api/src/oauth/oauth.types.ts`
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
- Test: `apps/api/test/application-onboarding.service.spec.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: Write prompt service tests**

Create `apps/api/test/integration-prompt.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IntegrationPromptService } from '../src/oauth/integration-prompt.service';

describe('IntegrationPromptService', () => {
  it('generates a full Codex prompt with one-time secrets', () => {
    const service = new IntegrationPromptService();
    const prompt = service.generateFullPrompt({
      baseIamUrl: 'http://feishu-iam.dev.tangtring.com',
      appKey: 'finance',
      applicationName: '财务系统',
      redirectUris: ['http://localhost:5173/auth/callback'],
      clientId: 'bic_finance',
      clientSecret: 'bics_secret',
      developerApiToken: 'biad_secret'
    });

    expect(prompt).toContain('AGENTS.md');
    expect(prompt).toContain('CLAUDE.md');
    expect(prompt).toContain('FEISHU_IAM_URL=http://feishu-iam.dev.tangtring.com');
    expect(prompt).toContain('app_key: finance');
    expect(prompt).toContain('client_id: bic_finance');
    expect(prompt).toContain('client_secret: bics_secret');
    expect(prompt).toContain('developer_api_token: biad_secret');
    expect(prompt).toContain('/oauth/authorize');
    expect(prompt).toContain('/api/v1/apps/finance/me/permissions');
  });

  it('generates a safe prompt without plaintext secrets', () => {
    const service = new IntegrationPromptService();
    const prompt = service.generateSafePrompt({
      baseIamUrl: 'http://feishu-iam.dev.tangtring.com',
      appKey: 'finance',
      applicationName: '财务系统',
      redirectUris: ['http://localhost:5173/auth/callback'],
      clientId: 'bic_finance'
    });

    expect(prompt).toContain('如需完整提示词，请轮换登录凭证和开发者 API 凭证');
    expect(prompt).not.toContain('bics_secret');
    expect(prompt).not.toContain('biad_secret');
  });
});
```

- [ ] **Step 2: Implement prompt service**

Create `apps/api/src/oauth/integration-prompt.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

type FullPromptInput = {
  baseIamUrl: string;
  appKey: string;
  applicationName: string;
  redirectUris: string[];
  clientId: string;
  clientSecret: string;
  developerApiToken: string;
};

type SafePromptInput = Omit<FullPromptInput, 'clientSecret' | 'developerApiToken'>;

@Injectable()
export class IntegrationPromptService {
  generateFullPrompt(input: FullPromptInput): string {
    return buildPrompt(input, {
      clientSecret: input.clientSecret,
      developerApiToken: input.developerApiToken
    });
  }

  generateSafePrompt(input: SafePromptInput): string {
    return buildPrompt(input, {
      clientSecret: '<请在 Feishu IAM 中轮换登录凭证后填入>',
      developerApiToken: '<请在 Feishu IAM 中轮换开发者 API 凭证后填入>',
      safeNotice: '如需完整提示词，请轮换登录凭证和开发者 API 凭证。'
    });
  }
}

function buildPrompt(
  input: SafePromptInput,
  secrets: { clientSecret: string; developerApiToken: string; safeNotice?: string }
): string {
  const redirectList = input.redirectUris.map((uri) => `- ${uri}`).join('\\n');
  return `你正在开发第三方应用「${input.applicationName}」，请把以下 Feishu IAM 接入约定写入本项目 AGENTS.md 或 CLAUDE.md。

${secrets.safeNotice ?? '以下 secret 只展示一次，请写入本项目的安全配置或密钥管理系统，不要提交到仓库。'}

Feishu IAM:
- FEISHU_IAM_URL=${input.baseIamUrl}
- app_key: ${input.appKey}
- client_id: ${input.clientId}
- client_secret: ${secrets.clientSecret}
- developer_api_token: ${secrets.developerApiToken}

回调地址必须与 Feishu IAM 登记值完全一致：
${redirectList}

OAuth 登录流程：
1. 浏览器跳转到 ${input.baseIamUrl}/oauth/authorize，携带 response_type=code、client_id、redirect_uri、state、scope。
2. 第三方后端在回调地址收到 code 后，调用 ${input.baseIamUrl}/oauth/token 换取 access token。
3. 使用 access token 调用 ${input.baseIamUrl}/oauth/userinfo 获取用户信息。
4. 使用 access token 调用 ${input.baseIamUrl}/api/v1/apps/${input.appKey}/me/permissions 获取权限组和权限点。

开发者 API：
- 使用 Authorization: Bearer <developer_api_token>。
- 只能维护本应用的权限点、权限组和权限组权限点绑定。
- 不能修改应用配置、回调地址、登录凭证、角色授权或管理员授权。

安全要求：
- 不要把 client_secret、developer_api_token、authorization code、access token、cookie 或密码写入仓库、日志、截图、聊天消息、测试快照或会话归档。
- 权限点 key 必须以 ${input.appKey}. 开头。

验收 checklist：
- 可以完成 Feishu IAM 登录并回到登记的 redirect_uri。
- 后端可以用 code 换取 access token。
- 可以读取 /oauth/userinfo。
- 可以读取 /api/v1/apps/${input.appKey}/me/permissions。
- 可以用开发者 API 创建或更新本应用权限点和权限组。
`;
}
```

- [ ] **Step 3: Write onboarding service test**

Create `apps/api/test/application-onboarding.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ApplicationOnboardingService } from '../src/oauth/application-onboarding.service';

describe('ApplicationOnboardingService', () => {
  it('creates application, redirect URI, OAuth credential, developer credential, and full prompt', async () => {
    const applications = {
      createApplication: vi.fn().mockResolvedValue({
        id: 'app-finance',
        appKey: 'finance',
        name: '财务系统',
        status: 'active'
      })
    };
    const oauthConfig = {
      createRedirectUri: vi.fn().mockResolvedValue({
        id: 'redirect-1',
        redirectUri: 'http://localhost:5173/auth/callback',
        status: 'active'
      }),
      createPrimaryOauthCredential: vi.fn().mockResolvedValue({
        id: 'credential-1',
        clientId: 'bic_finance',
        clientSecret: 'bics_secret',
        status: 'active'
      })
    };
    const developerCredentials = {
      createCredential: vi.fn().mockResolvedValue({
        credential: { id: 'developer-credential-1', status: 'active' },
        token: 'biad_secret'
      })
    };
    const prompts = {
      generateFullPrompt: vi.fn().mockReturnValue('full prompt')
    };

    const service = new ApplicationOnboardingService(
      applications as never,
      oauthConfig as never,
      developerCredentials as never,
      prompts as never
    );

    const result = await service.createOnboardingPackage({
      appKey: 'finance',
      name: '财务系统',
      redirectUris: ['http://localhost:5173/auth/callback']
    });

    expect(applications.createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ appKey: 'finance', name: '财务系统' }),
      undefined
    );
    expect(oauthConfig.createRedirectUri).toHaveBeenCalledWith(
      'finance',
      { redirectUri: 'http://localhost:5173/auth/callback' },
      undefined
    );
    expect(result.clientSecret).toBe('bics_secret');
    expect(result.developerApiToken).toBe('biad_secret');
    expect(result.integrationPrompt).toBe('full prompt');
  });
});
```

- [ ] **Step 4: Implement onboarding service**

Create `apps/api/src/oauth/application-onboarding.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ApplicationService } from '../permission/application.service';
import type { OauthAuditContext } from './oauth.types';
import { DeveloperCredentialService } from './developer-credential.service';
import { IntegrationPromptService } from './integration-prompt.service';
import { OauthConfigService } from './oauth-config.service';

type CreateOnboardingInput = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  redirectUris: string[];
};

@Injectable()
export class ApplicationOnboardingService {
  constructor(
    private readonly applications: ApplicationService,
    private readonly oauthConfig: OauthConfigService,
    private readonly developerCredentials: DeveloperCredentialService,
    private readonly prompts: IntegrationPromptService
  ) {}

  async createOnboardingPackage(input: CreateOnboardingInput, auditContext?: OauthAuditContext) {
    const application = await this.applications.createApplication({
      appKey: input.appKey,
      name: input.name,
      description: input.description,
      ownerUserId: input.ownerUserId
    }, auditContext);
    const redirectUris = [];
    for (const redirectUri of input.redirectUris) {
      redirectUris.push(await this.oauthConfig.createRedirectUri(input.appKey, { redirectUri }, auditContext));
    }
    const oauthCredential = await this.oauthConfig.createPrimaryOauthCredential(input.appKey, {}, auditContext);
    const developerCredential = await this.developerCredentials.createCredential(input.appKey, '默认开发者 API 凭证', auditContext);
    const baseIamUrl = process.env.FEISHU_IAM_PUBLIC_URL ?? `http://localhost:${process.env.HOST_WEB_PORT ?? '8000'}`;
    const integrationPrompt = this.prompts.generateFullPrompt({
      baseIamUrl,
      appKey: input.appKey,
      applicationName: input.name,
      redirectUris: input.redirectUris,
      clientId: oauthCredential.clientId,
      clientSecret: oauthCredential.clientSecret,
      developerApiToken: developerCredential.token
    });

    return {
      application,
      redirectUris,
      oauthCredential: {
        id: oauthCredential.id,
        clientId: oauthCredential.clientId,
        status: oauthCredential.status
      },
      clientSecret: oauthCredential.clientSecret,
      developerCredential: developerCredential.credential,
      developerApiToken: developerCredential.token,
      integrationPrompt
    };
  }
}
```

- [ ] **Step 5: Register services in OAuth module**

In `apps/api/src/oauth/oauth.module.ts`, add providers:

```ts
providers: [
  OauthService,
  OauthConfigService,
  ClientSecretVault,
  SecurityEventService,
  DeveloperCredentialService,
  IntegrationPromptService,
  ApplicationOnboardingService
],
exports: [
  OauthConfigService,
  SecurityEventService,
  DeveloperCredentialService,
  IntegrationPromptService,
  ApplicationOnboardingService
]
```

- [ ] **Step 6: Add admin onboarding endpoint**

In `apps/api/src/admin/admin-permission.controller.ts`, inject `ApplicationOnboardingService` and change `POST /api/v1/admin/applications`:

```ts
type CreateApplicationBody = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  redirectUris?: string[];
};

@Post('/applications')
async createApplication(
  @Body() body: CreateApplicationBody,
  @Req() request: Request
): Promise<Awaited<ReturnType<ApplicationOnboardingService['createOnboardingPackage']>>> {
  return this.writeWithAudit(
    request,
    { appKey: body.appKey, resourceType: 'application', resourceId: safeResourceId(body.appKey), action: 'create_onboarding_package' },
    (auditContext) => this.onboarding.createOnboardingPackage({
      appKey: body.appKey,
      name: body.name,
      description: body.description,
      ownerUserId: body.ownerUserId,
      redirectUris: body.redirectUris ?? []
    }, auditContext)
  );
}
```

Before calling the service, reject an empty `redirectUris` array with `PermissionDomainError('APPLICATION_REDIRECT_URI_REQUIRED', '至少需要一个回调地址', 400)`.

- [ ] **Step 7: Run onboarding tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- integration-prompt.service.spec.ts application-onboarding.service.spec.ts admin.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit onboarding package**

```bash
git add apps/api/src/oauth/integration-prompt.service.ts apps/api/src/oauth/application-onboarding.service.ts apps/api/src/oauth/oauth.module.ts apps/api/src/oauth/oauth.types.ts apps/api/src/admin/admin-permission.controller.ts apps/api/test/integration-prompt.service.spec.ts apps/api/test/application-onboarding.service.spec.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: create application onboarding package"
```

---

### Task 5: Developer API Credential and Permission Catalog API

**Files:**
- Create: `apps/api/src/oauth/developer-credential.service.ts`
- Create: `apps/api/src/oauth/developer-api.guard.ts`
- Create: `apps/api/src/oauth/developer-permission.controller.ts`
- Modify: `apps/api/src/oauth/oauth.module.ts`
- Test: `apps/api/test/developer-credential.service.spec.ts`
- Test: `apps/api/test/developer-permission.controller.e2e-spec.ts`

- [ ] **Step 1: Write credential service tests**

Create `apps/api/test/developer-credential.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DeveloperCredentialService } from '../src/oauth/developer-credential.service';
import { hashOauthSecret } from '../src/oauth/oauth-crypto';

describe('DeveloperCredentialService', () => {
  it('verifies active developer token and records usage', async () => {
    const token = 'biad_test_token';
    const credential = {
      id: 'dev-credential-1',
      applicationId: 'app-finance',
      tokenHash: hashOauthSecret(token),
      status: 'active',
      application: { id: 'app-finance', appKey: 'finance', status: 'active' }
    };
    const prisma = {
      applicationDeveloperCredential: {
        findMany: vi.fn().mockResolvedValue([credential]),
        update: vi.fn()
      }
    };
    const applications = { getApplicationByKey: vi.fn() };
    const audit = { record: vi.fn() };
    const securityEvents = { record: vi.fn() };
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    const context = await service.verifyBearerToken(token, { requestId: 'req-1', ip: '127.0.0.1', userAgent: 'test' });

    expect(context.appKey).toBe('finance');
    expect(prisma.applicationDeveloperCredential.update).toHaveBeenCalledWith({
      where: { id: 'dev-credential-1' },
      data: { lastUsedAt: expect.any(Date) }
    });
  });
});
```

- [ ] **Step 2: Implement developer credential service**

Create `apps/api/src/oauth/developer-credential.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApplicationService } from '../permission/application.service';
import { AuditLogService } from '../permission/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { createOauthSecret, hashOauthSecret, timingSafeEqualHash } from './oauth-crypto';
import { SecurityEventService } from './security-event.service';
import { OauthDomainError, type OauthAuditContext } from './oauth.types';

export type DeveloperCredentialContext = {
  credentialId: string;
  applicationId: string;
  appKey: string;
};

@Injectable()
export class DeveloperCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationService,
    private readonly audit: AuditLogService,
    private readonly securityEvents: SecurityEventService
  ) {}

  async createCredential(appKey: string, name: string, auditContext?: OauthAuditContext) {
    const token = createOauthSecret('biad');
    const application = await this.applications.getApplicationByKey(appKey);
    const credential = await this.prisma.applicationDeveloperCredential.create({
      data: {
        id: randomUUID(),
        applicationId: application.id,
        tokenHash: hashOauthSecret(token),
        name
      }
    });
    await this.audit.record({
      actorType: auditContext?.actorType ?? 'admin_web',
      actorId: auditContext?.actorId ?? 'system',
      source: auditContext?.source ?? 'admin_web',
      applicationId: application.id,
      resourceType: 'application_developer_credential',
      resourceId: credential.id,
      action: 'create',
      result: 'success',
      requestId: auditContext?.requestId,
      ip: auditContext?.ip,
      userAgent: auditContext?.userAgent
    });
    return { credential: removeDeveloperSecretMaterial(credential), token };
  }

  async verifyBearerToken(token: string, auditContext: OauthAuditContext): Promise<DeveloperCredentialContext> {
    const credentials = await this.prisma.applicationDeveloperCredential.findMany({
      where: { status: 'active' },
      include: { application: true }
    });
    const matched = credentials.find((credential) => timingSafeEqualHash(token, credential.tokenHash));
    if (!matched || matched.application.status !== 'active') {
      await this.securityEvents.record({
        eventType: 'developer_api_credentials_invalid',
        result: 'failed',
        summary: '开发者 API 凭证无效',
        requestId: auditContext.requestId,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent
      });
      throw new OauthDomainError('DEVELOPER_CREDENTIAL_INVALID', '开发者 API 凭证无效', 401);
    }
    await this.prisma.applicationDeveloperCredential.update({
      where: { id: matched.id },
      data: { lastUsedAt: new Date() }
    });
    return {
      credentialId: matched.id,
      applicationId: matched.applicationId,
      appKey: matched.application.appKey
    };
  }
}

function removeDeveloperSecretMaterial<T extends { tokenHash: string }>(credential: T): Omit<T, 'tokenHash'> {
  const { tokenHash, ...safe } = credential;
  void tokenHash;
  return safe;
}
```

- [ ] **Step 3: Implement developer API guard**

Create `apps/api/src/oauth/developer-api.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { buildOauthAuditContext } from './oauth-request-context';
import { DeveloperCredentialService, type DeveloperCredentialContext } from './developer-credential.service';
import { OauthDomainError } from './oauth.types';

export type DeveloperApiRequest = Request & {
  developerCredential?: DeveloperCredentialContext;
};

@Injectable()
export class DeveloperApiGuard implements CanActivate {
  constructor(private readonly credentials: DeveloperCredentialService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeveloperApiRequest>();
    const authorization = request.header('authorization') ?? '';
    const match = authorization.match(/^Bearer\\s+(.+)$/i);
    if (!match) {
      throw new OauthDomainError('DEVELOPER_CREDENTIAL_REQUIRED', '需要开发者 API 凭证', 401);
    }
    request.developerCredential = await this.credentials.verifyBearerToken(match[1], buildOauthAuditContext(request));
    return true;
  }
}
```

- [ ] **Step 4: Implement developer permission controller**

Create `apps/api/src/oauth/developer-permission.controller.ts`:

```ts
import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Req, UseFilters, UseGuards } from '@nestjs/common';
import { PermissionCatalogService } from '../permission/permission-catalog.service';
import { PermissionErrorFilter } from '../permission/permission-error.filter';
import type { DeveloperApiRequest } from './developer-api.guard';
import { DeveloperApiGuard } from './developer-api.guard';

type CatalogBody = { key: string; name: string; description?: string };
type CatalogUpdateBody = { name?: string; description?: string | null };
type ReplaceGroupPointsBody = { pointIds?: string[] };

@Controller('/api/v1/developer')
@UseGuards(DeveloperApiGuard)
@UseFilters(PermissionErrorFilter)
export class DeveloperPermissionController {
  constructor(@Inject(PermissionCatalogService) private readonly catalog: PermissionCatalogService) {}

  @Get('/permission-points')
  async listPermissionPoints(@Req() request: DeveloperApiRequest) {
    return { items: await this.catalog.listPermissionPoints(request.developerCredential!.appKey) };
  }

  @Post('/permission-points')
  async createPermissionPoint(@Req() request: DeveloperApiRequest, @Body() body: CatalogBody) {
    return this.catalog.createPermissionPoint(request.developerCredential!.appKey, body, developerAuditContext(request));
  }

  @Patch('/permission-points/:pointId')
  async updatePermissionPoint(@Req() request: DeveloperApiRequest, @Param('pointId') pointId: string, @Body() body: CatalogUpdateBody) {
    return this.catalog.updatePermissionPoint(request.developerCredential!.appKey, pointId, body, developerAuditContext(request));
  }

  @Post('/permission-points/:pointId/disable')
  async disablePermissionPoint(@Req() request: DeveloperApiRequest, @Param('pointId') pointId: string) {
    return this.catalog.setPermissionPointStatus(request.developerCredential!.appKey, pointId, 'disabled', developerAuditContext(request));
  }

  @Get('/permission-groups')
  async listPermissionGroups(@Req() request: DeveloperApiRequest) {
    return { items: await this.catalog.listPermissionGroups(request.developerCredential!.appKey) };
  }

  @Post('/permission-groups')
  async createPermissionGroup(@Req() request: DeveloperApiRequest, @Body() body: CatalogBody) {
    return this.catalog.createPermissionGroup(request.developerCredential!.appKey, body, developerAuditContext(request));
  }

  @Patch('/permission-groups/:groupId')
  async updatePermissionGroup(@Req() request: DeveloperApiRequest, @Param('groupId') groupId: string, @Body() body: CatalogUpdateBody) {
    return this.catalog.updatePermissionGroup(request.developerCredential!.appKey, groupId, body, developerAuditContext(request));
  }

  @Post('/permission-groups/:groupId/disable')
  async disablePermissionGroup(@Req() request: DeveloperApiRequest, @Param('groupId') groupId: string) {
    return this.catalog.setPermissionGroupStatus(request.developerCredential!.appKey, groupId, 'disabled', developerAuditContext(request));
  }

  @Put('/permission-groups/:groupId/points')
  async replaceGroupPoints(@Req() request: DeveloperApiRequest, @Param('groupId') groupId: string, @Body() body: ReplaceGroupPointsBody) {
    await this.catalog.replacePermissionGroupPoints(request.developerCredential!.appKey, groupId, body.pointIds ?? [], developerAuditContext(request));
    return { ok: true };
  }
}

function developerAuditContext(request: DeveloperApiRequest) {
  return {
    actorType: 'application_developer_credential',
    actorId: request.developerCredential!.credentialId,
    source: 'developer_api',
    requestId: request.header('x-request-id') ?? undefined,
    ip: request.ip,
    userAgent: request.header('user-agent') ?? undefined
  };
}
```

- [ ] **Step 5: Register guard and controller**

In `apps/api/src/oauth/oauth.module.ts`, add `DeveloperApiGuard` to providers and `DeveloperPermissionController` to controllers.

- [ ] **Step 6: Add e2e tests for developer API**

Create `apps/api/test/developer-permission.controller.e2e-spec.ts` with these assertions:

```ts
it('allows developer credential to create only its application permission point', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/developer/permission-points')
    .set('Authorization', `Bearer ${developerToken}`)
    .send({ key: 'finance.invoice.view', name: '查看发票' })
    .expect(201);

  expect(response.body.key).toBe('finance.invoice.view');
});

it('rejects permission point key for another application prefix', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/developer/permission-points')
    .set('Authorization', `Bearer ${developerToken}`)
    .send({ key: 'hr.employee.view', name: '查看员工' })
    .expect(400);
});

it('does not expose application configuration mutation endpoints under developer API', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/developer/redirect-uris')
    .set('Authorization', `Bearer ${developerToken}`)
    .send({ redirectUri: 'http://localhost:5173/callback' })
    .expect(404);
});
```

- [ ] **Step 7: Run developer API tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- developer-credential.service.spec.ts developer-permission.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit developer API**

```bash
git add apps/api/src/oauth/developer-credential.service.ts apps/api/src/oauth/developer-api.guard.ts apps/api/src/oauth/developer-permission.controller.ts apps/api/src/oauth/oauth.module.ts apps/api/test/developer-credential.service.spec.ts apps/api/test/developer-permission.controller.e2e-spec.ts
git commit -m "feat: add application developer api credentials"
```

---

### Task 6: Admin UI Application Onboarding

**Files:**
- Modify: `apps/admin-web/src/api/permission.ts`
- Modify: `apps/admin-web/src/api/oauth.ts`
- Modify: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Modify: `apps/admin-web/src/App.css`
- Test: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Add frontend test for create button and prompt**

In `apps/admin-web/src/App.test.tsx`, add:

```tsx
it('creates an application onboarding package and shows copyable Codex prompt', async () => {
  render(<App />);

  await screen.findByRole('heading', { name: '应用管理' });
  await userEvent.click(screen.getByRole('button', { name: '新增应用' }));
  await userEvent.type(screen.getByLabelText('app_key'), 'finance');
  await userEvent.type(screen.getByLabelText('应用名称'), '财务系统');
  await userEvent.type(screen.getByLabelText('回调地址 1'), 'http://localhost:5173/auth/callback');
  await userEvent.click(screen.getByRole('button', { name: '创建接入包' }));

  expect(await screen.findByText('应用接入包已创建')).toBeInTheDocument();
  expect(screen.getByText(/client_id/)).toBeInTheDocument();
  expect(screen.getByText(/developer_api_token/)).toBeInTheDocument();
  expect(screen.getByLabelText('Codex 接入提示词')).toHaveValue(expect.stringContaining('AGENTS.md'));
});

it('does not show environment or client tabs in application detail', async () => {
  render(<App />);

  await screen.findByRole('heading', { name: '应用管理' });
  expect(screen.queryByRole('tab', { name: '环境与回调' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Client' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Update permission API client**

In `apps/admin-web/src/api/permission.ts`, add:

```ts
export type ApplicationOnboardingPackage = {
  application: Application;
  redirectUris: Array<{ id: string; redirectUri: string; status: EntityStatus }>;
  oauthCredential: { id: string; clientId: string; status: EntityStatus };
  clientSecret: string;
  developerCredential: { id: string; name: string; status: EntityStatus };
  developerApiToken: string;
  integrationPrompt: string;
};

export async function createApplication(input: {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  redirectUris: string[];
}): Promise<ApplicationOnboardingPackage> {
  return readJson<ApplicationOnboardingPackage>('/api/v1/admin/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}
```

- [ ] **Step 3: Update OAuth API client**

In `apps/admin-web/src/api/oauth.ts`, replace environment types with:

```ts
export type ApplicationRedirectUri = {
  id: string;
  redirectUri: string;
  status: EntityStatus;
};

export type ApplicationOauthCredential = {
  id: string;
  clientId: string;
  status: EntityStatus;
  lastUsedAt?: string | null;
};

export type ApplicationDeveloperCredential = {
  id: string;
  name: string;
  status: EntityStatus;
  lastUsedAt?: string | null;
  rotatedAt?: string | null;
};

export async function fetchRedirectUris(appKey: string): Promise<ApplicationRedirectUri[]> {
  const result = await readJson<{ items: ApplicationRedirectUri[] }>(`${applicationPath(appKey)}/redirect-uris`);
  return result.items;
}

export async function createRedirectUri(appKey: string, input: { redirectUri: string }): Promise<ApplicationRedirectUri> {
  return writeJson<ApplicationRedirectUri>(`${applicationPath(appKey)}/redirect-uris`, input);
}

export async function fetchIntegrationPrompt(appKey: string): Promise<{ integrationPrompt: string }> {
  return readJson<{ integrationPrompt: string }>(`${applicationPath(appKey)}/integration-prompt`);
}
```

Remove `ApplicationEnvironment`, `fetchApplicationEnvironments`, and `createApplicationEnvironment` from the UI path.

- [ ] **Step 4: Update application page state types**

In `apps/admin-web/src/routes/ApplicationManagementPage.tsx`, change `tabs`:

```ts
const tabs = ['基础信息', '接入配置', '开发者 API', '操作记录'] as const;
```

Replace `AccessConfigState` with:

```ts
type AccessConfigState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'loaded';
      redirectUris: ApplicationRedirectUri[];
      oauthCredential: ApplicationOauthCredential | null;
      developerCredential: ApplicationDeveloperCredential | null;
      safeIntegrationPrompt: string | null;
    }
  | { status: 'failed'; message: string };
```

- [ ] **Step 5: Add onboarding modal state and submit handler**

In the same file, add state:

```ts
const [isCreateOpen, setIsCreateOpen] = useState(false);
const [createAppKey, setCreateAppKey] = useState('');
const [createName, setCreateName] = useState('');
const [createDescription, setCreateDescription] = useState('');
const [createRedirectUris, setCreateRedirectUris] = useState(['']);
const [createdPackage, setCreatedPackage] = useState<ApplicationOnboardingPackage | null>(null);
const [createError, setCreateError] = useState<string | null>(null);
const [isCreating, setIsCreating] = useState(false);
```

Add submit handler:

```ts
async function handleCreateApplication(event: SubmitEventLike): Promise<void> {
  event.preventDefault();
  const redirectUris = createRedirectUris.map((uri) => uri.trim()).filter(Boolean);
  if (createAppKey.trim().length === 0 || createName.trim().length === 0 || redirectUris.length === 0) {
    setCreateError('请输入 app_key、应用名称和至少一个回调地址');
    return;
  }
  setIsCreating(true);
  setCreateError(null);
  try {
    const created = await createApplication({
      appKey: createAppKey.trim(),
      name: createName.trim(),
      description: createDescription.trim() || undefined,
      redirectUris
    });
    setCreatedPackage(created);
    setApplicationState((current) =>
      current.status === 'loaded'
        ? { status: 'loaded', applications: [...current.applications, created.application] }
        : current
    );
    selectApplication(created.application.appKey);
  } catch (error: unknown) {
    setCreateError(error instanceof Error ? error.message : '无法创建应用接入包');
  } finally {
    setIsCreating(false);
  }
}
```

- [ ] **Step 6: Render the create button and modal**

In the section header actions, add:

```tsx
<button className="primary-button" type="button" onClick={() => setIsCreateOpen(true)}>
  新增应用
</button>
```

Render modal:

```tsx
{isCreateOpen ? (
  <div className="modal-backdrop" role="presentation">
    <section className="modal-panel onboarding-modal" role="dialog" aria-modal="true" aria-label="新增应用">
      <header className="modal-header">
        <h3>新增应用</h3>
        <button className="icon-button" type="button" aria-label="关闭新增应用" onClick={() => setIsCreateOpen(false)}>
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      <form className="stack-form" onSubmit={(event) => void handleCreateApplication(event)}>
        <label>app_key<input aria-label="app_key" value={createAppKey} onChange={(event) => setCreateAppKey(event.target.value)} /></label>
        <label>应用名称<input aria-label="应用名称" value={createName} onChange={(event) => setCreateName(event.target.value)} /></label>
        <label>应用描述<textarea aria-label="应用描述" value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} /></label>
        {createRedirectUris.map((uri, index) => (
          <label key={index}>回调地址 {index + 1}<input aria-label={`回调地址 ${index + 1}`} value={uri} onChange={(event) => {
            setCreateRedirectUris((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item));
          }} /></label>
        ))}
        <button className="text-button" type="button" onClick={() => setCreateRedirectUris((current) => [...current, ''])}>添加回调地址</button>
        {createError ? <p className="error">{createError}</p> : null}
        <button className="primary-button" type="submit" disabled={isCreating}>{isCreating ? '正在创建' : '创建接入包'}</button>
      </form>
    </section>
  </div>
) : null}
```

- [ ] **Step 7: Render one-time onboarding result**

Add after the modal:

```tsx
{createdPackage ? (
  <aside className="onboarding-result" role="dialog" aria-label="应用接入包已创建">
    <h3>应用接入包已创建</h3>
    <dl>
      <dt>client_id</dt>
      <dd>{createdPackage.oauthCredential.clientId}</dd>
      <dt>client_secret</dt>
      <dd><code>{createdPackage.clientSecret}</code></dd>
      <dt>developer_api_token</dt>
      <dd><code>{createdPackage.developerApiToken}</code></dd>
    </dl>
    <label>
      Codex 接入提示词
      <textarea aria-label="Codex 接入提示词" readOnly value={createdPackage.integrationPrompt} />
    </label>
    <button type="button" className="primary-button" onClick={() => void navigator.clipboard.writeText(createdPackage.integrationPrompt)}>
      复制提示词
    </button>
    <button type="button" className="text-button" onClick={() => setCreatedPackage(null)}>
      我已保存，关闭
    </button>
  </aside>
) : null}
```

- [ ] **Step 8: Run frontend tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx -t "应用|接入|prompt|提示词"
```

Expected: matching tests pass.

- [ ] **Step 9: Commit admin UI**

```bash
git add apps/admin-web/src/api/permission.ts apps/admin-web/src/api/oauth.ts apps/admin-web/src/routes/ApplicationManagementPage.tsx apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx
git commit -m "feat: add application onboarding UI"
```

---

### Task 7: Documentation, Deploy Script, and Version Defaults

**Files:**
- Modify: `README.md`
- Modify: `docs/sso-provider.md`
- Modify: `docs/permission-model.md`
- Create: `deploy/install.sh`
- Modify: `deploy/upgrade.sh`
- Modify: `deploy/server.env.example`
- Modify: `deploy/docker-compose.yml`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/api/src/version/version.controller.ts`

- [ ] **Step 1: Update versions**

Set versions:

```json
{
  "version": "0.8.1"
}
```

In `apps/api/src/version/version.controller.ts`, set fallback:

```ts
const version = process.env.APP_VERSION ?? '0.8.1-dev';
```

In `deploy/docker-compose.yml`, set defaults:

```yaml
image: ${FEISHU_IAM_IMAGE:-dockerhub.it.tangtring.com:80/ai/feishu-iam}:${FEISHU_IAM_IMAGE_TAG:-v0.8.1}
environment:
  APP_VERSION: ${APP_VERSION:-0.8.1}
```

- [ ] **Step 2: Add install script**

Create `deploy/install.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

FEISHU_IAM_VERSION="${FEISHU_IAM_VERSION:-v0.8.1}"
FEISHU_IAM_DEPLOY_DIR="${FEISHU_IAM_DEPLOY_DIR:-${HOME}/feishu-iam}"
FEISHU_IAM_RAW_BASE="${FEISHU_IAM_RAW_BASE:-https://raw.githubusercontent.com/wodenwang/feishu-iam/${FEISHU_IAM_VERSION}}"

mkdir -p "${FEISHU_IAM_DEPLOY_DIR}"
cd "${FEISHU_IAM_DEPLOY_DIR}"

download() {
  local source_path="$1"
  local target_path="$2"
  curl -fsSL "${FEISHU_IAM_RAW_BASE}/${source_path}" -o "${target_path}"
}

download "deploy/docker-compose.yml" "docker-compose.yaml"
download "deploy/server.env.example" ".env.example"
download "deploy/upgrade.sh" "upgrade.sh"
chmod 700 upgrade.sh

if [ ! -f ".env" ]; then
  cp .env.example .env
  chmod 600 .env
fi

echo "Feishu IAM deployment files are ready in ${FEISHU_IAM_DEPLOY_DIR}"
echo "Edit ${FEISHU_IAM_DEPLOY_DIR}/.env on this server, then run:"
echo "  cd ${FEISHU_IAM_DEPLOY_DIR} && FEISHU_IAM_IMAGE_TAG=${FEISHU_IAM_VERSION} ./upgrade.sh"
```

- [ ] **Step 3: Update README one-liner**

Add a README section:

```markdown
### v0.8.1 一键部署

服务器首次部署使用以下 one-liner 下载部署文件：

```bash
curl -fsSL https://raw.githubusercontent.com/wodenwang/feishu-iam/v0.8.1/deploy/install.sh | FEISHU_IAM_VERSION=v0.8.1 bash
```

执行后进入 `~/feishu-iam`，只在服务器本地编辑 `.env`，录入飞书配置、数据库密码和加密 key。不要把 `.env`、secret、token、cookie 或密码提交到仓库。

已运行实例升级：

```bash
cd ~/feishu-iam
FEISHU_IAM_IMAGE_TAG=v0.8.1 ./upgrade.sh
```
```

- [ ] **Step 4: Update multi-arch image docs**

Add README commands:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --provenance=false \
  --sbom=false \
  -f deploy/api.Dockerfile \
  -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.1 \
  -t dockerhub.it.tangtring.com:80/ai/feishu-iam:latest \
  --push .

docker buildx imagetools inspect dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.1
```

- [ ] **Step 5: Update SSO documentation**

In `docs/sso-provider.md`, replace environment prerequisites with:

```markdown
接入前需要：

1. 管理员已在 Feishu IAM 创建应用，并保存 `app_key`。
2. 管理员已在应用中登记一个或多个精确回调地址。
3. 管理员已保存创建应用时一次性展示的 `client_id` 和 `client_secret`。
4. 第三方系统后端具备安全保存 `client_secret` 的能力。

回调地址规则：

- 必须是完整 URL。
- 必须与 Feishu IAM 登记值完全一致。
- 不支持通配符、前缀匹配或正则匹配。
- 配置 HTTP 就允许该精确 HTTP 回调，配置 HTTPS 就允许该精确 HTTPS 回调。
```

- [ ] **Step 6: Update permission model developer API section**

In `docs/permission-model.md`, add:

```markdown
## 应用开发者 API 凭证

`v0.8.1` 起，每个应用可拥有专属开发者 API 凭证。该凭证只用于维护本应用权限点、权限组和权限组权限点绑定，不用于用户登录。

鉴权方式：

```http
Authorization: Bearer <developer_api_token>
```

该凭证不能修改应用基础信息、回调地址、OAuth 登录凭证、IAM 角色、角色成员、管理员授权或系统设置。
```

- [ ] **Step 7: Run documentation scans**

Run:

```bash
rg -n "dev 环境|test 环境|prod 环境|环境与回调|创建 client|新增 client" README.md docs/sso-provider.md docs/permission-model.md deploy
```

Expected: no matches for stale environment/client instructions.

- [ ] **Step 8: Commit docs and deployment defaults**

```bash
git add README.md docs/sso-provider.md docs/permission-model.md deploy/install.sh deploy/upgrade.sh deploy/server.env.example deploy/docker-compose.yml package.json apps/api/package.json apps/admin-web/package.json apps/api/src/version/version.controller.ts
git commit -m "docs: add v0.8.1 deployment and onboarding docs"
```

---

### Task 8: Full Verification and Browser QA

**Files:**
- Modify: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.8.1-应用接入包实施.md`

- [ ] **Step 1: Run full checks**

Run:

```bash
pnpm check
pnpm build
```

Expected: both commands pass.

- [ ] **Step 2: Validate Compose config**

Run:

```bash
docker compose -f deploy/docker-compose.yml config --quiet
```

Expected: command exits 0.

- [ ] **Step 3: Run local Compose upgrade path**

Run:

```bash
FEISHU_IAM_IMAGE_TAG=v0.8.1 FEISHU_IAM_PULL_POLICY=never ./deploy/upgrade.sh
```

Expected: if the local `v0.8.1` image is not loaded, the script fails with `local image not found`. If the image is loaded, the script stops web, backs up DB, applies migrations, starts web, and passes `/ready` and `/version`.

- [ ] **Step 4: Start local app for browser QA**

Run:

```bash
pnpm compose:up
```

Expected: web and db services are healthy.

- [ ] **Step 5: Browser self-check**

Use `@Browser` to open `http://localhost:3000/` or the active local web port. Verify:

- `新增应用` is visible on 应用管理.
- Creating an application shows one-time `client_secret`, one-time `developer_api_token`, and copyable Codex prompt.
- Application detail tabs are `基础信息`、`接入配置`、`开发者 API`、`操作记录`.
- `环境与回调` and `Client` tabs are absent.
- Desktop layout has no obvious overlap or overflow.
- 390px narrow layout remains usable.
- Console has no errors.
- Network has no unexpected failed requests.

- [ ] **Step 6: Archive implementation session**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.8.1-应用接入包实施.md` with:

```markdown
# v0.8.1 应用接入包实施

## 会话目标

实施 Feishu IAM v0.8.1 应用接入包、去环境化、开发者 API 凭证、部署脚本和多架构镜像发布准备。

## 用户原始关键要求摘要

- 应用管理补齐新增应用。
- 应用不再需要环境概念。
- 创建应用后可复制第三方 Codex 接入提示词。
- 应用拥有专属开发者 API 凭证维护权限点和权限组。
- README 提供 one-liner 部署。
- `upgrade.sh` 支持方便停机升级。
- Docker 镜像兼容 linux/amd64 和 linux/arm64。
- GitLab issue #1 不纳入本版本。

## 修改过的文件

- `apps/api/prisma/schema.prisma`
- `migrations/V0_8_1__application_onboarding.sql`
- `apps/api/src/oauth/*`
- `apps/api/src/admin/admin-permission.controller.ts`
- `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- `apps/admin-web/src/api/permission.ts`
- `apps/admin-web/src/api/oauth.ts`
- `README.md`
- `docs/sso-provider.md`
- `docs/permission-model.md`
- `deploy/install.sh`
- `deploy/upgrade.sh`

## 验证结果

- `pnpm check`：执行本计划时记录通过或失败摘要。
- `pnpm build`：执行本计划时记录通过或失败摘要。
- `docker compose -f deploy/docker-compose.yml config --quiet`：执行本计划时记录退出码。
- Browser 自检：执行本计划时记录入口、桌面结果、窄屏结果、console 和 Network 结果。

## 未完成事项和下一步建议

- 执行本计划时保留本节，并把验证阶段发现的剩余风险记录在这里。
```

Before committing the archive, replace command-result summaries with the values observed during execution.

- [ ] **Step 7: Commit verification archive**

```bash
git add docs/codex-sessions
git commit -m "docs: archive v0.8.1 implementation"
```

---

### Task 9: Multi-Architecture Image Publish

**Files:**
- Modify: `README.md`
- Modify: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.8.1-镜像发布.md`

- [ ] **Step 1: Build and push multi-platform image**

Run after all code checks pass:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --provenance=false \
  --sbom=false \
  -f deploy/api.Dockerfile \
  -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.1 \
  -t dockerhub.it.tangtring.com:80/ai/feishu-iam:latest \
  --push .
```

Expected: push succeeds for both platforms.

- [ ] **Step 2: Inspect manifest**

Run:

```bash
docker buildx imagetools inspect dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.1
```

Expected: output includes both `linux/amd64` and `linux/arm64`.

- [ ] **Step 3: Record image digest in README**

Update README image section with:

```markdown
### v0.8.1 镜像下载信息

```bash
docker pull dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.1
docker buildx imagetools inspect dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.1
```

`v0.8.1` manifest digest should be copied from `docker buildx imagetools inspect`.
```

- [ ] **Step 4: Archive image publication**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.8.1-镜像发布.md`:

```markdown
# v0.8.1 镜像发布

## 会话目标

构建并发布 Feishu IAM v0.8.1 multi-platform Docker 镜像。

## 执行过的关键命令和验证结果

- `docker buildx build --platform linux/amd64,linux/arm64 ... --push .`：执行本计划时记录推送结果。
- `docker buildx imagetools inspect dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.1`：执行本计划时记录 `linux/amd64`、`linux/arm64` 和 manifest digest。

## 安全说明

本归档不记录 Registry 密码、Personal Access Token、Deploy Token 或 Docker 登录凭据。
```

Before committing the archive, replace command-result summaries with the values observed during publication.

- [ ] **Step 5: Commit image publication docs**

```bash
git add README.md docs/codex-sessions
git commit -m "docs: record v0.8.1 image publication"
```

---

## Self-Review

Spec coverage:

- 应用新增按钮和创建接入包：Task 4 and Task 6.
- 彻底去环境化：Task 1, Task 2, Task 3, Task 6, Task 7.
- 创建应用生成登录凭证和开发者 API 凭证：Task 4 and Task 5.
- 一键复制 Codex 接入提示词：Task 4 and Task 6.
- 开发者 API 维护权限点、权限组和绑定：Task 5.
- README one-liner and upgrade flow：Task 7.
- Multi-architecture image：Task 9.
- Browser verification：Task 8.
- GitLab issue #1 excluded：Scope Check and Task 8 archive text.

Template scan:

- `rg` scan was used to remove unreplaced template markers and stale wording from this plan.
- Runtime archive templates intentionally instruct the implementer to record observed command results before committing generated archive files.

Type consistency:

- `ApplicationOnboardingPackage` frontend type matches the backend onboarding return shape.
- `DeveloperCredentialContext` is stored on `DeveloperApiRequest.developerCredential`.
- `ApplicationRedirectUri.environmentId` and `ApplicationClient.environmentId` are nullable for compatibility.
- New developer API endpoints do not accept `app_key` path parameters, preventing path-level cross-application spoofing.
