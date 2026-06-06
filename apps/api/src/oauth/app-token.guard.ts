import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { hashOauthSecret } from './oauth-crypto';
import { getOauthRequestId } from './oauth-request-context';
import { OauthDomainError, type AppTokenContext } from './oauth.types';
import { SecurityEventService } from './security-event.service';

type RequestWithAppTokenContext = Request & {
  appTokenContext?: AppTokenContext;
};

@Injectable()
export class AppTokenGuard implements CanActivate {
  private readonly logger = new Logger(AppTokenGuard.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecurityEventService)
    private readonly securityEvents: SecurityEventService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAppTokenContext>();
    let failureContext: AppTokenContext | null = null;

    try {
      const token = readBearerToken(request);
      const tokenHash = hashOauthSecret(token);
      const accessToken = await this.prisma.oauthAccessToken.findUnique({
        where: {
          tokenHash
        },
        include: {
          application: true,
          feishuUser: true
        }
      });

      if (!accessToken) {
        throw new OauthDomainError('OAUTH_TOKEN_INVALID', 'access token 无效', 401);
      }

      failureContext = {
        applicationId: accessToken.applicationId,
        appKey: accessToken.application.appKey,
        environmentId: accessToken.environmentId,
        clientId: accessToken.clientId,
        feishuUserId: accessToken.feishuUserId,
        scope: accessToken.scope
      };

      if (accessToken.expiresAt <= new Date()) {
        throw new OauthDomainError('OAUTH_TOKEN_EXPIRED', 'access token 已过期', 401);
      }
      if (accessToken.revokedAt) {
        throw new OauthDomainError('OAUTH_TOKEN_REVOKED', 'access token 已撤销', 401);
      }
      if (accessToken.application.status !== 'active') {
        throw new OauthDomainError('OAUTH_TOKEN_CONTEXT_DISABLED', 'access token 关联上下文已禁用', 403);
      }
      const client = await this.prisma.applicationClient.findFirst({
        where: {
          applicationId: accessToken.applicationId,
          clientId: accessToken.clientId
        },
        select: {
          status: true
        }
      });
      if (!client || client.status !== 'active') {
        throw new OauthDomainError('OAUTH_TOKEN_CONTEXT_DISABLED', 'access token 关联上下文已禁用', 403);
      }
      if (!accessToken.feishuUser.isActive || accessToken.feishuUser.isDeleted) {
        throw new OauthDomainError('OAUTH_TOKEN_USER_UNAVAILABLE', 'access token 关联用户不可用', 401);
      }

      request.appTokenContext = failureContext;

      return true;
    } catch (error) {
      if (error instanceof OauthDomainError) {
        await this.recordFailureBestEffort(request, error, failureContext);
      }
      throw error;
    }
  }

  private async recordFailureBestEffort(
    request: Request,
    error: OauthDomainError,
    context: AppTokenContext | null
  ): Promise<void> {
    try {
      await this.securityEvents.record({
        eventType: 'oauth_app_token_auth',
        applicationId: context?.applicationId,
        clientId: context?.clientId,
        feishuUserId: context?.feishuUserId,
        result: 'failed',
        reasonCode: error.code,
        summary: `应用 access token 认证失败：${error.code}`,
        ip: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null,
        requestId: getOauthRequestId(request)
      });
    } catch (recordError) {
      this.logger.error('OAuth app token security event write failed', recordError instanceof Error ? recordError.stack : undefined);
    }
  }
}

export function readAppTokenContext(request: Request): AppTokenContext {
  const context = (request as RequestWithAppTokenContext).appTokenContext;
  if (!context) {
    throw new OauthDomainError('OAUTH_TOKEN_CONTEXT_MISSING', 'access token 上下文缺失', 401);
  }

  return context;
}

function readBearerToken(request: Request): string {
  const authorization = request.header('authorization');
  if (!authorization) {
    throw new OauthDomainError('OAUTH_TOKEN_MISSING', '缺少 Bearer access token', 401);
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  if (!token) {
    throw new OauthDomainError('OAUTH_TOKEN_INVALID', 'access token 无效', 401);
  }

  return token;
}
