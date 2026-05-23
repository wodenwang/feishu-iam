export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function unauthorized(message = '需要先通过飞书登录'): HttpError {
  return new HttpError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = '没有权限执行此操作'): HttpError {
  return new HttpError(403, 'FORBIDDEN', message);
}
