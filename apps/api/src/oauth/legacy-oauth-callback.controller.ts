import { Controller, Get, Inject, Query, Req, Res, UseFilters } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OauthErrorFilter } from './oauth-error.filter';
import { OAUTH_SSO_SESSION_COOKIE_NAME, OAUTH_SSO_SESSION_COOKIE_OPTIONS } from './oauth.controller';
import { getOauthRequestId } from './oauth-request-context';
import { OauthService } from './oauth.service';
import type { OauthAuditContext } from './oauth.types';

@Controller('api/auth/feishu')
@UseFilters(OauthErrorFilter)
export class LegacyOauthCallbackController {
  constructor(@Inject(OauthService) private readonly oauth: OauthService) {}

  @Get('callback')
  async feishuCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const result = await this.oauth.handleFeishuCallback({ code, state }, buildContext(request));
    response.cookie(OAUTH_SSO_SESSION_COOKIE_NAME, result.ssoSessionSecret, {
      ...OAUTH_SSO_SESSION_COOKIE_OPTIONS,
      maxAge: result.ssoSessionMaxAgeMs
    });
    response.redirect(302, result.redirectTo);
  }
}

function buildContext(request: Request): OauthAuditContext {
  return {
    requestId: getOauthRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}
