import { Controller, Get, HttpCode, Inject, NotFoundException, Post, Query, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminErrorFilter } from './admin-error.filter';
import { readAdminContext } from './admin-request-context';
import { ADMIN_SESSION_COOKIE_NAME, AdminSessionGuard, readAdminSessionCookie } from './admin-session.guard';
import { AdminDomainError, type AdminContext } from './admin.types';

const ADMIN_LOGIN_STATE_COOKIE_NAME = 'feishu_iam_admin_login_state';
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ADMIN_LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
const ADMIN_HOME_PATH = '/';
const REMOVED_ADMIN_BOOTSTRAP_PATH = ['/admin/auth', 'bootstrap'].join('/');

const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/'
};

const CLEAR_ADMIN_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/'
};

@Controller()
@UseFilters(AdminErrorFilter)
export class AdminAuthController {
  constructor(@Inject(AdminAuthService) private readonly auth: AdminAuthService) {}

  @Get('/admin/auth/login')
  login(@Res() response: Response): void {
    const login = this.auth.startFeishuLogin();
    response.cookie(ADMIN_LOGIN_STATE_COOKIE_NAME, login.state, {
      ...ADMIN_COOKIE_OPTIONS,
      maxAge: ADMIN_LOGIN_STATE_TTL_MS
    });
    response.redirect(302, login.redirectTo);
  }

  @Get(REMOVED_ADMIN_BOOTSTRAP_PATH)
  removedBootstrapGet(): never {
    throwRemovedBootstrapRoute();
  }

  @Post(REMOVED_ADMIN_BOOTSTRAP_PATH)
  removedBootstrapPost(): never {
    throwRemovedBootstrapRoute();
  }

  @Get('/admin/auth/feishu/callback')
  async feishuCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const loginStateCookie = readAdminLoginStateCookie(request);
    if (!loginStateCookie) {
      throw new AdminDomainError('ADMIN_LOGIN_STATE_INVALID', '后台登录状态已失效，请重新登录', 400);
    }

    const result = await this.auth.handleFeishuCallback(
      {
        code,
        state,
        expectedState: loginStateCookie
      },
      {
        ip: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null
      }
    );

    response.cookie(ADMIN_SESSION_COOKIE_NAME, result.sessionSecret, {
      ...ADMIN_COOKIE_OPTIONS,
      maxAge: ADMIN_SESSION_TTL_MS
    });
    response.clearCookie(ADMIN_LOGIN_STATE_COOKIE_NAME, CLEAR_ADMIN_SESSION_COOKIE_OPTIONS);
    response.redirect(302, ADMIN_HOME_PATH);
  }

  @Get('/api/v1/admin/me')
  @UseGuards(AdminSessionGuard)
  me(@Req() request: Request): AdminContext {
    const context = readAdminContext(request);

    if (!context) {
      throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
    }

    return context;
  }

  @Post('/admin/auth/logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ ok: true }> {
    const sessionCookie = readAdminSessionCookie(request);

    if (sessionCookie.status === 'present') {
      await this.auth.logout(sessionCookie.value);
    }

    response.clearCookie(ADMIN_SESSION_COOKIE_NAME, CLEAR_ADMIN_SESSION_COOKIE_OPTIONS);
    return { ok: true };
  }

  @Get('/admin/auth/logout')
  async logoutRedirect(@Req() request: Request, @Res() response: Response): Promise<void> {
    const sessionCookie = readAdminSessionCookie(request);

    if (sessionCookie.status === 'present') {
      await this.auth.logout(sessionCookie.value);
    }

    response.clearCookie(ADMIN_SESSION_COOKIE_NAME, CLEAR_ADMIN_SESSION_COOKIE_OPTIONS);
    response.redirect(302, ADMIN_HOME_PATH);
  }
}

function throwRemovedBootstrapRoute(): never {
  throw new NotFoundException({
    code: 'ADMIN_BOOTSTRAP_REMOVED',
    message: '生产路径不再提供破窗入口'
  });
}

function readAdminLoginStateCookie(request: Request): string | null {
  const cookieHeader = request.header('cookie');
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${ADMIN_LOGIN_STATE_COOKIE_NAME}=`;
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
