import crypto from 'node:crypto';
import Fastify from 'fastify';
import type { DbPool } from './db/pool';
import { registerApplicationApiRoutes } from './modules/applicationApi/applicationApiRoutes';
import { registerApplicationRoutes } from './modules/applications/applicationRoutes';
import { registerAuditRoutes } from './modules/audit/auditRoutes';
import { registerAuthRoutes } from './modules/auth/authRoutes';
import { MockFeishuAuthAdapter } from './modules/auth/mockFeishuAuthAdapter';
import { registerDirectoryRoutes } from './modules/directory/directoryRoutes';
import { errorHandler } from './modules/errors/errorHandler';
import { registerInitializationRoutes } from './modules/initialization/initializationRoutes';
import { registerRoleRoutes } from './modules/roles/roleRoutes';
import { registerRawBodyParser } from './plugins/rawBody';
import { registerRequestContext } from './plugins/requestContext';

export interface AppOptions {
  pool: DbPool;
  sessionCookieName: string;
  allowMockLogin: boolean;
}

export async function buildApp(options: AppOptions) {
  const app = Fastify({
    genReqId: () => crypto.randomUUID(),
  });

  app.setErrorHandler(errorHandler);
  await registerRawBodyParser(app);
  await registerRequestContext(app, options);

  app.get('/api/health', async () => ({ ok: true }));

  await registerAuthRoutes(app, {
    pool: options.pool,
    adapter: new MockFeishuAuthAdapter(),
    sessionCookieName: options.sessionCookieName,
    allowMockLogin: options.allowMockLogin,
  });
  await registerInitializationRoutes(app, options.pool);
  await registerApplicationRoutes(app, options.pool);
  await registerApplicationApiRoutes(app, options.pool);
  await registerDirectoryRoutes(app, options.pool);
  await registerRoleRoutes(app, options.pool);
  await registerAuditRoutes(app, options.pool);

  return app;
}
