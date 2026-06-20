import { Injectable } from '@nestjs/common';
import type { FullIntegrationPromptInput, IntegrationPromptInput } from './oauth.types';

@Injectable()
export class IntegrationPromptService {
  generateFullPrompt(input: FullIntegrationPromptInput): string {
    return buildPrompt(input, {
      clientSecret: input.clientSecret,
      developerApiToken: input.developerApiToken
    });
  }

  generateSafePrompt(input: IntegrationPromptInput): string {
    return buildPrompt(input, {
      clientSecret: '<请在 Feishu IAM 中轮换登录凭证后填入>',
      developerApiToken: '<请在 Feishu IAM 中轮换开发者 API 凭证后填入>',
      safeNotice: '如需完整提示词，请轮换登录凭证和开发者 API 凭证。'
    });
  }
}

function buildPrompt(
  input: IntegrationPromptInput,
  secrets: { clientSecret: string; developerApiToken: string; safeNotice?: string }
): string {
  const redirectList = input.redirectUris.map((uri) => `- ${uri}`).join('\n');

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

OAuth 登录和权限 API：
1. 浏览器跳转到 ${input.baseIamUrl}/oauth/authorize，携带 response_type=code、client_id、redirect_uri、state、scope。
2. 第三方后端在回调地址收到 code 后，调用 ${input.baseIamUrl}/oauth/token 换取 access token。
3. 使用 access token 调用 ${input.baseIamUrl}/oauth/userinfo 获取用户信息。
4. 使用 access token 调用 ${input.baseIamUrl}/api/v1/apps/${input.appKey}/me/permissions 获取权限组和权限点。

开发者 API 权限边界：
- 使用 Authorization: Bearer <developer_api_token>。
- 只能维护本应用的权限点、权限组和权限组权限点绑定。
- 不能修改应用配置、回调地址、登录凭证、角色授权或管理员授权。
- 权限点 key 必须以 ${input.appKey}. 开头。
- 权限点接口使用 ${input.baseIamUrl}/api/v1/developer/apps/${input.appKey}/permission-points。
- 权限组接口使用 ${input.baseIamUrl}/api/v1/developer/apps/${input.appKey}/permission-groups。
- 权限组绑定接口使用 ${input.baseIamUrl}/api/v1/developer/apps/${input.appKey}/permission-groups/{group_id}/points。

${buildScenarioPreset(input)}

接入预检：
- Feishu IAM 中至少存在 1 个启用的 Redirect URI，且第三方后端配置的 redirect_uri 必须逐字精确匹配。
- Feishu IAM 中至少存在 1 个启用的 OAuth 登录凭证。
- Feishu IAM 中至少存在 1 个 developer API 凭证。
- 如果本提示词来自“刷新凭证并生成完整提示词”，旧 client_secret 和 developer_api_token 会立即失效，第三方项目必须同步更新后端 env 或密钥系统。
- 排障只需要复制 request id；不要复制 token、cookie、authorization、授权码或整段问题信息。

安全要求：
- 不要把 client_secret、developer_api_token、authorization code、access token、cookie 或密码写入仓库、日志、截图、聊天消息、测试快照或会话归档。
- 不要在前端代码中保存 client_secret 或 developer_api_token。
- 回调地址必须精确匹配，http 地址按 http 登记，https 地址按 https 登记。

验收 checklist：
- 可以完成 Feishu IAM 登录并回到登记的 redirect_uri。
- 后端可以用 code 换取 access token。
- 可以读取 /oauth/userinfo。
- 可以读取 /api/v1/apps/${input.appKey}/me/permissions。
- 可以用开发者 API 创建或更新本应用权限点和权限组。
`;
}

function buildScenarioPreset(input: IntegrationPromptInput): string {
  if (input.appKey !== 'base-portal') {
    return `第三方应用接入约束：
- 第三方应用只对接 Feishu IAM，不直接绑定飞书 app_id 或 app_secret。
- Feishu IAM 只返回用户身份、权限组和权限点；菜单、按钮、接口和业务行为由第三方应用自行控制。
- 权限点建议按 ${input.appKey}.<module>.<action> 命名，并在第三方项目中集中维护权限点清单。`;
  }

  return `Base Portal preset：
- Portal 只负责入口编排、登录态和权限过滤，不替被嵌入的第三方系统做二次鉴权。
- 菜单打开方式必须显式标注为 iframe、immersive_iframe 或 new_tab。
- 推荐权限点：
  - base-portal.portal.access
  - base-portal.navigation.view
  - base-portal.menu.<menu_key>.open
  - base-portal.admin.sync-permissions
- Portal 菜单权限点必须通过 developer API 同步到 Feishu IAM，key 必须以 base-portal. 开头。
- iframe 无感验收必须覆盖：顶层访问、Portal 内嵌访问、未登录自动跳转、已登录无额外交互、失败页只复制 request id。
- iframe 内优先使用 /oauth/authorize?prompt=none 探测 Feishu IAM SSO session：成功时 302 回 redirect_uri 并携带 code/state；未登录时 302 回 redirect_uri 并携带 error=login_required/state；策略不允许时返回 error=unauthorized_client/state。
- prompt=none 不能渲染 IAM 登录页，不能要求 Base Portal 传 token、cookie、authorization code 或 secret；普通交互登录应在顶层窗口或 new_tab 发起。
- 如果第三方页面不允许 iframe 或浏览器 cookie 策略导致第三方自身 session 不可用，应把该菜单切换为 new_tab 或让第三方系统调整 frame/cookie 策略；Feishu IAM 本版本不实现 refresh token 或 iframe 专用 token 代理协议。`;
}
