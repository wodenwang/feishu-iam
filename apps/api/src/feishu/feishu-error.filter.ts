import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { FeishuClientError } from './feishu.types';

type StableFeishuErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
};

@Catch(FeishuClientError)
export class FeishuErrorFilter implements ExceptionFilter {
  catch(exception: FeishuClientError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const nestedCode =
      typeof exception.detail?.error_code === 'string' ? exception.detail.error_code : undefined;
    const code = nestedCode ?? exception.code;
    const requestId =
      typeof exception.detail?.request_id === 'string' ? exception.detail.request_id : undefined;

    const body: StableFeishuErrorResponse = {
      error: {
        code,
        message: exception.message,
        ...(requestId ? { request_id: requestId } : {})
      }
    };

    response.status(this.httpStatusFor(code)).json(body);
  }

  private httpStatusFor(code: string): number {
    if (code === 'FEISHU_SYNC_ALREADY_RUNNING') {
      return HttpStatus.CONFLICT;
    }
    if (code === 'FEISHU_PERMISSION_DENIED') {
      return HttpStatus.FORBIDDEN;
    }
    if (code === 'FEISHU_CONFIG_MISSING') {
      return HttpStatus.BAD_REQUEST;
    }
    return HttpStatus.BAD_GATEWAY;
  }
}
