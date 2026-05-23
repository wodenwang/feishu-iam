export interface FeishuUserIdentity {
  feishuUserId: string;
  name: string;
  email?: string;
  status: 'active' | 'disabled' | 'resigned';
}

export interface FeishuAuthAdapter {
  resolveMockUser(input: unknown): Promise<FeishuUserIdentity>;
}
