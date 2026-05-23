import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from './httpError';

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  const requestId = request.id;
  if (error instanceof HttpError) {
    reply.status(error.statusCode).send({
      requestId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  reply.status(500).send({
    requestId,
    code: 'INTERNAL_SERVER_ERROR',
    message: '服务暂时不可用',
    details: {},
  });
}
