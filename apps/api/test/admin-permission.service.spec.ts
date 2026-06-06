import { describe, expect, it } from 'vitest';
import { AdminPermissionService } from '../src/admin/admin-permission.service';
import { AdminDomainError, type AdminContext } from '../src/admin/admin.types';

function context(roles: AdminContext['roles'], applicationIds: string[] = []): AdminContext {
  return {
    adminUserId: 'admin-1',
    feishuUserId: 'ou_admin',
    displayName: '管理员',
    roles,
    applicationIds
  };
}

function expectDenied(action: () => void, code = 'ADMIN_PERMISSION_DENIED'): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AdminDomainError);
    expect((error as AdminDomainError).code).toBe(code);
    return;
  }

  throw new Error('Expected AdminDomainError');
}

describe('AdminPermissionService', () => {
  const service = new AdminPermissionService();

  it('平台管理员可管理全部应用', () => {
    expect(service.canManageApplication(context(['platform_admin']), 'app-finance')).toBe(true);
    expect(service.canManageApplication(context(['platform_admin']), 'app-hr')).toBe(true);
  });

  it('应用管理员只能管理授权应用', () => {
    expect(service.canManageApplication(context(['application_admin'], ['app-finance']), 'app-finance')).toBe(true);
    expect(service.canManageApplication(context(['application_admin'], ['app-finance']), 'app-hr')).toBe(false);
  });

  it('审计查看员无写权限', () => {
    expect(service.canViewGlobalAudit(context(['audit_viewer']))).toBe(true);
    expect(() => {
      service.assertCanViewGlobalAudit(context(['audit_viewer']));
    }).not.toThrow();
    expectDenied(() => {
      service.assertCanManageApplication(context(['audit_viewer']), 'app-finance');
    });
    expectDenied(() => {
      service.assertCanTriggerFeishuSync(context(['audit_viewer']));
    });
  });

  it('同步管理员只能触发轻量同步，不能管理应用或全量同步', () => {
    expect(service.canTriggerFeishuLightSync(context(['sync_admin']))).toBe(true);
    expect(service.canTriggerFeishuSync(context(['sync_admin']))).toBe(false);
    expectDenied(() => {
      service.assertCanManageApplication(context(['sync_admin']), 'app-finance');
    });
    expectDenied(() => {
      service.assertCanManageAdmins(context(['sync_admin']));
    });
  });

  it('平台管理员可查看镜像、触发轻量同步和触发全量同步', () => {
    const admin = context(['platform_admin']);

    expect(service.canViewFeishuSync(admin)).toBe(true);
    expect(service.canQueryFeishuMirror(admin)).toBe(true);
    expect(service.canTriggerFeishuLightSync(admin)).toBe(true);
    expect(service.canTriggerFeishuFullSync(admin)).toBe(true);
    expect(() => {
      service.assertCanTriggerFeishuFullSync(admin);
    }).not.toThrow();
  });

  it('同步管理员可查询镜像和触发轻量同步但不能触发全量同步', () => {
    const admin = context(['sync_admin']);

    expect(service.canViewFeishuSync(admin)).toBe(true);
    expect(service.canQueryFeishuMirror(admin)).toBe(true);
    expect(service.canTriggerFeishuLightSync(admin)).toBe(true);
    expect(service.canTriggerFeishuFullSync(admin)).toBe(false);
    expectDenied(() => {
      service.assertCanTriggerFeishuFullSync(admin);
    });
  });

  it('审计查看员只能查看同步信息，不能查看镜像详情或触发同步', () => {
    const admin = context(['audit_viewer']);

    expect(service.canViewFeishuSync(admin)).toBe(true);
    expect(service.canQueryFeishuMirror(admin)).toBe(false);
    expect(service.canTriggerFeishuLightSync(admin)).toBe(false);
    expect(service.canTriggerFeishuFullSync(admin)).toBe(false);
    expectDenied(() => {
      service.assertCanQueryFeishuMirror(admin);
    });
    expectDenied(() => {
      service.assertCanTriggerFeishuLightSync(admin);
    });
  });

  it('应用管理员不能查看全局审计日志', () => {
    expect(service.canViewGlobalAudit(context(['application_admin'], ['app-finance']))).toBe(false);
    expectDenied(() => {
      service.assertCanViewGlobalAudit(context(['application_admin'], ['app-finance']));
    });
  });
});
