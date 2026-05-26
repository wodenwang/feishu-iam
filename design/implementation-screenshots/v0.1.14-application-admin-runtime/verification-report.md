# v0.1.14 Application Admin Runtime 验证报告

日期：2026-05-26

## 自动化验证

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_test npm run server:test -- server/tests/applicationAdmin.test.ts server/tests/applications.test.ts server/tests/roles.test.ts server/tests/audit.test.ts server/tests/requestContext.test.ts server/tests/migrations.test.ts
```

结果：通过。6 个测试文件，29 个测试通过。

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_test npm run server:test
```

结果：通过。18 个测试文件，78 个测试通过。

```bash
npm run server:build
```

结果：通过。TypeScript server 编译通过，SSR build 成功。

```bash
npm run build
```

结果：通过。前端 TypeScript 和 Vite build 成功；保留既有 chunk size warning。

```bash
npm test
```

结果：通过。25 个测试文件，117 个测试通过。jsdom 输出 Ant Design `getComputedStyle` pseudo-elements 提示，不影响测试结果。

```bash
git diff --check
```

结果：通过。无 whitespace error。

## 浏览器验证

工具：Playwright MCP browser。

验证路径：

1. 启动本地 API：`http://127.0.0.1:4100/api/health` 返回 `{"ok":true}`。
2. 启动本地前端：`http://127.0.0.1:5173`。
3. 用 mock API 创建飞书用户、平台管理员和带应用管理员 owner 的测试应用。
4. 浏览器以应用管理员身份登录并打开 `/applications`。
5. 校验 session 返回：
   - `roles: ["application_admin"]`
   - `permissions` 不包含 `directory:view`、`sync:run`
   - `applicationIds` 只包含当前应用。
6. 校验侧边栏仅显示 `应用管理` 和 `角色授权`，不显示 `组织与用户`、全局 `审计日志`、`飞书同步`。
7. 浏览器 console error：0。

截图：

- `design/implementation-screenshots/v0.1.14-application-admin-runtime/app-admin-applications.png`

## Review Loop Metrics

- design-review：循环 1 次，发现 0 个阻塞视觉问题，修复 0 个，剩余 0 个，状态 cleared。
- qa：循环 1 次，发现 2 个权限 UX 问题，修复 2 个，剩余 0 个，状态 cleared。
  - HTTP runtime 侧边栏绕过权限显示 `组织与用户`。
  - 应用管理员可看到全局 `审计日志` 菜单，但该页是全局审计入口。
- review：循环 1 次，发现 0 个高风险 diff 问题，修复 0 个，剩余 0 个，状态 cleared。
