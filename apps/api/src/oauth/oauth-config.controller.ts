import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Inject, Param, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApplicationService } from '../permission/application.service';
import { AuditLogService } from '../permission/audit-log.service';
import { PermissionErrorFilter } from '../permission/permission-error.filter';
import { PermissionDomainError } from '../permission/permission.types';
import { PlatformTokenGuard } from '../platform/platform-token.guard';
import { OauthConfigService } from './oauth-config.service';
import { OauthErrorFilter } from './oauth-error.filter';
import { OauthDomainError, type OauthAuditContext } from './oauth.types';

type CreateEnvironmentBody = {
  environmentKey: string;
  name: string;
};

type CreateRedirectUriBody = {
  redirectUri: string;
};

type CreateClientBody = {
  name: string;
};

type ClientSecretMaterialField =
  | 'clientSecretHash'
  | 'clientSecretCiphertext'
  | 'clientSecretIv'
  | 'clientSecretAuthTag'
  | 'clientSecretAlgorithm';

type FailedAuditTarget = {
  appKey: string;
  resourceType: string;
  resourceId: string;
  action: string;
};

@Controller('/api/v1/platform/applications/:appKey')
@UseGuards(PlatformTokenGuard)
@UseFilters(OauthErrorFilter, PermissionErrorFilter)
export class OauthConfigController {
  constructor(
    @Inject(OauthConfigService)
    private readonly oauthConfig: OauthConfigService,
    @Inject(AuditLogService)
    private readonly audit: AuditLogService,
    @Inject(ApplicationService)
    private readonly applications: ApplicationService
  ) {}

  @Post('/environments')
  async createEnvironment(
    @Param('appKey') appKey: string,
    @Body() body: CreateEnvironmentBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<OauthConfigService['createEnvironment']>>> {
    return this.writeWithAudit(
      request,
      {
        appKey,
        resourceType: 'application_environment',
        resourceId: safeResourceId(body.environmentKey),
        action: 'create'
      },
      (auditContext) => this.oauthConfig.createEnvironment(appKey, body, auditContext)
    );
  }

  @Get('/environments')
  async listEnvironments(
    @Param('appKey') appKey: string
  ): Promise<{ items: Awaited<ReturnType<OauthConfigService['listEnvironments']>> }> {
    return { items: await this.oauthConfig.listEnvironments(appKey) };
  }

  @Post('/environments/:environmentId/enable')
  async enableEnvironment(
    @Param('appKey') appKey: string,
    @Param('environmentId') environmentId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<OauthConfigService['setEnvironmentStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application_environment', resourceId: environmentId, action: 'set_status' },
      (auditContext) => this.oauthConfig.setEnvironmentStatus(appKey, environmentId, 'active', auditContext)
    );
  }

  @Post('/environments/:environmentId/disable')
  async disableEnvironment(
    @Param('appKey') appKey: string,
    @Param('environmentId') environmentId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<OauthConfigService['setEnvironmentStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application_environment', resourceId: environmentId, action: 'set_status' },
      (auditContext) => this.oauthConfig.setEnvironmentStatus(appKey, environmentId, 'disabled', auditContext)
    );
  }

  @Post('/environments/:environmentId/redirect-uris')
  async createRedirectUri(
    @Param('appKey') appKey: string,
    @Param('environmentId') environmentId: string,
    @Body() body: CreateRedirectUriBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<OauthConfigService['createRedirectUri']>>> {
    return this.writeWithAudit(
      request,
      {
        appKey,
        resourceType: 'application_redirect_uri',
        resourceId: safeResourceId(body.redirectUri),
        action: 'create'
      },
      (auditContext) => this.oauthConfig.createRedirectUri(appKey, environmentId, body, auditContext)
    );
  }

  @Get('/environments/:environmentId/redirect-uris')
  async listRedirectUris(
    @Param('appKey') appKey: string,
    @Param('environmentId') environmentId: string
  ): Promise<{ items: Awaited<ReturnType<OauthConfigService['listRedirectUris']>> }> {
    return { items: await this.oauthConfig.listRedirectUris(appKey, environmentId) };
  }

  @Post('/redirect-uris/:redirectUriId/disable')
  async disableRedirectUri(
    @Param('appKey') appKey: string,
    @Param('redirectUriId') redirectUriId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<OauthConfigService['disableRedirectUri']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application_redirect_uri', resourceId: redirectUriId, action: 'set_status' },
      (auditContext) => this.oauthConfig.disableRedirectUri(appKey, redirectUriId, auditContext)
    );
  }

  @Post('/environments/:environmentId/clients')
  async createClient(
    @Param('appKey') appKey: string,
    @Param('environmentId') environmentId: string,
    @Body() body: CreateClientBody,
    @Req() request: Request
  ): Promise<Omit<Awaited<ReturnType<OauthConfigService['createClient']>>, ClientSecretMaterialField>> {
    const created = await this.writeWithAudit(
      request,
      {
        appKey,
        resourceType: 'application_client',
        resourceId: safeResourceId(body.name),
        action: 'create'
      },
      (auditContext) => this.oauthConfig.createClient(appKey, environmentId, body, auditContext)
    );
    return removeClientSecretMaterial(created);
  }

  @Get('/environments/:environmentId/clients')
  async listClients(
    @Param('appKey') appKey: string,
    @Param('environmentId') environmentId: string
  ): Promise<{ items: Awaited<ReturnType<OauthConfigService['listClients']>> }> {
    return { items: await this.oauthConfig.listClients(appKey, environmentId) };
  }

  @Post('/clients/:clientId/rotate-secret')
  async rotateClientSecret(
    @Param('appKey') appKey: string,
    @Param('clientId') clientId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<OauthConfigService['rotateClientSecret']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application_client', resourceId: clientId, action: 'rotate_secret' },
      (auditContext) => this.oauthConfig.rotateClientSecret(appKey, clientId, auditContext)
    );
  }

  @Post('/clients/:clientId/enable')
  async enableClient(
    @Param('appKey') appKey: string,
    @Param('clientId') clientId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<OauthConfigService['setClientStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application_client', resourceId: clientId, action: 'set_status' },
      (auditContext) => this.oauthConfig.setClientStatus(appKey, clientId, 'active', auditContext)
    );
  }

  @Post('/clients/:clientId/disable')
  async disableClient(
    @Param('appKey') appKey: string,
    @Param('clientId') clientId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<OauthConfigService['setClientStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application_client', resourceId: clientId, action: 'set_status' },
      (auditContext) => this.oauthConfig.setClientStatus(appKey, clientId, 'disabled', auditContext)
    );
  }

  private async writeWithAudit<T>(
    request: Request,
    target: FailedAuditTarget,
    operation: (auditContext: OauthAuditContext) => Promise<T>
  ): Promise<T> {
    const auditContext = buildAuditContext(request);
    try {
      return await operation(auditContext);
    } catch (error: unknown) {
      try {
        await this.recordFailedAudit(target, auditContext, error);
      } catch {
        // 失败审计是尽力记录，不能掩盖原始业务错误响应。
      }
      throw error;
    }
  }

  private async recordFailedAudit(
    target: FailedAuditTarget,
    auditContext: OauthAuditContext,
    error: unknown
  ): Promise<void> {
    await this.audit.record({
      actorType: 'platform_token',
      actorId: 'platform-admin-token',
      source: 'platform_api',
      applicationId: await this.resolveApplicationId(target.appKey),
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      action: target.action,
      after: {
        error: serializeAuditError(error)
      },
      result: 'failed',
      requestId: auditContext.requestId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent
    });
  }

  private async resolveApplicationId(appKey: string): Promise<string | null> {
    try {
      const application = await this.applications.getApplicationByKey(appKey);
      return application.id;
    } catch {
      return null;
    }
  }
}

function buildAuditContext(request: Request): OauthAuditContext {
  return {
    requestId: request.header('x-request-id') ?? cryptoRandomRequestId(),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}

function cryptoRandomRequestId(): string {
  return randomUUID();
}

function serializeAuditError(error: unknown): Record<string, unknown> {
  if (error instanceof OauthDomainError || error instanceof PermissionDomainError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    message: 'Unknown error'
  };
}

function safeResourceId(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function removeClientSecretMaterial<T extends Partial<Record<ClientSecretMaterialField, unknown>>>(
  client: T
): Omit<T, ClientSecretMaterialField> {
  const {
    clientSecretHash,
    clientSecretCiphertext,
    clientSecretIv,
    clientSecretAuthTag,
    clientSecretAlgorithm,
    ...response
  } = client;
  void clientSecretHash;
  void clientSecretCiphertext;
  void clientSecretIv;
  void clientSecretAuthTag;
  void clientSecretAlgorithm;
  return response;
}
