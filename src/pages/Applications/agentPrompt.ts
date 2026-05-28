import type { Application, ApplicationRedirectUri } from '../../features/iam/types';

export interface AgentPromptSecrets {
  appSecret?: string;
  apiSecret?: string;
}

export function getIamBaseUrl() {
  if (typeof window === 'undefined') {
    return 'https://iam.example.com';
  }
  return window.location.origin;
}

export function buildApplicationPrompt(input: {
  application: Application;
  redirectUris: ApplicationRedirectUri[];
  oneTimeSecrets?: AgentPromptSecrets;
}) {
  const baseUrl = getIamBaseUrl();
  const activeRedirectUris = input.redirectUris.filter((item) => item.status === 'active').map((item) => item.redirectUri);
  const callbackList = activeRedirectUris.length ? activeRedirectUris : ['https://your-app.example.com/auth/callback'];
  const appSecret = input.oneTimeSecrets?.appSecret ?? '<FEISHU_IAM_APP_SECRET>';
  const apiSecret = input.oneTimeSecrets?.apiSecret ?? '<FEISHU_IAM_API_SECRET>';

  return [
    '你正在把一个第三方内部业务系统接入 feishu-iam。请在第三方项目中创建或更新 AGENTS.md 和 CLAUDE.md，并按本文完成 IAM 接入。',
    '',
    '目标：',
    '- 让第三方项目使用 feishu-iam / 飞书 SSO 完成登录。',
    '- 让第三方项目通过 Application API 注册权限组和权限点。',
    '- 让第三方项目通过 feishu-iam 查询当前用户权限，并用权限点控制页面、菜单、按钮和后端接口。',
    '- 让第三方项目内的 Codex / Claude Code 能从 AGENTS.md / CLAUDE.md 直接理解接入边界、接口和验收方法。',
    '',
    '硬性约束：',
    '- 只使用 feishu-iam / 飞书 SSO，不新增 username/password、本地超级管理员或绕过 IAM 的权限判断。',
    '- 不把真实 appSecret、apiSecret、token、飞书应用凭证提交到 Git。',
    '- 如果本提示词包含明文 secret，只能写入第三方项目的 .env、CI secret 或 secret manager。',
    '- AGENTS.md 和 CLAUDE.md 可以写变量名、接口、SOP 和验收命令，但不要写入真实 secret 明文。',
    '',
    '当前应用接入信息：',
    `- IAM_BASE_URL=${baseUrl}`,
    `- IAM_APP_KEY=${input.application.appKey}`,
    `- OAUTH_CLIENT_ID=${input.application.appKey}`,
    `- OAUTH_AUTHORIZE_ENDPOINT=${baseUrl}/api/oauth/authorize`,
    `- OAUTH_TOKEN_ENDPOINT=${baseUrl}/api/oauth/token`,
    `- APPLICATION_API_BASE=${baseUrl}/api/application`,
    `- CALLBACK_URLS=${callbackList.join(', ')}`,
    '',
    '第三方项目运行时环境变量：',
    `IAM_BASE_URL=${baseUrl}`,
    `IAM_APP_KEY=${input.application.appKey}`,
    `IAM_APP_SECRET=${appSecret}`,
    `IAM_API_SECRET=${apiSecret}`,
    '',
    'OAuth SOP：',
    `- 登录入口跳转到 GET /api/oauth/authorize，完整地址为 ${baseUrl}/api/oauth/authorize。`,
    '- authorize 请求必须携带 client_id、redirect_uri、state。',
    '- redirect_uri 必须已经在 feishu-iam 应用详情的 OAuth redirect URI 中启用。',
    `- callback 收到 code 和 state 后调用 POST /api/oauth/token，完整地址为 ${baseUrl}/api/oauth/token。`,
    '- token 请求使用 grant_type=authorization_code、code、redirect_uri、client_id 和 client_secret。',
    '- client_secret 从 IAM_APP_SECRET 读取。',
    '- 必须校验 state，处理 code 过期、code 重放、redirect_uri 不匹配、应用停用和未登录恢复。',
    '- 登录失败、token exchange 失败和无权限时必须提供可恢复提示和重新登录入口。',
    '',
    'Application API SOP：',
    `- 权限组注册：PUT /api/application/permission-groups，完整地址为 ${baseUrl}/api/application/permission-groups。`,
    `- 权限点注册：PUT /api/application/permission-points，完整地址为 ${baseUrl}/api/application/permission-points。`,
    `- 当前用户权限查询：GET /api/application/me/permissions，完整地址为 ${baseUrl}/api/application/me/permissions。`,
    '- 权限点命名采用 domain.resource:action，例如 crm.customer:read。',
    '- 前端路由、菜单、按钮和后端接口都必须根据 permissionCodes 做授权判断。',
    '',
    'Application API HMAC-SHA256 鉴权：',
    '- 每个 Application API 请求都必须带以下 header：',
    '  - x-fiam-app-key',
    '  - x-fiam-timestamp',
    '  - x-fiam-nonce',
    '  - x-fiam-body-sha256',
    '  - x-fiam-signature',
    '- x-fiam-app-key 使用 IAM_APP_KEY。',
    '- x-fiam-body-sha256 是原始请求体的 SHA-256 hex；GET 无 body 时使用空字符串的 SHA-256 hex。',
    '- x-fiam-signature 是用 IAM_API_SECRET 对 canonical string 做 HMAC-SHA256 hex。',
    '- timestamp 默认 5 分钟容忍窗口，nonce 不能重放。',
    '',
    'canonical string 格式：',
    '```text',
    'METHOD',
    'PATH',
    'NORMALIZED_QUERY',
    'TIMESTAMP',
    'NONCE',
    'BODY_SHA256_HEX',
    '```',
    '',
    '请写入第三方项目 AGENTS.md 和 CLAUDE.md 的内容：',
    '- 本项目使用 feishu-iam 作为唯一 IAM / SSO 来源。',
    '- 本项目不得新增本地账号密码登录或本地超级管理员。',
    '- 本项目运行依赖 IAM_BASE_URL、IAM_APP_KEY、IAM_APP_SECRET、IAM_API_SECRET。',
    '- 本项目权限点命名规范、权限注册入口、权限查询入口和 HMAC 签名规则。',
    '- 本项目 OAuth 登录、callback、token exchange、无权限页和重新登录 SOP。',
    '- 本项目本地验证命令和线上发布前验收清单。',
    '',
    '接入验收清单：',
    '- .env、CI secret 或 secret manager 已配置 IAM_BASE_URL、IAM_APP_KEY、IAM_APP_SECRET、IAM_API_SECRET。',
    '- feishu-iam 应用详情中实际 callback URL 已启用。',
    '- 第三方项目启动时或部署时能注册权限组和权限点。',
    '- feishu-iam 角色授权已把权限点绑定给目标飞书用户或部门。',
    '- 有权限用户可以完成 OAuth 登录并查到预期 permissionCodes。',
    '- 无权限用户进入可恢复的无权限页。',
    '- 审计日志能查到 OAuth token exchange、Application API 权限注册和权限查询 requestId。',
    '',
    '排障优先级：',
    '- OAuth 失败先检查 client_id、redirect_uri、state、IAM_APP_SECRET 和应用状态。',
    '- HMAC 失败先检查 x-fiam-body-sha256、canonical string、timestamp、nonce 和 IAM_API_SECRET。',
    '- 权限为空先检查权限点是否注册、角色是否授权、飞书用户是否已同步、部门绑定是否命中。',
    '- 排障材料只能包含 requestId、appKey、endpoint、权限 code 和脱敏配置状态，不要附带 secret、token、cookie 或 authorization code。',
  ].join('\n');
}
