import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type ApplicationDeveloperCredential } from '@prisma/client';
import { ApplicationService } from '../permission/application.service';
import { AuditLogService } from '../permission/audit-log.service';
import { PermissionDomainError, type PermissionAuditContext } from '../permission/permission.types';
import { PrismaService } from '../prisma/prisma.service';
import { createOauthSecret, hashOauthSecret } from './oauth-crypto';
import { OauthDomainError, type OauthAuditContext } from './oauth.types';
import { SecurityEventService } from './security-event.service';

type SafeDeveloperCredential = Omit<ApplicationDeveloperCredential, 'tokenHash'>;
type DeveloperCredentialClient = Pick<Prisma.TransactionClient, 'applicationDeveloperCredential' | 'auditLog'>;

export type DeveloperCredentialContext = {
  credentialId: string;
  applicationId: string;
  appKey: string;
};

const SYSTEM_ACTOR = {
  actorType: 'platform_token',
  actorId: 'platform-admin-token',
  source: 'platform_api'
};

@Injectable()
export class DeveloperCredentialService {
  private readonly logger = new Logger(DeveloperCredentialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationService,
    private readonly audit: AuditLogService,
    private readonly securityEvents: SecurityEventService
  ) {}

  async createCredential(
    appKey: string,
    name: string,
    auditContext?: PermissionAuditContext
  ): Promise<{ credential: SafeDeveloperCredential; token: string }> {
    return this.prisma.$transaction((tx) => this.createCredentialInTransaction(appKey, name, tx, auditContext));
  }

  async rotatePrimaryCredential(
    appKey: string,
    auditContext?: PermissionAuditContext
  ): Promise<{ credential: SafeDeveloperCredential; token: string }> {
    return this.prisma.$transaction((tx) =>
      this.rotatePrimaryCredentialInTransaction(appKey, tx, auditContext)
    );
  }

  async rotatePrimaryCredentialInTransaction(
    appKey: string,
    tx: Prisma.TransactionClient,
    auditContext?: PermissionAuditContext
  ): Promise<{ credential: SafeDeveloperCredential; token: string }> {
    const application = await this.applications.getApplicationByKey(appKey, tx);
    const credentials = await tx.applicationDeveloperCredential.findMany({
      where: { applicationId: application.id },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
    });
    const current = credentials.find((credential) => credential.status === 'active') ?? credentials[0] ?? null;

    if (!current) {
      return this.createCredentialInTransaction(appKey, '默认开发者 API 凭证', tx, auditContext);
    }

    const token = createOauthSecret('biad');
    const tokenHash = hashOauthSecret(token);
    const updated = await tx.applicationDeveloperCredential.update({
      where: { id: current.id },
      data: {
        tokenHash,
        status: 'active',
        rotatedAt: new Date()
      }
    });

    await this.recordAudit(
      application.id,
      updated.id,
      removeTokenHash(current),
      { ...removeTokenHash(updated), tokenShownOnce: true },
      tx,
      auditContext,
      'rotate_secret'
    );

    return { credential: removeTokenHash(updated), token };
  }

  async listCredentials(appKey: string): Promise<SafeDeveloperCredential[]> {
    const application = await this.applications.getApplicationByKey(appKey);
    const credentials = await this.prisma.applicationDeveloperCredential.findMany({
      where: { applicationId: application.id },
      orderBy: { createdAt: 'asc' }
    });
    return credentials.map(removeTokenHash);
  }

  async createCredentialInTransaction(
    appKey: string,
    name: string,
    tx: Prisma.TransactionClient,
    auditContext?: PermissionAuditContext
  ): Promise<{ credential: SafeDeveloperCredential; token: string }> {
    const token = createOauthSecret('biad');
    const tokenHash = hashOauthSecret(token);

    try {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const created = await tx.applicationDeveloperCredential.create({
        data: {
          id: randomUUID(),
          applicationId: application.id,
          tokenHash,
          name,
          status: 'active'
        }
      });

      await this.recordAudit(
        application.id,
        created.id,
        undefined,
        { ...removeTokenHash(created), tokenShownOnce: true },
        tx,
        auditContext,
        'create'
      );

      return { credential: removeTokenHash(created), token };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new PermissionDomainError('DEVELOPER_CREDENTIAL_CONFLICT', '开发者 API 凭证已存在', 409);
      }
      throw error;
    }
  }

  async verifyBearerToken(token: string, auditContext: OauthAuditContext): Promise<DeveloperCredentialContext> {
    const tokenHash = hashOauthSecret(token);
    const credential = await this.prisma.applicationDeveloperCredential.findUnique({
      where: { tokenHash },
      include: { application: true }
    });

    if (!credential) {
      await this.recordCredentialFailureEventBestEffort(
        auditContext,
        null,
        'DEVELOPER_CREDENTIAL_INVALID',
        '开发者 API 凭证无效'
      );
      throw new OauthDomainError('DEVELOPER_CREDENTIAL_INVALID', '开发者 API 凭证无效', 401);
    }

    if (credential.status !== 'active') {
      await this.recordCredentialFailureEventBestEffort(
        auditContext,
        credential.applicationId,
        'DEVELOPER_CREDENTIAL_DISABLED',
        '开发者 API 凭证已停用'
      );
      throw new OauthDomainError('DEVELOPER_CREDENTIAL_DISABLED', '开发者 API 凭证已停用', 403);
    }

    if (credential.application.status !== 'active') {
      await this.recordCredentialFailureEventBestEffort(
        auditContext,
        credential.applicationId,
        'DEVELOPER_APPLICATION_DISABLED',
        '开发者 API 所属应用已停用'
      );
      throw new OauthDomainError('DEVELOPER_APPLICATION_DISABLED', '开发者 API 所属应用已停用', 403);
    }

    await this.prisma.applicationDeveloperCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() }
    });

    return {
      credentialId: credential.id,
      applicationId: credential.applicationId,
      appKey: credential.application.appKey
    };
  }

  private async recordAudit(
    applicationId: string,
    resourceId: string,
    before: unknown,
    after: unknown,
    client: DeveloperCredentialClient,
    auditContext?: PermissionAuditContext,
    action = 'create'
  ): Promise<void> {
    await this.audit.record({
      actorType: auditContext?.actorType ?? SYSTEM_ACTOR.actorType,
      actorId: auditContext?.actorId ?? SYSTEM_ACTOR.actorId,
      source: auditContext?.source ?? SYSTEM_ACTOR.source,
      applicationId,
      resourceType: 'application_developer_credential',
      resourceId,
      action,
      before,
      after,
      result: 'success',
      requestId: auditContext?.requestId,
      ip: auditContext?.ip,
      userAgent: auditContext?.userAgent
    }, client);
  }

  private async recordCredentialFailureEventBestEffort(
    auditContext: OauthAuditContext,
    applicationId: string | null,
    reasonCode: string,
    summary: string
  ): Promise<void> {
    try {
      await this.securityEvents.record({
        eventType: 'developer_api_credential_invalid',
        applicationId,
        result: 'failed',
        reasonCode,
        summary,
        requestId: auditContext.requestId,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent
      });
    } catch {
      this.logger.warn('Failed to record developer API credential security event');
    }
  }
}

function removeTokenHash(credential: ApplicationDeveloperCredential): SafeDeveloperCredential {
  const { tokenHash, ...safeCredential } = credential;
  void tokenHash;
  return safeCredential;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
