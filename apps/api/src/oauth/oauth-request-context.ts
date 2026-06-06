import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

type RequestWithOauthContext = Request & {
  oauthRequestId?: string;
};

export function getOauthRequestId(request: Request): string {
  const requestWithContext = request as RequestWithOauthContext;
  if (requestWithContext.oauthRequestId) {
    return requestWithContext.oauthRequestId;
  }

  const requestId = request.header('x-request-id') || randomUUID();
  requestWithContext.oauthRequestId = requestId;
  return requestId;
}
