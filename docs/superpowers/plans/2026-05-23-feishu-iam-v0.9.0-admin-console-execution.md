# Feishu IAM v0.9.0 Admin Console Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.9.0 Feishu IAM admin console as a Pencil-style, production-usable management UI backed by the v0.8.1 application onboarding model and complete verification gates.

**Architecture:** Use gstack for product/design/engineering gates and use Superpowers for execution granularity. Implement backend contract changes first, then the shared admin UI foundation, then the six modules on the same “list -> detail drawer” interaction contract. Keep the v0.9.0 implementation on a new branch or worktree, not on `codex/v0.8.0-admin-ui-rebuild`.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React 19, Vite, TypeScript, Vitest, Testing Library, Supertest, Bash, Docker Compose, Browser/Playwright-style browser verification.

---

## Scope Check

This plan covers one release-sized system change: v0.9.0 admin console rebuild. It touches backend contracts, frontend UI, tests, docs, and release verification, but those pieces are coupled by one product contract: the admin console must stop presenting the old environment/client model and must use the v0.8.1 application onboarding package as the application-management source of truth.

The work is split into vertical tasks that can pass tests independently:

- Task 1 creates the clean v0.9.0 branch/worktree and protects the current dirty v0.8.0 branch.
- Tasks 2-5 establish backend contracts and security gates.
- Tasks 6-8 migrate the frontend against those contracts.
- Tasks 9-10 add browser verification and release documentation.

Do not expand this plan into HTTPS, high availability, full OIDC discovery, JWKS, ID token, refresh token, SAML, ABAC, resource-level permission, Feishu user-group sync, or Feishu role sync.

## File Structure

Branch and execution safety:

- Read: `AGENTS.md`
- Read: `/Users/tonycheng/.gstack/projects/ai-feishu-iam/checkpoints/20260523-144812-v090-admin-ui-review-complete.md`
- Create or modify only after switching to the new implementation branch or worktree.

Backend schema and data contract:

- Modify: `apps/api/prisma/schema.prisma`
- Create: `migrations/V0_9_0__admin_console_onboarding_contract.sql`
- Modify: `apps/api/src/prisma/prisma.service.ts`
- Modify: `apps/api/src/permission/application.service.ts`
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
- Modify: `apps/api/src/admin/admin-query.service.ts`
- Create: `apps/api/src/oauth/application-onboarding.service.ts`
- Create: `apps/api/src/oauth/developer-credential.service.ts`
- Create: `apps/api/src/oauth/developer-api.guard.ts`
- Create: `apps/api/src/oauth/developer-permission.controller.ts`
- Create: `apps/api/src/oauth/integration-prompt.service.ts`
- Modify: `apps/api/src/oauth/oauth-config.service.ts`
- Modify: `apps/api/src/oauth/oauth.module.ts`

Backend tests:

- Modify: `apps/api/test/prisma.service.spec.ts`
- Modify: `apps/api/test/admin-query.service.spec.ts`
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`
- Create: `apps/api/test/application-onboarding.service.spec.ts`
- Create: `apps/api/test/developer-credential.service.spec.ts`
- Create: `apps/api/test/developer-permission.controller.e2e-spec.ts`

Frontend shared foundation:

- Create or modify: `design/feishu-iam-admin-ui-design-system.md`
- Modify: `apps/admin-web/src/admin-types.ts`
- Modify: `apps/admin-web/src/api/permission.ts`
- Modify: `apps/admin-web/src/api/applications.ts`
- Modify: `apps/admin-web/src/api/oauth.ts`
- Create or modify: `apps/admin-web/src/components/AdminPage.tsx`
- Create: `apps/admin-web/src/components/DataToolbar.tsx`
- Create: `apps/admin-web/src/components/DataTable.tsx`
- Create: `apps/admin-web/src/components/DetailDrawer.tsx`
- Create: `apps/admin-web/src/components/FormModal.tsx`
- Modify: `apps/admin-web/src/components/ConfirmDialog.tsx`
- Modify: `apps/admin-web/src/components/PageState.tsx`
- Modify: `apps/admin-web/src/App.css`

Frontend modules:

- Modify and split: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Create: `apps/admin-web/src/routes/application-management/ApplicationDetailDrawer.tsx`
- Create: `apps/admin-web/src/routes/application-management/ApplicationOnboardingModal.tsx`
- Create: `apps/admin-web/src/routes/application-management/RedirectUriPanel.tsx`
- Create: `apps/admin-web/src/routes/application-management/OAuthCredentialPanel.tsx`
- Create: `apps/admin-web/src/routes/application-management/DeveloperCredentialPanel.tsx`
- Create: `apps/admin-web/src/routes/application-management/IntegrationPromptPanel.tsx`
- Modify: `apps/admin-web/src/routes/WorkspacePage.tsx`
- Modify: `apps/admin-web/src/routes/PermissionManagementPage.tsx`
- Modify: `apps/admin-web/src/routes/AdminAuthorizationPage.tsx`
- Modify: `apps/admin-web/src/routes/RecordQueryPage.tsx`
- Modify: `apps/admin-web/src/routes/SystemSettingsPage.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`

Browser verification:

- Create: `apps/admin-web/test/responsive-overflow.spec.ts`
- Create: `apps/admin-web/test/run-responsive-overflow-check.mjs`

Docs and session archive:

- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-22-feishu-iam-v0.8.1-application-onboarding-design.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.9.0管理后台执行计划.md`

## Execution Rules

- Before execution, create a new branch or worktree named `codex/v0.9.0-admin-ui-rebuild` from the agreed baseline. Do not continue implementation on `codex/v0.8.0-admin-ui-rebuild`.
- Use `feishu-iam-admin-ui` as the project-specific implementation skill for admin UI tasks.
- Use `frontend-design` only under admin-console constraints: dense, operational, table-first, no marketing hero, no decorative gradient.
- After each backend task, run the narrow Vitest command listed in the task.
- After each frontend task, run `pnpm --filter @feishu-iam/admin-web test` and `pnpm --filter @feishu-iam/admin-web typecheck`.
- After the final integration task, run `pnpm check`, build the admin web package, and verify the app in a real browser.

---

### Task 1: Create v0.9.0 Execution Workspace

**Files:**
- Read: `AGENTS.md`
- Read: `/Users/tonycheng/.gstack/projects/ai-feishu-iam/checkpoints/20260523-144812-v090-admin-ui-review-complete.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.9.0管理后台执行计划.md`

- [ ] **Step 1: Inspect current branch and dirty state**

Run:

```bash
git status --short
git branch --show-current
git rev-parse --short HEAD
```

Expected: current context may still be `codex/v0.8.0-admin-ui-rebuild` with a dirty tree. Do not clean or reset it in this task.

- [ ] **Step 2: Create an isolated v0.9.0 worktree or branch**

If using a worktree, run:

```bash
git fetch origin
git worktree add ../feishu-iam-v0.9.0-admin-console -b codex/v0.9.0-admin-ui-rebuild origin/main
cd ../feishu-iam-v0.9.0-admin-console
```

If staying in the current checkout after manually saving v0.8.0 state, run:

```bash
git fetch origin
git switch -c codex/v0.9.0-admin-ui-rebuild origin/main
```

Expected: `git branch --show-current` prints `codex/v0.9.0-admin-ui-rebuild`.

- [ ] **Step 3: Copy authoritative planning context into the new workspace**

Run:

```bash
mkdir -p docs/codex-sessions
test -f design/admin-console.pen
test -f docs/superpowers/specs/2026-05-22-feishu-iam-v0.8.1-application-onboarding-design.md
```

Expected: both `test` commands exit 0. If `design/admin-console.pen` is missing from the new baseline, copy only the `design/` directory from the checked review branch with normal Git-safe copy and then inspect `git diff --stat`.

- [ ] **Step 4: Record the execution-start session archive**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.9.0管理后台执行计划.md` with this content shape:

```markdown
# v0.9.0 管理后台执行计划启动

## 会话目标

启动 Feishu IAM v0.9.0 管理后台 Pencil 风格重构的工程执行分解。

## 关键约束

- v0.9.0 在 `codex/v0.9.0-admin-ui-rebuild` 独立分支或 worktree 执行。
- 视觉源是 `design/admin-console.pen`。
- 工程计划源是 `docs/superpowers/plans/2026-05-23-feishu-iam-v0.9.0-admin-console-execution.md`。
- 不把 `.DS_Store`、明文 secret、token、cookie、密码写入仓库。

## 下一步

按 Superpowers 计划逐任务执行，任务完成后运行对应验证命令。
```

- [ ] **Step 5: Commit the execution-start archive**

Run:

```bash
git add docs/codex-sessions/YYYY-MM-DD-HHMM-v0.9.0管理后台执行计划.md
git commit -m "docs: start v0.9.0 admin console execution"
```

Expected: one docs-only commit on `codex/v0.9.0-admin-ui-rebuild`.

---

### Task 2: Application Onboarding Data Contract

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `migrations/V0_9_0__admin_console_onboarding_contract.sql`
- Modify: `apps/api/src/prisma/prisma.service.ts`
- Test: `apps/api/test/prisma.service.spec.ts`

- [ ] **Step 1: Write the schema-version failing test**

In `apps/api/test/prisma.service.spec.ts`, add:

```ts
it('v0.9.0 requires application onboarding contract tables and columns', () => {
  const required = [
    'application_redirect_uris.application_id',
    'application_clients.application_id',
    'application_clients.is_primary',
    'application_developer_credentials.application_id',
    'application_developer_credentials.token_hash'
  ];

  expect(required).toContain('application_developer_credentials.token_hash');
});
```

This starts as a low-level contract assertion. Extend the existing Prisma readiness test in the same file so these names are checked against the actual schema markers used by `PrismaService`.

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @feishu-iam/api test -- prisma.service.spec.ts
```

Expected: FAIL because v0.9.0 schema markers are not implemented yet.

- [ ] **Step 3: Add migration SQL**

Create `migrations/V0_9_0__admin_console_onboarding_contract.sql`:

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
VALUES ('0.9.0', 'admin console onboarding contract')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 4: Update Prisma schema**

In `apps/api/prisma/schema.prisma`, make `ApplicationRedirectUri.environmentId` and `ApplicationClient.environmentId` nullable, add `sourceEnvironmentId`, add `isPrimary`, add `revokedAt`, and add `ApplicationDeveloperCredential`. Use this exact model for the new credential:

```prisma
model ApplicationDeveloperCredential {
  id            String      @id
  applicationId String      @map("application_id")
  tokenHash     String      @unique @map("token_hash")
  name          String
  status        String      @default("active")
  lastUsedAt    DateTime?   @map("last_used_at") @db.Timestamptz(6)
  rotatedAt     DateTime?   @map("rotated_at") @db.Timestamptz(6)
  createdAt     DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@index([applicationId])
  @@index([status])
  @@map("application_developer_credentials")
}
```

- [ ] **Step 5: Update Prisma readiness checks**

In `apps/api/src/prisma/prisma.service.ts`, include these required table/column checks in the existing readiness query:

```ts
const REQUIRED_V0_9_0_COLUMNS = [
  ['application_redirect_uris', 'application_id'],
  ['application_clients', 'application_id'],
  ['application_clients', 'is_primary'],
  ['application_developer_credentials', 'application_id'],
  ['application_developer_credentials', 'token_hash']
] as const;
```

Use the existing table/column probing style in `PrismaService`; do not introduce a second migration checker.

- [ ] **Step 6: Run schema verification**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:validate
pnpm --filter @feishu-iam/api test -- prisma.service.spec.ts
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/api/prisma/schema.prisma migrations/V0_9_0__admin_console_onboarding_contract.sql apps/api/src/prisma/prisma.service.ts apps/api/test/prisma.service.spec.ts
git commit -m "feat: add v0.9.0 application onboarding schema contract"
```

---

### Task 3: Application Package Admin API

**Files:**
- Modify: `apps/api/src/permission/application.service.ts`
- Create: `apps/api/src/oauth/developer-credential.service.ts`
- Create: `apps/api/src/oauth/integration-prompt.service.ts`
- Create: `apps/api/src/oauth/application-onboarding.service.ts`
- Modify: `apps/api/src/oauth/oauth-config.service.ts`
- Modify: `apps/api/src/oauth/oauth.module.ts`
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
- Test: `apps/api/test/application-onboarding.service.spec.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: Write the onboarding service failing test**

Create `apps/api/test/application-onboarding.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ApplicationOnboardingService } from '../src/oauth/application-onboarding.service';

function makeDependencyMocks() {
  return {
    applications: {
      createApplication: vi.fn().mockResolvedValue({
        id: 'app-demo',
        appKey: 'demo',
        name: 'Demo 应用',
        status: 'active'
      })
    },
    oauthConfig: {
      createApplicationRedirectUri: vi.fn().mockResolvedValue({
        id: 'uri-1',
        redirectUri: 'https://demo.example.com/callback',
        status: 'active'
      }),
      rotatePrimaryApplicationClientSecret: vi.fn().mockResolvedValue({
        clientId: 'bic_demo',
        clientSecret: 'bics_once_only'
      })
    },
    developerCredentials: {
      rotateApplicationDeveloperCredential: vi.fn().mockResolvedValue({
        credentialId: 'devcred-1',
        token: 'biad_once_only'
      })
    },
    prompts: {
      buildFullPrompt: vi.fn().mockReturnValue('完整接入提示词，不写入仓库')
    }
  };
}

describe('ApplicationOnboardingService', () => {
  it('creates one application package with redirect uri, oauth secret, developer token and prompt', async () => {
    const deps = makeDependencyMocks();
    const service = new ApplicationOnboardingService(
      deps.applications as never,
      deps.oauthConfig as never,
      deps.developerCredentials as never,
      deps.prompts as never
    );

    const result = await service.createPackage({
      appKey: 'demo',
      name: 'Demo 应用',
      redirectUris: ['https://demo.example.com/callback']
    }, {
      actorType: 'admin_user',
      actorId: 'admin-platform',
      source: 'admin_web',
      requestId: 'req-onboarding'
    });

    expect(result.application.appKey).toBe('demo');
    expect(result.redirectUris).toHaveLength(1);
    expect(result.oauthCredential).toMatchObject({ clientId: 'bic_demo', clientSecret: 'bics_once_only' });
    expect(result.developerCredential).toMatchObject({ credentialId: 'devcred-1', token: 'biad_once_only' });
    expect(result.integrationPrompt).toContain('完整接入提示词');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @feishu-iam/api test -- application-onboarding.service.spec.ts
```

Expected: FAIL because `ApplicationOnboardingService` does not exist.

- [ ] **Step 3: Create integration prompt service**

Create `apps/api/src/oauth/integration-prompt.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

type PromptInput = {
  baseIamUrl: string;
  appKey: string;
  clientId: string;
  clientSecret?: string;
  developerCredentialId: string;
  developerToken?: string;
  redirectUris: string[];
};

@Injectable()
export class IntegrationPromptService {
  buildFullPrompt(input: PromptInput): string {
    return [
      '# Feishu IAM 接入提示词',
      '',
      '把本提示词整理进第三方项目的 AGENTS.md 或 CLAUDE.md。',
      `FEISHU_IAM_URL=${input.baseIamUrl}`,
      `app_key=${input.appKey}`,
      `client_id=${input.clientId}`,
      `client_secret=${input.clientSecret ?? '[只在创建或轮换时展示一次]'}`,
      `developer_credential_id=${input.developerCredentialId}`,
      `developer_api_token=${input.developerToken ?? '[只在创建或轮换时展示一次]'}`,
      '',
      '回调地址必须与 Feishu IAM 登记值完全一致：',
      ...input.redirectUris.map((uri) => `- ${uri}`),
      '',
      'OAuth 流程：/oauth/authorize -> /oauth/token -> /oauth/userinfo。',
      '权限查询：/api/v1/apps/{app_key}/me/permissions。',
      '开发者 API 只允许维护本应用权限点、权限组及绑定。',
      '禁止把明文 secret 或 token 写入仓库、日志、截图、聊天消息、测试快照或会话归档。'
    ].join('\n');
  }

  buildSafePrompt(input: Omit<PromptInput, 'clientSecret' | 'developerToken'>): string {
    return this.buildFullPrompt(input);
  }
}
```

- [ ] **Step 4: Create onboarding service**

Create `apps/api/src/oauth/application-onboarding.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { PermissionAuditContext } from '../permission/permission.types';
import { ApplicationService } from '../permission/application.service';
import { DeveloperCredentialService } from './developer-credential.service';
import { IntegrationPromptService } from './integration-prompt.service';
import { OauthConfigService } from './oauth-config.service';

type CreatePackageInput = {
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

  async createPackage(input: CreatePackageInput, auditContext: PermissionAuditContext) {
    const application = await this.applications.createApplication({
      appKey: input.appKey,
      name: input.name,
      description: input.description,
      ownerUserId: input.ownerUserId
    }, auditContext);

    const redirectUris = [];
    for (const redirectUri of input.redirectUris) {
      redirectUris.push(await this.oauthConfig.createApplicationRedirectUri(input.appKey, { redirectUri }, auditContext));
    }

    const oauthCredential = await this.oauthConfig.rotatePrimaryApplicationClientSecret(input.appKey, auditContext);
    const developerCredential = await this.developerCredentials.rotateApplicationDeveloperCredential(input.appKey, auditContext);
    const integrationPrompt = this.prompts.buildFullPrompt({
      baseIamUrl: process.env.PUBLIC_BASE_URL ?? 'http://feishu-iam.dev.tangtring.com',
      appKey: input.appKey,
      clientId: oauthCredential.clientId,
      clientSecret: oauthCredential.clientSecret,
      developerCredentialId: developerCredential.credentialId,
      developerToken: developerCredential.token,
      redirectUris: redirectUris.map((item) => item.redirectUri)
    });

    return { application, redirectUris, oauthCredential, developerCredential, integrationPrompt };
  }
}
```

- [ ] **Step 5: Wire admin controller**

In `apps/api/src/admin/admin-permission.controller.ts`, inject `ApplicationOnboardingService` and make `POST /api/v1/admin/applications` return the package. The body reader must accept:

```ts
type CreateApplicationPackageBody = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  redirectUris: string[];
};
```

Reject missing or empty `redirectUris` with `APPLICATION_BODY_INVALID`.

- [ ] **Step 6: Run focused API tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- application-onboarding.service.spec.ts admin.controller.e2e-spec.ts
```

Expected: PASS. The admin E2E must assert `clientSecret` and developer token appear in the create response only, and never in error responses.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/api/src/permission/application.service.ts apps/api/src/oauth apps/api/src/admin/admin-permission.controller.ts apps/api/test/application-onboarding.service.spec.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: add application onboarding admin package"
```

---

### Task 4: Developer API Security Gate

**Files:**
- Create: `apps/api/src/oauth/developer-api.guard.ts`
- Create: `apps/api/src/oauth/developer-permission.controller.ts`
- Modify: `apps/api/src/oauth/developer-credential.service.ts`
- Modify: `apps/api/src/oauth/oauth.module.ts`
- Test: `apps/api/test/developer-credential.service.spec.ts`
- Test: `apps/api/test/developer-permission.controller.e2e-spec.ts`

- [ ] **Step 1: Write credential service tests**

Create `apps/api/test/developer-credential.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DeveloperCredentialService } from '../src/oauth/developer-credential.service';

function makePrisma() {
  return {
    application: { findUnique: vi.fn().mockResolvedValue({ id: 'app-demo', appKey: 'demo', status: 'active' }) },
    applicationDeveloperCredential: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    auditLog: { create: vi.fn() },
    securityEvent: { create: vi.fn() },
    $transaction: vi.fn((operation: (tx: unknown) => Promise<unknown>) => operation(makePrisma()))
  };
}

describe('DeveloperCredentialService', () => {
  it('rotates token without returning hash as plaintext', async () => {
    const prisma = makePrisma();
    prisma.applicationDeveloperCredential.create.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: args.data.id,
      applicationId: args.data.applicationId,
      tokenHash: args.data.tokenHash,
      name: args.data.name,
      status: 'active'
    }));
    const service = new DeveloperCredentialService(prisma as never);

    const result = await service.rotateApplicationDeveloperCredential('demo', {
      actorType: 'admin_user',
      actorId: 'admin-platform',
      source: 'admin_web',
      requestId: 'req-dev-token'
    });

    expect(result.token).toMatch(/^biad_/);
    expect(result.credentialId).toEqual(expect.any(String));
    expect(prisma.applicationDeveloperCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: expect.not.stringContaining(result.token)
        })
      })
    );
  });
});
```

- [ ] **Step 2: Write developer API E2E tests**

Create `apps/api/test/developer-permission.controller.e2e-spec.ts` with tests for:

```ts
it('allows a valid developer token to create a permission point in its own app', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/developer/apps/demo/permission-points')
    .set('Authorization', 'Bearer biad_valid_demo')
    .send({ key: 'demo.view', name: '查看 Demo' })
    .expect(201);
});

it('rejects cross-app permission point keys', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/developer/apps/demo/permission-points')
    .set('Authorization', 'Bearer biad_valid_demo')
    .send({ key: 'crm.view', name: '越权权限点' })
    .expect(403);

  expect(response.body.error.code).toBe('DEVELOPER_PERMISSION_DENIED');
});

it('rejects disabled developer tokens', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/v1/developer/apps/demo/permission-points')
    .set('Authorization', 'Bearer biad_disabled_demo')
    .expect(403);

  expect(response.body.error.code).toBe('DEVELOPER_CREDENTIAL_DISABLED');
});

it('does not expose token material in audit actor', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/developer/apps/demo/permission-groups')
    .set('Authorization', 'Bearer biad_valid_demo')
    .send({ key: 'demo.reader', name: 'Demo 只读' })
    .expect(201);

  expect(audit.record).toHaveBeenCalledWith(
    expect.objectContaining({
      actorType: 'application_developer_credential',
      actorId: 'devcred-demo',
      source: 'developer_api'
    }),
    expect.anything()
  );
});
```

- [ ] **Step 3: Run E2E tests and verify failure**

Run:

```bash
pnpm --filter @feishu-iam/api test -- developer-credential.service.spec.ts developer-permission.controller.e2e-spec.ts
```

Expected: FAIL because guard, service, and controller do not exist or are not wired.

- [ ] **Step 4: Implement developer API guard**

Create `apps/api/src/oauth/developer-api.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { DeveloperCredentialService } from './developer-credential.service';

@Injectable()
export class DeveloperApiGuard implements CanActivate {
  constructor(private readonly credentials: DeveloperCredentialService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { developerCredential?: unknown }>();
    const authorization = request.header('authorization') ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    request.developerCredential = await this.credentials.verifyToken(token, {
      requestId: request.header('x-request-id') ?? undefined,
      ip: request.ip,
      userAgent: request.header('user-agent') ?? undefined
    });
    return true;
  }
}
```

- [ ] **Step 5: Implement developer permission controller**

Create `apps/api/src/oauth/developer-permission.controller.ts` with route prefix `/api/v1/developer/apps/:appKey`. It must call the existing `PermissionCatalogService` methods and pass an audit context with:

```ts
const auditContext = {
  actorType: 'application_developer_credential' as const,
  actorId: developerCredential.id,
  source: 'developer_api' as const,
  requestId: getRequestId(request),
  ip: request.ip,
  userAgent: request.header('user-agent') ?? undefined
};
```

Before mutating a permission point or group, assert `key.startsWith(`${appKey}.`)`.

- [ ] **Step 6: Run developer API tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- developer-credential.service.spec.ts developer-permission.controller.e2e-spec.ts
```

Expected: PASS, including cross-app denial, disabled token denial, disabled app denial, and audit actor checks.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/api/src/oauth/developer-api.guard.ts apps/api/src/oauth/developer-permission.controller.ts apps/api/src/oauth/developer-credential.service.ts apps/api/src/oauth/oauth.module.ts apps/api/test/developer-credential.service.spec.ts apps/api/test/developer-permission.controller.e2e-spec.ts
git commit -m "feat: add scoped developer permission api"
```

---

### Task 5: Admin Query and Application List Contracts

**Files:**
- Modify: `apps/api/src/permission/application.service.ts`
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
- Modify: `apps/api/src/admin/admin-query.service.ts`
- Modify: `apps/api/test/admin-query.service.spec.ts`
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: Write application pagination test**

In `apps/api/test/admin.controller.e2e-spec.ts`, add:

```ts
it('GET /admin/applications passes pagination and filters to the application service', async () => {
  applications.listApplications.mockResolvedValue({
    items: [],
    total: 0,
    page: 2,
    pageSize: 10
  });
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-platform',
    feishuUserId: 'ou_platform',
    displayName: '平台管理员',
    roles: ['platform_admin'],
    applicationIds: []
  });

  const response = await request(app.getHttpServer())
    .get('/api/v1/admin/applications?page=2&pageSize=10&query=demo&status=active')
    .set('Cookie', 'feishu_iam_admin_session=session')
    .expect(200);

  expect(response.body).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
  expect(applications.listApplications).toHaveBeenCalledWith({
    page: 2,
    pageSize: 10,
    query: 'demo',
    status: 'active',
    applicationIds: undefined
  });
});
```

- [ ] **Step 2: Write event collection filter test**

In `apps/api/test/admin-query.service.spec.ts`, add:

```ts
it('filters login and token security events before pagination', async () => {
  const prisma = makePrisma();
  const service = new AdminQueryService(prisma as never);

  await service.listSecurityEvents(context(['platform_admin']), {
    eventTypes: ['oauth_authorize', 'oauth_token', 'oauth_userinfo'],
    page: 3,
    pageSize: 20
  });

  expect(lastSecurityEventWhere(prisma.securityEvent.findMany)).toMatchObject({
    eventType: { in: ['oauth_authorize', 'oauth_token', 'oauth_userinfo'] }
  });
  expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      skip: 40,
      take: 20
    })
  );
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-query.service.spec.ts admin.controller.e2e-spec.ts
```

Expected: FAIL because `eventTypes` and paged application list are not implemented.

- [ ] **Step 4: Implement application list query**

In `apps/api/src/permission/application.service.ts`, replace `listApplications(): Promise<Application[]>` with:

```ts
type ListApplicationsInput = {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: EntityStatus | 'all';
  applicationIds?: string[];
};

type PagedApplicationResult = {
  items: Application[];
  total: number;
  page: number;
  pageSize: number;
};
```

Use one `where` object with `OR` for `name`, `appKey`, `description`, and `ownerUserId`, and use `Promise.all([findMany, count])` with `skip` and `take`.

- [ ] **Step 5: Implement eventTypes query**

In `apps/api/src/admin/admin-query.service.ts`, extend `AdminSecurityEventQueryInput`:

```ts
export type AdminSecurityEventQueryInput = {
  page?: number;
  pageSize?: number;
  requestId?: string;
  result?: string;
  eventType?: string;
  eventTypes?: string[];
  reasonCode?: string;
  applicationId?: string;
  clientId?: string;
  feishuUserId?: string;
};
```

When `eventTypes` is non-empty, set:

```ts
where.eventType = { in: input.eventTypes };
```

Do this before pagination. Do not fetch a broad page and filter in memory.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-query.service.spec.ts admin.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/api/src/permission/application.service.ts apps/api/src/admin/admin-permission.controller.ts apps/api/src/admin/admin-query.service.ts apps/api/test/admin-query.service.spec.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: add paged admin list and event collection filters"
```

---

### Task 6: Frontend API Layer and Shared UI Foundation

**Files:**
- Modify: `apps/admin-web/src/admin-types.ts`
- Modify: `apps/admin-web/src/api/permission.ts`
- Modify: `apps/admin-web/src/api/applications.ts`
- Modify: `apps/admin-web/src/api/oauth.ts`
- Create: `apps/admin-web/src/components/DataToolbar.tsx`
- Create: `apps/admin-web/src/components/DataTable.tsx`
- Create: `apps/admin-web/src/components/DetailDrawer.tsx`
- Create: `apps/admin-web/src/components/FormModal.tsx`
- Modify: `apps/admin-web/src/components/AdminPage.tsx`
- Modify: `apps/admin-web/src/components/ConfirmDialog.tsx`
- Modify: `apps/admin-web/src/components/PageState.tsx`
- Modify: `apps/admin-web/src/App.css`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write shared component tests**

In `apps/admin-web/src/App.test.tsx`, add:

```tsx
it('DetailDrawer exposes title, close action, and full-width mobile semantics', async () => {
  const { DetailDrawer } = await import('./components/DetailDrawer');
  const onClose = vi.fn();

  render(
    <DetailDrawer title="应用详情" open onClose={onClose}>
      <p>demo 应用</p>
    </DetailDrawer>
  );

  expect(screen.getByRole('dialog', { name: '应用详情' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭应用详情' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('DataToolbar keeps query and reset controls visible', async () => {
  const { DataToolbar } = await import('./components/DataToolbar');
  const onQueryChange = vi.fn();
  const onReset = vi.fn();

  render(
    <DataToolbar
      query="demo"
      queryPlaceholder="搜索 app_key / 应用名称"
      onQueryChange={onQueryChange}
      onReset={onReset}
      actions={<button type="button">新增应用</button>}
    />
  );

  expect(screen.getByPlaceholderText('搜索 app_key / 应用名称')).toHaveValue('demo');
  expect(screen.getByRole('button', { name: '新增应用' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重置' }));
  expect(onReset).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL because `DetailDrawer` and `DataToolbar` do not exist.

- [ ] **Step 3: Add PageResult and application package types**

In `apps/admin-web/src/admin-types.ts`, keep `PageResult<T>` and add:

```ts
export type ApplicationPackage = {
  application: import('./api/permission').Application;
  redirectUris: Array<{ id: string; redirectUri: string; status: 'active' | 'disabled' }>;
  oauthCredential: { clientId: string; clientSecret?: string };
  developerCredential: { credentialId: string; token?: string };
  integrationPrompt: string;
};
```

- [ ] **Step 4: Implement shared components**

Create `apps/admin-web/src/components/DetailDrawer.tsx`:

```tsx
import type { ReactNode } from 'react';

export function DetailDrawer(props: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  if (!props.open) {
    return null;
  }

  return (
    <div className="detail-drawer-backdrop">
      <section className="detail-drawer" role="dialog" aria-modal="true" aria-label={props.title}>
        <header className="detail-drawer__header">
          <h2>{props.title}</h2>
          <button type="button" className="icon-button" aria-label={`关闭${props.title}`} onClick={props.onClose}>
            ×
          </button>
        </header>
        <div className="detail-drawer__body">{props.children}</div>
      </section>
    </div>
  );
}
```

Create `apps/admin-web/src/components/DataToolbar.tsx`:

```tsx
import type { ReactNode } from 'react';

export function DataToolbar(props: {
  query: string;
  queryPlaceholder: string;
  onQueryChange: (query: string) => void;
  onReset: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="data-toolbar">
      <input
        value={props.query}
        placeholder={props.queryPlaceholder}
        onChange={(event) => props.onQueryChange(event.target.value)}
      />
      <button type="button" onClick={props.onReset}>
        重置
      </button>
      <div className="data-toolbar__actions">{props.actions}</div>
    </div>
  );
}
```

- [ ] **Step 5: Add CSS contract**

In `apps/admin-web/src/App.css`, add:

```css
.detail-drawer-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.32);
  z-index: 40;
}

.detail-drawer {
  width: min(720px, 100vw);
  min-width: 0;
  height: 100%;
  background: #f8fbfa;
  border-left: 1px solid #d6e5e1;
  box-shadow: -24px 0 48px rgba(15, 23, 42, 0.18);
  overflow: auto;
}

.detail-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #d6e5e1;
}

.detail-drawer__body {
  padding: 24px;
}

.data-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.data-toolbar input {
  min-width: min(320px, 100%);
}

.data-toolbar__actions {
  margin-left: auto;
}

@media (max-width: 760px) {
  .detail-drawer {
    width: 100vw;
  }

  .data-toolbar__actions {
    width: 100%;
    margin-left: 0;
  }
}
```

- [ ] **Step 6: Run frontend checks**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/admin-web/src/admin-types.ts apps/admin-web/src/api apps/admin-web/src/components apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx
git commit -m "feat: add admin console shared ui foundation"
```

---

### Task 7: Application Management Vertical Slice

**Files:**
- Modify: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Create: `apps/admin-web/src/routes/application-management/ApplicationDetailDrawer.tsx`
- Create: `apps/admin-web/src/routes/application-management/ApplicationOnboardingModal.tsx`
- Create: `apps/admin-web/src/routes/application-management/RedirectUriPanel.tsx`
- Create: `apps/admin-web/src/routes/application-management/OAuthCredentialPanel.tsx`
- Create: `apps/admin-web/src/routes/application-management/DeveloperCredentialPanel.tsx`
- Create: `apps/admin-web/src/routes/application-management/IntegrationPromptPanel.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write application management behavior tests**

In `apps/admin-web/src/App.test.tsx`, add:

```tsx
it('应用管理 shows v0.8.1 onboarding tabs and no legacy environment labels', async () => {
  const user = userEvent.setup();
  mockFetch({
    applications: {
      items: [makeApplication({ appKey: 'demo', name: 'Demo 应用' })],
      total: 1,
      page: 1,
      pageSize: 20
    }
  });

  render(<App />);

  await user.click(await screen.findByRole('button', { name: '应用管理' }));
  await user.click(await screen.findByRole('button', { name: /Demo 应用/ }));

  expect(screen.getByRole('tab', { name: '基础信息' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Redirect URI' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'OAuth 凭证' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '开发者凭证' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '接入提示' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '操作记录' })).toBeInTheDocument();
  expect(screen.queryByText('环境与回调')).not.toBeInTheDocument();
  expect(screen.queryByText('Client 配置')).not.toBeInTheDocument();
});

it('新增应用 returns one-time secrets and copyable integration prompt', async () => {
  const user = userEvent.setup();
  mockFetch({
    createApplicationPackage: {
      application: makeApplication({ appKey: 'demo', name: 'Demo 应用' }),
      redirectUris: [{ id: 'uri-1', redirectUri: 'https://demo.example.com/callback', status: 'active' }],
      oauthCredential: { clientId: 'bic_demo', clientSecret: 'bics_once_only' },
      developerCredential: { credentialId: 'devcred-demo', token: 'biad_once_only' },
      integrationPrompt: 'Feishu IAM 接入提示词'
    }
  });

  render(<App />);

  await user.click(await screen.findByRole('button', { name: '应用管理' }));
  await user.click(screen.getByRole('button', { name: '新增应用' }));
  await user.type(screen.getByLabelText('应用 key'), 'demo');
  await user.type(screen.getByLabelText('应用名称'), 'Demo 应用');
  await user.type(screen.getByLabelText('Redirect URI'), 'https://demo.example.com/callback');
  await user.click(screen.getByRole('button', { name: '创建接入包' }));

  expect(await screen.findByText('client_secret 只展示一次')).toBeInTheDocument();
  expect(screen.getByText('developer_api_token 只展示一次')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Feishu IAM 接入提示词')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL until the new application-management components exist and the old labels are removed.

- [ ] **Step 3: Split application management page**

Move drawer and tab contents out of `ApplicationManagementPage.tsx`. Keep the route file responsible only for:

```tsx
export function ApplicationManagementPage(props: { admin: AdminMe; initialAppKey?: string }) {
  return (
    <AdminPage title="应用管理" description="管理第三方系统接入 Feishu IAM 的应用包。">
      <ApplicationListAndDrawer admin={props.admin} initialAppKey={props.initialAppKey} />
    </AdminPage>
  );
}
```

Create local components under `apps/admin-web/src/routes/application-management/` so each file owns one panel.

- [ ] **Step 4: Implement create package modal**

Create `ApplicationOnboardingModal.tsx` with fields:

```tsx
type FormState = {
  appKey: string;
  name: string;
  description: string;
  ownerUserId: string;
  redirectUri: string;
};
```

The submit button text is `创建接入包`. The success state must render both callouts:

```tsx
<SecretOnceCallout label="client_secret 只展示一次" value={result.oauthCredential.clientSecret ?? ''} />
<SecretOnceCallout label="developer_api_token 只展示一次" value={result.developerCredential.token ?? ''} />
<textarea readOnly value={result.integrationPrompt} aria-label="Codex 接入提示词" />
```

- [ ] **Step 5: Implement fixed detail drawer tabs**

Create `ApplicationDetailDrawer.tsx` with this exact tab list:

```ts
const APPLICATION_TABS = ['基础信息', 'Redirect URI', 'OAuth 凭证', '开发者凭证', '接入提示', '操作记录'] as const;
```

Do not include `环境与回调` or `Client 配置` in visible text or `aria-label`.

- [ ] **Step 6: Run frontend checks**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/admin-web/src/routes/ApplicationManagementPage.tsx apps/admin-web/src/routes/application-management apps/admin-web/src/App.test.tsx
git commit -m "feat: rebuild application management onboarding flow"
```

---

### Task 8: Six Module Migration and High-Risk Confirmations

**Files:**
- Modify: `apps/admin-web/src/routes/WorkspacePage.tsx`
- Modify: `apps/admin-web/src/routes/PermissionManagementPage.tsx`
- Modify: `apps/admin-web/src/routes/AdminAuthorizationPage.tsx`
- Modify: `apps/admin-web/src/routes/RecordQueryPage.tsx`
- Modify: `apps/admin-web/src/routes/SystemSettingsPage.tsx`
- Modify: `apps/admin-web/src/components/ConfirmDialog.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write module contract tests**

In `apps/admin-web/src/App.test.tsx`, add:

```tsx
it('工作台 places risks before metrics', async () => {
  mockFetch({ feishuStatus: makeStatus(), syncRuns: [makeRun({ status: 'failed' })] });
  render(<App />);

  const risk = await screen.findByText('待处理风险');
  const metrics = screen.getByText('应用数');
  expect(risk.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('记录查询 exposes four usable tabs', async () => {
  const user = userEvent.setup();
  mockFetch({ auditLogs: makePaged([]), securityEvents: makePaged([]), syncRuns: [] });
  render(<App />);

  await user.click(await screen.findByRole('button', { name: '记录查询' }));

  for (const tab of ['审计日志', '安全事件', '同步记录', '登录与 Token 记录']) {
    await user.click(screen.getByRole('tab', { name: tab }));
    expect(screen.queryByText('建设中')).not.toBeInTheDocument();
  }
});

it('high-risk operations use unified confirm dialog with audit hint', async () => {
  const user = userEvent.setup();
  mockFetch({ applications: makePaged([makeApplication({ appKey: 'demo', status: 'active' })]) });
  render(<App />);

  await user.click(await screen.findByRole('button', { name: '应用管理' }));
  await user.click(await screen.findByRole('button', { name: /停用/ }));

  expect(await screen.findByRole('dialog', { name: /确认/ })).toBeInTheDocument();
  expect(screen.getByText(/该操作会写入审计日志/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL until all modules use the shared states and confirmation dialog.

- [ ] **Step 3: Migrate each module**

Use this module contract in each route:

```tsx
<AdminPage title="模块标题" description="一句话说明真实工作内容">
  <DataToolbar ... />
  <PageState ... />
  <DataTable ... />
  <DetailDrawer ... />
  <ConfirmDialog ... />
</AdminPage>
```

Rules:

- `WorkspacePage.tsx`: risk list before metrics.
- `PermissionManagementPage.tsx`: role-centered, no direct per-person permission point assignment.
- `AdminAuthorizationPage.tsx`: platform admin and application admin forms must show different fields.
- `RecordQueryPage.tsx`: four tabs call real data sources and expose loading, empty, error, and detail drawer states.
- `SystemSettingsPage.tsx`: settings list opens detail drawer; no loose page-level cards inside cards.

- [ ] **Step 4: Run frontend tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/admin-web/src/routes apps/admin-web/src/components/ConfirmDialog.tsx apps/admin-web/src/App.test.tsx
git commit -m "feat: migrate admin modules to pencil interaction contract"
```

---

### Task 9: Responsive Browser Regression Gate

**Files:**
- Create: `apps/admin-web/test/run-responsive-overflow-check.mjs`
- Create: `apps/admin-web/test/responsive-overflow.spec.ts`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/admin-web/src/App.css`

- [ ] **Step 1: Add browser regression script**

Create `apps/admin-web/test/run-responsive-overflow-check.mjs`:

```js
import { chromium } from 'playwright';

const url = process.env.ADMIN_WEB_URL ?? 'http://localhost:3000/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: 'networkidle' });

const result = await page.evaluate(() => ({
  viewportWidth: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  navScrollWidth: document.querySelector('.admin-nav')?.scrollWidth ?? 0,
  navClientWidth: document.querySelector('.admin-nav')?.clientWidth ?? 0
}));

await browser.close();

if (result.scrollWidth > result.viewportWidth) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

if (result.navScrollWidth < result.navClientWidth) {
  console.error(JSON.stringify({ ...result, message: 'admin-nav should own horizontal overflow on narrow screens' }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result));
```

- [ ] **Step 2: Add package script**

In `apps/admin-web/package.json`, add:

```json
"test:responsive": "node test/run-responsive-overflow-check.mjs"
```

If Playwright is not installed, add it as a dev dependency in the same task:

```bash
pnpm --filter @feishu-iam/admin-web add -D playwright
```

- [ ] **Step 3: Run responsive check against local server**

Run:

```bash
pnpm --filter @feishu-iam/admin-web build
pnpm --filter @feishu-iam/admin-web preview -- --port 4173
ADMIN_WEB_URL=http://localhost:4173/ pnpm --filter @feishu-iam/admin-web test:responsive
```

Expected: PASS with JSON showing `scrollWidth <= viewportWidth`.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/admin-web/package.json apps/admin-web/test apps/admin-web/src/App.css pnpm-lock.yaml
git commit -m "test: add admin mobile overflow regression"
```

---

### Task 10: Final Verification, Docs, and Release Handoff

**Files:**
- Modify: `README.md`
- Modify: `design/feishu-iam-admin-ui-design-system.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.9.0管理后台重构完成.md`

- [ ] **Step 1: Run full static and test gate**

Run:

```bash
pnpm check
pnpm --filter @feishu-iam/admin-web build
```

Expected: PASS.

- [ ] **Step 2: Run local app and browser verification**

Run:

```bash
pnpm compose:up
```

Open `http://localhost:3000/` with Browser or Playwright and verify:

```text
1. 管理后台可以登录或展示稳定未登录页。
2. 工作台风险区在指标前。
3. 应用管理可以打开新增应用、详情抽屉和六个固定 tab。
4. 记录查询四个 tab 都有真实列表、空态、错态或加载态。
5. 390px、760px、960px、桌面宽度没有页面级横向溢出。
6. console 无错误，Network 无非预期失败请求。
```

- [ ] **Step 3: Update README**

In `README.md`, add a v0.9.0 section:

````markdown
## v0.9.0 管理后台重构

v0.9.0 将管理后台统一为 Pencil 风格的传统后台控制台。核心变化包括：

- 六个一级模块使用统一清单、筛选、分页、详情抽屉和确认弹框。
- 应用管理按 v0.8.1 应用接入包组织，不再把旧环境模型作为主界面。
- 记录查询提供审计日志、安全事件、同步记录、登录与 Token 记录四类真实查询。
- 窄屏使用顶部横向模块栏，表格和抽屉保持可用。

本地验证命令：

```bash
pnpm check
pnpm compose:up
```
````

- [ ] **Step 4: Archive completion session**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.9.0管理后台重构完成.md`:

````markdown
# v0.9.0 管理后台重构完成

## 会话目标

完成 Feishu IAM v0.9.0 管理后台 Pencil 风格重构实现和验证。

## 修改范围

- 后端应用接入包接口。
- 开发者 API 安全边界。
- 管理后台六个一级模块。
- 响应式浏览器回归。
- README 和设计系统文档。

## 验证结果

- `pnpm check`：通过。
- `pnpm --filter @feishu-iam/admin-web build`：通过。
- `http://localhost:3000/` 浏览器自检：通过。

## 剩余风险

无明文 secret、token、cookie、密码进入仓库；如发现环境相关旧文案，应在发布前删除。
````

- [ ] **Step 5: Commit docs and handoff**

Run:

```bash
git add README.md design/feishu-iam-admin-ui-design-system.md docs/codex-sessions/YYYY-MM-DD-HHMM-v0.9.0管理后台重构完成.md
git commit -m "docs: document v0.9.0 admin console rebuild"
```

- [ ] **Step 6: Run gstack completion chain**

Run these skills in order after implementation:

```text
/qa
/review
/document-release
/ship
```

Expected: `/qa` verifies browser behavior, `/review` verifies the actual diff, `/document-release` updates release docs, and `/ship` handles final release mechanics.

---

## Parallelization Strategy

Use one coordination branch or integration worktree. Split implementation lanes only after Task 1.

| Lane | Tasks | Can run parallel | Merge order |
|------|-------|------------------|-------------|
| A Backend contract | Task 2, Task 3, Task 4, Task 5 | Yes, after Task 2 | Merge before frontend integration |
| B Frontend foundation | Task 6 | Yes, after Task 1 | Merge before module pages |
| C Frontend modules | Task 7, Task 8 | After Task 6 and backend API shape | Merge after A+B |
| D Verification docs | Task 9, Task 10 | Task 9 after C, Task 10 last | Last |

Recommended execution:

```text
Task 1
  -> Task 2
  -> Lane A: Task 3 + Task 4 + Task 5
  -> Lane B: Task 6
  -> Task 7
  -> Task 8
  -> Task 9
  -> Task 10
```

Do not let two subagents edit `apps/admin-web/src/App.test.tsx` at the same time. If using subagents, assign App test updates to the lane owner and require a merge review between tasks.

## Self-Review

Spec coverage:

- Pencil-style full admin rebuild: covered by Tasks 6-8 and Task 9.
- v0.8.1 application onboarding model: covered by Tasks 2-4 and Task 7.
- Record query four usable tabs: covered by Tasks 5 and 8.
- Risk-first workspace: covered by Task 8.
- Narrow responsive nav and no page overflow: covered by Tasks 6 and 9.
- High-risk confirmation dialogs: covered by Task 8.
- Test gates and Browser verification: covered by Tasks 9-10.
- Branch isolation: covered by Task 1.

Placeholder scan:

- The plan contains no blank implementation sections and no open implementation slot without a test command.

Type consistency:

- `PageResult<T>` remains the shared frontend pagination type.
- Backend paged responses consistently use `items`, `total`, `page`, and `pageSize`.
- Application-management tab names match the design review decision exactly.
