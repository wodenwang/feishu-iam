import { describe, expect, it, vi } from 'vitest';
import { SecurityEventService, type SecurityEventInput } from '../src/oauth/security-event.service';

type SecurityEventCreateArgs = {
  data: {
    id: string;
    eventType: string;
    applicationId: string | null;
    clientId: string | null;
    feishuUserId: string | null;
    result: string;
    reasonCode: string | null;
    summary: string;
    ip: string | null;
    userAgent: string | null;
    requestId: string | null;
  };
};

function makePrisma(create: (args: SecurityEventCreateArgs) => Promise<unknown>) {
  return {
    securityEvent: {
      create
    }
  };
}

describe('SecurityEventService', () => {
  it('maps input fields and fills missing optional fields with null', async () => {
    const create = vi.fn<Parameters<typeof makePrisma>[0]>().mockResolvedValue({});
    const service = new SecurityEventService(makePrisma(create) as never);
    const input: SecurityEventInput = {
      eventType: 'oauth.token.failed',
      clientId: 'client-1',
      result: 'failed',
      reasonCode: 'CLIENT_SECRET_INVALID',
      summary: 'client secret 校验失败',
      ip: '127.0.0.1'
    };

    await service.record(input);

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      eventType: 'oauth.token.failed',
      applicationId: null,
      clientId: 'client-1',
      feishuUserId: null,
      result: 'failed',
      reasonCode: 'CLIENT_SECRET_INVALID',
      summary: 'client secret 校验失败',
      ip: '127.0.0.1',
      userAgent: null,
      requestId: null
    });
    expect(create.mock.calls[0]?.[0].data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
