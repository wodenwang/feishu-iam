import { ArgumentsHost, Catch, ExceptionFilter, Inject, Logger, Optional } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminAuthFailureRecorder } from './admin-auth-failure-recorder';
import { getAdminRequestId } from './admin-request-context';
import { AdminDomainError } from './admin.types';

type StableAdminErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
};

@Catch(AdminDomainError)
export class AdminErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AdminErrorFilter.name);

  constructor(
    @Optional()
    @Inject(AdminAuthFailureRecorder)
    private readonly authFailureRecorder?: AdminAuthFailureRecorder
  ) {}

  async catch(exception: AdminDomainError, host: ArgumentsHost): Promise<void> {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = getAdminRequestId(request);

    try {
      await this.authFailureRecorder?.recordBestEffort({
        code: exception.code,
        status: exception.status,
        message: exception.message,
        request
      });
    } catch (error) {
      this.logger.error(
        `Admin auth failure recorder failed: ${exception.code} / request id: ${requestId} / error: ${error instanceof Error ? error.name : 'unknown'}`
      );
    }

    const body: StableAdminErrorResponse = {
      error: {
        code: exception.code,
        message: exception.message,
        request_id: requestId
      }
    };

    response.status(exception.status).json(body);
  }
}
