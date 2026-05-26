import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppOptions } from '../app';

export interface CurrentActor {
  feishuUserId: string;
  name: string;
  isPlatformAdmin: boolean;
  oauthApplicationId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    actor: CurrentActor | null;
  }
}

export async function registerRequestContext(app: FastifyInstance, options: AppOptions): Promise<void> {
  app.addHook('preHandler', async (request) => {
    request.actor = await resolveActor(request, options);
  });
}

async function resolveActor(request: FastifyRequest, options: AppOptions): Promise<CurrentActor | null> {
  const cookie = request.headers.cookie ?? '';
  const token = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${options.sessionCookieName}=`))
    ?.split('=')[1];

  if (!token) {
    return resolveOAuthActor(request, options);
  }

  const result = await options.pool.query(
    `
      select u.feishu_user_id, u.name, exists(
        select 1 from platform_admins pa where pa.feishu_user_id = u.feishu_user_id
      ) as is_platform_admin
      from iam_sessions s
      join feishu_users u on u.feishu_user_id = s.feishu_user_id
      where s.token_hash = encode(digest($1, 'sha256'), 'hex')
        and s.expires_at > now()
    `,
    [token],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    feishuUserId: row.feishu_user_id,
    name: row.name,
    isPlatformAdmin: row.is_platform_admin,
  };
}

async function resolveOAuthActor(request: FastifyRequest, options: AppOptions): Promise<CurrentActor | null> {
  const authorization = request.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  const result = await options.pool.query(
    `
      select u.feishu_user_id, u.name, s.application_id
      from application_oauth_sessions s
      join feishu_users u on u.feishu_user_id = s.feishu_user_id
      join applications a on a.id = s.application_id
      where s.token_hash = encode(digest($1, 'sha256'), 'hex')
        and s.expires_at > now()
        and a.status = 'active'
    `,
    [token],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    feishuUserId: row.feishu_user_id,
    name: row.name,
    isPlatformAdmin: false,
    oauthApplicationId: row.application_id,
  };
}
