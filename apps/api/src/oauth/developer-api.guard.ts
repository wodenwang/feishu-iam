import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { DeveloperCredentialService, type DeveloperCredentialContext } from './developer-credential.service';
import { getOauthRequestId } from './oauth-request-context';
import { OauthDomainError } from './oauth.types';

export type DeveloperApiRequest = Request & {
  developerCredential?: DeveloperCredentialContext;
};

@Injectable()
export class DeveloperApiGuard implements CanActivate {
  constructor(@Inject(DeveloperCredentialService) private readonly credentials: DeveloperCredentialService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeveloperApiRequest>();
    const authorization = (request.header('authorization') ?? '').trim();
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();

    if (!token) {
      throw new OauthDomainError('DEVELOPER_CREDENTIAL_REQUIRED', '需要开发者 API 凭证', 401);
    }

    request.developerCredential = await this.credentials.verifyBearerToken(token, {
      requestId: getOauthRequestId(request),
      ip: request.ip ?? null,
      userAgent: request.header('user-agent') ?? null
    });
    return true;
  }
}
