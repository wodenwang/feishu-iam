import { HttpError } from '../errors/httpError';
import type { FeishuAuthAdapter, FeishuUserIdentity } from './feishuAuthAdapter';

export class MockFeishuAuthAdapter implements FeishuAuthAdapter {
  async resolveMockUser(input: unknown): Promise<FeishuUserIdentity> {
    const value = input as Partial<FeishuUserIdentity>;
    if (!value.feishuUserId || !value.name) {
      throw new HttpError(400, 'INVALID_MOCK_FEISHU_USER', 'mock 飞书用户必须包含 feishuUserId 和 name');
    }

    return {
      feishuUserId: value.feishuUserId,
      name: value.name,
      email: value.email,
      status: value.status ?? 'active',
    };
  }
}
