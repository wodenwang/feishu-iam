import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

const PLACEHOLDER_PLATFORM_TOKEN = 'replace-with-local-admin-token';

@Injectable()
export class PlatformTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.PLATFORM_ADMIN_TOKEN;
    if (!expected || expected === PLACEHOLDER_PLATFORM_TOKEN) {
      throw new UnauthorizedException({
        error: {
          code: 'PLATFORM_TOKEN_NOT_CONFIGURED',
          message: '平台管理 token 未配置'
        }
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    if (authorization !== `Bearer ${expected}`) {
      throw new UnauthorizedException({
        error: {
          code: 'PLATFORM_TOKEN_INVALID',
          message: '平台管理 token 无效'
        }
      });
    }

    return true;
  }
}
