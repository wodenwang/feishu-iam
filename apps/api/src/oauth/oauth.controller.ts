import { Body, Controller, Get, HttpCode, Inject, Post, Query, Redirect, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
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

export const OAUTH_SSO_SESSION_COOKIE_NAME = 'feishu_iam_sso_session';
export const OAUTH_SSO_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/'
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
    @Query('prompt') prompt: string | undefined,
    @Req() request: Request
  ): Promise<{ url: string }> {
    const result = await this.oauth.startAuthorization(
      {
        responseType,
        clientId,
        redirectUri,
        state,
        scope,
        prompt,
        ssoSessionSecret: readOauthSsoSessionCookie(request)
      },
      buildContext(request)
    );
    return {
      url: result.redirectTo
    };
  }

  @Get('feishu/callback')
  async feishuCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const result = await this.oauth.handleFeishuCallback(
      {
        code,
        state
      },
        buildContext(request)
    );
    response.cookie(OAUTH_SSO_SESSION_COOKIE_NAME, result.ssoSessionSecret, {
      ...OAUTH_SSO_SESSION_COOKIE_OPTIONS,
      maxAge: result.ssoSessionMaxAgeMs
    });
    response.redirect(302, result.redirectTo);
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

export function readOauthSsoSessionCookie(request: Request): string | null {
  const cookieHeader = request.header('cookie');
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${OAUTH_SSO_SESSION_COOKIE_NAME}=`;
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!cookie) {
    return null;
  }

  try {
    const value = decodeURIComponent(cookie.slice(prefix.length)).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function buildContext(request: Request): OauthAuditContext {
  return {
    requestId: getOauthRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}
