# feishu-iam third-party demo

这是一个最小第三方业务系统 Demo，用来验证：

- 第三方系统跳转到 `feishu-iam` 发起 OAuth 登录。
- 如果浏览器未登录 IAM，IAM 登录成功后会恢复原始 OAuth 请求。
- `feishu-iam` 返回 authorization code。
- Demo 用 `IAM_APP_SECRET` 换取短期 bearer token。
- Demo 使用 Application API HMAC 签名查询当前用户权限点。
- 页面根据 `demo.customer:view` 显示客户列表或 403。

## 环境变量

OAuth mode 是当前版本的默认验收路径。复制 `.env.example` 后填入应用创建时返回的一次性 secret：

```bash
cp examples/thirdparty-demo/.env.example examples/thirdparty-demo/.env
```

需要的变量：

- `IAM_BASE_URL`: `feishu-iam` 后端地址，例如 `http://127.0.0.1:4100`
- `DEMO_BASE_URL`: Demo 自己的访问地址，例如 `http://127.0.0.1:4200`
- `IAM_APP_KEY`: 应用详情里的 `appKey`
- `IAM_APP_SECRET`: 创建应用时一次性返回的 `appSecret`
- `IAM_API_SECRET`: 创建应用时一次性返回的 `apiSecret`

不要把 `.env` 或真实 secret 提交到 Git。

如果只是想先验证 IAM runtime 主链路，可以先运行仓库根目录的自动验收脚本：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
bash scripts/verify-v0.2-application-onboarding.sh
```

`v0.2.0` 脚本会验证 redirect URI 启停、OAuth active URI 校验、`appSecret` / `apiSecret` 轮换、旧 secret 失效、新 secret 生效、应用管理员维护和配置审计。脚本不会打印 `IAM_APP_SECRET`、`IAM_API_SECRET`、cookie、authorization code、bearer token 或 HMAC signature。

如需验证 v0.1 OAuth + 权限授权完整链路，也可以运行：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
bash scripts/verify-v0.1-access-loop.sh
```

v0.1 脚本会自动创建临时应用并验证 OAuth、权限注册、角色授权、allow/deny 权限查询和审计回溯。脚本输出的 `appKey` 只用于定位本次验收，不会打印 `IAM_APP_SECRET`、`IAM_API_SECRET` 或 bearer token。

建议在干净数据库中运行该脚本，或使用已经由 `ou_v017_verify_admin` 完成首次平台管理员绑定的本地测试库。

## 启动

```bash
npm --prefix examples/thirdparty-demo run dev
```

打开：

```text
http://127.0.0.1:4200
```

如果浏览器还没有 `feishu-iam` 登录态，OAuth authorize 会要求先登录 IAM；登录成功后会自动回到 Demo callback。开发环境可以先在 Admin Console 使用本地 mock 飞书登录，mock 登录也会返回 pending OAuth 的 `redirectTo` 供本地验证。

有 `demo.customer:view` 权限的飞书用户应看到客户列表；没有该权限的飞书用户应进入 403 页面。生产接入时必须使用 OAuth mode，不能依赖 mock fallback。

在 v0.2.0 中，Demo redirect URI 必须在应用详情 `接入配置` 中保持启用；停用后 OAuth authorize 会失败。轮换 `appSecret` 或 `apiSecret` 后，需要立即同步更新 Demo 运行环境变量，旧 secret 不应继续可用。真实飞书环境还需要在飞书开放平台手动配置 redirect URI、通讯录读取权限和部署环境白名单。

## 本地 mock fallback

历史 mock 模式仍保留，便于单独验证权限查询：

```bash
DEMO_AUTH_MODE=mock \
IAM_BASE_URL=http://127.0.0.1:4100 \
IAM_APP_KEY=<app-key> \
IAM_API_SECRET=<api-secret> \
npm --prefix examples/thirdparty-demo run dev
```

mock 模式不代表生产登录路径；生产接入必须使用 OAuth mode。
