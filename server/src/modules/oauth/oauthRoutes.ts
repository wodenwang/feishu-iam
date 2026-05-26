import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
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

export async function registerOAuthRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  app.get('/api/oauth/authorize', async (request, reply) => {
    const query = request.query as AuthorizeQuery;
    if (!query.client_id || !query.redirect_uri || !query.state) {
      throw new HttpError(400, 'OAUTH_AUTHORIZE_INVALID_REQUEST', 'OAuth authorize 参数不完整');
    }
    if (!request.actor) {
      await writeAudit(pool, {
        requestId: request.id,
        actorFeishuUserId: null,
        action: 'oauth.authorize',
        targetType: 'application',
        result: 'failure',
        metadata: { reason: 'login_required', clientId: query.client_id },
      });
      reply.redirect('/login?status=loginRequired');
      return;
    }

    const application = await findAuthorizedRedirect(pool, query.client_id, query.redirect_uri);
    if (!application) {
      await writeAudit(pool, {
        requestId: request.id,
        actorFeishuUserId: request.actor.feishuUserId,
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
        actorFeishuUserId: request.actor.feishuUserId,
        action: 'oauth.authorize',
        targetType: 'application',
        targetId: application.id,
        result: 'failure',
        metadata: { reason: 'application_disabled', appKey: application.app_key },
      });
      throw new HttpError(403, 'APPLICATION_DISABLED', '应用已停用');
    }

    const code = `code_${crypto.randomUUID().replaceAll('-', '')}`;
    await pool.query(
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
      [code, application.id, query.redirect_uri, request.actor.feishuUserId, query.state],
    );

    await writeAudit(pool, {
      requestId: request.id,
      actorFeishuUserId: request.actor.feishuUserId,
      action: 'oauth.authorize',
      targetType: 'application',
      targetId: application.id,
      result: 'success',
      metadata: { appKey: application.app_key },
    });

    const redirectUrl = new URL(query.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', query.state);
    reply.redirect(redirectUrl.toString());
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

async function findAuthorizedRedirect(pool: DbPool, appKey: string, redirectUri: string) {
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
  return result.rows[0] as { id: string; app_key: string; status: string } | undefined;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
