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
    expect(prompt).toContain('http://localhost:5173/auth/callback');
    expect(prompt).toContain('/oauth/authorize');
    expect(prompt).toContain('/oauth/token');
    expect(prompt).toContain('/oauth/userinfo');
    expect(prompt).toContain('/api/v1/apps/finance/me/permissions');
    expect(prompt).toContain('/api/v1/developer/apps/finance/permission-points');
    expect(prompt).toContain('/api/v1/developer/apps/finance/permission-groups/{group_id}/points');
    expect(prompt).toContain('只能维护本应用的权限点、权限组和权限组权限点绑定');
    expect(prompt).toContain('权限点 key 必须以 finance. 开头');
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
    expect(prompt).toContain('client_secret: <请在 Feishu IAM 中轮换登录凭证后填入>');
    expect(prompt).toContain('developer_api_token: <请在 Feishu IAM 中轮换开发者 API 凭证后填入>');
    expect(prompt).not.toContain('bics_secret');
    expect(prompt).not.toContain('biad_secret');
  });
});
