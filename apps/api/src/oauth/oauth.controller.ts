import { Body, Controller, Get, HttpCode, Inject, Post, Query, Redirect, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AppTokenGuard, readAppTokenContext } from './app-token.guard';
import { OauthErrorFilter } from './oauth-error.filter';
import { getOauthRequestId } from './oauth-request-context';
import { OauthService } from './oauth.service';
import type { OauthAuditContext, RevokeResponse, TokenResponse, UserinfoResponse } from './oauth.types';

type TokenFormBody = {
  grant_type?: unknown;
  code?: unknown;
  redirect_uri?: unknown;
  client_id?: unknown;
  client_secret?: unknown;
};

type RevokeFormBody = {
  token?: unknown;
  client_id?: unknown;
  client_secret?: unknown;
};

@Controller('oauth')
@UseFilters(OauthErrorFilter)
export class OauthController {
  constructor(@Inject(OauthService) private readonly oauth: OauthService) {}

  @Get('authorize')
  @Redirect(undefined, 302)
  async authorize(
    @Query('response_type') responseType: string | undefined,
    @Query('client_id') clientId: string | undefined,
    @Query('redirect_uri') redirectUri: string | undefined,
    @Query('state') state: string | undefined,
    @Query('scope') scope: string | undefined,
    @Req() request: Request
  ): Promise<{ url: string }> {
    const result = await this.oauth.startAuthorization(
      {
        responseType,
        clientId,
        redirectUri,
        state,
        scope
      },
      buildContext(request)
    );
    return {
      url: result.redirectTo
    };
  }

  @Get('feishu/callback')
  @Redirect(undefined, 302)
  async feishuCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request
  ): Promise<{ url: string }> {
    const result = await this.oauth.handleFeishuCallback(
      {
        code,
        state
      },
      buildContext(request)
    );
    return {
      url: result.redirectTo
    };
  }

  @Post('token')
  @HttpCode(200)
  async token(@Body() body: TokenFormBody, @Req() request: Request): Promise<TokenResponse> {
    return this.oauth.exchangeCode(
      {
        grantType: body.grant_type,
        code: body.code,
        redirectUri: body.redirect_uri,
        clientId: body.client_id,
        clientSecret: body.client_secret
      },
      buildContext(request)
    );
  }

  @Get('userinfo')
  @UseGuards(AppTokenGuard)
  async userinfo(@Req() request: Request): Promise<UserinfoResponse> {
    return this.oauth.getUserinfo(readAppTokenContext(request), buildContext(request));
  }

  @Post('revoke')
  @HttpCode(200)
  async revoke(@Body() body: RevokeFormBody, @Req() request: Request): Promise<RevokeResponse> {
    return this.oauth.revokeToken(
      {
        token: body.token,
        clientId: body.client_id,
        clientSecret: body.client_secret
      },
      buildContext(request)
    );
  }
}

function buildContext(request: Request): OauthAuditContext {
  return {
    requestId: getOauthRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}
