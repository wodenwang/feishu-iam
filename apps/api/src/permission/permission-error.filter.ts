import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PermissionDomainError } from './permission.types';

type StablePermissionErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
};

@Catch(PermissionDomainError)
export class PermissionErrorFilter implements ExceptionFilter {
  catch(exception: PermissionDomainError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = request.header('x-request-id');

    const body: StablePermissionErrorResponse = {
      error: {
        code: exception.code,
        message: exception.message,
        ...(requestId ? { request_id: requestId } : {})
      }
    };

    response.status(exception.status).json(body);
  }
}
