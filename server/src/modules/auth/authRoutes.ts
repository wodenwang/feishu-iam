import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import { writeAudit } from '../audit/auditRepository';
import type { FeishuAuthAdapter } from './feishuAuthAdapter';

interface AuthRouteOptions {
  pool: DbPool;
  adapter: FeishuAuthAdapter;
  sessionCookieName: string;
  allowMockLogin: boolean;
}

const platformAdminPermissions = [
  'dashboard:view',
  'application:view',
  'application:create',
  'application:update',
  'application:disable',
  'application:secret',
  'role:view',
  'role:update',
  'directory:view',
  'sync:view',
  'sync:run',
  'audit:view',
];

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  app.post('/api/dev/feishu/mock-login', async (request, reply) => {
    if (!options.allowMockLogin) {
      reply.status(404).send({ requestId: request.id, code: 'NOT_FOUND', message: 'Not found', details: {} });
      return;
    }

    const user = await options.adapter.resolveMockUser(request.body);
    const token = crypto.randomUUID();
    await options.pool.query(
      `
        insert into feishu_users(feishu_user_id, name, email, status, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (feishu_user_id)
        do update set name = excluded.name, email = excluded.email, status = excluded.status, updated_at = now()
      `,
      [user.feishuUserId, user.name, user.email ?? null, user.status],
    );
    await options.pool.query(
      `
        insert into directory_users(feishu_user_id, name, email, department_id, status, updated_at)
        values ($1, $2, $3, $4, $5, now())
        on conflict (feishu_user_id)
        do update set name = excluded.name,
                      email = excluded.email,
                      status = excluded.status,
                      updated_at = now()
      `,
      [user.feishuUserId, user.name, user.email ?? null, null, user.status],
    );
    await options.pool.query(
      `
        insert into iam_sessions(token_hash, feishu_user_id, expires_at)
        values (encode(digest($1, 'sha256'), 'hex'), $2, now() + interval '8 hours')
      `,
      [token, user.feishuUserId],
    );
    await writeAudit(options.pool, {
      requestId: request.id,
      actorFeishuUserId: user.feishuUserId,
      action: 'auth.mock_login',
      targetType: 'feishu_user',
      targetId: user.feishuUserId,
      result: 'success',
    });

    reply.header('set-cookie', `${options.sessionCookieName}=${token}; HttpOnly; Path=/; SameSite=Lax`);
    return { feishuUserId: user.feishuUserId, name: user.name };
  });

  app.get('/api/session/current', async (request) => {
    if (!request.actor) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        feishuUserId: request.actor.feishuUserId,
        displayName: request.actor.name,
        departmentPath: '-',
        status: 'active',
      },
      roles: request.actor.isPlatformAdmin ? ['platform_admin'] : [],
      permissions: request.actor.isPlatformAdmin ? platformAdminPermissions : [],
      applicationIds: [],
    };
  });
}
