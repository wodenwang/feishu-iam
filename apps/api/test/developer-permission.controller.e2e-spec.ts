import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeveloperCredentialService } from '../src/oauth/developer-credential.service';
import { AppModule } from '../src/app.module';
import { PermissionCatalogService } from '../src/permission/permission-catalog.service';
import { PermissionDomainError } from '../src/permission/permission.types';
import { PrismaService } from '../src/prisma/prisma.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorCode(body: unknown): unknown {
  const error = isRecord(body) ? body.error : undefined;
  return isRecord(error) ? error.code : undefined;
}

describe('DeveloperPermissionController', () => {
  let app: INestApplication;

  const credentials = {
    verifyBearerToken: vi.fn<DeveloperCredentialService['verifyBearerToken']>()
  };
  const catalog = {
    createPermissionPoint: vi.fn<PermissionCatalogService['createPermissionPoint']>(),
    listPermissionPoints: vi.fn<PermissionCatalogService['listPermissionPoints']>(),
    updatePermissionPoint: vi.fn<PermissionCatalogService['updatePermissionPoint']>(),
    setPermissionPointStatus: vi.fn<PermissionCatalogService['setPermissionPointStatus']>(),
    createPermissionGroup: vi.fn<PermissionCatalogService['createPermissionGroup']>(),
    listPermissionGroups: vi.fn<PermissionCatalogService['listPermissionGroups']>(),
    updatePermissionGroup: vi.fn<PermissionCatalogService['updatePermissionGroup']>(),
    setPermissionGroupStatus: vi.fn<PermissionCatalogService['setPermissionGroupStatus']>(),
    replacePermissionGroupPoints: vi.fn<PermissionCatalogService['replacePermissionGroupPoints']>()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        isReady: vi.fn().mockResolvedValue(true),
        $connect: vi.fn(),
        $disconnect: vi.fn()
      })
      .overrideProvider(DeveloperCredentialService)
      .useValue(credentials)
      .overrideProvider(PermissionCatalogService)
      .useValue(catalog)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    credentials.verifyBearerToken.mockResolvedValue({
      credentialId: 'developer-credential-finance',
      applicationId: 'app-finance',
      appKey: 'finance'
    });
    catalog.createPermissionPoint.mockImplementation((appKey, input) => Promise.resolve({
      id: 'point-1',
      applicationId: `app-${appKey}`,
      status: 'active',
      createdAt: new Date('2026-05-22T01:00:00.000Z'),
      updatedAt: new Date('2026-05-22T01:00:00.000Z'),
      ...input
    } as never));
    catalog.listPermissionPoints.mockResolvedValue([{ id: 'point-1', key: 'finance.invoice.view' }] as never);
    catalog.updatePermissionPoint.mockResolvedValue({ id: 'point-1', key: 'finance.invoice.view', name: '查看发票' } as never);
    catalog.setPermissionPointStatus.mockResolvedValue({ id: 'point-1', key: 'finance.invoice.view', status: 'disabled' } as never);
    catalog.createPermissionGroup.mockResolvedValue({ id: 'group-1', key: 'finance.invoice.admin', name: '发票管理员' } as never);
    catalog.listPermissionGroups.mockResolvedValue([{ id: 'group-1', key: 'finance.invoice.admin' }] as never);
    catalog.updatePermissionGroup.mockResolvedValue({ id: 'group-1', key: 'finance.invoice.admin', name: '费用管理员' } as never);
    catalog.setPermissionGroupStatus.mockResolvedValue({ id: 'group-1', key: 'finance.invoice.admin', status: 'disabled' } as never);
    catalog.replacePermissionGroupPoints.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('developer credential can create permission point for its application', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/permission-points')
      .set('Authorization', 'Bearer biad_finance')
      .send({ appKey: 'hr', key: 'finance.invoice.view', name: '查看发票' })
      .expect(201)
      .expect((response) => {
        expect(isRecord(response.body) ? response.body.key : undefined).toBe('finance.invoice.view');
      });

    expect(catalog.createPermissionPoint).toHaveBeenCalledWith(
      'finance',
      { key: 'finance.invoice.view', name: '查看发票' },
      expect.objectContaining({
        actorType: 'application_developer_credential',
        actorId: 'developer-credential-finance',
        source: 'developer_api'
      })
    );
  });

  it('developer credential can create permission point through app-scoped route', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/apps/finance/permission-points')
      .set('Authorization', 'Bearer biad_finance')
      .send({ key: 'finance.invoice.view', name: '查看发票' })
      .expect(201)
      .expect((response) => {
        expect(isRecord(response.body) ? response.body.key : undefined).toBe('finance.invoice.view');
      });

    expect(catalog.createPermissionPoint).toHaveBeenCalledWith(
      'finance',
      { key: 'finance.invoice.view', name: '查看发票' },
      expect.objectContaining({
        actorType: 'application_developer_credential',
        actorId: 'developer-credential-finance',
        source: 'developer_api'
      })
    );
  });

  it('rejects app-scoped route when path appKey does not match credential appKey', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/apps/hr/permission-points')
      .set('Authorization', 'Bearer biad_finance')
      .send({ key: 'hr.employee.view', name: '查看员工' })
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('DEVELOPER_PERMISSION_DENIED');
      });

    expect(catalog.createPermissionPoint).not.toHaveBeenCalled();
  });

  it('rejects permission point key for another application prefix', async () => {
    catalog.createPermissionPoint.mockRejectedValueOnce(
      new PermissionDomainError('PERMISSION_POINT_KEY_INVALID', '权限点 key 必须以应用 key 为前缀', 422)
    );
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/permission-points')
      .set('Authorization', 'Bearer biad_finance')
      .send({ key: 'hr.employee.view', name: '查看员工' })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PERMISSION_POINT_KEY_INVALID');
      });
  });

  it('can create, list, update, disable permission group and replace group points', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/permission-groups')
      .set('Authorization', 'Bearer biad_finance')
      .send({ key: 'finance.invoice.admin', name: '发票管理员' })
      .expect(201);
    await request(httpServer)
      .get('/api/v1/developer/permission-groups')
      .set('Authorization', 'Bearer biad_finance')
      .expect(200)
      .expect((response) => {
        expect(isRecord(response.body) ? response.body.items : undefined).toEqual([{ id: 'group-1', key: 'finance.invoice.admin' }]);
      });
    await request(httpServer)
      .patch('/api/v1/developer/permission-groups/group-1')
      .set('Authorization', 'Bearer biad_finance')
      .send({ name: '费用管理员' })
      .expect(200);
    await request(httpServer)
      .put('/api/v1/developer/permission-groups/group-1/points')
      .set('Authorization', 'Bearer biad_finance')
      .send({ pointIds: ['point-1'] })
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({ ok: true });
      });
    await request(httpServer)
      .post('/api/v1/developer/permission-groups/group-1/disable')
      .set('Authorization', 'Bearer biad_finance')
      .expect(201);

    expect(catalog.createPermissionGroup).toHaveBeenCalledWith('finance', expect.objectContaining({ key: 'finance.invoice.admin' }), expect.any(Object));
    expect(catalog.listPermissionGroups).toHaveBeenCalledWith('finance');
    expect(catalog.updatePermissionGroup).toHaveBeenCalledWith('finance', 'group-1', { name: '费用管理员' }, expect.any(Object));
    expect(catalog.replacePermissionGroupPoints).toHaveBeenCalledWith('finance', 'group-1', ['point-1'], expect.any(Object));
    expect(catalog.setPermissionGroupStatus).toHaveBeenCalledWith('finance', 'group-1', 'disabled', expect.any(Object));
  });

  it('can list app-scoped permission points and replace app-scoped group points', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/api/v1/developer/apps/finance/permission-points')
      .set('Authorization', 'Bearer biad_finance')
      .expect(200)
      .expect((response) => {
        expect(isRecord(response.body) ? response.body.items : undefined).toEqual([{ id: 'point-1', key: 'finance.invoice.view' }]);
      });

    await request(httpServer)
      .put('/api/v1/developer/apps/finance/permission-groups/group-1/points')
      .set('Authorization', 'Bearer biad_finance')
      .send({ pointIds: ['point-1'] })
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({ ok: true });
      });

    expect(catalog.listPermissionPoints).toHaveBeenCalledWith('finance');
    expect(catalog.replacePermissionGroupPoints).toHaveBeenCalledWith('finance', 'group-1', ['point-1'], expect.any(Object));
  });

  it('does not expose application configuration endpoints under developer API', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/redirect-uris')
      .set('Authorization', 'Bearer biad_finance')
      .send({ redirectUri: 'http://localhost:5173/callback' })
      .expect(404);
  });

  it('returns stable error when Bearer token is missing', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/permission-points')
      .send({ key: 'finance.invoice.view', name: '查看发票' })
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('DEVELOPER_CREDENTIAL_REQUIRED');
      });
  });

  it('uses credential context appKey instead of request body appKey for catalog calls', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/permission-groups')
      .set('Authorization', 'Bearer biad_finance')
      .send({ appKey: 'hr', key: 'finance.invoice.admin', name: '发票管理员' })
      .expect(201);

    expect(catalog.createPermissionGroup).toHaveBeenCalledWith(
      'finance',
      { key: 'finance.invoice.admin', name: '发票管理员' },
      expect.any(Object)
    );
  });

  it('rejects non-object body with stable permission error instead of 500', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post('/api/v1/developer/permission-points')
      .set('Authorization', 'Bearer biad_finance')
      .set('Content-Type', 'application/json')
      .send('[]')
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PERMISSION_POINT_BODY_INVALID');
      });
  });
});
