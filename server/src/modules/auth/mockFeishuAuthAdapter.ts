import { HttpError } from '../errors/httpError';
import type { FeishuAuthAdapter, FeishuUserIdentity } from './feishuAuthAdapter';

const validStatuses = new Set<FeishuUserIdentity['status']>(['active', 'disabled', 'resigned']);

export class MockFeishuAuthAdapter implements FeishuAuthAdapter {
  async resolveMockUser(input: unknown): Promise<FeishuUserIdentity> {
    if (!isRecord(input)) {
      throw new HttpError(400, 'INVALID_MOCK_FEISHU_USER', 'mock 飞书用户必须包含 feishuUserId 和 name');
    }

    const value = input as Partial<FeishuUserIdentity>;
    if (!isNonEmptyString(value.feishuUserId) || !isNonEmptyString(value.name)) {
      throw new HttpError(400, 'INVALID_MOCK_FEISHU_USER', 'mock 飞书用户必须包含 feishuUserId 和 name');
    }
    if (value.email !== undefined && typeof value.email !== 'string') {
      throw new HttpError(400, 'INVALID_MOCK_FEISHU_USER', 'mock 飞书用户 email 必须是字符串');
    }
    if (value.status !== undefined && !validStatuses.has(value.status)) {
      throw new HttpError(400, 'INVALID_MOCK_FEISHU_USER', 'mock 飞书用户状态无效');
    }

    return {
      feishuUserId: value.feishuUserId,
      name: value.name,
      email: value.email,
      status: value.status ?? 'active',
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
