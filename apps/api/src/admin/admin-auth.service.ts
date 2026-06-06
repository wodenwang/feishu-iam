import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { FEISHU_CLIENT, type FeishuClient } from '../feishu/feishu-client';
import type { FeishuOAuthUserIdentity } from '../feishu/feishu-oauth.types';
import { PrismaService } from '../prisma/prisma.service';
import { createAdminSessionSecret, hashAdminSessionSecret } from './admin-session-crypto';
import { AdminDomainError, type AdminContext, type AdminRoleKey } from './admin.types';

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ADMIN_ROLE_KEYS = ['platform_admin', 'application_admin', 'audit_viewer', 'sync_admin'] as const satisfies readonly AdminRoleKey[];
const ADMIN_ROLE_KEY_SET = new Set<string>(ADMIN_ROLE_KEYS);

type AdminContextSource = {
  id: string;
  feishuUserId: string;
  displayName: string;
  roles: Array<{ adminRole: { roleKey: string } }>;
  applicationScopes: Array<{ applicationId: string }>;
};

type SessionMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FEISHU_CLIENT) private readonly feishuClient: FeishuClient
  ) {}

  startFeishuLogin(): { state: string; redirectTo: string; redirectUri: string } {
    const redirectUri = readAdminFeishuRedirectUri();
    const state = createAdminSessionSecret();
    return {
      state,
      redirectUri,
      redirectTo: this.feishuClient.buildOAuthAuthorizeUrl({
        state,
        redirectUri
      })
    };
  }

  async handleFeishuCallback(
    input: { code?: string; state?: string; expectedState?: string },
    meta: SessionMeta
  ): Promise<{ sessionSecret: string; context: AdminContext }> {
    if (!input.code) {
      throw new AdminDomainError('ADMIN_FEISHU_CODE_REQUIRED', '飞书回调缺少 code', 400);
    }
    if (!input.state || !input.expectedState || input.state !== input.expectedState) {
      throw new AdminDomainError('ADMIN_LOGIN_STATE_INVALID', '后台登录状态已失效，请重新登录', 400);
    }

    const identity = await this.feishuClient.exchangeOAuthCode(input.code, readAdminFeishuRedirectUri());
    const feishuUser = await this.findFeishuUserByOAuthIdentity(identity);
    if (!feishuUser) {
      throw new AdminDomainError('ADMIN_USER_NOT_BOUND', '当前飞书用户尚未被授权为 Feishu IAM 管理员', 403);
    }

    return this.createSessionForFeishuUser(feishuUser.userId, meta);
  }

  async createSessionForFeishuUser(
    feishuUserId: string,
    meta: SessionMeta
  ): Promise<{ sessionSecret: string; context: AdminContext }> {
    const admin = await this.prisma.adminUser.findFirst({
      where: {
        feishuUserId,
        status: 'active',
        feishuUser: {
          isActive: true,
          isDeleted: false
        }
      },
      include: {
        roles: { include: { adminRole: true } },
        applicationScopes: true
      }
    });

    if (!admin) {
      throw new AdminDomainError('ADMIN_USER_NOT_BOUND', '当前飞书用户尚未被授权为 Feishu IAM 管理员', 403);
    }

    const now = new Date();
    const sessionSecret = createAdminSessionSecret();
    await this.prisma.adminSession.create({
      data: {
        id: randomUUID(),
        sessionHash: hashAdminSessionSecret(sessionSecret),
        adminUserId: admin.id,
        expiresAt: new Date(now.getTime() + ADMIN_SESSION_TTL_MS),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        lastUsedAt: now
      }
    });
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: now }
    });

    return {
      sessionSecret,
      context: toContext(admin)
    };
  }

  async getContextFromSessionSecret(sessionSecret: string): Promise<AdminContext> {
    const session = await this.prisma.adminSession.findUnique({
      where: {
        sessionHash: hashAdminSessionSecret(sessionSecret)
      },
      include: {
        adminUser: {
          include: {
            feishuUser: true,
            roles: { include: { adminRole: true } },
            applicationScopes: true
          }
        }
      }
    });

    if (!session || session.revokedAt) {
      throw new AdminDomainError('ADMIN_SESSION_INVALID', '后台登录态无效', 401);
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AdminDomainError('ADMIN_SESSION_EXPIRED', '后台登录态已过期', 401);
    }

    if (
      session.adminUser.status !== 'active' ||
      !session.adminUser.feishuUser.isActive ||
      session.adminUser.feishuUser.isDeleted
    ) {
      throw new AdminDomainError('ADMIN_USER_UNAVAILABLE', '管理员或关联飞书用户不可用', 403);
    }

    const adminContext = toContext(session.adminUser);

    await this.prisma.adminSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    });

    return adminContext;
  }

  async logout(sessionSecret: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: {
        sessionHash: hashAdminSessionSecret(sessionSecret),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private async findFeishuUserByOAuthIdentity(identity: FeishuOAuthUserIdentity): Promise<{ userId: string } | null> {
    if (identity.user_id) {
      return this.prisma.feishuUser.findUnique({
        where: {
          userId: identity.user_id
        },
        select: {
          userId: true
        }
      });
    }
    const openId = identity.open_id ?? identity.sub;
    if (openId) {
      return this.prisma.feishuUser.findUnique({
        where: {
          openId
        },
        select: {
          userId: true
        }
      });
    }
    if (identity.union_id) {
      return this.prisma.feishuUser.findUnique({
        where: {
          unionId: identity.union_id
        },
        select: {
          userId: true
        }
      });
    }

    return null;
  }
}

function readAdminFeishuRedirectUri(): string {
  const redirectUri = process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
  if (!redirectUri) {
    throw new AdminDomainError('ADMIN_FEISHU_REDIRECT_URI_MISSING', '后台飞书登录回调地址未配置', 500);
  }

  return redirectUri;
}

function toContext(admin: AdminContextSource): AdminContext {
  const roles = admin.roles.map((role) => toAdminRoleKey(role.adminRole.roleKey));

  return {
    adminUserId: admin.id,
    feishuUserId: admin.feishuUserId,
    displayName: admin.displayName,
    roles,
    applicationIds: admin.applicationScopes.map((scope) => scope.applicationId)
  };
}

function toAdminRoleKey(roleKey: string): AdminRoleKey {
  if (ADMIN_ROLE_KEY_SET.has(roleKey)) {
    return roleKey as AdminRoleKey;
  }

  throw new AdminDomainError('ADMIN_ROLE_INVALID', '管理员角色不合法', 500);
}
