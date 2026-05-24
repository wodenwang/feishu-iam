import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody: string;
  }
}

export async function registerRawBodyParser(app: FastifyInstance): Promise<void> {
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const rawBody = typeof body === 'string' ? body : body.toString('utf8');
    request.rawBody = rawBody;
    if (rawBody.trim() === '') {
      const error = new Error('Body cannot be empty when content-type is set to application/json') as Error & {
        statusCode: number;
      };
      error.statusCode = 400;
      done(error);
      return;
    }

    try {
      done(null, JSON.parse(rawBody));
    } catch (error) {
      done(error as Error);
    }
  });

  app.addHook('preHandler', async (request) => {
    request.rawBody ??= '';
  });
}
