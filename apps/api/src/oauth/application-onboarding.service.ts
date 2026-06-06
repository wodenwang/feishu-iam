import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationService } from '../permission/application.service';
import { PermissionDomainError, type PermissionAuditContext } from '../permission/permission.types';
import { DeveloperCredentialService } from './developer-credential.service';
import { IntegrationPromptService } from './integration-prompt.service';
import { OauthConfigService } from './oauth-config.service';
import type { CreateApplicationOnboardingInput } from './oauth.types';

@Injectable()
export class ApplicationOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationService,
    private readonly oauthConfig: OauthConfigService,
    private readonly developerCredentials: DeveloperCredentialService,
    private readonly prompts: IntegrationPromptService
  ) {}

  async createOnboardingPackage(input: CreateApplicationOnboardingInput, auditContext?: PermissionAuditContext) {
    if (input.redirectUris.length === 0) {
      throw new PermissionDomainError('APPLICATION_REDIRECT_URI_REQUIRED', '至少需要一个回调地址', 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.createApplicationInTransaction({
        appKey: input.appKey,
        name: input.name,
        description: input.description,
        ownerUserId: input.ownerUserId
      }, tx, auditContext);

      const redirectUris = [];
      for (const redirectUri of input.redirectUris) {
        redirectUris.push(await this.oauthConfig.createRedirectUriInTransaction(
          input.appKey,
          { redirectUri },
          tx,
          auditContext
        ));
      }

      const oauthCredential = await this.oauthConfig.createPrimaryOauthCredentialInTransaction(
        input.appKey,
        { name: '默认登录凭证' },
        tx,
        auditContext
      );
      const developerCredential = await this.developerCredentials.createCredentialInTransaction(
        input.appKey,
        '默认开发者 API 凭证',
        tx,
        auditContext
      );
      const baseIamUrl = process.env.FEISHU_IAM_PUBLIC_URL ?? `http://localhost:${process.env.HOST_WEB_PORT ?? '8000'}`;
      const integrationPrompt = this.prompts.generateFullPrompt({
        baseIamUrl,
        appKey: input.appKey,
        applicationName: input.name,
        redirectUris: input.redirectUris,
        clientId: oauthCredential.clientId,
        clientSecret: oauthCredential.clientSecret,
        developerApiToken: developerCredential.token
      });

      return {
        application,
        redirectUris,
        oauthCredential: {
          id: oauthCredential.id,
          clientId: oauthCredential.clientId,
          name: oauthCredential.name,
          status: oauthCredential.status,
          isPrimary: oauthCredential.isPrimary,
          createdAt: oauthCredential.createdAt,
          updatedAt: oauthCredential.updatedAt
        },
        clientSecret: oauthCredential.clientSecret,
        developerCredential: developerCredential.credential,
        developerApiToken: developerCredential.token,
        integrationPrompt
      };
    });
  }
}
