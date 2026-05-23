import crypto from 'node:crypto';
import type { DbPool } from '../../db/pool';

export interface CreateApplicationInput {
  name: string;
  createdByFeishuUserId: string;
}

export async function createApplication(pool: DbPool, input: CreateApplicationInput) {
  const id = crypto.randomUUID();
  const appKey = `app_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const appSecret = `sec_${crypto.randomUUID().replaceAll('-', '')}`;
  const secretHash = crypto.createHash('sha256').update(appSecret).digest('hex');

  const result = await pool.query(
    `
      insert into applications(id, app_key, name, created_by_feishu_user_id)
      values ($1, $2, $3, $4)
      returning id, app_key, name, status, created_at
    `,
    [id, appKey, input.name, input.createdByFeishuUserId],
  );
  await pool.query('insert into application_secrets(application_id, secret_hash) values ($1, $2)', [id, secretHash]);

  return { ...result.rows[0], appSecret };
}
