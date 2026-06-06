import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { setAdminContext } from './admin-request-context';
import { AdminDomainError } from './admin.types';

export const ADMIN_SESSION_COOKIE_NAME = 'feishu_iam_admin_session';

export type AdminSessionCookieResult =
  | { status: 'present'; value: string }
  | { status: 'missing' }
  | { status: 'invalid' };

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(@Inject(AdminAuthService) private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionCookie = readAdminSessionCookie(request);

    if (sessionCookie.status === 'missing') {
      throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
    }

    if (sessionCookie.status === 'invalid') {
      throw new AdminDomainError('ADMIN_SESSION_INVALID', '后台登录态无效', 401);
    }

    const adminContext = await this.auth.getContextFromSessionSecret(sessionCookie.value);
    setAdminContext(request, adminContext);
    return true;
  }
}

export function readAdminSessionCookie(request: Request): AdminSessionCookieResult {
  return readCookie(request, ADMIN_SESSION_COOKIE_NAME);
}

function readCookie(request: Request, name: string): AdminSessionCookieResult {
  const cookieHeader = request.header('cookie');
  if (!cookieHeader) {
    return { status: 'missing' };
  }

  const prefix = `${name}=`;
  const cookies = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));

  if (cookies.length === 0) {
    return { status: 'missing' };
  }

  if (cookies.length > 1) {
    return { status: 'invalid' };
  }

  const rawValue = cookies[0]?.slice(prefix.length) ?? '';
  let value: string;
  try {
    value = decodeURIComponent(rawValue);
  } catch {
    return { status: 'invalid' };
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? { status: 'present', value: normalizedValue } : { status: 'missing' };
}
