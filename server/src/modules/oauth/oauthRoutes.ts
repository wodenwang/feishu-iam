import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DbClient, DbPool } from '../../db/pool';
import { writeAudit } from '../audit/auditRepository';
import { HttpError } from '../errors/httpError';

interface AuthorizeQuery {
  client_id?: string;
  redirect_uri?: string;
  state?: string;
}

interface TokenBody {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
}

interface OAuthApplication {
  id: string;
  app_key: string;
  status: string;
}

interface PendingOAuthRequest {
  pending_token_hash: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  expires_at: Date;
  consumed_at: Date | null;
}

export const oauthPendingCookieName = 'iam_oauth_pending';

export async function registerOAuthRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  app.get('/api/oauth/authorize', async (request, reply) => {
    await cleanupExpiredOAuthArtifacts(pool, { requestId: request.id, writeAuditLog: true });

    const query = request.query as AuthorizeQuery;
    if (!query.client_id || !query.redirect_uri || !query.state) {
      throw new HttpError(400, 'OAUTH_AUTHORIZE_INVALID_REQUEST', 'OAuth authorize 参数不完整');
    }

    const application = await findAuthorizedRedirect(pool, query.client_id, query.redirect_uri);
    if (!application) {
      await writeAudit(pool, {
        requestId: request.id,
        actorFeishuUserId: request.actor?.feishuUserId ?? null,
        action: 'oauth.authorize',
        targetType: 'application',
        result: 'failure',
        metadata: { reason: 'invalid_client_or_redirect', clientId: query.client_id },
      });
      throw new HttpError(400, 'OAUTH_CLIENT_OR_REDIRECT_INVALID', '应用或回调地址无效');
    }
    if (application.status !== 'active') {
      await writeAudit(pool, {
        requestId: request.id,
        actorFeishuUserId: request.actor?.feishuUserId ?? null,
        action: 'oauth.authorize',
        targetType: 'application',
        targetId: application.id,
        result: 'failure',
        metadata: { reason: 'application_disabled', appKey: application.app_key },
      });
      throw new HttpError(403, 'APPLICATION_DISABLED', '应用已停用');
    }

    if (!request.actor) {
      const pendingToken = await createPendingOAuthRequest(pool, {
        clientId: query.client_id,
        redirectUri: query.redirect_uri,
        state: query.state,
      });
      await writeAudit(pool, {
        requestId: request.id,
        actorFeishuUserId: null,
        action: 'oauth.pending.create',
        targetType: 'application',
        result: 'success',
        metadata: { clientId: query.client_id },
      });
      await writeAudit(pool, {
        requestId: request.id,
        actorFeishuUserId: null,
        action: 'oauth.authorize',
        targetType: 'application',
        result: 'failure',
        metadata: { reason: 'login_required', clientId: query.client_id },
      });
      reply.header('set-cookie', buildOAuthPendingCookie(pendingToken));
      reply.redirect('/login?status=loginRequired');
      return;
    }

    reply.redirect(
      await issueAuthorizationCode(pool, {
        application,
        redirectUri: query.redirect_uri,
        feishuUserId: request.actor.feishuUserId,
        state: query.state,
        requestId: request.id,
      }),
    );
  });

  app.post('/api/oauth/token', async (request) => {
    const body = request.body as TokenBody;
    if (
      body?.grant_type !== 'authorization_code' ||
      !body.code ||
      !body.redirect_uri ||
      !body.client_id ||
      !body.client_secret
    ) {
      throw new HttpError(400, 'OAUTH_TOKEN_INVALID_REQUEST', 'OAuth token 参数不完整');
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(
        `
          select c.code_hash,
                 c.application_id,
                 c.redirect_uri,
                 c.feishu_user_id,
                 c.expires_at,
                 c.consumed_at,
                 a.app_key,
                 a.status,
                 s.secret_hash
          from application_oauth_authorization_codes c
          join applications a on a.id = c.application_id
          join application_secrets s on s.application_id = a.id
          where c.code_hash = encode(digest($1, 'sha256'), 'hex')
            and a.app_key = $2
          for update
        `,
        [body.code, body.client_id],
      );
      const code = result.rows[0] as
        | {
            code_hash: string;
            application_id: string;
            redirect_uri: string;
            feishu_user_id: string;
            expires_at: Date;
            consumed_at: Date | null;
            app_key: string;
            status: string;
            secret_hash: string;
          }
        | undefined;
      if (!code) {
        throw new HttpError(400, 'OAUTH_CODE_INVALID', 'OAuth authorization code 无效');
      }
      if (code.status !== 'active') {
        throw new HttpError(403, 'APPLICATION_DISABLED', '应用已停用');
      }
      if (code.redirect_uri !== body.redirect_uri) {
        throw new HttpError(400, 'OAUTH_REDIRECT_URI_MISMATCH', 'OAuth redirect_uri 不匹配');
      }
      if (code.consumed_at) {
        throw new HttpError(400, 'OAUTH_CODE_CONSUMED', 'OAuth authorization code 已使用');
      }
      if (new Date(code.expires_at).getTime() <= Date.now()) {
        throw new HttpError(400, 'OAUTH_CODE_EXPIRED', 'OAuth authorization code 已过期');
      }
      if (sha256Hex(body.client_secret) !== code.secret_hash) {
        throw new HttpError(401, 'OAUTH_CLIENT_SECRET_INVALID', 'OAuth client_secret 无效');
      }

      const accessToken = `fiams_${crypto.randomUUID().replaceAll('-', '')}`;
      await client.query('update application_oauth_authorization_codes set consumed_at = now() where code_hash = $1', [
        code.code_hash,
      ]);
      await client.query(
        `
          insert into application_oauth_sessions(token_hash, application_id, feishu_user_id, expires_at)
          values (encode(digest($1, 'sha256'), 'hex'), $2, $3, now() + interval '8 hours')
        `,
        [accessToken, code.application_id, code.feishu_user_id],
      );
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: code.feishu_user_id,
        action: 'oauth.token.exchange',
        targetType: 'application',
        targetId: code.application_id,
        result: 'success',
        metadata: { appKey: code.app_key },
      });
      await client.query('commit');

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 28800,
        appKey: code.app_key,
        feishuUserId: code.feishu_user_id,
      };
    } catch (error) {
      await client.query('rollback');
      if (error instanceof HttpError) {
        await writeAudit(pool, {
          requestId: request.id,
          actorFeishuUserId: null,
          action: 'oauth.token.exchange',
          targetType: 'application',
          result: 'failure',
          metadata: { reason: error.code, clientId: body.client_id },
        });
      }
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function resumePendingOAuthRequest(
  pool: DbPool,
  input: { pendingToken: string; feishuUserId: string; requestId: string },
): Promise<{ redirectUrl?: string; failureReason?: string }> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const pending = await findPendingOAuthRequest(client, input.pendingToken);
    if (!pending) {
      await client.query('commit');
      return { failureReason: 'pending_not_found' };
    }
    if (pending.consumed_at) {
      await writePendingResumeFailure(client, input.requestId, input.feishuUserId, 'pending_consumed', pending.client_id);
      await client.query('commit');
      return { failureReason: 'pending_consumed' };
    }
    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await consumePendingOAuthRequest(client, pending.pending_token_hash, 'pending_expired');
      await writePendingResumeFailure(client, input.requestId, input.feishuUserId, 'pending_expired', pending.client_id);
      await client.query('commit');
      return { failureReason: 'pending_expired' };
    }

    const application = await findAuthorizedRedirect(client, pending.client_id, pending.redirect_uri);
    if (!application) {
      await consumePendingOAuthRequest(client, pending.pending_token_hash, 'invalid_client_or_redirect');
      await writePendingResumeFailure(client, input.requestId, input.feishuUserId, 'invalid_client_or_redirect', pending.client_id);
      await client.query('commit');
      return { failureReason: 'invalid_client_or_redirect' };
    }
    if (application.status !== 'active') {
      await consumePendingOAuthRequest(client, pending.pending_token_hash, 'application_disabled');
      await writePendingResumeFailure(client, input.requestId, input.feishuUserId, 'application_disabled', pending.client_id, application.id);
      await client.query('commit');
      return { failureReason: 'application_disabled' };
    }

    const redirectUrl = await issueAuthorizationCode(client, {
      application,
      redirectUri: pending.redirect_uri,
      feishuUserId: input.feishuUserId,
      state: pending.state,
      requestId: input.requestId,
    });
    await consumePendingOAuthRequest(client, pending.pending_token_hash, null);
    await writeAudit(client, {
      requestId: input.requestId,
      actorFeishuUserId: input.feishuUserId,
      action: 'oauth.pending.resume',
      targetType: 'application',
      targetId: application.id,
      result: 'success',
      metadata: { appKey: application.app_key },
    });
    await client.query('commit');
    return { redirectUrl };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupExpiredOAuthArtifacts(
  pool: DbPool,
  input: { requestId?: string; writeAuditLog?: boolean } = {},
): Promise<{ authorizationCodes: number; oauthSessions: number; pendingRequests: number }> {
  const authorizationCodes = await pool.query('delete from application_oauth_authorization_codes where expires_at <= now()');
  const oauthSessions = await pool.query('delete from application_oauth_sessions where expires_at <= now()');
  const pendingRequests = await pool.query('delete from application_oauth_pending_requests where expires_at <= now()');
  const counts = {
    authorizationCodes: authorizationCodes.rowCount ?? 0,
    oauthSessions: oauthSessions.rowCount ?? 0,
    pendingRequests: pendingRequests.rowCount ?? 0,
  };
  const total = counts.authorizationCodes + counts.oauthSessions + counts.pendingRequests;
  if (input.writeAuditLog && total > 0) {
    await writeAudit(pool, {
      requestId: input.requestId ?? 'oauth-cleanup',
      actorFeishuUserId: null,
      action: 'oauth.cleanup',
      targetType: 'oauth_artifacts',
      result: 'success',
      metadata: counts,
    });
  }
  return counts;
}

export function buildOAuthPendingCookie(value: string, options: { maxAge?: number; secure?: boolean } = {}): string {
  const parts = [`${oauthPendingCookieName}=${value}`, 'Path=/', 'SameSite=Lax', 'HttpOnly'];
  if (options.secure) {
    parts.push('Secure');
  }
  parts.push(`Max-Age=${options.maxAge ?? 300}`);
  return parts.join('; ');
}

async function createPendingOAuthRequest(pool: DbPool, input: { clientId: string; redirectUri: string; state: string }): Promise<string> {
  const token = `pending_${crypto.randomUUID().replaceAll('-', '')}`;
  await pool.query(
    `
      insert into application_oauth_pending_requests(
        pending_token_hash,
        client_id,
        redirect_uri,
        state,
        expires_at
      )
      values (encode(digest($1, 'sha256'), 'hex'), $2, $3, $4, now() + interval '5 minutes')
    `,
    [token, input.clientId, input.redirectUri, input.state],
  );
  return token;
}

async function findPendingOAuthRequest(client: DbClient, token: string): Promise<PendingOAuthRequest | undefined> {
  const result = await client.query(
    `
      select pending_token_hash, client_id, redirect_uri, state, expires_at, consumed_at
      from application_oauth_pending_requests
      where pending_token_hash = encode(digest($1, 'sha256'), 'hex')
      for update
    `,
    [token],
  );
  return result.rows[0] as PendingOAuthRequest | undefined;
}

async function consumePendingOAuthRequest(client: DbClient, pendingTokenHash: string, failureReason: string | null): Promise<void> {
  await client.query(
    `
      update application_oauth_pending_requests
      set consumed_at = now(), failure_reason = $2
      where pending_token_hash = $1
    `,
    [pendingTokenHash, failureReason],
  );
}

async function writePendingResumeFailure(
  client: DbClient,
  requestId: string,
  feishuUserId: string,
  reason: string,
  clientId: string,
  targetId?: string,
): Promise<void> {
  await writeAudit(client, {
    requestId,
    actorFeishuUserId: feishuUserId,
    action: 'oauth.pending.resume',
    targetType: 'application',
    targetId,
    result: 'failure',
    metadata: { reason, clientId },
  });
}

async function issueAuthorizationCode(
  client: DbClient,
  input: {
    application: OAuthApplication;
    redirectUri: string;
    feishuUserId: string;
    state: string;
    requestId: string;
  },
): Promise<string> {
  const code = `code_${crypto.randomUUID().replaceAll('-', '')}`;
  await client.query(
    `
      insert into application_oauth_authorization_codes(
        code_hash,
        application_id,
        redirect_uri,
        feishu_user_id,
        state,
        expires_at
      )
      values (encode(digest($1, 'sha256'), 'hex'), $2, $3, $4, $5, now() + interval '5 minutes')
    `,
    [code, input.application.id, input.redirectUri, input.feishuUserId, input.state],
  );

  await writeAudit(client, {
    requestId: input.requestId,
    actorFeishuUserId: input.feishuUserId,
    action: 'oauth.authorize',
    targetType: 'application',
    targetId: input.application.id,
    result: 'success',
    metadata: { appKey: input.application.app_key },
  });

  const redirectUrl = new URL(input.redirectUri);
  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('state', input.state);
  return redirectUrl.toString();
}

async function findAuthorizedRedirect(pool: DbClient, appKey: string, redirectUri: string) {
  const result = await pool.query(
    `
      select a.id, a.app_key, a.status
      from applications a
      join application_oauth_redirect_uris r on r.application_id = a.id
      where a.app_key = $1
        and r.redirect_uri = $2
    `,
    [appKey, redirectUri],
  );
  return result.rows[0] as OAuthApplication | undefined;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
