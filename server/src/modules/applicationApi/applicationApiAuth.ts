import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DbPool } from '../../db/pool';
import { HttpError } from '../errors/httpError';

const timestampToleranceSeconds = 300;

export interface ApplicationApiContext {
  applicationId: string;
  appKey: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    applicationApi: ApplicationApiContext | null;
  }
}

export function applicationApiAuth(pool: DbPool) {
  return async function authenticateApplicationApi(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const headers = readHeaders(request);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const timestamp = Number(headers.timestamp);
    if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > timestampToleranceSeconds) {
      throw new HttpError(401, 'APPLICATION_API_TIMESTAMP_EXPIRED', 'Application API timestamp 已过期');
    }

    const rawBody = request.rawBody ?? '';
    const actualBodyHash = sha256Hex(rawBody);
    if (!timingSafeEqual(headers.bodyHash, actualBodyHash)) {
      throw new HttpError(401, 'APPLICATION_API_BODY_HASH_MISMATCH', 'Application API body hash 不匹配');
    }

    const credential = await pool.query(
      `
        select a.id, a.app_key, a.status, c.api_secret_hash
        from applications a
        join application_api_credentials c on c.application_id = a.id
        where a.app_key = $1
      `,
      [headers.appKey],
    );
    const row = credential.rows[0] as
      | { id: string; app_key: string; status: string; api_secret_hash: string }
      | undefined;
    if (!row) {
      throw new HttpError(401, 'APPLICATION_API_CREDENTIAL_INVALID', 'Application API credential 无效');
    }
    if (row.status !== 'active') {
      throw new HttpError(403, 'APPLICATION_DISABLED', '应用已停用');
    }

    const expectedSignature = crypto
      .createHmac('sha256', row.api_secret_hash)
      .update(buildCanonicalString(request, headers.timestamp, headers.nonce, headers.bodyHash))
      .digest('hex');
    if (!timingSafeEqual(headers.signature, expectedSignature)) {
      throw new HttpError(401, 'APPLICATION_API_SIGNATURE_INVALID', 'Application API signature 无效');
    }

    try {
      await pool.query(
        `
          insert into application_api_nonces(application_id, nonce, request_timestamp)
          values ($1, $2, to_timestamp($3))
        `,
        [row.id, headers.nonce, timestamp],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(401, 'APPLICATION_API_NONCE_REPLAYED', 'Application API nonce 已使用');
      }
      throw error;
    }

    request.applicationApi = {
      applicationId: row.id,
      appKey: row.app_key,
    };
  };
}

function readHeaders(request: FastifyRequest) {
  const appKey = readRequiredHeader(request, 'x-fiam-app-key');
  const timestamp = readRequiredHeader(request, 'x-fiam-timestamp');
  const nonce = readRequiredHeader(request, 'x-fiam-nonce');
  const bodyHash = readRequiredHeader(request, 'x-fiam-body-sha256');
  const signature = readRequiredHeader(request, 'x-fiam-signature');

  if (!/^[a-f0-9]{64}$/.test(bodyHash)) {
    throw new HttpError(401, 'APPLICATION_API_BODY_HASH_INVALID', 'Application API body hash 格式无效');
  }
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    throw new HttpError(401, 'APPLICATION_API_SIGNATURE_INVALID', 'Application API signature 无效');
  }

  return { appKey, timestamp, nonce, bodyHash, signature };
}

function readRequiredHeader(request: FastifyRequest, name: string): string {
  const value = request.headers[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(401, 'APPLICATION_API_AUTH_REQUIRED', '缺少 Application API 鉴权头');
  }
  return value.trim();
}

function buildCanonicalString(request: FastifyRequest, timestamp: string, nonce: string, bodyHash: string): string {
  const url = new URL(request.url, 'http://feishu-iam.local');
  return [
    request.method.toUpperCase(),
    url.pathname,
    normalizeQuery(url.searchParams),
    timestamp,
    nonce,
    bodyHash,
  ].join('\n');
}

function normalizeQuery(searchParams: URLSearchParams): string {
  return [...searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }
      return leftKey.localeCompare(rightKey);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

