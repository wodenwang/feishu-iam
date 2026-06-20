import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { AuditLogService } from '../src/permission/audit-log.service';
import { ApplicationService } from '../src/permission/application.service';
import { IamRoleService } from '../src/permission/iam-role.service';
import { PermissionCalculationService } from '../src/permission/permission-calculation.service';
import { PermissionCatalogService } from '../src/permission/permission-catalog.service';
import { PermissionDomainError } from '../src/permission/permission.types';
import { PrismaService } from '../src/prisma/prisma.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getField(body: unknown, field: string): unknown {
  return isRecord(body) ? body[field] : undefined;
}

function getErrorCode(body: unknown): unknown {
  const error = getField(body, 'error');
  return isRecord(error) ? error.code : undefined;
}

function getErrorRequestId(body: unknown): unknown {
  const error = getField(body, 'error');
  return isRecord(error) ? error.request_id : undefined;
}

const auditContext = expect.objectContaining({
  requestId: expect.any(String) as unknown,
  ip: expect.any(String) as unknown
}) as unknown;

describe('权限平台 API', () => {
  let app: INestApplication;
  let originalPlatformAdminToken: string | undefined;

  const applicationService = {
    createApplication: vi.fn<ApplicationService['createApplication']>(),
    listApplications: vi.fn<ApplicationService['listApplications']>(),
    listAllApplications: vi.fn<ApplicationService['listAllApplications']>(),
    getApplicationByKey: vi.fn<ApplicationService['getApplicationByKey']>(),
    updateApplication: vi.fn<ApplicationService['updateApplication']>(),
    setApplicationStatus: vi.fn<ApplicationService['setApplicationStatus']>()
  };
  const catalogService = {
    createPermissionGroup: vi.fn<PermissionCatalogService['createPermissionGroup']>(),
    listPermissionGroups: vi.fn<PermissionCatalogService['listPermissionGroups']>(),
    updatePermissionGroup: vi.fn<PermissionCatalogService['updatePermissionGroup']>(),
    setPermissionGroupStatus: vi.fn<PermissionCatalogService['setPermissionGroupStatus']>(),
    replacePermissionGroupPoints: vi.fn<PermissionCatalogService['replacePermissionGroupPoints']>(),
    createPermissionPoint: vi.fn<PermissionCatalogService['createPermissionPoint']>(),
    listPermissionPoints: vi.fn<PermissionCatalogService['listPermissionPoints']>(),
    updatePermissionPoint: vi.fn<PermissionCatalogService['updatePermissionPoint']>(),
    setPermissionPointStatus: vi.fn<PermissionCatalogService['setPermissionPointStatus']>()
  };
  const iamRoleService = {
    createRole: vi.fn<IamRoleService['createRole']>(),
    listRoles: vi.fn<IamRoleService['listRoles']>(),
    updateRole: vi.fn<IamRoleService['updateRole']>(),
    setRoleStatus: vi.fn<IamRoleService['setRoleStatus']>(),
    replaceRoleSubjects: vi.fn<IamRoleService['replaceRoleSubjects']>(),
    replaceRolePermissionGroups: vi.fn<IamRoleService['replaceRolePermissionGroups']>(),
    replaceRolePermissionPoints: vi.fn<IamRoleService['replaceRolePermissionPoints']>()
  };
  const calculationService = {
    calculate: vi.fn<PermissionCalculationService['calculate']>()
  };
  const auditService = {
    record: vi.fn<AuditLogService['record']>()
  };

  beforeAll(async () => {
    originalPlatformAdminToken = process.env.PLATFORM_ADMIN_TOKEN;
    process.env.PLATFORM_ADMIN_TOKEN = 'test-token';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        isReady: vi.fn().mockResolvedValue(true),
        $connect: vi.fn(),
        $disconnect: vi.fn()
      })
      .overrideProvider(ApplicationService)
      .useValue(applicationService)
      .overrideProvider(PermissionCatalogService)
      .useValue(catalogService)
      .overrideProvider(IamRoleService)
      .useValue(iamRoleService)
      .overrideProvider(PermissionCalculationService)
      .useValue(calculationService)
      .overrideProvider(AuditLogService)
      .useValue(auditService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    auditService.record.mockResolvedValue(undefined);
    process.env.PLATFORM_ADMIN_TOKEN = 'test-token';
  });

  afterAll(async () => {
    await app.close();
    if (originalPlatformAdminToken === undefined) {
      delete process.env.PLATFORM_ADMIN_TOKEN;
    } else {
      process.env.PLATFORM_ADMIN_TOKEN = originalPlatformAdminToken;
    }
  });

  it('拒绝未携带或错误平台 token 的请求', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/api/v1/platform/applications')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PLATFORM_TOKEN_INVALID');
      });

    await request(httpServer)
      .get('/api/v1/platform/applications')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PLATFORM_TOKEN_INVALID');
      });
  });

  it('创建应用并把 DTO 传给服务', async () => {
    applicationService.createApplication.mockResolvedValue({
      id: 'app-1',
      appKey: 'finance',
      name: '财务系统'
    } as never);

    const body = {
      appKey: 'finance',
      name: '财务系统',
      description: '费用与报销',
      ownerUserId: 'ou-admin'
    };

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications')
      .set('Authorization', 'Bearer test-token')
      .send(body)
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, 'appKey')).toBe('finance');
      });

    expect(applicationService.createApplication).toHaveBeenCalledWith(body, auditContext);
  });

  it('返回 PermissionErrorFilter 处理后的稳定错误体', async () => {
    applicationService.createApplication.mockRejectedValue(
      new PermissionDomainError('APPLICATION_KEY_INVALID', '应用 key 不符合规则', 400)
    );
    catalogService.createPermissionPoint.mockRejectedValue(
      new PermissionDomainError('PERMISSION_POINT_KEY_INVALID', '权限点 key 不符合规则', 422)
    );
    catalogService.createPermissionGroup.mockRejectedValue(
      new PermissionDomainError('PERMISSION_GROUP_KEY_REQUIRED', '权限组 key 不能为空', 422)
    );

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications')
      .set('Authorization', 'Bearer test-token')
      .set('x-request-id', 'req-app-invalid')
      .send({ appKey: 'Bad Key', name: '非法应用' })
      .expect(400)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('APPLICATION_KEY_INVALID');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-app-invalid');
      });

    await request(httpServer)
      .post('/api/v1/platform/applications/finance/permission-points')
      .set('Authorization', 'Bearer test-token')
      .set('x-request-id', 'req-point-invalid')
      .send({ key: 'invoice.read', name: '查看发票' })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PERMISSION_POINT_KEY_INVALID');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-point-invalid');
      });

    await request(httpServer)
      .post('/api/v1/platform/applications/finance/permission-groups')
      .set('Authorization', 'Bearer test-token')
      .set('x-request-id', 'req-group-missing-key')
      .send({ name: '发票管理员' })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PERMISSION_GROUP_KEY_REQUIRED');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-group-missing-key');
      });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'application',
        resourceId: 'Bad Key',
        action: 'create',
        result: 'failed',
        requestId: 'req-app-invalid',
        after: {
          error: {
            code: 'APPLICATION_KEY_INVALID',
            message: '应用 key 不符合规则',
            status: 400
          }
        }
      }) as unknown
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'permission_point',
        resourceId: 'invoice.read',
        action: 'create',
        result: 'failed',
        requestId: 'req-point-invalid'
      }) as unknown
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'permission_group',
        resourceId: 'unknown',
        action: 'create',
        result: 'failed',
        requestId: 'req-group-missing-key'
      }) as unknown
    );
  });

  it('失败审计写入异常时仍返回原始业务错误', async () => {
    applicationService.createApplication.mockRejectedValue(
      new PermissionDomainError('APPLICATION_KEY_INVALID', '应用 key 不符合规则', 400)
    );
    auditService.record.mockRejectedValueOnce(new Error('audit database unavailable'));

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications')
      .set('Authorization', 'Bearer test-token')
      .set('x-request-id', 'req-audit-write-failed')
      .send({ appKey: 'Bad Key', name: '非法应用' })
      .expect(400)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('APPLICATION_KEY_INVALID');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-audit-write-failed');
      });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'application',
        resourceId: 'Bad Key',
        action: 'create',
        result: 'failed',
        requestId: 'req-audit-write-failed'
      }) as unknown
    );
  });

  it('列出、读取、更新、启停应用', async () => {
    applicationService.listAllApplications.mockResolvedValue([
      {
        id: 'app-1',
        appKey: 'finance',
        name: '财务系统',
        description: null,
        ownerUserId: null,
        status: 'active',
        createdAt: new Date('2026-05-17T01:00:00.000Z'),
        updatedAt: new Date('2026-05-17T01:00:00.000Z'),
        silentSsoEnabled: false,
        silentSsoAllowedOrigins: []
      }
    ]);
    applicationService.getApplicationByKey.mockResolvedValue({ id: 'app-1', appKey: 'finance' } as never);
    applicationService.updateApplication.mockResolvedValue({ id: 'app-1', appKey: 'finance', name: '财务' } as never);
    applicationService.setApplicationStatus.mockResolvedValue({ id: 'app-1', appKey: 'finance' } as never);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/applications')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, 'items')).toEqual([
          expect.objectContaining({ id: 'app-1', appKey: 'finance' })
        ]);
        expect(getField(response.body as unknown, 'total')).toBeUndefined();
      });
    expect(applicationService.listAllApplications).toHaveBeenCalledWith();
    expect(applicationService.listApplications).not.toHaveBeenCalled();

    await request(httpServer)
      .get('/api/v1/platform/applications/finance')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    await request(httpServer)
      .patch('/api/v1/platform/applications/finance')
      .set('Authorization', 'Bearer test-token')
      .send({ name: '财务' })
      .expect(200);
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/disable')
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/enable')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(applicationService.getApplicationByKey).toHaveBeenCalledWith('finance');
    expect(applicationService.updateApplication).toHaveBeenCalledWith('finance', { name: '财务' }, auditContext);
    expect(applicationService.setApplicationStatus).toHaveBeenCalledWith('finance', 'disabled', auditContext);
    expect(applicationService.setApplicationStatus).toHaveBeenCalledWith('finance', 'active', auditContext);
  });

  it('创建权限点、权限组并替换权限组绑定的权限点', async () => {
    catalogService.createPermissionPoint.mockResolvedValue({ id: 'point-1', key: 'finance.invoice.read' } as never);
    catalogService.listPermissionPoints.mockResolvedValue([{ id: 'point-1', key: 'finance.invoice.read' }] as never);
    catalogService.updatePermissionPoint.mockResolvedValue({ id: 'point-1', name: '查看发票' } as never);
    catalogService.setPermissionPointStatus.mockResolvedValue({ id: 'point-1' } as never);
    catalogService.createPermissionGroup.mockResolvedValue({ id: 'group-1', key: 'finance.invoice.viewer' } as never);
    catalogService.listPermissionGroups.mockResolvedValue([{ id: 'group-1', key: 'finance.invoice.viewer' }] as never);
    catalogService.updatePermissionGroup.mockResolvedValue({ id: 'group-1', name: '发票查看员' } as never);
    catalogService.setPermissionGroupStatus.mockResolvedValue({ id: 'group-1' } as never);
    catalogService.replacePermissionGroupPoints.mockResolvedValue(undefined);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/permission-points')
      .set('Authorization', 'Bearer test-token')
      .send({ key: 'finance.invoice.read', name: '查看发票' })
      .expect(201);
    await request(httpServer)
      .get('/api/v1/platform/applications/finance/permission-points')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    await request(httpServer)
      .patch('/api/v1/platform/applications/finance/permission-points/point-1')
      .set('Authorization', 'Bearer test-token')
      .send({ name: '查看发票' })
      .expect(200);
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/permission-points/point-1/disable')
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/permission-points/point-1/enable')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    await request(httpServer)
      .post('/api/v1/platform/applications/finance/permission-groups')
      .set('Authorization', 'Bearer test-token')
      .send({ key: 'finance.invoice.viewer', name: '发票查看员' })
      .expect(201);
    await request(httpServer)
      .get('/api/v1/platform/applications/finance/permission-groups')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    await request(httpServer)
      .patch('/api/v1/platform/applications/finance/permission-groups/group-1')
      .set('Authorization', 'Bearer test-token')
      .send({ name: '发票查看员' })
      .expect(200);
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/permission-groups/group-1/disable')
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/permission-groups/group-1/enable')
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    await request(httpServer)
      .put('/api/v1/platform/applications/finance/permission-groups/group-1/points')
      .set('Authorization', 'Bearer test-token')
      .send({ pointIds: ['point-1'] })
      .expect(200)
      .expect({ ok: true });

    expect(catalogService.createPermissionPoint).toHaveBeenCalledWith('finance', {
      key: 'finance.invoice.read',
      name: '查看发票'
    }, auditContext);
    expect(catalogService.replacePermissionGroupPoints).toHaveBeenCalledWith('finance', 'group-1', ['point-1'], auditContext);
    expect(catalogService.setPermissionPointStatus).toHaveBeenCalledWith('finance', 'point-1', 'disabled', auditContext);
    expect(catalogService.setPermissionPointStatus).toHaveBeenCalledWith('finance', 'point-1', 'active', auditContext);
    expect(catalogService.setPermissionGroupStatus).toHaveBeenCalledWith('finance', 'group-1', 'disabled', auditContext);
    expect(catalogService.setPermissionGroupStatus).toHaveBeenCalledWith('finance', 'group-1', 'active', auditContext);
  });

  it('拒绝缺失权限点列表，避免静默清空权限组绑定', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/permission-groups/group-1/points')
      .set('Authorization', 'Bearer test-token')
      .set('x-request-id', 'req-missing-point-ids')
      .send({})
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PERMISSION_POINT_IDS_INVALID');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-missing-point-ids');
      });

    expect(catalogService.replacePermissionGroupPoints).not.toHaveBeenCalled();
  });

  it('允许显式空数组清空权限组绑定', async () => {
    catalogService.replacePermissionGroupPoints.mockResolvedValue(undefined);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/permission-groups/group-1/points')
      .set('Authorization', 'Bearer test-token')
      .send({ pointIds: [] })
      .expect(200)
      .expect({ ok: true });

    expect(catalogService.replacePermissionGroupPoints).toHaveBeenCalledWith('finance', 'group-1', [], auditContext);
  });

  it('拒绝权限组绑定中的非法权限点 ID 元素', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/permission-groups/group-1/points')
      .set('Authorization', 'Bearer test-token')
      .send({ pointIds: ['point-1', null] })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PERMISSION_POINT_IDS_INVALID');
      });

    expect(catalogService.replacePermissionGroupPoints).not.toHaveBeenCalled();
  });

  it('创建 IAM role 并替换 subjects、permission groups、permission points', async () => {
    iamRoleService.createRole.mockResolvedValue({ id: 'role-1', key: 'finance_admin' } as never);
    iamRoleService.listRoles.mockResolvedValue([{ id: 'role-1', key: 'finance_admin' }] as never);
    iamRoleService.updateRole.mockResolvedValue({ id: 'role-1', name: '财务管理员' } as never);
    iamRoleService.setRoleStatus.mockResolvedValue({ id: 'role-1' } as never);
    iamRoleService.replaceRoleSubjects.mockResolvedValue(undefined);
    iamRoleService.replaceRolePermissionGroups.mockResolvedValue(undefined);
    iamRoleService.replaceRolePermissionPoints.mockResolvedValue(undefined);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/iam-roles')
      .set('Authorization', 'Bearer test-token')
      .send({ key: 'finance_admin', name: '财务管理员' })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, 'app_key')).toBe('finance');
        expect(getField(response.body as unknown, 'key')).toBe('finance_admin');
      });
    await request(httpServer)
      .get('/api/v1/platform/applications/finance/iam-roles')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, 'items')).toEqual([
          { id: 'role-1', key: 'finance_admin', app_key: 'finance' }
        ]);
      });
    await request(httpServer)
      .patch('/api/v1/platform/applications/finance/iam-roles/role-1')
      .set('Authorization', 'Bearer test-token')
      .send({ name: '财务管理员' })
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, 'app_key')).toBe('finance');
      });
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/iam-roles/role-1/disable')
      .set('Authorization', 'Bearer test-token')
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, 'app_key')).toBe('finance');
      });
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/iam-roles/role-1/enable')
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/subjects')
      .set('Authorization', 'Bearer test-token')
      .send({ subjects: [{ type: 'feishu_user', id: 'ou-user-1' }] })
      .expect(200)
      .expect({ ok: true });
    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/permission-groups')
      .set('Authorization', 'Bearer test-token')
      .send({ groupIds: ['group-1'] })
      .expect(200)
      .expect({ ok: true });
    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/permission-points')
      .set('Authorization', 'Bearer test-token')
      .send({ pointIds: ['point-1'] })
      .expect(200)
      .expect({ ok: true });

    expect(iamRoleService.createRole).toHaveBeenCalledWith('finance', {
      key: 'finance_admin',
      name: '财务管理员'
    }, auditContext);
    expect(iamRoleService.replaceRoleSubjects).toHaveBeenCalledWith('finance', 'role-1', [
      { type: 'feishu_user', id: 'ou-user-1' }
    ], auditContext);
    expect(iamRoleService.replaceRolePermissionGroups).toHaveBeenCalledWith('finance', 'role-1', ['group-1'], auditContext);
    expect(iamRoleService.replaceRolePermissionPoints).toHaveBeenCalledWith('finance', 'role-1', ['point-1'], auditContext);
    expect(iamRoleService.setRoleStatus).toHaveBeenCalledWith('finance', 'role-1', 'disabled', auditContext);
    expect(iamRoleService.setRoleStatus).toHaveBeenCalledWith('finance', 'role-1', 'active', auditContext);
  });

  it('IAM role 权限组绑定兼容 permissionGroupIds 旧字段', async () => {
    iamRoleService.replaceRolePermissionGroups.mockResolvedValue(undefined);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/permission-groups')
      .set('Authorization', 'Bearer test-token')
      .send({ permissionGroupIds: ['group-legacy'] })
      .expect(200)
      .expect({ ok: true });

    expect(iamRoleService.replaceRolePermissionGroups).toHaveBeenCalledWith(
      'finance',
      'role-1',
      ['group-legacy'],
      auditContext
    );
  });

  it('拒绝非数组 IAM role subjects，避免静默清空主体绑定', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/subjects')
      .set('Authorization', 'Bearer test-token')
      .send({ subjects: 'ou-user-1' })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('IAM_ROLE_SUBJECTS_INVALID');
      });

    expect(iamRoleService.replaceRoleSubjects).not.toHaveBeenCalled();
  });

  it('拒绝 IAM role subjects 中的非法元素', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/subjects')
      .set('Authorization', 'Bearer test-token')
      .send({ subjects: [null] })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('IAM_ROLE_SUBJECTS_INVALID');
      });

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/subjects')
      .set('Authorization', 'Bearer test-token')
      .send({ subjects: [{ type: 'feishu_user' }] })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('IAM_ROLE_SUBJECTS_INVALID');
      });

    expect(iamRoleService.replaceRoleSubjects).not.toHaveBeenCalled();
  });

  it('拒绝 IAM role 权限组和权限点绑定中的非法 ID 元素', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/permission-groups')
      .set('Authorization', 'Bearer test-token')
      .send({ groupIds: ['group-1', {}] })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PERMISSION_GROUP_IDS_INVALID');
      });

    await request(httpServer)
      .put('/api/v1/platform/applications/finance/iam-roles/role-1/permission-points')
      .set('Authorization', 'Bearer test-token')
      .send({ pointIds: ['point-1', 123] })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PERMISSION_POINT_IDS_INVALID');
      });

    expect(iamRoleService.replaceRolePermissionGroups).not.toHaveBeenCalled();
    expect(iamRoleService.replaceRolePermissionPoints).not.toHaveBeenCalled();
  });

  it('返回用户权限计算结果', async () => {
    calculationService.calculate.mockResolvedValue({
      appKey: 'finance',
      userId: 'ou-user-1',
      permissionGroups: [{ key: 'finance.invoice.viewer', name: '发票查看员' }],
      permissionPoints: [{ key: 'finance.invoice.read', name: '查看发票' }],
      matchedRoles: [{ key: 'finance_admin', name: '财务管理员' }],
      computedAt: '2026-05-16T03:00:00.000Z'
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/applications/finance/users/ou-user-1/permissions')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, 'app_key')).toBe('finance');
        expect(getField(response.body as unknown, 'user_id')).toBe('ou-user-1');
        expect(getField(response.body as unknown, 'permission_points')).toEqual([
          { key: 'finance.invoice.read', name: '查看发票' }
        ]);
        expect(getField(response.body as unknown, 'permissionPoints')).toBeUndefined();
        expect(getField(response.body as unknown, 'computed_at')).toBe('2026-05-16T03:00:00.000Z');
      });

    expect(calculationService.calculate).toHaveBeenCalledWith('finance', 'ou-user-1');
  });
});
