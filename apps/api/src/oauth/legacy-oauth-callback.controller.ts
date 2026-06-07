import { Controller, Get, Inject, Query, Redirect, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { OauthErrorFilter } from './oauth-error.filter';
import { getOauthRequestId } from './oauth-request-context';
import { OauthService } from './oauth.service';
import type { OauthAuditContext } from './oauth.types';

@Controller('api/auth/feishu')
@UseFilters(OauthErrorFilter)
export class LegacyOauthCallbackController {
  constructor(@Inject(OauthService) private readonly oauth: OauthService) {}

  @Get('callback')
  @Redirect(undefined, 302)
  async feishuCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request
  ): Promise<{ url: string }> {
    const result = await this.oauth.handleFeishuCallback({ code, state }, buildContext(request));
    return { url: result.redirectTo };
  }
}

function buildContext(request: Request): OauthAuditContext {
  return {
    requestId: getOauthRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}
