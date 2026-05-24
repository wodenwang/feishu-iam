import { isIamHttpError } from '../../features/iam/httpClient';

export function getRoleRequestId(error: unknown): string | undefined {
  return isIamHttpError(error) ? error.requestId : undefined;
}

export function formatRoleError(error: unknown, fallback: string): string {
  if (isIamHttpError(error)) {
    const requestId = error.requestId ? `（Request ID: ${error.requestId}）` : '';
    return `${error.message || fallback}${requestId}`;
  }
  return error instanceof Error && error.message ? `${fallback}：${error.message}` : fallback;
}
