import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuditLogService } from '../src/permission/audit-log.service';

type AuditLogCreateArgs = {
  data: {
    before?: unknown;
    after?: unknown;
  };
};

function makePrisma(create: (args: AuditLogCreateArgs) => Promise<unknown>) {
  return {
    auditLog: {
      create
    }
  };
}

function baseParams() {
  return {
    actorType: 'feishu_user',
    actorId: 'ou_test',
    source: 'admin-web',
    resourceType: 'permission_point',
    resourceId: 'point-1',
    action: 'create',
    result: 'success' as const,
    requestId: 'req-1'
  };
}

describe('AuditLogService', () => {
  it('写入前归一化 JSON 安全的 before/after', async () => {
    const create = vi.fn<Parameters<typeof makePrisma>[0]>().mockResolvedValue({});
    const service = new AuditLogService(makePrisma(create) as never);
    const circular: Record<string, unknown> = { name: 'root' };
    circular.self = circular;
    const symbolValue = Symbol('hidden');

    await service.record({
      ...baseParams(),
      before: {
        kept: 'value',
        omitted: undefined,
        nil: null,
        date: new Date('2026-05-16T01:02:03.000Z'),
        bigint: 12n,
        fn: () => 'ignored',
        symbolValue,
        nested: {
          list: [undefined, () => 'ignored', symbolValue, 12n, new Date('2026-05-16T02:03:04.000Z')]
        },
        circular
      },
      after: undefined
    });

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[0].data.before).toEqual({
      kept: 'value',
      nil: null,
      date: '2026-05-16T01:02:03.000Z',
      bigint: '12',
      nested: {
        list: [null, null, null, '12', '2026-05-16T02:03:04.000Z']
      },
      circular: {
        name: 'root',
        self: '[Circular]'
      }
    });
    expect(create.mock.calls[0]?.[0].data.after).toBeUndefined();
  });

  it('顶层 null 会按 JSON null 写入', async () => {
    const create = vi.fn<Parameters<typeof makePrisma>[0]>().mockResolvedValue({});
    const service = new AuditLogService(makePrisma(create) as never);

    await service.record({
      ...baseParams(),
      before: null,
      after: { enabled: true }
    });

    expect(create.mock.calls[0]?.[0].data.before).toEqual(Prisma.JsonNull);
    expect(create.mock.calls[0]?.[0].data.after).toEqual({ enabled: true });
  });

  it('prisma 写入失败时不吞掉异常', async () => {
    const error = new Error('database unavailable');
    const create = vi.fn<Parameters<typeof makePrisma>[0]>().mockRejectedValue(error);
    const service = new AuditLogService(makePrisma(create) as never);

    await expect(service.record(baseParams())).rejects.toThrow(error);
  });
});
