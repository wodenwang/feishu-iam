# feishu-iam third-party demo

这是一个最小第三方业务系统 Demo，用来验证：

- 第三方系统跳转到 `feishu-iam` 发起 OAuth 登录。
- 如果浏览器未登录 IAM，IAM 登录成功后会恢复原始 OAuth 请求。
- `feishu-iam` 返回 authorization code。
- Demo 用 `IAM_APP_SECRET` 换取短期 bearer token。
- Demo 使用 Application API HMAC 签名查询当前用户权限点。
- 页面根据 `demo.customer:view` 显示客户列表或 403。

## 环境变量

复制 `.env.example` 后填入应用创建时返回的一次性 secret：

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

## 启动

```bash
npm --prefix examples/thirdparty-demo run dev
```

打开：

```text
http://127.0.0.1:4200
```

如果浏览器还没有 `feishu-iam` 登录态，OAuth authorize 会要求先登录 IAM；登录成功后会自动回到 Demo callback。开发环境可以先在 Admin Console 使用本地 mock 飞书登录，mock 登录也会返回 pending OAuth 的 `redirectTo` 供本地验证。

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
