import { Injectable } from '@nestjs/common';
import { AdminDomainError, type AdminContext, type AdminRoleKey } from './admin.types';

@Injectable()
export class AdminPermissionService {
  canManageApplication(context: AdminContext, applicationId: string): boolean {
    return (
      hasRole(context, 'platform_admin') ||
      (hasRole(context, 'application_admin') && context.applicationIds.includes(applicationId))
    );
  }

  assertCanManageApplication(context: AdminContext, applicationId: string): void {
    if (!this.canManageApplication(context, applicationId)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权管理该应用', 403);
    }
  }

  canManageAdmins(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin');
  }

  assertCanManageAdmins(context: AdminContext): void {
    if (!this.canManageAdmins(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权管理管理员授权', 403);
    }
  }

  canTriggerFeishuSync(context: AdminContext): boolean {
    return this.canTriggerFeishuFullSync(context);
  }

  assertCanTriggerFeishuSync(context: AdminContext): void {
    if (!this.canTriggerFeishuSync(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权触发飞书同步', 403);
    }
  }

  canViewFeishuSync(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'sync_admin') || hasRole(context, 'audit_viewer');
  }

  assertCanViewFeishuSync(context: AdminContext): void {
    if (!this.canViewFeishuSync(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看飞书同步信息', 403);
    }
  }

  canQueryFeishuMirror(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'sync_admin');
  }

  assertCanQueryFeishuMirror(context: AdminContext): void {
    if (!this.canQueryFeishuMirror(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看飞书组织和用户详情', 403);
    }
  }

  canTriggerFeishuLightSync(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'sync_admin');
  }

  assertCanTriggerFeishuLightSync(context: AdminContext): void {
    if (!this.canTriggerFeishuLightSync(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权触发飞书轻量同步', 403);
    }
  }

  canTriggerFeishuFullSync(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin');
  }

  assertCanTriggerFeishuFullSync(context: AdminContext): void {
    if (!this.canTriggerFeishuFullSync(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权触发飞书全量同步', 403);
    }
  }

  canViewGlobalAudit(context: AdminContext): boolean {
    return hasRole(context, 'platform_admin') || hasRole(context, 'audit_viewer');
  }

  assertCanViewGlobalAudit(context: AdminContext): void {
    if (!this.canViewGlobalAudit(context)) {
      throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看全局审计日志', 403);
    }
  }
}

function hasRole(context: AdminContext, role: AdminRoleKey): boolean {
  return context.roles.includes(role);
}
