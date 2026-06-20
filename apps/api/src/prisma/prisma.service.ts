import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const REQUIRED_SCHEMA_VERSION = '1.0.5';
export const REQUIRED_TABLES = [
  'schema_versions',
  'system_settings',
  'applications',
  'application_redirect_uris',
  'application_clients',
  'application_developer_credentials',
  'oauth_authorization_codes',
  'oauth_access_tokens',
  'permission_groups',
  'permission_points',
  'permission_group_points',
  'iam_roles',
  'iam_role_applications',
  'iam_role_subjects',
  'admin_users',
  'audit_logs',
  'security_events',
] as const;
export const REQUIRED_COLUMNS = [
  ['application_redirect_uris', 'application_id'],
  ['application_redirect_uris', 'source_environment_id'],
  ['application_clients', 'application_id'],
  ['application_clients', 'source_environment_id'],
  ['application_clients', 'is_primary'],
  ['application_clients', 'revoked_at'],
  ['application_developer_credentials', 'application_id'],
  ['application_developer_credentials', 'token_hash'],
  ['iam_role_applications', 'iam_role_id'],
  ['iam_role_applications', 'application_id'],
  ['iam_role_applications', 'status'],
  ['iam_role_permission_groups', 'application_id'],
  ['iam_role_permission_points', 'application_id'],
] as const;
const REQUIRED_COLUMN_TABLES = REQUIRED_COLUMNS.map(([tableName]) => tableName);
const REQUIRED_COLUMN_NAMES = REQUIRED_COLUMNS.map(([, columnName]) => columnName);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async isReady(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;

    const [requiredTables] = await this.$queryRaw<Array<{ existing_count: bigint }>>`
      SELECT COUNT(*)::bigint AS "existing_count"
      FROM unnest(${REQUIRED_TABLES}::text[]) AS required_table(table_name)
      WHERE to_regclass('public.' || required_table.table_name) IS NOT NULL
    `;

    if (requiredTables?.existing_count !== BigInt(REQUIRED_TABLES.length)) {
      throw new Error(`Database schema v${REQUIRED_SCHEMA_VERSION} tables are not ready`);
    }

    const [schemaVersion] = await this.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM schema_versions
        WHERE version = ${REQUIRED_SCHEMA_VERSION}
      ) AS "exists"
    `;

    if (!schemaVersion?.exists) {
      throw new Error(`Database schema v${REQUIRED_SCHEMA_VERSION} version is not ready`);
    }

    const [requiredColumns] = await this.$queryRaw<Array<{ existing_count: bigint }>>`
      SELECT COUNT(*)::bigint AS "existing_count"
      FROM unnest(${REQUIRED_COLUMN_TABLES}::text[], ${REQUIRED_COLUMN_NAMES}::text[]) AS required_column(table_name, column_name)
      JOIN information_schema.columns existing_column
        ON existing_column.table_schema = 'public'
       AND existing_column.table_name = required_column.table_name
       AND existing_column.column_name = required_column.column_name
    `;

    if (requiredColumns?.existing_count !== BigInt(REQUIRED_COLUMNS.length)) {
      throw new Error(`Database schema v${REQUIRED_SCHEMA_VERSION} columns are not ready`);
    }

    return true;
  }
}
