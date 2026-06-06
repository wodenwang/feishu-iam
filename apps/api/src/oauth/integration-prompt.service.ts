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
