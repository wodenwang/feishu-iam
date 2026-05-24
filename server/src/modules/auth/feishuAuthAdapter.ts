export interface FeishuUserIdentity {
  feishuUserId: string;
  name: string;
  email?: string;
  status: 'active' | 'disabled' | 'resigned';
}

export interface FeishuAuthAdapter {
  resolveMockUser(input: unknown): Promise<FeishuUserIdentity>;
  buildAuthorizationUrl?(input: { state: string; redirectUri: string }): string;
  exchangeCodeForUser?(input: { code: string; redirectUri: string }): Promise<FeishuUserIdentity>;
}
