import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService, REQUIRED_COLUMNS, REQUIRED_TABLES } from '../src/prisma/prisma.service';

describe('v0.5.0 migration', () => {
  it('declares admin console schema version and fixed admin roles', () => {
    const migration = readFileSync(join(process.cwd(), '../../migrations/V0_5_0__admin_console.sql'), 'utf8');

    expect(migration).toContain("VALUES ('0.5.0', '管理后台与管理员体系最小闭环')");
    expect(migration).toContain('INSERT INTO admin_roles(id, role_key, name, description)');
    expect(migration).toContain("('admin-role-platform-admin', 'platform_admin', '平台管理员'");
    expect(migration).toContain("('admin-role-application-admin', 'application_admin', '应用管理员'");
    expect(migration).toContain("('admin-role-audit-viewer', 'audit_viewer', '审计查看员'");
    expect(migration).toContain("('admin-role-sync-admin', 'sync_admin', '同步管理员'");
  });
});

describe('v0.8.1 migration', () => {
  it('迁移到应用级接入前先处理历史重复数据并补齐约束', () => {
    const migration = readFileSync(
      join(process.cwd(), '../../migrations/V0_8_1__application_onboarding.sql'),
      'utf8',
    );

    expect(migration).toContain('WITH ranked_redirect_uris AS');
    expect(migration).toContain('PARTITION BY application_id, redirect_uri');
    expect(migration).toContain("CASE WHEN status = 'active' THEN 0 ELSE 1 END");
    expect(migration).toContain('updated_at DESC');
    expect(migration).toContain('created_at DESC');
    expect(migration).toContain('id ASC');
    expect(migration).toContain('DELETE FROM application_redirect_uris');
    expect(migration).toContain('application_redirect_uris_application_fk');
    expect(migration).toContain('application_clients_application_fk');
    expect(migration.match(/REFERENCES applications\(id\) ON UPDATE CASCADE ON DELETE RESTRICT/g)).toHaveLength(3);
    expect(migration).toContain('application_clients_application_client_unique');
    expect(migration).toContain('ON application_clients(application_id, client_id)');
  });
});

describe('v0.9.0 migration', () => {
  it('补齐 primary client 时保留已有 primary 并使用确定性排序', () => {
    const migration = readFileSync(
      join(process.cwd(), '../../migrations/V0_9_0__admin_console_onboarding_contract.sql'),
      'utf8',
    );
    const normalized = migration.replace(/\s+/g, ' ').trim();

    expect(normalized).toMatch(
      /row_number\(\) OVER \( PARTITION BY application_id ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, last_used_at DESC NULLS LAST, created_at DESC, id ASC \) AS rn/,
    );
    expect(normalized).toMatch(
      /FROM application_clients WHERE revoked_at IS NULL AND NOT EXISTS \( SELECT 1 FROM application_clients existing_primary WHERE existing_primary\.application_id = application_clients\.application_id AND existing_primary\.is_primary = true AND existing_primary\.revoked_at IS NULL \)/,
    );
    expect(normalized).toMatch(
      /UPDATE application_clients c SET is_primary = true FROM ranked_clients WHERE ranked_clients\.id = c\.id AND ranked_clients\.rn = 1;/,
    );
    expect(normalized).not.toContain('SET is_primary = ranked_clients.rn = 1');
  });
});

describe('PrismaService ready check', () => {
  it('保留历史核心表并要求 v1.0.5 角色应用绑定表', () => {
    expect(REQUIRED_TABLES).toEqual(
      expect.arrayContaining([
        'system_settings',
        'iam_role_subjects',
        'application_developer_credentials',
        'iam_role_applications',
      ]),
    );
    expect(REQUIRED_COLUMNS).toEqual(
      expect.arrayContaining([
        ['iam_role_applications', 'iam_role_id'],
        ['iam_role_applications', 'application_id'],
        ['iam_role_applications', 'status'],
      ]),
    );
  });

  it('要求数据库至少迁移到 v1.0.5', async () => {
    const service = new PrismaService();
    const query = vi
      .spyOn(service, '$queryRaw')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ existing_count: BigInt(REQUIRED_TABLES.length) }] as never)
      .mockResolvedValueOnce([{ exists: false }] as never);

    await expect(service.isReady()).rejects.toThrow('Database schema v1.0.5 version is not ready');
    expect(query).toHaveBeenCalledTimes(3);

    await service.$disconnect();
  });

  it('缺少 schema_versions 或其他核心表时不先查询 schema version', async () => {
    const service = new PrismaService();
    const query = vi
      .spyOn(service, '$queryRaw')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ existing_count: BigInt(4) }] as never);

    await expect(service.isReady()).rejects.toThrow('Database schema v1.0.5 tables are not ready');
    expect(query).toHaveBeenCalledTimes(2);

    await service.$disconnect();
  });

  it('要求 v1.0.5 应用接入与角色应用绑定列契约存在', async () => {
    const service = new PrismaService();
    const query = vi
      .spyOn(service, '$queryRaw')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ existing_count: BigInt(REQUIRED_TABLES.length) }] as never)
      .mockResolvedValueOnce([{ exists: true }] as never)
      .mockResolvedValueOnce([{ existing_count: BigInt(REQUIRED_COLUMNS.length - 1) }] as never);

    await expect(service.isReady()).rejects.toThrow('Database schema v1.0.5 columns are not ready');
    expect(query).toHaveBeenCalledTimes(4);

    await service.$disconnect();
  });

  it('v1.0.5 schema version、核心表和列契约都就绪时返回 true', async () => {
    const service = new PrismaService();
    const query = vi
      .spyOn(service, '$queryRaw')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ existing_count: BigInt(REQUIRED_TABLES.length) }] as never)
      .mockResolvedValueOnce([{ exists: true }] as never)
      .mockResolvedValueOnce([{ existing_count: BigInt(REQUIRED_COLUMNS.length) }] as never);

    await expect(service.isReady()).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(4);

    await service.$disconnect();
  });
});
