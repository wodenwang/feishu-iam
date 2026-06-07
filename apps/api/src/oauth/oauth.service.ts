import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { FEISHU_CLIENT, type FeishuClient } from '../feishu/feishu-client';
import type { FeishuOAuthUserIdentity } from '../feishu/feishu-oauth.types';
import { FeishuClientError } from '../feishu/feishu.types';
import { AuditLogService } from '../permission/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { createOauthSecret, hashOauthSecret, timingSafeEqualHash } from './oauth-crypto';
import {
  OauthDomainError,
  type AppTokenContext,
  type OauthAuditContext,
  type RevokeInput,
  type RevokeResponse,
  type TokenInput,
  type TokenResponse,
  type UserinfoResponse
} from './oauth.types';
import { SecurityEventService, type SecurityEventInput } from './security-event.service';

type StartAuthorizationInput = {
  responseType?: string;
  clientId?: string;
  redirectUri?: string;
  state?: string;
  scope?: string;
};

type FeishuCallbackInput = {
  code?: string;
  state?: string;
};

type RedirectResult = {
  redirectTo: string;
};

const DEFAULT_SCOPE = 'openid profile permissions';
const ALLOWED_SCOPES = ['openid', 'profile', 'permissions'] as const;
const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 7200;
const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;
const SUPPORTED_FEISHU_OAUTH_CALLBACK_PATHS = ['/oauth/feishu/callback', '/api/auth/feishu/callback'] as const;

type RequiredTokenInput = {
  grantType: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
};

type RequiredRevokeInput = {
  token: string;
  clientId: string;
  clientSecret: string;
};

type OauthClientWithContext = {
  applicationId: string;
  environmentId: string | null;
  clientId: string;
  clientSecretHash: string;
  status: string;
  application?: { status: string } | null;
};

@Injectable()
export class OauthService {
  private readonly logger = new Logger(OauthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FEISHU_CLIENT) private readonly feishuClient: FeishuClient,
    private readonly securityEvents: SecurityEventService,
    private readonly audit: AuditLogService
  ) {}

  async startAuthorization(
    input: StartAuthorizationInput,
    context: OauthAuditContext
  ): Promise<RedirectResult> {
    try {
      return await this.doStartAuthorization(input);
    } catch (error) {
      await this.recordFailure('oauth_authorize', error, context);
      throw error;
    }
  }

  async handleFeishuCallback(
    input: FeishuCallbackInput,
    context: OauthAuditContext
  ): Promise<RedirectResult> {
    try {
      const result = await this.doHandleFeishuCallback(input);
      await this.recordSecurityEventBestEffort({
        eventType: 'oauth_login',
        applicationId: result.applicationId,
        clientId: result.clientId,
        feishuUserId: result.feishuUserId,
        result: 'success',
        summary: '飞书登录成功并发放授权码',
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId
      });
      return {
        redirectTo: result.redirectTo
      };
    } catch (error) {
      await this.recordFailure('oauth_login', error, context);
      throw error;
    }
  }

  async exchangeCode(input: TokenInput, context: OauthAuditContext): Promise<TokenResponse> {
    let credentialFailureClient: OauthClientWithContext | null = null;
    try {
      const normalizedInput = normalizeTokenInput(input);
      const client = await this.prisma.applicationClient.findUnique({
        where: {
          clientId: normalizedInput.clientId
        },
        include: {
          application: true
        }
      });
      if (!client) {
        throw new OauthDomainError('OAUTH_CLIENT_CREDENTIALS_INVALID', 'client 凭证无效', 401);
      }
      this.assertActiveClientContext(client);
      credentialFailureClient = client;
      if (!timingSafeEqualHash(normalizedInput.clientSecret, client.clientSecretHash)) {
        throw new OauthDomainError('OAUTH_CLIENT_CREDENTIALS_INVALID', 'client 凭证无效', 401);
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const codeHash = hashOauthSecret(normalizedInput.code);
        const authorizationCode = await tx.oauthAuthorizationCode.findUnique({
          where: {
            codeHash
          }
        });
        if (!authorizationCode) {
          throw new OauthDomainError('OAUTH_CODE_INVALID', '授权码无效', 400);
        }
        if (
          authorizationCode.clientId !== client.clientId ||
          authorizationCode.redirectUri !== normalizedInput.redirectUri
        ) {
          throw new OauthDomainError('OAUTH_CODE_INVALID', '授权码无效', 400);
        }
        if (authorizationCode.usedAt) {
          throw new OauthDomainError('OAUTH_CODE_USED', '授权码已使用', 400);
        }
        if (authorizationCode.expiresAt <= now) {
          throw new OauthDomainError('OAUTH_CODE_EXPIRED', '授权码已过期', 400);
        }

        const marked = await tx.oauthAuthorizationCode.updateMany({
          where: {
            codeHash,
            clientId: client.clientId,
            redirectUri: normalizedInput.redirectUri,
            usedAt: null,
            expiresAt: {
              gt: now
            }
          },
          data: {
            usedAt: now
          }
        });
        if (marked.count !== 1) {
          throw new OauthDomainError('OAUTH_CODE_USED', '授权码已使用', 400);
        }

        const accessToken = createOauthSecret('biat');
        await tx.oauthAccessToken.create({
          data: {
            id: randomUUID(),
            tokenHash: hashOauthSecret(accessToken),
            applicationId: authorizationCode.applicationId,
            environmentId: authorizationCode.environmentId ?? null,
            clientId: client.clientId,
            feishuUserId: authorizationCode.feishuUserId,
            scope: authorizationCode.scope,
            expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS)
          }
        });
        await tx.applicationClient.update({
          where: {
            clientId: client.clientId
          },
          data: {
            lastUsedAt: now
          }
        });

        return {
          response: {
            access_token: accessToken,
            token_type: 'Bearer' as const,
            expires_in: ACCESS_TOKEN_TTL_SECONDS,
            scope: authorizationCode.scope
          },
          eventContext: {
            applicationId: authorizationCode.applicationId,
            clientId: client.clientId,
            feishuUserId: authorizationCode.feishuUserId
          }
        };
      });

      await this.recordSecurityEventBestEffort({
        eventType: 'oauth_token_exchange',
        applicationId: result.eventContext.applicationId,
        clientId: result.eventContext.clientId,
        feishuUserId: result.eventContext.feishuUserId,
        result: 'success',
        summary: '授权码换取 access token 成功',
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId
      });
      return result.response;
    } catch (error) {
      await this.recordFailureOnce('oauth_token_exchange', error, context, credentialFailureClient);
      throw error;
    }
  }

  async revokeToken(input: RevokeInput, context: OauthAuditContext): Promise<RevokeResponse> {
    let credentialFailureClient: OauthClientWithContext | null = null;
    try {
      const normalizedInput = normalizeRevokeInput(input);
      const client = await this.prisma.applicationClient.findUnique({
        where: {
          clientId: normalizedInput.clientId
        },
        include: {
          application: true
        }
      });
      if (!client) {
        throw new OauthDomainError('OAUTH_CLIENT_CREDENTIALS_INVALID', 'client 凭证无效', 401);
      }
      this.assertActiveClientContext(client);
      credentialFailureClient = client;
      if (!timingSafeEqualHash(normalizedInput.clientSecret, client.clientSecretHash)) {
        throw new OauthDomainError('OAUTH_CLIENT_CREDENTIALS_INVALID', 'client 凭证无效', 401);
      }

      await this.prisma.$transaction(async (tx) => {
        const revoked = await tx.oauthAccessToken.updateMany({
          where: {
            tokenHash: hashOauthSecret(normalizedInput.token),
            clientId: client.clientId,
            revokedAt: null
          },
          data: {
            revokedAt: new Date()
          }
        });
        await this.audit.record(
          {
            actorType: 'application_client',
            actorId: client.clientId,
            source: 'oauth_api',
            applicationId: client.applicationId,
            resourceType: 'oauth_access_token',
            resourceId: client.clientId,
            action: 'revoke',
            after: {
              status: revoked.count > 0 ? 'revoked' : 'unknown'
            },
            result: 'success',
            ip: context.ip,
            userAgent: context.userAgent,
            requestId: context.requestId
          },
          tx
        );
      });

      await this.recordSecurityEventBestEffort({
        eventType: 'oauth_token_revoke',
        clientId: normalizedInput.clientId,
        result: 'success',
        summary: 'access token 撤销请求已处理',
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId
      });
      return { revoked: true };
    } catch (error) {
      await this.recordFailureOnce('oauth_token_revoke', error, context, credentialFailureClient);
      throw error;
    }
  }

  async getUserinfo(context: AppTokenContext, audit: OauthAuditContext): Promise<UserinfoResponse> {
    try {
      const user = await this.prisma.feishuUser.findUnique({
        where: {
          userId: context.feishuUserId
        }
      });
      if (!user || !user.isActive || user.isDeleted) {
        throw new OauthDomainError('OAUTH_TOKEN_USER_UNAVAILABLE', 'access token 关联用户不可用', 401);
      }

      await this.recordSecurityEventBestEffort({
        eventType: 'oauth_userinfo',
        applicationId: context.applicationId,
        clientId: context.clientId,
        feishuUserId: context.feishuUserId,
        result: 'success',
        summary: 'userinfo 查询成功',
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId
      });

      return {
        sub: user.userId,
        user_id: user.userId,
        open_id: user.openId,
        union_id: user.unionId,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
        employee_no: user.employeeNo,
        job_title: user.jobTitle
      };
    } catch (error) {
      await this.recordSecurityEventBestEffort({
        eventType: 'oauth_userinfo',
        applicationId: context.applicationId,
        clientId: context.clientId,
        feishuUserId: context.feishuUserId,
        result: 'failed',
        reasonCode: toOauthFailureReasonCode(error),
        summary: `userinfo 查询失败：${toOauthFailureReasonCode(error)}`,
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId
      });
      throw error;
    }
  }

  private async doStartAuthorization(input: StartAuthorizationInput): Promise<RedirectResult> {
    if (input.responseType !== 'code') {
      throw new OauthDomainError('OAUTH_RESPONSE_TYPE_UNSUPPORTED', 'response_type 只支持 code', 400);
    }
    if (!input.clientId) {
      throw new OauthDomainError('OAUTH_CLIENT_ID_REQUIRED', 'client_id 不能为空', 400);
    }
    if (!input.redirectUri) {
      throw new OauthDomainError('OAUTH_REDIRECT_URI_REQUIRED', 'redirect_uri 不能为空', 400);
    }
    if (!input.state || input.state.trim().length === 0) {
      throw new OauthDomainError('OAUTH_STATE_REQUIRED', 'state 不能为空', 400);
    }

    const client = await this.prisma.applicationClient.findUnique({
      where: {
        clientId: input.clientId
      },
      include: {
        application: true
      }
    });
    if (!client) {
      throw new OauthDomainError('OAUTH_CLIENT_NOT_FOUND', 'client 不存在', 404);
    }
    this.assertActiveClientContext(client);

    const redirectUri = await this.prisma.applicationRedirectUri.findFirst({
      where: {
        applicationId: client.applicationId,
        redirectUri: input.redirectUri,
        status: 'active'
      }
    });
    if (!redirectUri) {
      throw new OauthDomainError('OAUTH_REDIRECT_URI_UNTRUSTED', 'redirect_uri 未登记或已禁用', 400);
    }

    const feishuRedirectUri = normalizeFeishuRedirectUri(process.env.FEISHU_OAUTH_REDIRECT_URI);

    const requestedScope = normalizeScope(input.scope);
    const internalState = createOauthSecret('bils');
    await this.prisma.oauthLoginState.create({
      data: {
        id: randomUUID(),
        stateHash: hashOauthSecret(internalState),
        clientId: client.clientId,
        redirectUri: input.redirectUri,
        requestedScope,
        externalState: input.state,
        expiresAt: new Date(Date.now() + LOGIN_STATE_TTL_MS)
      }
    });

    return {
      redirectTo: this.feishuClient.buildOAuthAuthorizeUrl({
        state: internalState,
        redirectUri: feishuRedirectUri
      })
    };
  }

  private async doHandleFeishuCallback(
    input: FeishuCallbackInput
  ): Promise<RedirectResult & { applicationId: string; clientId: string; feishuUserId: string }> {
    if (!input.code) {
      throw new OauthDomainError('OAUTH_FEISHU_CODE_REQUIRED', '飞书回调缺少 code', 400);
    }
    if (!input.state) {
      throw new OauthDomainError('OAUTH_STATE_REQUIRED', 'state 不能为空', 400);
    }

    const stateHash = hashOauthSecret(input.state);
    const consumed = await this.prisma.oauthLoginState.updateMany({
      where: {
        stateHash,
        consumedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      data: {
        consumedAt: new Date()
      }
    });
    if (consumed.count !== 1) {
      throw new OauthDomainError('OAUTH_LOGIN_STATE_INVALID', '登录状态已失效，请重新发起登录', 400);
    }

    const loginState = await this.prisma.oauthLoginState.findUnique({
      where: {
        stateHash
      },
      include: {
        client: {
          include: {
            application: true
          }
        }
      }
    });
    if (!loginState) {
      throw new OauthDomainError('OAUTH_LOGIN_STATE_INVALID', '登录状态已失效，请重新发起登录', 400);
    }
    this.assertActiveClientContext(loginState.client);

    const identity = await this.feishuClient.exchangeOAuthCode(
      input.code,
      normalizeFeishuRedirectUri(process.env.FEISHU_OAUTH_REDIRECT_URI)
    );
    const feishuUser = await this.findFeishuUserByOAuthIdentity(identity);
    if (!feishuUser || !feishuUser.isActive || feishuUser.isDeleted) {
      throw new OauthDomainError('OAUTH_USER_NOT_ACTIVE', '当前飞书用户不可登录', 403);
    }

    const authorizationCode = createOauthSecret('biac');
    await this.prisma.oauthAuthorizationCode.create({
      data: {
        id: randomUUID(),
        codeHash: hashOauthSecret(authorizationCode),
        applicationId: loginState.client.applicationId,
        environmentId: loginState.client.environmentId ?? null,
        clientId: loginState.clientId,
        redirectUri: loginState.redirectUri,
        feishuUserId: feishuUser.userId,
        scope: loginState.requestedScope,
        state: loginState.externalState,
        expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS)
      }
    });
    const redirectUrl = new URL(loginState.redirectUri);
    redirectUrl.searchParams.set('code', authorizationCode);
    redirectUrl.searchParams.set('state', loginState.externalState);

    return {
      redirectTo: redirectUrl.toString(),
      applicationId: loginState.client.applicationId,
      clientId: loginState.clientId,
      feishuUserId: feishuUser.userId
    };
  }

  private async findFeishuUserByOAuthIdentity(identity: FeishuOAuthUserIdentity) {
    if (identity.user_id) {
      return this.prisma.feishuUser.findUnique({
        where: {
          userId: identity.user_id
        }
      });
    }
    const openId = identity.open_id ?? identity.sub;
    if (openId) {
      return this.prisma.feishuUser.findUnique({
        where: {
          openId
        }
      });
    }
    if (identity.union_id) {
      return this.prisma.feishuUser.findUnique({
        where: {
          unionId: identity.union_id
        }
      });
    }

    return null;
  }

  private assertActiveClientContext(client: {
    status: string;
    environmentId: string | null;
    application?: { status: string } | null;
  }): void {
    if (client.status !== 'active') {
      throw new OauthDomainError('OAUTH_CLIENT_DISABLED', 'client 已禁用', 403);
    }
    if (client.application?.status !== 'active') {
      throw new OauthDomainError('OAUTH_APPLICATION_DISABLED', '应用已禁用', 403);
    }
  }

  private async recordFailure(
    eventType: string,
    error: unknown,
    context: OauthAuditContext
  ): Promise<void> {
    const reasonCode = toOauthFailureReasonCode(error);
    if (error instanceof FeishuClientError) {
      this.logger.warn(`OAuth 飞书客户端错误：${JSON.stringify(toSafeFeishuErrorLog(error))}`);
    } else if (!(error instanceof OauthDomainError)) {
      this.logger.error('OAuth 流程出现未预期错误', error instanceof Error ? error.stack : undefined);
    }
    await this.recordSecurityEventBestEffort({
      eventType,
      result: 'failed',
      reasonCode,
      summary: `OAuth 流程失败：${reasonCode}`,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });
  }

  private async recordClientCredentialFailure(
    eventType: string,
    client: {
      applicationId: string;
      clientId: string;
    },
    context: OauthAuditContext
  ): Promise<void> {
    await this.recordSecurityEventBestEffort({
      eventType,
      applicationId: client.applicationId,
      clientId: client.clientId,
      result: 'failed',
      reasonCode: 'OAUTH_CLIENT_CREDENTIALS_INVALID',
      summary: 'client 凭证校验失败',
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });
  }

  private async recordFailureOnce(
    eventType: string,
    error: unknown,
    context: OauthAuditContext,
    credentialFailureClient: OauthClientWithContext | null
  ): Promise<void> {
    if (
      error instanceof OauthDomainError &&
      error.code === 'OAUTH_CLIENT_CREDENTIALS_INVALID' &&
      credentialFailureClient
    ) {
      await this.recordClientCredentialFailure(eventType, credentialFailureClient, context);
      return;
    }

    await this.recordFailure(eventType, error, context);
  }

  private async recordSecurityEventBestEffort(input: SecurityEventInput): Promise<void> {
    try {
      await this.securityEvents.record(input);
    } catch (error) {
      this.logger.error('OAuth security event write failed', error instanceof Error ? error.stack : undefined);
    }
  }
}

function toOauthFailureReasonCode(error: unknown): string {
  if (error instanceof OauthDomainError) {
    return error.code;
  }
  if (error instanceof FeishuClientError) {
    return 'OAUTH_FEISHU_CLIENT_ERROR';
  }

  return 'OAUTH_INTERNAL_ERROR';
}

function toSafeFeishuErrorLog(error: FeishuClientError): Record<string, unknown> {
  const detail = error.detail ?? {};
  return {
    code: error.code,
    message: error.message,
    feishu_code: detail.feishu_code,
    path: detail.path,
    request_id: detail.request_id,
    status: detail.status
  };
}

function normalizeScope(scope: string | undefined): string {
  if (!scope || scope.trim().length === 0) {
    return DEFAULT_SCOPE;
  }

  const requested = scope.trim().split(/\s+/);
  const requestedSet = new Set(requested);
  const unknown = requested.filter((item) => !ALLOWED_SCOPES.includes(item as (typeof ALLOWED_SCOPES)[number]));
  if (unknown.length > 0) {
    throw new OauthDomainError('OAUTH_SCOPE_INVALID', 'scope 包含不支持的权限范围', 400);
  }

  return ALLOWED_SCOPES.filter((item) => requestedSet.has(item)).join(' ');
}

function normalizeFeishuRedirectUri(rawRedirectUri: string | undefined): string {
  if (!rawRedirectUri) {
    throw new OauthDomainError(
      'OAUTH_FEISHU_REDIRECT_URI_MISSING',
      'Feishu IAM 飞书 OAuth 回调地址未配置',
      500
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawRedirectUri);
  } catch {
    throw new OauthDomainError(
      'OAUTH_FEISHU_REDIRECT_URI_INVALID',
      'Feishu IAM 飞书 OAuth 回调地址格式无效',
      500
    );
  }

  const supportedPath = SUPPORTED_FEISHU_OAUTH_CALLBACK_PATHS.includes(
    parsed.pathname as (typeof SUPPORTED_FEISHU_OAUTH_CALLBACK_PATHS)[number]
  );
  if (!supportedPath) {
    throw new OauthDomainError(
      'OAUTH_FEISHU_REDIRECT_URI_UNSUPPORTED',
      'Feishu IAM 飞书 OAuth 回调地址未指向当前服务支持的回调路由',
      500
    );
  }

  return rawRedirectUri;
}

function normalizeTokenInput(input: TokenInput): RequiredTokenInput {
  const grantType = readRequiredString(input.grantType, 'OAUTH_GRANT_TYPE_UNSUPPORTED', 'grant_type 只支持 authorization_code');
  if (grantType !== 'authorization_code') {
    throw new OauthDomainError('OAUTH_GRANT_TYPE_UNSUPPORTED', 'grant_type 只支持 authorization_code', 400);
  }

  return {
    grantType,
    code: readRequiredString(input.code, 'OAUTH_CODE_REQUIRED', 'code 不能为空'),
    redirectUri: readRequiredString(input.redirectUri, 'OAUTH_REDIRECT_URI_REQUIRED', 'redirect_uri 不能为空'),
    clientId: readRequiredString(input.clientId, 'OAUTH_CLIENT_ID_REQUIRED', 'client_id 不能为空'),
    clientSecret: readRequiredString(input.clientSecret, 'OAUTH_CLIENT_SECRET_REQUIRED', 'client_secret 不能为空')
  };
}

function normalizeRevokeInput(input: RevokeInput): RequiredRevokeInput {
  return {
    token: readRequiredString(input.token, 'OAUTH_TOKEN_REQUIRED', 'token 不能为空'),
    clientId: readRequiredString(input.clientId, 'OAUTH_CLIENT_ID_REQUIRED', 'client_id 不能为空'),
    clientSecret: readRequiredString(input.clientSecret, 'OAUTH_CLIENT_SECRET_REQUIRED', 'client_secret 不能为空')
  };
}

function readRequiredString(value: unknown, code: string, message: string): string {
  if (typeof value !== 'string') {
    throw new OauthDomainError(code, message, 400);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new OauthDomainError(code, message, 400);
  }

  return trimmed;
}
