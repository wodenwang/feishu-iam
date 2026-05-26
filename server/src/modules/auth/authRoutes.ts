import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import { writeAudit } from '../audit/auditRepository';
import { buildOAuthPendingCookie, oauthPendingCookieName, resumePendingOAuthRequest } from '../oauth/oauthRoutes';
import type { FeishuAuthAdapter, FeishuUserIdentity } from './feishuAuthAdapter';

interface AuthRouteOptions {
  pool: DbPool;
  adapter: FeishuAuthAdapter;
  sessionCookieName: string;
  allowMockLogin: boolean;
  secureCookies?: boolean;
  feishuRedirectUri?: string;
}

const oauthStateCookieName = 'iam_oauth_state';

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
    const token = await createLoginSession(options.pool, user);
    await writeAudit(options.pool, {
      requestId: request.id,
      actorFeishuUserId: user.feishuUserId,
      action: 'auth.mock_login',
      targetType: 'feishu_user',
      targetId: user.feishuUserId,
      result: 'success',
    });

    const pendingRedirect = await resolvePendingOAuthRedirect(options.pool, {
      requestId: request.id,
      feishuUserId: user.feishuUserId,
      cookieHeader: request.headers.cookie,
    });

    const sessionCookie = buildCookie(options.sessionCookieName, token, { httpOnly: true, secure: options.secureCookies });
    if (pendingRedirect) {
      reply.header('set-cookie', [sessionCookie, buildOAuthPendingCookie('', { maxAge: 0, secure: options.secureCookies })]);
    } else {
      reply.header('set-cookie', sessionCookie);
    }
    return { feishuUserId: user.feishuUserId, name: user.name, redirectTo: pendingRedirect };
  });

  app.get('/api/auth/feishu/start', async (_request, reply) => {
    if (!options.adapter.buildAuthorizationUrl || !options.feishuRedirectUri) {
      reply.redirect('/login?status=configMissing');
      return;
    }

    const state = crypto.randomUUID();
    const authorizationUrl = options.adapter.buildAuthorizationUrl({ state, redirectUri: options.feishuRedirectUri });
    reply.header('set-cookie', buildCookie(oauthStateCookieName, state, { maxAge: 300, httpOnly: true, secure: options.secureCookies }));
    reply.redirect(authorizationUrl);
  });

  app.get('/api/auth/feishu/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    const clearStateCookie = buildCookie(oauthStateCookieName, '', { maxAge: 0, httpOnly: true, secure: options.secureCookies });

    if (!options.adapter.exchangeCodeForUser || !options.feishuRedirectUri) {
      reply.header('set-cookie', clearStateCookie).redirect('/login?status=configMissing');
      return;
    }

    const stateCookie = readCookie(request.headers.cookie, oauthStateCookieName);
    if (!query.code || !query.state || !stateCookie || query.state !== stateCookie) {
      await writeAudit(options.pool, {
        requestId: request.id,
        actorFeishuUserId: null,
        action: 'auth.feishu_login',
        targetType: 'feishu_user',
        result: 'failure',
        metadata: { reason: 'invalid_state' },
      });
      reply.header('set-cookie', clearStateCookie).redirect('/login?status=authFailed');
      return;
    }

    try {
      const user = await options.adapter.exchangeCodeForUser({ code: query.code, redirectUri: options.feishuRedirectUri });
      const token = await createLoginSession(options.pool, user);
      await writeAudit(options.pool, {
        requestId: request.id,
        actorFeishuUserId: user.feishuUserId,
        action: 'auth.feishu_login',
        targetType: 'feishu_user',
        targetId: user.feishuUserId,
        result: 'success',
      });

      const redirectPath = await resolvePostLoginRedirect(options.pool, user.feishuUserId);
      const pendingRedirect =
        redirectPath === '/initialize'
          ? undefined
          : await resolvePendingOAuthRedirect(options.pool, {
              requestId: request.id,
              feishuUserId: user.feishuUserId,
              cookieHeader: request.headers.cookie,
            });
      const finalRedirectPath = pendingRedirect ?? redirectPath;
      const cookies = [
        clearStateCookie,
        buildCookie(options.sessionCookieName, token, { httpOnly: true, secure: options.secureCookies }),
      ];
      if (pendingRedirect || readCookie(request.headers.cookie, oauthPendingCookieName)) {
        cookies.push(buildOAuthPendingCookie('', { maxAge: 0, secure: options.secureCookies }));
      }
      reply
        .header('set-cookie', cookies)
        .redirect(finalRedirectPath);
    } catch (error) {
      await writeAudit(options.pool, {
        requestId: request.id,
        actorFeishuUserId: null,
        action: 'auth.feishu_login',
        targetType: 'feishu_user',
        result: 'failure',
        metadata: { reason: error instanceof Error ? error.message : 'unknown' },
      });
      reply.header('set-cookie', clearStateCookie).redirect('/login?status=authFailed');
    }
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = readCookie(request.headers.cookie, options.sessionCookieName);

    if (token) {
      await options.pool.query("delete from iam_sessions where token_hash = encode(digest($1, 'sha256'), 'hex')", [token]);
    }

    reply.header('set-cookie', buildCookie(options.sessionCookieName, '', { maxAge: 0, httpOnly: true, secure: options.secureCookies }));
    return { ok: true };
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

async function createLoginSession(pool: DbPool, user: FeishuUserIdentity): Promise<string> {
  const token = crypto.randomUUID();
  await pool.query(
    `
      insert into feishu_users(feishu_user_id, name, email, status, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (feishu_user_id)
      do update set name = excluded.name, email = excluded.email, status = excluded.status, updated_at = now()
    `,
    [user.feishuUserId, user.name, user.email ?? null, user.status],
  );
  await pool.query(
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
  await pool.query(
    `
      insert into iam_sessions(token_hash, feishu_user_id, expires_at)
      values (encode(digest($1, 'sha256'), 'hex'), $2, now() + interval '8 hours')
    `,
    [token, user.feishuUserId],
  );
  return token;
}

async function resolvePostLoginRedirect(pool: DbPool, feishuUserId: string): Promise<string> {
  const result = await pool.query(
    `
      select
        (select count(*)::int from platform_admins) as admin_count,
        exists(select 1 from platform_admins where feishu_user_id = $1) as is_platform_admin
    `,
    [feishuUserId],
  );
  const row = result.rows[0];
  if (!row || row.admin_count === 0) {
    return '/initialize';
  }
  return row.is_platform_admin ? '/applications' : '/403';
}

async function resolvePendingOAuthRedirect(
  pool: DbPool,
  input: { requestId: string; feishuUserId: string; cookieHeader: string | undefined },
): Promise<string | undefined> {
  const pendingToken = readCookie(input.cookieHeader, oauthPendingCookieName);
  if (!pendingToken) {
    return undefined;
  }

  const initialized = await isPlatformInitialized(pool);
  if (!initialized) {
    return undefined;
  }

  const result = await resumePendingOAuthRequest(pool, {
    pendingToken,
    feishuUserId: input.feishuUserId,
    requestId: input.requestId,
  });
  return result.redirectUrl;
}

async function isPlatformInitialized(pool: DbPool): Promise<boolean> {
  const result = await pool.query('select exists(select 1 from platform_admins) as initialized');
  return Boolean(result.rows[0]?.initialized);
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  return (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function buildCookie(name: string, value: string, options: { maxAge?: number; httpOnly?: boolean; secure?: boolean } = {}): string {
  const parts = [`${name}=${value}`, 'Path=/', 'SameSite=Lax'];
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  return parts.join('; ');
}
