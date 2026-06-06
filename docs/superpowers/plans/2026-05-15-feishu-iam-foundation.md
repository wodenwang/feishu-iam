# Feishu IAM 基础工程实施计划

> **给 Agent 工作者：** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 初始化 Feishu IAM 第一阶段基础工程，让 API、管理端、PostgreSQL、Prisma、Docker Compose、健康检查和文档归档机制形成可运行骨架。

**架构：** 使用 pnpm workspace 管理 `apps/api` 和 `apps/admin-web`。API 使用 NestJS 暴露 `/health`、`/ready`、`/version`，并通过 Prisma 验证数据库连接；管理端使用 React + Vite 调用 API 展示运行状态。Docker Compose 启动 PostgreSQL 和 API，后续业务模块在这个底座上增量实现。

**技术栈：** pnpm、TypeScript、NestJS、React、Vite、Prisma、PostgreSQL、Docker Compose、Vitest、Supertest。

---

## 范围说明

完整 Feishu IAM 设计包含飞书同步、SSO、权限模型、开放 API、管理后台、审计和升级体系。该设计过大，不适合放进一个实施计划。本计划只覆盖第一阶段基础工程，要求产出可运行、可测试、可继续扩展的软件骨架。

后续应继续拆分为这些独立计划：

- 飞书主数据同步计划。
- 应用、权限组、权限点与 IAM 角色计划。
- SSO 授权码流程计划。
- 管理后台核心页面计划。
- 审计与平台 API 计划。
- 发布、镜像与升级计划。

## 文件结构与职责

- `package.json`：根工作区脚本和基础开发依赖。
- `pnpm-workspace.yaml`：pnpm workspace 范围。
- `tsconfig.base.json`：前后端共享 TypeScript 基础配置。
- `eslint.config.mjs`：前后端共享 ESLint flat config。
- `.editorconfig`：统一编辑器格式。
- `.env.example`：开发环境变量样例，不包含真实密钥。
- `.gitignore`：忽略依赖、构建产物、环境文件和临时目录。
- `apps/api/package.json`：API 服务依赖与脚本。
- `apps/api/src/main.ts`：NestJS API 启动入口。
- `apps/api/src/app.module.ts`：API 根模块。
- `apps/api/src/health/health.controller.ts`：`/health` 和 `/ready`。
- `apps/api/src/version/version.controller.ts`：`/version`。
- `apps/api/src/prisma/prisma.service.ts`：Prisma 生命周期与数据库探测。
- `apps/api/test/health.e2e-spec.ts`：API 健康检查端到端测试。
- `apps/api/prisma/schema.prisma`：Prisma 基础 schema。
- `apps/admin-web/package.json`：管理端依赖与脚本。
- `apps/admin-web/index.html`：Vite HTML 入口。
- `apps/admin-web/src/main.tsx`：React 入口。
- `apps/admin-web/src/App.tsx`：管理端状态页。
- `apps/admin-web/src/api/status.ts`：API 状态调用。
- `apps/admin-web/src/App.test.tsx`：管理端基础测试。
- `deploy/docker-compose.yml`：本地 Docker Compose。
- `deploy/api.Dockerfile`：API 镜像构建。
- `deploy/upgrade.sh`：第一版升级脚本骨架，包含版本检查和 ready check。
- `docs/codex-sessions/README.md`：Codex 会话归档说明。

---

### Task 1: 初始化根工作区配置

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `.editorconfig`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: 写入根 `package.json`**

创建 `package.json`：

```json
{
  "name": "feishu-iam",
  "version": "0.1.0",
  "private": true,
  "description": "企业内部身份与权限管理中台",
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "pnpm --parallel --filter @feishu-iam/api --filter @feishu-iam/admin-web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md,yml,yaml}\"",
    "check": "pnpm typecheck && pnpm lint && pnpm test"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "eslint": "^9.17.0",
    "globals": "^15.14.0",
    "prettier": "^3.4.2",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.2"
  }
}
```

- [ ] **Step 2: 写入 workspace 配置**

创建 `pnpm-workspace.yaml`：

```yaml
packages:
  - apps/*
```

- [ ] **Step 3: 写入 TypeScript 基础配置**

创建 `tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

- [ ] **Step 4: 写入 ESLint 配置**

创建 `eslint.config.mjs`：

```js
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'apps/admin-web/dist/**']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  }))
);
```

- [ ] **Step 5: 写入编辑器配置**

创建 `.editorconfig`：

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 6: 写入环境变量样例**

创建 `.env.example`：

```dotenv
NODE_ENV=development
PORT=3000
PUBLIC_BASE_URL=http://localhost:3000
ADMIN_WEB_BASE_URL=http://localhost:5173

DATABASE_URL=<postgresql_database_url>

BOOTSTRAP_SUPER_ADMIN_USERNAME=admin
BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH=replace-with-bcrypt-hash

FEISHU_APP_ID=cli_replace_me
FEISHU_APP_SECRET=replace_me
FEISHU_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/feishu/callback
```

- [ ] **Step 7: 扩展 `.gitignore`**

把 `.gitignore` 改成：

```gitignore
.superpowers/

node_modules/
dist/
coverage/
.turbo/
.vite/

.env
.env.local
.env.*.local

*.log
pnpm-debug.log*

apps/api/generated/
```

- [ ] **Step 8: 安装依赖**

运行：

```bash
pnpm install
```

预期：生成 `pnpm-lock.yaml`，命令成功退出。

- [ ] **Step 9: 提交根工作区配置**

运行：

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs .editorconfig .env.example .gitignore pnpm-lock.yaml
git commit -m "chore: initialize pnpm workspace"
```

预期：生成一次根工作区初始化提交。

---

### Task 2: 初始化 NestJS API 骨架

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/version/version.controller.ts`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/test/health.e2e-spec.ts`
- Create: `apps/api/vitest.config.ts`

- [ ] **Step 1: 写 API package**

创建 `apps/api/package.json`：

```json
{
  "name": "@feishu-iam/api",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "test": "vitest run",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-express": "^10.4.15",
    "@prisma/client": "^6.1.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.8",
    "@nestjs/testing": "^10.4.15",
    "@types/express": "^5.0.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^8.18.2",
    "@typescript-eslint/parser": "^8.18.2",
    "eslint": "^9.17.0",
    "prisma": "^6.1.0",
    "supertest": "^7.0.0",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 写 API TypeScript 配置**

创建 `apps/api/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "types": ["node", "vitest"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"]
}
```

创建 `apps/api/tsconfig.build.json`：

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["test", "dist", "node_modules", "**/*.spec.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: 写 Prisma 服务**

创建 `apps/api/src/prisma/prisma.service.ts`：

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async isReady(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }
}
```

- [ ] **Step 4: 写健康检查控制器**

创建 `apps/api/src/health/health.controller.ts`：

```ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type HealthResponse = {
  status: 'ok';
  service: 'feishu-iam-api';
};

type ReadyResponse = {
  status: 'ready' | 'not_ready';
  checks: {
    database: 'ok' | 'error';
  };
};

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health(): HealthResponse {
    return {
      status: 'ok',
      service: 'feishu-iam-api'
    };
  }

  @Get('ready')
  async ready(): Promise<ReadyResponse> {
    try {
      await this.prisma.isReady();
      return {
        status: 'ready',
        checks: {
          database: 'ok'
        }
      };
    } catch {
      return {
        status: 'not_ready',
        checks: {
          database: 'error'
        }
      };
    }
  }
}
```

- [ ] **Step 5: 写版本控制器**

创建 `apps/api/src/version/version.controller.ts`：

```ts
import { Controller, Get } from '@nestjs/common';

type VersionResponse = {
  name: 'feishu-iam-api';
  version: string;
  commit: string;
  node_env: string;
};

@Controller()
export class VersionController {
  @Get('version')
  version(): VersionResponse {
    return {
      name: 'feishu-iam-api',
      version: process.env.APP_VERSION ?? '0.1.0-dev',
      commit: process.env.GIT_COMMIT ?? 'local',
      node_env: process.env.NODE_ENV ?? 'development'
    };
  }
}
```

- [ ] **Step 6: 写 Nest 根模块和启动入口**

创建 `apps/api/src/app.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';
import { VersionController } from './version/version.controller';

@Module({
  controllers: [HealthController, VersionController],
  providers: [PrismaService]
})
export class AppModule {}
```

创建 `apps/api/src/main.ts`：

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:5173',
    credentials: true
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
```

- [ ] **Step 7: 写 API 测试配置**

创建 `apps/api/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts']
  }
});
```

- [ ] **Step 8: 写健康检查端到端测试**

创建 `apps/api/test/health.e2e-spec.ts`：

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('基础健康检查', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        isReady: vi.fn().mockResolvedValue(true),
        $connect: vi.fn(),
        $disconnect: vi.fn()
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health 返回 API 进程健康', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'feishu-iam-api'
      });
  });

  it('GET /ready 返回数据库就绪状态', async () => {
    await request(app.getHttpServer())
      .get('/ready')
      .expect(200)
      .expect({
        status: 'ready',
        checks: {
          database: 'ok'
        }
      });
  });
});
```

- [ ] **Step 9: 安装并运行 API 测试**

运行：

```bash
pnpm install
pnpm --filter @feishu-iam/api test
pnpm --filter @feishu-iam/api typecheck
```

预期：测试和类型检查通过。

- [ ] **Step 10: 提交 API 骨架**

运行：

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat: add api service skeleton"
```

预期：生成 API 骨架提交。

---

### Task 3: 初始化 Prisma 与数据库基线

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `migrations/V0_1_0__baseline.sql`
- Modify: `apps/api/package.json`

- [ ] **Step 1: 写 Prisma schema**

创建 `apps/api/prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model SystemSetting {
  key       String   @id
  value     Json
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("system_settings")
}

model SchemaVersion {
  version     String   @id
  description String
  appliedAt   DateTime @default(now()) @map("applied_at")

  @@map("schema_versions")
}
```

- [ ] **Step 2: 写 SQL 基线迁移**

创建 `migrations/V0_1_0__baseline.sql`：

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_versions (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_versions (version, description)
VALUES ('0.1.0', '基础工程基线')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 3: 给 API package 增加 Prisma 脚本**

修改 `apps/api/package.json` 的 `scripts`，加入：

```json
{
  "prisma:generate": "prisma generate",
  "prisma:format": "prisma format",
  "prisma:validate": "prisma validate"
}
```

最终 `scripts` 至少包含：

```json
{
  "dev": "nest start --watch",
  "build": "nest build",
  "start": "node dist/main.js",
  "test": "vitest run",
  "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "prisma:generate": "prisma generate",
  "prisma:format": "prisma format",
  "prisma:validate": "prisma validate"
}
```

- [ ] **Step 4: 生成 Prisma Client 并验证 schema**

运行：

```bash
pnpm --filter @feishu-iam/api prisma:format
pnpm --filter @feishu-iam/api prisma:validate
pnpm --filter @feishu-iam/api prisma:generate
```

预期：Prisma schema 有效，并生成 client。

- [ ] **Step 5: 提交数据库基线**

运行：

```bash
git add apps/api/prisma/schema.prisma apps/api/package.json migrations/V0_1_0__baseline.sql pnpm-lock.yaml
git commit -m "feat: add database baseline"
```

预期：生成数据库基线提交。

---

### Task 4: 初始化 React 管理端骨架

**Files:**
- Create: `apps/admin-web/package.json`
- Create: `apps/admin-web/tsconfig.json`
- Create: `apps/admin-web/vite.config.ts`
- Create: `apps/admin-web/index.html`
- Create: `apps/admin-web/src/main.tsx`
- Create: `apps/admin-web/src/App.tsx`
- Create: `apps/admin-web/src/App.css`
- Create: `apps/admin-web/src/api/status.ts`
- Create: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 写管理端 package**

创建 `apps/admin-web/package.json`：

```json
{
  "name": "@feishu-iam/admin-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@typescript-eslint/eslint-plugin": "^8.18.2",
    "@typescript-eslint/parser": "^8.18.2",
    "eslint": "^9.17.0",
    "jsdom": "^25.0.1",
    "vite": "^6.0.6",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 写管理端 TypeScript 与 Vite 配置**

创建 `apps/admin-web/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

创建 `apps/admin-web/vite.config.ts`：

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/ready': 'http://localhost:3000',
      '/version': 'http://localhost:3000'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: []
  }
});
```

- [ ] **Step 3: 写 HTML 和 React 入口**

创建 `apps/admin-web/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Feishu IAM 管理后台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

创建 `apps/admin-web/src/main.tsx`：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './App.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: 写状态 API 客户端**

创建 `apps/admin-web/src/api/status.ts`：

```ts
export type ApiStatus = {
  health: 'ok' | 'error';
  ready: 'ready' | 'not_ready' | 'error';
  version: string;
};

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchApiStatus(): Promise<ApiStatus> {
  const [health, ready, version] = await Promise.all([
    readJson<{ status: 'ok' }>('/health'),
    readJson<{ status: 'ready' | 'not_ready' }>('/ready'),
    readJson<{ version: string }>('/version')
  ]);

  return {
    health: health.status,
    ready: ready.status,
    version: version.version
  };
}
```

- [ ] **Step 5: 写管理端首页**

创建 `apps/admin-web/src/App.tsx`：

```tsx
import { Activity, Database, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiStatus, fetchApiStatus } from './api/status';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; data: ApiStatus }
  | { status: 'failed'; message: string };

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    void fetchApiStatus()
      .then((data) => setState({ status: 'loaded', data }))
      .catch((error: unknown) =>
        setState({
          status: 'failed',
          message: error instanceof Error ? error.message : '无法读取 API 状态'
        })
      );
  }, []);

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Feishu IAM</p>
          <h1>管理后台骨架</h1>
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
```

- [ ] **Step 6: 写管理端样式**

创建 `apps/admin-web/src/App.css`：

```css
:root {
  color: #18212f;
  background: #f6f8fb;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

body {
  margin: 0;
}

.page {
  min-height: 100vh;
  padding: 32px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1120px;
  margin: 0 auto 28px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #526172;
  font-size: 13px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 28px;
  font-weight: 700;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  max-width: 1120px;
  margin: 0 auto;
}

.status-card {
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 112px;
  padding: 18px;
  border: 1px solid #d9e1ea;
  border-radius: 8px;
  background: #ffffff;
}

.status-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  color: #155eef;
  background: #eef4ff;
}

.status-card h2 {
  margin-bottom: 8px;
  color: #526172;
  font-size: 14px;
  font-weight: 600;
}

.status-card p {
  font-size: 20px;
  font-weight: 700;
}

.error {
  max-width: 1120px;
  margin: 18px auto 0;
  color: #b42318;
}

@media (max-width: 760px) {
  .page {
    padding: 20px;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: 写管理端测试**

创建 `apps/admin-web/src/App.test.tsx`：

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('管理后台骨架', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('展示 API 状态', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url === '/health') {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok' })));
      }
      if (url === '/ready') {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ready' })));
      }
      if (url === '/version') {
        return Promise.resolve(new Response(JSON.stringify({ version: '0.1.0-dev' })));
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('0.1.0-dev')).toBeInTheDocument();
    });
    expect(screen.getByText('API 进程')).toBeInTheDocument();
    expect(screen.getByText('数据库就绪')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: 安装并验证管理端**

运行：

```bash
pnpm install
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web build
```

预期：测试、类型检查和构建通过。

- [ ] **Step 9: 提交管理端骨架**

运行：

```bash
git add apps/admin-web package.json pnpm-lock.yaml
git commit -m "feat: add admin web skeleton"
```

预期：生成管理端骨架提交。

---

### Task 5: 增加 Docker Compose 与升级脚本骨架

**Files:**
- Create: `deploy/docker-compose.yml`
- Create: `deploy/api.Dockerfile`
- Create: `deploy/upgrade.sh`
- Modify: `package.json`

- [ ] **Step 1: 写 API Dockerfile**

创建 `deploy/api.Dockerfile`：

```dockerfile
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @feishu-iam/api prisma:generate
RUN pnpm --filter @feishu-iam/api build
RUN pnpm --filter @feishu-iam/admin-web build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/admin-web/dist ./apps/admin-web/dist
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```

- [ ] **Step 2: 写 Docker Compose**

创建 `deploy/docker-compose.yml`：

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: feishu-iam-postgres
    environment:
      POSTGRES_DB: feishu_iam
      POSTGRES_USER: feishu_iam
      POSTGRES_PASSWORD: feishu_iam_dev
    ports:
      - "5432:5432"
    volumes:
      - feishu_iam_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U feishu_iam -d feishu_iam"]
      interval: 5s
      timeout: 3s
      retries: 20

  api:
    build:
      context: ..
      dockerfile: deploy/api.Dockerfile
    container_name: feishu-iam-api
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: <postgresql_database_url>
      ADMIN_WEB_BASE_URL: http://localhost:3000
      APP_VERSION: 0.1.0
      GIT_COMMIT: local
    ports:
      - "3000:3000"

volumes:
  feishu_iam_pgdata:
```

- [ ] **Step 3: 写升级脚本骨架**

创建 `deploy/upgrade.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/docker-compose.yml"
BACKUP_DIR="${ROOT_DIR}/backups/$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"

echo "==> Feishu IAM upgrade started"
echo "==> Backup directory: ${BACKUP_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found" >&2
  exit 1
fi

echo "==> Pulling images when available"
docker compose -f "${COMPOSE_FILE}" pull || true

echo "==> Starting postgres"
docker compose -f "${COMPOSE_FILE}" up -d postgres

echo "==> Creating database backup"
docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_dump -U feishu_iam feishu_iam > "${BACKUP_DIR}/feishu_iam.sql"

echo "==> Rebuilding and restarting API"
docker compose -f "${COMPOSE_FILE}" up -d --build api

echo "==> Checking readiness"
for i in {1..60}; do
  if curl -fsS http://localhost:3000/ready >/dev/null; then
    echo "==> Feishu IAM is ready"
    exit 0
  fi
  sleep 2
done

echo "Feishu IAM did not become ready. Backup is at ${BACKUP_DIR}" >&2
exit 1
```

- [ ] **Step 4: 给脚本增加执行权限**

运行：

```bash
chmod +x deploy/upgrade.sh
```

预期：`deploy/upgrade.sh` 可执行。

- [ ] **Step 5: 给根 package 增加 compose 脚本**

修改根 `package.json` 的 `scripts`，加入：

```json
{
  "compose:up": "docker compose -f deploy/docker-compose.yml up -d --build",
  "compose:down": "docker compose -f deploy/docker-compose.yml down",
  "compose:logs": "docker compose -f deploy/docker-compose.yml logs -f"
}
```

- [ ] **Step 6: 构建并启动 compose**

运行：

```bash
pnpm compose:up
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:3000/version
```

预期：`/health` 返回 `{"status":"ok","service":"feishu-iam-api"}`，`/version` 返回版本 JSON。

- [ ] **Step 7: 停止 compose**

运行：

```bash
pnpm compose:down
```

预期：容器停止，命令成功。

- [ ] **Step 8: 提交部署骨架**

运行：

```bash
git add deploy/docker-compose.yml deploy/api.Dockerfile deploy/upgrade.sh package.json
git commit -m "feat: add docker compose foundation"
```

预期：生成部署骨架提交。

---

### Task 6: 增加 Codex 会话归档目录与基础验证

**Files:**
- Create: `docs/codex-sessions/README.md`
- Modify: `README.md`

- [ ] **Step 1: 创建会话归档说明**

创建 `docs/codex-sessions/README.md`：

```markdown
# Codex 会话归档

本目录用于归档每个重要独立 Codex 会话的摘要，便于未来追溯项目决策、提示词约束、实施计划、代码变更和验证结果。

## 命名规则

```text
YYYY-MM-DD-HHMM-简短主题.md
```

## 摘要结构

每份摘要至少包含：

- 会话目标。
- 用户原始关键要求摘要。
- 本次会话使用或形成的关键提示词/约束。
- 重要设计决策和原因。
- 修改过的文件。
- 执行过的关键命令和验证结果。
- 未完成事项和下一步建议。

## 安全要求

- 必须使用中文。
- 不记录明文密钥、token、cookie、密码或其他敏感凭证。
- 如果用户要求不归档某段敏感内容，以用户要求为准。
```

- [ ] **Step 2: 在 README 增加会话归档入口**

修改 `README.md`，在“设计文档”之后增加：

```markdown
## Codex 会话归档

重要独立会话需要归档到：

- [docs/codex-sessions](docs/codex-sessions)

归档规则见 [AGENTS.md](AGENTS.md)。
```

- [ ] **Step 3: 运行全量检查**

运行：

```bash
pnpm check
pnpm --filter @feishu-iam/api prisma:validate
```

预期：类型检查、lint、测试、Prisma 校验全部通过。

- [ ] **Step 4: 检查文档占位符和临时目录**

运行：

```bash
rg -n "lorem|占位符" README.md AGENTS.md docs apps deploy migrations
git status --short
```

预期：`rg` 没有发现未处理占位符；`git status --short` 只显示本任务预期文件。

- [ ] **Step 5: 提交文档归档机制**

运行：

```bash
git add README.md docs/codex-sessions/README.md
git commit -m "docs: add codex session archive directory"
```

预期：生成文档归档机制提交。

---

## 自检记录

- 设计覆盖：本计划覆盖设计文档中的技术栈、基础部署、健康检查、Prisma/PostgreSQL、管理端骨架、中文文档和 Codex 会话归档要求。
- 暂不覆盖：飞书同步、SSO 授权码流程、权限计算、应用管理、审计写入、平台 API。这些属于后续独立实施计划。
- 占位符检查：计划正文未使用未处理占位符。
- 类型一致性：API 使用 NestJS + PrismaService；管理端通过 `/health`、`/ready`、`/version` 调用 API；Docker Compose 暴露同一端口。
