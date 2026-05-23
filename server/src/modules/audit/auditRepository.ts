import type { DbPool } from '../../db/pool';

export interface AuditInput {
  requestId: string;
  actorFeishuUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  result: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

export async function writeAudit(pool: DbPool, input: AuditInput): Promise<void> {
  await pool.query(
    `
      insert into audit_logs(request_id, actor_feishu_user_id, action, target_type, target_id, result, metadata)
      values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.requestId,
      input.actorFeishuUserId,
      input.action,
      input.targetType,
      input.targetId ?? null,
      input.result,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
