# Feishu IAM v0.2.1 Feishu Field Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `v0.2.1` as a small Feishu field-readiness release that can diagnose missing Feishu fields before full sync and gate future SSO work on `activeUsers > 0`.

**Architecture:** Add a backend `FeishuDiagnosticsService` that samples existing read-only Feishu directory APIs without writing database state, expose it through the protected platform API, then surface the result in the existing admin Feishu sync panel. Keep diagnostics stateless, reuse existing error filtering and platform token guard, and leave IAM permissions and SSO out of scope.

**Tech Stack:** NestJS, Vitest, Supertest, React, Vite, Testing Library, TypeScript, Prisma-backed existing sync status API.

---

## File Structure

- Create `apps/api/src/feishu/feishu-diagnostics.service.ts`: stateless diagnostics service; owns field classification, sample collection, readiness decision, and next-action messages.
- Modify `apps/api/src/feishu/feishu.types.ts`: shared Feishu diagnostic response types and field status types.
- Modify `apps/api/src/feishu/feishu.controller.ts`: add `GET /api/v1/platform/feishu/field-diagnostics`.
- Modify `apps/api/src/feishu/feishu.module.ts`: register and export diagnostics service.
- Create `apps/api/test/feishu-diagnostics.service.spec.ts`: service-level diagnostics tests using `MockFeishuClient`.
- Modify `apps/api/test/feishu.controller.e2e-spec.ts`: protected API endpoint test and sanitized error path.
- Modify `apps/admin-web/src/api/feishu.ts`: frontend diagnostic types and fetch function.
- Modify `apps/admin-web/src/App.tsx`: render diagnostics card and refresh diagnostics with sync status.
- Modify `apps/admin-web/src/App.test.tsx`: admin diagnostics rendering and refresh tests.
- Modify `docs/feishu-identity-sync.md`: document diagnostics API, field levels, and real Feishu validation checklist.
- Modify `README.md`: update current status and next step.
- Modify `package.json`: bump root version to `0.2.1`.
- Create `docs/codex-sessions/2026-05-15-2355-v0.2.1-飞书字段诊断实施.md`: archive the implementation session.

## Task 1: Backend Diagnostic Types

**Files:**
- Modify: `apps/api/src/feishu/feishu.types.ts`
- Test: `apps/api/test/feishu-diagnostics.service.spec.ts`

- [ ] **Step 1: Add a failing type-level service test stub**

Create `apps/api/test/feishu-diagnostics.service.spec.ts` with this first test. It intentionally imports types and service that do not exist yet.

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FeishuDiagnosticsService } from '../src/feishu/feishu-diagnostics.service';
import { MockFeishuClient } from '../src/feishu/mock-feishu.client';

describe('FeishuDiagnosticsService', () => {
  const originalAppId = process.env.FEISHU_APP_ID;
  const originalAppSecret = process.env.FEISHU_APP_SECRET;

  beforeEach(() => {
    process.env.FEISHU_APP_ID = 'cli_test';
    process.env.FEISHU_APP_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (originalAppId === undefined) {
      delete process.env.FEISHU_APP_ID;
    } else {
      process.env.FEISHU_APP_ID = originalAppId;
    }
    if (originalAppSecret === undefined) {
      delete process.env.FEISHU_APP_SECRET;
    } else {
      process.env.FEISHU_APP_SECRET = originalAppSecret;
    }
  });

  it('返回通过态字段诊断', async () => {
    const client = new MockFeishuClient(
      {
        '0': [
          {
            department_id: 'D001',
            open_department_id: 'od-001',
            parent_department_id: '0',
            name: '总部'
          }
        ]
      },
      {
        '0': [],
        D001: [
          {
            user_id: 'u001',
            open_id: 'ou_001',
            union_id: 'on_001',
            name: '张三',
            email: 'zhangsan@example.com',
            mobile: '13800000000',
            status: { is_activated: true },
            department_ids: ['D001']
          }
        ]
      }
    );

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('passed');
    expect(result.loginReadiness.ready).toBe(true);
    expect(result.sampleCounts.departments).toBe(1);
    expect(result.sampleCounts.users).toBe(1);
    expect(result.userFields.find((field) => field.field === 'status')?.status).toBe('present');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/api test -- --run test/feishu-diagnostics.service.spec.ts
```

Expected: FAIL with an import error for `../src/feishu/feishu-diagnostics.service`.

- [ ] **Step 3: Add diagnostic response types**

Append these types to `apps/api/src/feishu/feishu.types.ts` after `FeishuConnectionStatus`:

```ts
export type FeishuDiagnosticStatus = 'passed' | 'warning' | 'failed' | 'not_configured';

export type FeishuDiagnosticFieldStatus = 'present' | 'empty' | 'missing' | 'not_sampled';

export type FeishuDiagnosticRequiredLevel = 'blocking' | 'strong_warning' | 'warning';

export type FeishuDiagnosticField = {
  field: string;
  status: FeishuDiagnosticFieldStatus;
  presentCount: number;
  missingCount: number;
  emptyCount: number;
  requiredLevel: FeishuDiagnosticRequiredLevel;
};

export type FeishuFieldDiagnostics = {
  status: FeishuDiagnosticStatus;
  loginReadiness: {
    ready: boolean;
    reason: string;
  };
  sampleCounts: {
    departments: number;
    users: number;
    activeUsers: number;
  };
  departmentFields: FeishuDiagnosticField[];
  userFields: FeishuDiagnosticField[];
  blockingIssues: string[];
  warnings: string[];
  nextActions: string[];
};
```

- [ ] **Step 4: Run typecheck to verify only missing service remains**

Run:

```bash
pnpm --filter @feishu-iam/api typecheck
```

Expected: FAIL only because `feishu-diagnostics.service` is not implemented yet.

## Task 2: Backend Diagnostics Service

**Files:**
- Create: `apps/api/src/feishu/feishu-diagnostics.service.ts`
- Modify: `apps/api/test/feishu-diagnostics.service.spec.ts`

- [ ] **Step 1: Extend failing tests for blocking and warning cases**

Add these tests below the first service test:

```ts
  it('用户 status 缺失时返回阻断项', async () => {
    const client = new MockFeishuClient(
      { '0': [{ department_id: 'D001', name: '总部' }] },
      { D001: [{ user_id: 'u001', name: '张三', department_ids: ['D001'] }] }
    );

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('failed');
    expect(result.loginReadiness.ready).toBe(false);
    expect(result.blockingIssues).toContain('用户 status 字段未返回，无法判断可登录用户');
    expect(result.userFields.find((field) => field.field === 'status')?.status).toBe('missing');
  });

  it('用户和部门名称缺失时返回强警告', async () => {
    const client = new MockFeishuClient(
      { '0': [{ open_department_id: 'od-001' }] },
      {
        '0': [],
        'od-001': [
          {
            user_id: 'u001',
            status: { is_activated: true },
            department_ids: ['od-001']
          }
        ]
      }
    );

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('warning');
    expect(result.loginReadiness.ready).toBe(true);
    expect(result.warnings).toContain('部门 name 字段未返回，管理端会使用部门 ID 占位');
    expect(result.warnings).toContain('用户 name 字段未返回，管理端会使用 user_id 占位');
  });

  it('抽样不到用户时返回阻断项', async () => {
    const client = new MockFeishuClient({ '0': [{ department_id: 'D001', name: '总部' }] }, { D001: [] });

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('failed');
    expect(result.sampleCounts.users).toBe(0);
    expect(result.blockingIssues).toContain('未抽样到飞书用户，请检查通讯录可见范围');
  });

  it('飞书配置缺失时返回 not_configured 诊断', async () => {
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;

    const result = await new FeishuDiagnosticsService(new MockFeishuClient()).getFieldDiagnostics();

    expect(result.status).toBe('not_configured');
    expect(result.loginReadiness.ready).toBe(false);
    expect(result.nextActions).toContain('配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET 后重新运行字段诊断');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @feishu-iam/api test -- --run test/feishu-diagnostics.service.spec.ts
```

Expected: FAIL because `FeishuDiagnosticsService` does not exist.

- [ ] **Step 3: Implement diagnostics service**

Create `apps/api/src/feishu/feishu-diagnostics.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { FEISHU_CLIENT, type FeishuClient } from './feishu-client';
import {
  isFeishuUserActive,
  type FeishuDepartmentItem,
  type FeishuDiagnosticField,
  type FeishuDiagnosticRequiredLevel,
  type FeishuFieldDiagnostics,
  type FeishuUserItem
} from './feishu.types';

type FieldDefinition = {
  field: string;
  requiredLevel: FeishuDiagnosticRequiredLevel;
};

const MAX_DEPARTMENT_SAMPLE = 5;
const MAX_USER_SAMPLE = 20;

const DEPARTMENT_FIELDS: FieldDefinition[] = [
  { field: 'department_id', requiredLevel: 'warning' },
  { field: 'open_department_id', requiredLevel: 'warning' },
  { field: 'name', requiredLevel: 'strong_warning' },
  { field: 'i18n_name', requiredLevel: 'warning' },
  { field: 'parent_department_id', requiredLevel: 'warning' }
];

const USER_FIELDS: FieldDefinition[] = [
  { field: 'user_id', requiredLevel: 'blocking' },
  { field: 'open_id', requiredLevel: 'warning' },
  { field: 'union_id', requiredLevel: 'warning' },
  { field: 'name', requiredLevel: 'strong_warning' },
  { field: 'status', requiredLevel: 'blocking' },
  { field: 'email', requiredLevel: 'warning' },
  { field: 'mobile', requiredLevel: 'warning' },
  { field: 'department_ids', requiredLevel: 'blocking' }
];

@Injectable()
export class FeishuDiagnosticsService {
  constructor(@Inject(FEISHU_CLIENT) private readonly feishuClient: FeishuClient) {}

  async getFieldDiagnostics(): Promise<FeishuFieldDiagnostics> {
    if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
      return this.notConfiguredDiagnostics();
    }

    const departments = await this.sampleDepartments();
    const users = await this.sampleUsers(departments);
    const departmentFields = this.evaluateFields(departments, DEPARTMENT_FIELDS);
    const userFields = this.evaluateFields(users, USER_FIELDS);
    const activeUsers = users.filter((user) => isFeishuUserActive(user.status)).length;
    const blockingIssues = this.buildBlockingIssues(users, userFields, activeUsers);
    const warnings = this.buildWarnings(departmentFields, userFields);

    return {
      status: blockingIssues.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
      loginReadiness: {
        ready: blockingIssues.length === 0,
        reason:
          blockingIssues[0] ??
          (warnings.length > 0 ? '关键字段满足登录准备要求，但展示字段仍需补齐' : '字段满足后续 SSO 准备要求')
      },
      sampleCounts: {
        departments: departments.length,
        users: users.length,
        activeUsers
      },
      departmentFields,
      userFields,
      blockingIssues,
      warnings,
      nextActions: this.buildNextActions(blockingIssues, warnings)
    };
  }

  private async sampleDepartments(): Promise<FeishuDepartmentItem[]> {
    const page = await this.feishuClient.listDepartmentChildren({
      departmentId: '0',
      pageSize: MAX_DEPARTMENT_SAMPLE
    });
    return page.items.slice(0, MAX_DEPARTMENT_SAMPLE);
  }

  private async sampleUsers(departments: FeishuDepartmentItem[]): Promise<FeishuUserItem[]> {
    const departmentIds = [
      '0',
      ...departments
        .map((department) => department.department_id ?? department.open_department_id)
        .filter((departmentId): departmentId is string => Boolean(departmentId))
    ];
    const users: FeishuUserItem[] = [];

    for (const departmentId of departmentIds) {
      if (users.length >= MAX_USER_SAMPLE) {
        break;
      }
      const page = await this.feishuClient.listDepartmentUsers({
        departmentId,
        pageSize: MAX_USER_SAMPLE - users.length
      });
      users.push(...page.items);
    }

    return users.slice(0, MAX_USER_SAMPLE);
  }

  private evaluateFields<T extends object>(
    items: T[],
    definitions: FieldDefinition[]
  ): FeishuDiagnosticField[] {
    return definitions.map((definition) => {
      if (items.length === 0) {
        return {
          field: definition.field,
          status: 'not_sampled',
          presentCount: 0,
          missingCount: 0,
          emptyCount: 0,
          requiredLevel: definition.requiredLevel
        };
      }

      const counters = items.reduce(
        (acc, item) => {
          const record = item as Record<string, unknown>;
          if (!(definition.field in record)) {
            acc.missingCount += 1;
            return acc;
          }
          if (this.isEmptyValue(record[definition.field])) {
            acc.emptyCount += 1;
            return acc;
          }
          acc.presentCount += 1;
          return acc;
        },
        { presentCount: 0, missingCount: 0, emptyCount: 0 }
      );

      return {
        field: definition.field,
        status:
          counters.presentCount > 0
            ? 'present'
            : counters.emptyCount > 0
              ? 'empty'
              : counters.missingCount > 0
                ? 'missing'
                : 'not_sampled',
        ...counters,
        requiredLevel: definition.requiredLevel
      };
    });
  }

  private isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    return false;
  }

  private buildBlockingIssues(
    users: FeishuUserItem[],
    userFields: FeishuDiagnosticField[],
    activeUsers: number
  ): string[] {
    const issues: string[] = [];
    if (users.length === 0) {
      issues.push('未抽样到飞书用户，请检查通讯录可见范围');
    }
    if (this.fieldIsUnavailable(userFields, 'status')) {
      issues.push('用户 status 字段未返回，无法判断可登录用户');
    }
    if (users.length > 0 && !this.fieldIsUnavailable(userFields, 'status') && activeUsers === 0) {
      issues.push('抽样用户中没有可登录用户，请确认用户状态和通讯录范围');
    }
    return issues;
  }

  private buildWarnings(
    departmentFields: FeishuDiagnosticField[],
    userFields: FeishuDiagnosticField[]
  ): string[] {
    const warnings: string[] = [];
    if (this.fieldIsUnavailable(departmentFields, 'name')) {
      warnings.push('部门 name 字段未返回，管理端会使用部门 ID 占位');
    }
    if (this.fieldIsUnavailable(userFields, 'name')) {
      warnings.push('用户 name 字段未返回，管理端会使用 user_id 占位');
    }
    for (const optionalField of ['email', 'mobile']) {
      if (this.fieldIsUnavailable(userFields, optionalField)) {
        warnings.push(`用户 ${optionalField} 字段未返回，相关展示信息会缺失`);
      }
    }
    return warnings;
  }

  private fieldIsUnavailable(fields: FeishuDiagnosticField[], field: string): boolean {
    const diagnostic = fields.find((item) => item.field === field);
    return diagnostic?.status === 'missing' || diagnostic?.status === 'empty' || diagnostic?.status === 'not_sampled';
  }

  private buildNextActions(blockingIssues: string[], warnings: string[]): string[] {
    if (blockingIssues.length === 0 && warnings.length === 0) {
      return ['字段完整性满足 v0.2.1 发布门槛，可以执行真实同步验收'];
    }

    const actions = ['检查飞书应用的通讯录只读权限和通讯录可见范围'];
    if (blockingIssues.some((issue) => issue.includes('status'))) {
      actions.push('确认飞书应用已授权读取用户状态字段，补齐后重新运行字段诊断和全量同步');
    }
    if (warnings.some((warning) => warning.includes('name'))) {
      actions.push('确认飞书应用已授权读取用户姓名和部门名称字段');
    }
    if (warnings.some((warning) => warning.includes('email') || warning.includes('mobile'))) {
      actions.push('如果管理端需要展示邮箱或手机号，请在飞书后台补齐对应字段权限');
    }
    return actions;
  }

  private notConfiguredDiagnostics(): FeishuFieldDiagnostics {
    return {
      status: 'not_configured',
      loginReadiness: {
        ready: false,
        reason: '飞书应用配置缺失'
      },
      sampleCounts: {
        departments: 0,
        users: 0,
        activeUsers: 0
      },
      departmentFields: this.evaluateFields([], DEPARTMENT_FIELDS),
      userFields: this.evaluateFields([], USER_FIELDS),
      blockingIssues: ['飞书应用配置缺失'],
      warnings: [],
      nextActions: ['配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET 后重新运行字段诊断']
    };
  }
}
```

- [ ] **Step 4: Run focused diagnostics tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- --run test/feishu-diagnostics.service.spec.ts
```

Expected: PASS for the four service tests.

- [ ] **Step 5: Commit backend diagnostics service**

Run:

```bash
git add apps/api/src/feishu/feishu.types.ts apps/api/src/feishu/feishu-diagnostics.service.ts apps/api/test/feishu-diagnostics.service.spec.ts
git commit -m "feat: add feishu field diagnostics service"
```

## Task 3: Backend Platform API

**Files:**
- Modify: `apps/api/src/feishu/feishu.controller.ts`
- Modify: `apps/api/src/feishu/feishu.module.ts`
- Modify: `apps/api/test/feishu.controller.e2e-spec.ts`

- [ ] **Step 1: Add failing controller tests**

Modify `apps/api/test/feishu.controller.e2e-spec.ts`:

1. Add import:

```ts
import { FeishuDiagnosticsService } from '../src/feishu/feishu-diagnostics.service';
```

2. Add mock object next to `statusService`:

```ts
  const diagnosticsService = {
    getFieldDiagnostics: vi.fn<FeishuDiagnosticsService['getFieldDiagnostics']>()
  };
```

3. Add override in `beforeAll`:

```ts
      .overrideProvider(FeishuDiagnosticsService)
      .useValue(diagnosticsService)
```

4. Add test before the sync-run tests:

```ts
  it('返回飞书字段诊断结果', async () => {
    diagnosticsService.getFieldDiagnostics.mockResolvedValue({
      status: 'passed',
      loginReadiness: { ready: true, reason: '字段满足后续 SSO 准备要求' },
      sampleCounts: { departments: 1, users: 1, activeUsers: 1 },
      departmentFields: [],
      userFields: [],
      blockingIssues: [],
      warnings: [],
      nextActions: ['字段完整性满足 v0.2.1 发布门槛，可以执行真实同步验收']
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/feishu/field-diagnostics')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown;
        expect(getField(body, 'status')).toBe('passed');
        expect(getField(body, 'sampleCounts')).toEqual({
          departments: 1,
          users: 1,
          activeUsers: 1
        });
      });
  });
```

- [ ] **Step 2: Run controller test to verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/api test -- --run test/feishu.controller.e2e-spec.ts
```

Expected: FAIL with `404` for `/api/v1/platform/feishu/field-diagnostics` or missing provider.

- [ ] **Step 3: Register diagnostics service in the module**

Modify `apps/api/src/feishu/feishu.module.ts`:

```ts
import { FeishuDiagnosticsService } from './feishu-diagnostics.service';
```

Add `FeishuDiagnosticsService` to `providers` and `exports`:

```ts
    FeishuDiagnosticsService,
```

```ts
  exports: [FEISHU_CLIENT, FeishuSyncService, FeishuStatusService, FeishuDiagnosticsService]
```

- [ ] **Step 4: Add controller endpoint**

Modify `apps/api/src/feishu/feishu.controller.ts`:

```ts
import { FeishuDiagnosticsService } from './feishu-diagnostics.service';
```

Inject it:

```ts
    @Inject(FeishuDiagnosticsService)
    private readonly diagnosticsService: FeishuDiagnosticsService,
```

Add endpoint before `/status`:

```ts
  @Get('/field-diagnostics')
  async getFieldDiagnostics(): Promise<
    Awaited<ReturnType<FeishuDiagnosticsService['getFieldDiagnostics']>>
  > {
    return this.diagnosticsService.getFieldDiagnostics();
  }
```

- [ ] **Step 5: Run backend focused tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- --run test/feishu.controller.e2e-spec.ts test/feishu-diagnostics.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run backend typecheck and readonly guard**

Run:

```bash
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/api test -- --run test/feishu-readonly.spec.ts
```

Expected: both PASS; readonly static test confirms no Feishu write API paths were added.

- [ ] **Step 7: Commit platform API**

Run:

```bash
git add apps/api/src/feishu/feishu.controller.ts apps/api/src/feishu/feishu.module.ts apps/api/test/feishu.controller.e2e-spec.ts
git commit -m "feat: expose feishu field diagnostics api"
```

## Task 4: Admin API Client Types

**Files:**
- Modify: `apps/admin-web/src/api/feishu.ts`
- Test: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Add frontend type expectations by updating test fixtures**

Modify the import in `apps/admin-web/src/App.test.tsx`:

```ts
import type { FeishuFieldDiagnostics, FeishuStatus, FeishuSyncRun } from './api/feishu';
```

This will fail until `FeishuFieldDiagnostics` exists.

- [ ] **Step 2: Run admin typecheck to verify failure**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: FAIL because `FeishuFieldDiagnostics` is not exported.

- [ ] **Step 3: Add diagnostic frontend types and fetcher**

Append to `apps/admin-web/src/api/feishu.ts` after `FeishuStatus`:

```ts
export type FeishuDiagnosticStatus = 'passed' | 'warning' | 'failed' | 'not_configured';

export type FeishuDiagnosticFieldStatus = 'present' | 'empty' | 'missing' | 'not_sampled';

export type FeishuDiagnosticRequiredLevel = 'blocking' | 'strong_warning' | 'warning';

export type FeishuDiagnosticField = {
  field: string;
  status: FeishuDiagnosticFieldStatus;
  presentCount: number;
  missingCount: number;
  emptyCount: number;
  requiredLevel: FeishuDiagnosticRequiredLevel;
};

export type FeishuFieldDiagnostics = {
  status: FeishuDiagnosticStatus;
  loginReadiness: {
    ready: boolean;
    reason: string;
  };
  sampleCounts: {
    departments: number;
    users: number;
    activeUsers: number;
  };
  departmentFields: FeishuDiagnosticField[];
  userFields: FeishuDiagnosticField[];
  blockingIssues: string[];
  warnings: string[];
  nextActions: string[];
};
```

Add fetcher near the other API functions:

```ts
export async function fetchFeishuFieldDiagnostics(): Promise<FeishuFieldDiagnostics> {
  return readJson<FeishuFieldDiagnostics>('/api/v1/platform/feishu/field-diagnostics');
}
```

Update `safeErrorMessage` messages:

```ts
    FEISHU_CONFIG_MISSING: '飞书应用配置缺失',
    FEISHU_PERMISSION_DENIED: '飞书应用缺少只读通讯录权限或可见范围不足',
    FEISHU_SYNC_ALREADY_RUNNING: '已有飞书同步正在运行',
    FEISHU_SYNC_RUNNING: '已有飞书同步正在运行',
    FEISHU_NETWORK_ERROR: '飞书接口网络请求失败'
```

- [ ] **Step 4: Run admin typecheck**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit admin API types**

Run:

```bash
git add apps/admin-web/src/api/feishu.ts apps/admin-web/src/App.test.tsx
git commit -m "feat: add feishu diagnostics client types"
```

## Task 5: Admin Diagnostics Card

**Files:**
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`
- Modify: `apps/admin-web/src/App.css`

- [ ] **Step 1: Add failing diagnostics rendering tests**

In `apps/admin-web/src/App.test.tsx`, add this helper near `makeStatus`:

```ts
function makeDiagnostics(overrides?: Partial<FeishuFieldDiagnostics>): FeishuFieldDiagnostics {
  return {
    status: 'passed',
    loginReadiness: {
      ready: true,
      reason: '字段满足后续 SSO 准备要求'
    },
    sampleCounts: {
      departments: 1,
      users: 1,
      activeUsers: 1
    },
    departmentFields: [
      {
        field: 'name',
        status: 'present',
        presentCount: 1,
        missingCount: 0,
        emptyCount: 0,
        requiredLevel: 'strong_warning'
      }
    ],
    userFields: [
      {
        field: 'status',
        status: 'present',
        presentCount: 1,
        missingCount: 0,
        emptyCount: 0,
        requiredLevel: 'blocking'
      }
    ],
    blockingIssues: [],
    warnings: [],
    nextActions: ['字段完整性满足 v0.2.1 发布门槛，可以执行真实同步验收'],
    ...overrides
  };
}
```

Modify `mockFetch` signature and body:

```ts
function mockFetch(options: {
  feishuStatus: FeishuStatus;
  syncRuns: FeishuSyncRun[];
  diagnostics?: FeishuFieldDiagnostics;
}) {
```

Add endpoint branch:

```ts
    if (url === '/api/v1/platform/feishu/field-diagnostics') {
      return jsonResponse(options.diagnostics ?? makeDiagnostics());
    }
```

Add tests:

```ts
  it('展示字段完整性诊断通过态', async () => {
    mockFetch({
      feishuStatus: makeStatus({ counts: { departments: 1, activeDepartments: 1, users: 1, activeUsers: 1, relations: 1 } }),
      syncRuns: [makeRun()],
      diagnostics: makeDiagnostics()
    });

    render(<App />);

    expect(await screen.findByText('字段完整性诊断')).toBeInTheDocument();
    expect(screen.getByText('可进入后续 SSO')).toBeInTheDocument();
    expect(screen.getByText('active_users > 0 已满足')).toBeInTheDocument();
    expect(screen.getByText('字段满足后续 SSO 准备要求')).toBeInTheDocument();
  });

  it('展示字段诊断阻断态和安全建议', async () => {
    mockFetch({
      feishuStatus: makeStatus({ counts: { departments: 1, activeDepartments: 1, users: 1, activeUsers: 0, relations: 1 } }),
      syncRuns: [makeRun()],
      diagnostics: makeDiagnostics({
        status: 'failed',
        loginReadiness: {
          ready: false,
          reason: '用户 status 字段未返回，无法判断可登录用户'
        },
        sampleCounts: { departments: 1, users: 1, activeUsers: 0 },
        userFields: [
          {
            field: 'status',
            status: 'missing',
            presentCount: 0,
            missingCount: 1,
            emptyCount: 0,
            requiredLevel: 'blocking'
          }
        ],
        blockingIssues: ['用户 status 字段未返回，无法判断可登录用户'],
        nextActions: ['确认飞书应用已授权读取用户状态字段，补齐后重新运行字段诊断和全量同步']
      })
    });

    render(<App />);

    expect(await screen.findByText('不可进入后续 SSO')).toBeInTheDocument();
    expect(screen.getByText('active_users > 0 未满足')).toBeInTheDocument();
    expect(screen.getByText('用户 status 字段未返回，无法判断可登录用户')).toBeInTheDocument();
    expect(screen.getByText('确认飞书应用已授权读取用户状态字段，补齐后重新运行字段诊断和全量同步')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run admin tests to verify failure**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- --run src/App.test.tsx
```

Expected: FAIL because the app does not fetch or render diagnostics.

- [ ] **Step 3: Wire diagnostics loading in `App.tsx`**

Modify imports:

```ts
import {
  fetchFeishuFieldDiagnostics,
  fetchFeishuStatus,
  fetchFeishuSyncRuns,
  triggerFeishuSync
} from './api/feishu';
import type { FeishuFieldDiagnostics, FeishuStatus, FeishuSyncRun } from './api/feishu';
```

Modify `FeishuState` loaded branch:

```ts
      diagnostics: FeishuFieldDiagnostics;
      diagnosticsError?: string;
```

Modify `loadFeishu`:

```ts
  async function loadFeishu(): Promise<void> {
    try {
      const [data, runs, diagnostics] = await Promise.all([
        fetchFeishuStatus(),
        fetchFeishuSyncRuns(),
        fetchFeishuFieldDiagnostics()
      ]);
      setFeishuState({ status: 'loaded', data, runs, diagnostics, syncing: false });
    } catch (error: unknown) {
      setFeishuState({
        status: 'failed',
        message: error instanceof Error ? error.message : '无法读取飞书同步状态'
      });
    }
  }
```

Add refresh helper:

```ts
  async function refreshDiagnostics(): Promise<void> {
    if (feishuState.status !== 'loaded') {
      return;
    }
    try {
      const diagnostics = await fetchFeishuFieldDiagnostics();
      setFeishuState({ ...feishuState, diagnostics, diagnosticsError: undefined });
    } catch (error: unknown) {
      setFeishuState({
        ...feishuState,
        diagnosticsError: error instanceof Error ? error.message : '无法读取字段诊断'
      });
    }
  }
```

In `handleSync` catch branch, preserve diagnostics:

```ts
      setFeishuState({
        ...feishuState,
        syncing: false,
        syncError: error instanceof Error ? error.message : '无法触发飞书同步'
      });
```

- [ ] **Step 4: Render diagnostics card**

In `App.tsx`, render below `<LatestRunSummary />`:

```tsx
            <FieldDiagnosticsCard
              diagnostics={feishuState.diagnostics}
              activeUsers={feishuState.data.counts.activeUsers}
              error={feishuState.diagnosticsError}
              onRefresh={() => void refreshDiagnostics()}
            />
```

Add component before `SyncHistory`:

```tsx
function FieldDiagnosticsCard(props: {
  diagnostics: FeishuFieldDiagnostics;
  activeUsers: number;
  error?: string;
  onRefresh: () => void;
}) {
  return (
    <section className="field-diagnostics" aria-label="字段完整性诊断">
      <div className="latest-run-header">
        <div>
          <h3>字段完整性诊断</h3>
          <p className="muted">{props.diagnostics.loginReadiness.reason}</p>
        </div>
        <button className="text-button" type="button" onClick={props.onRefresh}>
          刷新诊断
        </button>
      </div>
      {props.error ? <p className="inline-error">{props.error}</p> : null}
      <div className="diagnostic-result">
        <strong>{formatDiagnosticConclusion(props.diagnostics.status)}</strong>
        <span>{props.activeUsers > 0 ? 'active_users > 0 已满足' : 'active_users > 0 未满足'}</span>
      </div>
      <div className="diagnostic-grid">
        <DiagnosticFieldList title="部门字段" fields={props.diagnostics.departmentFields} />
        <DiagnosticFieldList title="用户字段" fields={props.diagnostics.userFields} />
      </div>
      <DiagnosticMessages title="阻断项" items={props.diagnostics.blockingIssues} />
      <DiagnosticMessages title="警告" items={props.diagnostics.warnings} />
      <DiagnosticMessages title="下一步" items={props.diagnostics.nextActions} />
    </section>
  );
}

function DiagnosticFieldList(props: { title: string; fields: FeishuFieldDiagnostics['userFields'] }) {
  return (
    <div>
      <h4>{props.title}</h4>
      <ul className="diagnostic-fields">
        {props.fields.map((field) => (
          <li key={`${props.title}-${field.field}`}>
            <span>{field.field}</span>
            <strong>{formatFieldStatus(field.status)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagnosticMessages(props: { title: string; items: string[] }) {
  if (props.items.length === 0) {
    return null;
  }
  return (
    <div className="diagnostic-messages">
      <h4>{props.title}</h4>
      <ul>
        {props.items.map((item) => (
          <li key={`${props.title}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

Add formatters near existing format functions:

```ts
function formatDiagnosticConclusion(status: FeishuFieldDiagnostics['status']): string {
  const labels: Record<FeishuFieldDiagnostics['status'], string> = {
    passed: '可进入后续 SSO',
    warning: '字段不完整但可继续同步',
    failed: '不可进入后续 SSO',
    not_configured: '飞书未配置'
  };
  return labels[status];
}

function formatFieldStatus(status: FeishuFieldDiagnostics['userFields'][number]['status']): string {
  const labels: Record<FeishuFieldDiagnostics['userFields'][number]['status'], string> = {
    present: '已返回',
    empty: '空值',
    missing: '未返回',
    not_sampled: '未抽样到数据'
  };
  return labels[status];
}
```

- [ ] **Step 5: Add minimal CSS**

Append to `apps/admin-web/src/App.css`:

```css
.field-diagnostics {
  border-top: 1px solid #e2e8f0;
  margin-top: 24px;
  padding-top: 20px;
}

.text-button {
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #0f172a;
  cursor: pointer;
  font: inherit;
  padding: 8px 12px;
}

.diagnostic-result {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin: 16px 0;
  padding: 12px 14px;
}

.diagnostic-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.diagnostic-fields,
.diagnostic-messages ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.diagnostic-fields li {
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.diagnostic-messages {
  margin-top: 16px;
}

.diagnostic-messages li {
  color: #475569;
  margin-top: 6px;
}

@media (max-width: 760px) {
  .diagnostic-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run admin tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- --run src/App.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit admin diagnostics card**

Run:

```bash
git add apps/admin-web/src/api/feishu.ts apps/admin-web/src/App.tsx apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx
git commit -m "feat: show feishu field diagnostics"
```

## Task 6: Version and Documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/feishu-identity-sync.md`
- Create: `docs/codex-sessions/2026-05-15-2355-v0.2.1-飞书字段诊断实施.md`

- [ ] **Step 1: Update version**

Change root `package.json`:

```json
{
  "name": "feishu-iam",
  "version": "0.2.1",
  "private": true
}
```

Keep all existing scripts and dependencies unchanged.

- [ ] **Step 2: Update README status and next step**

In `README.md`, update “当前状态” and “下一步” text to:

```md
项目已完成基础工程初始化和 `v0.2.0` 飞书身份镜像同步，当前正在推进 `v0.2.1` 飞书字段完整性与发布收口。系统具备可运行的 API、管理端飞书同步状态页、Prisma/PostgreSQL 迁移、Docker Compose 部署骨架和 Codex 会话归档机制。
```

```md
下一步：

- 完成 `v0.2.1` 字段诊断、真实同步验收和 `active_users > 0` 发布门槛。
- `v0.2.1` 验收后，再拆分并实施 `v0.3.0` 应用、权限组、权限点与 IAM 角色计划。
```

- [ ] **Step 3: Document diagnostics API**

Append this section to `docs/feishu-identity-sync.md` after “平台 API”:

````md
## 字段完整性诊断

`v0.2.1` 增加字段完整性诊断接口，用于在执行完整同步前快速判断飞书只读权限、通讯录可见范围和字段返回情况。

```text
GET /api/v1/platform/feishu/field-diagnostics
Authorization: Bearer <PLATFORM_ADMIN_TOKEN>
```

诊断接口只调用现有只读飞书接口，不写入数据库，不创建同步 run，也不会返回真实手机号、邮箱或 token。

核心结论包括：

- `passed`：关键字段满足后续 SSO 准备要求。
- `warning`：没有阻断项，但姓名、部门名称、邮箱或手机号等展示字段不完整。
- `failed`：存在阻断项，例如用户 `status` 字段缺失、抽样不到用户或飞书权限不足。
- `not_configured`：缺少飞书应用配置。

`v0.2.1` 的真实发布门槛是：补齐字段权限后重新执行真实同步，`GET /api/v1/platform/feishu/status` 返回的 `counts.activeUsers` 必须大于 0。
````

- [ ] **Step 4: Add real Feishu checklist**

Append to the “真实飞书手动验证” section in `docs/feishu-identity-sync.md`:

```md
`v0.2.1` 真实字段验收步骤：

1. 调用字段诊断接口。
2. 如果返回 `failed`，先按 `nextActions` 检查飞书应用只读权限、字段权限和通讯录可见范围。
3. 确认用户 `status` 字段已返回，因为 Feishu IAM 依赖它计算 `is_active`。
4. 触发一次真实同步。
5. 查询同步状态，确认 `counts.activeUsers > 0`。
6. 如果用户姓名或部门名称仍缺失，可以继续同步，但不建议进入权限分配体验开发。
```

- [ ] **Step 5: Add session archive**

Create `docs/codex-sessions/2026-05-15-2355-v0.2.1-飞书字段诊断实施.md` with:

```md
# v0.2.1 飞书字段诊断实施

## 会话目标

实施 `v0.2.1` 飞书字段完整性诊断、管理端展示、文档更新和版本收口。

## 用户原始关键要求摘要

- 以 `active_users > 0` 作为真实同步发布门槛。
- 采用不落库的字段诊断接口和管理端诊断卡片。
- 不进入 SSO、权限模型、飞书角色或飞书用户组同步。

## 本次会话使用或形成的关键提示词/约束

- 遵守 `AGENTS.md` 和 `docs/superpowers/specs/2026-05-15-feishu-iam-v0.2.1-feishu-field-readiness-design.md`。
- 保持飞书通讯录只读边界。
- 不记录真实密钥、token、cookie 或密码。

## 重要设计决策和原因

- 诊断接口实时计算，不落库，避免完整同步耗时影响字段权限排查。
- 用户 `status` 缺失为阻断项，姓名和部门名称缺失为强警告，邮箱和手机号缺失为普通警告。

## 修改过的文件

- `apps/api/src/feishu/feishu.types.ts`
- `apps/api/src/feishu/feishu-diagnostics.service.ts`
- `apps/api/src/feishu/feishu.controller.ts`
- `apps/api/src/feishu/feishu.module.ts`
- `apps/api/test/feishu-diagnostics.service.spec.ts`
- `apps/api/test/feishu.controller.e2e-spec.ts`
- `apps/admin-web/src/api/feishu.ts`
- `apps/admin-web/src/App.tsx`
- `apps/admin-web/src/App.css`
- `apps/admin-web/src/App.test.tsx`
- `docs/feishu-identity-sync.md`
- `README.md`
- `package.json`

## 执行过的关键命令和验证结果

- `pnpm --filter @feishu-iam/api test -- --run test/feishu-diagnostics.service.spec.ts`
- `pnpm --filter @feishu-iam/api test -- --run test/feishu.controller.e2e-spec.ts test/feishu-diagnostics.service.spec.ts`
- `pnpm --filter @feishu-iam/admin-web test -- --run src/App.test.tsx`
- `pnpm check`

## 未完成事项和下一步建议

- 使用真实飞书凭证调用字段诊断接口。
- 按诊断结果补齐飞书后台只读字段权限。
- 触发真实同步并确认 `counts.activeUsers > 0`。
```

- [ ] **Step 6: Run docs placeholder scan**

Run:

```bash
rg -n "T[B]D|TO[D]O|待定|占位|xxx|XXX|replace_me|secret-token" README.md docs/feishu-identity-sync.md docs/codex-sessions
```

Expected: no new unresolved placeholders in edited docs. Existing safe examples such as `replace-with-local-admin-token` in documentation may remain only if they are clearly example values.

- [ ] **Step 7: Commit docs and version**

Run:

```bash
git add package.json README.md docs/feishu-identity-sync.md docs/codex-sessions
git commit -m "docs: document feishu field readiness"
```

## Task 7: Full Verification and Release Handoff

**Files:**
- No source changes expected.

- [ ] **Step 1: Run full project check**

Run:

```bash
pnpm check
```

Expected: typecheck, lint, API tests, and admin tests all PASS.

- [ ] **Step 2: Verify Docker Compose configuration**

Run:

```bash
docker compose -f deploy/docker-compose.yml config --quiet
```

Expected: command exits with status 0.

- [ ] **Step 3: Verify git state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -5
```

Expected: branch is `release/v0.2.1`; worktree is clean after commits; recent commits include diagnostics service, API, admin UI, and docs/version.

- [ ] **Step 4: Optional real Feishu validation**

Only run when real credentials are already available in the local environment. Do not print secrets.

```bash
curl -sS http://localhost:3000/api/v1/platform/feishu/field-diagnostics \
  -H "Authorization: Bearer ${PLATFORM_ADMIN_TOKEN}"
```

Expected: JSON response with `status`, `loginReadiness`, field matrices, and no secret values.

After a real sync:

```bash
curl -sS http://localhost:3000/api/v1/platform/feishu/status \
  -H "Authorization: Bearer ${PLATFORM_ADMIN_TOKEN}"
```

Expected for `v0.2.1` release readiness: `counts.activeUsers` is greater than `0`.

- [ ] **Step 5: Final commit if verification changed files**

If any formatting or generated files changed, commit them:

```bash
git add <changed-files>
git commit -m "chore: finalize v0.2.1 field readiness"
```

If no files changed, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks cover the stateless diagnostic API, backend field matrix, management UI card, sync refresh behavior, docs, version bump, readonly safety, and `activeUsers > 0` real release gate.
- Scope: The plan excludes IAM applications, permissions, SSO, Feishu roles, Feishu user groups, and persistence for diagnostics, matching the approved spec.
- Type consistency: Backend and frontend diagnostic status values match: `passed`, `warning`, `failed`, `not_configured`; field status values match: `present`, `empty`, `missing`, `not_sampled`.
- Placeholder scan: This plan intentionally avoids unresolved marker words and vague “handle later” steps. Any example placeholder strings are documented sample environment values, not unfinished work.
