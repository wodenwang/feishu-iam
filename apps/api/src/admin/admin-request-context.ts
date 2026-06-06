import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { AdminContext } from './admin.types';

type RequestWithAdminContext = Request & {
  adminRequestId?: string;
  adminContext?: AdminContext;
};

const TRUSTED_REQUEST_ID_PATTERNS = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  /^req-[A-Za-z0-9._-]{1,124}$/
] as const;

export function getAdminRequestId(request: Request): string {
  const requestWithContext = request as RequestWithAdminContext;
  if (requestWithContext.adminRequestId) {
    return requestWithContext.adminRequestId;
  }

  const requestId = readRequestIdHeader(request) ?? randomUUID();
  requestWithContext.adminRequestId = requestId;
  return requestId;
}

export function setAdminContext(request: Request, context: AdminContext): void {
  (request as RequestWithAdminContext).adminContext = context;
}

export function readAdminContext(request: Request): AdminContext | null {
  return (request as RequestWithAdminContext).adminContext ?? null;
}

function readRequestIdHeader(request: Request): string | null {
  const requestId = request.header('x-request-id')?.trim();
  if (!requestId) {
    return null;
  }
  return TRUSTED_REQUEST_ID_PATTERNS.some((pattern) => pattern.test(requestId)) ? requestId : null;
}
