import { Module } from '@nestjs/common';
import { FeishuModule } from '../feishu/feishu.module';
import { PermissionModule } from '../permission/permission.module';
import { PlatformTokenGuard } from '../platform/platform-token.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { OauthConfigController } from './oauth-config.controller';
import { OauthConfigService } from './oauth-config.service';
import { LegacyOauthCallbackController } from './legacy-oauth-callback.controller';
import { OauthController } from './oauth.controller';
import { OauthService } from './oauth.service';
import { AppPermissionsController } from './app-permissions.controller';
import { AppTokenGuard } from './app-token.guard';
import { ApplicationOnboardingService } from './application-onboarding.service';
import { ClientSecretVault } from './client-secret-vault';
import { DeveloperApiGuard } from './developer-api.guard';
import { DeveloperCredentialService } from './developer-credential.service';
import { DeveloperPermissionController } from './developer-permission.controller';
import { IntegrationPromptService } from './integration-prompt.service';
import { SecurityEventService } from './security-event.service';

const TEST_CLIENT_SECRET_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

@Module({
  imports: [PrismaModule, PermissionModule, FeishuModule],
  controllers: [
    OauthConfigController,
    OauthController,
    LegacyOauthCallbackController,
    AppPermissionsController,
    DeveloperPermissionController
  ],
  providers: [
    PlatformTokenGuard,
    AppTokenGuard,
    DeveloperApiGuard,
    OauthConfigService,
    OauthService,
    SecurityEventService,
    DeveloperCredentialService,
    IntegrationPromptService,
    ApplicationOnboardingService,
    {
      provide: ClientSecretVault,
      useFactory: () => new ClientSecretVault(resolveClientSecretEncryptionKey()),
    },
  ],
  exports: [
    AppTokenGuard,
    DeveloperApiGuard,
    OauthConfigService,
    OauthService,
    SecurityEventService,
    DeveloperCredentialService,
    IntegrationPromptService,
    ApplicationOnboardingService,
    ClientSecretVault
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class OauthModule {}

function resolveClientSecretEncryptionKey(): string {
  const configuredKey = process.env.CLIENT_SECRET_ENCRYPTION_KEY;

  if (configuredKey) {
    return configuredKey;
  }

  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return TEST_CLIENT_SECRET_ENCRYPTION_KEY;
  }

  return '';
}
