import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FeishuDiagnosticsService } from '../src/feishu/feishu-diagnostics.service';
import { MockFeishuClient } from '../src/feishu/mock-feishu.client';

describe('FeishuDiagnosticsService', () => {
  const originalAppId = process.env.FEISHU_APP_ID;
  const originalAppSecret = process.env.FEISHU_APP_SECRET;

  beforeEach(() => {
    process.env.FEISHU_APP_ID = 'cli_test';
    process.env.FEISHU_APP_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (originalAppId === undefined) {
      delete process.env.FEISHU_APP_ID;
    } else {
      process.env.FEISHU_APP_ID = originalAppId;
    }
    if (originalAppSecret === undefined) {
      delete process.env.FEISHU_APP_SECRET;
    } else {
      process.env.FEISHU_APP_SECRET = originalAppSecret;
    }
  });

  it('返回通过态字段诊断', async () => {
    const client = new MockFeishuClient(
      {
        '0': [
          {
            department_id: 'D001',
            open_department_id: 'od-001',
            parent_department_id: '0',
            name: '总部'
          }
        ]
      },
      {
        '0': [],
        D001: [
          {
            user_id: 'u001',
            open_id: 'ou_001',
            union_id: 'on_001',
            name: '张三',
            email: 'zhangsan@example.com',
            mobile: '13800000000',
            status: { is_activated: true },
            department_ids: ['D001']
          }
        ]
      }
    );

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('passed');
    expect(result.loginReadiness.ready).toBe(true);
    expect(result.sampleCounts.departments).toBe(1);
    expect(result.sampleCounts.users).toBe(1);
    expect(result.userFields.find((field) => field.field === 'status')?.status).toBe('present');
  });

  it('用户 status 缺失时返回阻断项', async () => {
    const client = new MockFeishuClient(
      { '0': [{ department_id: 'D001', name: '总部' }] },
      { D001: [{ user_id: 'u001', name: '张三', department_ids: ['D001'] }] }
    );

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('failed');
    expect(result.loginReadiness.ready).toBe(false);
    expect(result.blockingIssues).toContain('用户 status 字段未返回，无法判断可登录用户');
    expect(result.userFields.find((field) => field.field === 'status')?.status).toBe('missing');
    expect(result.nextActions).toContain(
      '补齐用户状态字段权限 contact:user.employee:readonly，补齐后重新运行字段诊断和全量同步'
    );
  });

  it('用户 department_ids 缺失时返回阻断项和精确 scope 提示', async () => {
    const client = new MockFeishuClient(
      { '0': [{ department_id: 'D001', name: '总部' }] },
      {
        D001: [
          {
            user_id: 'u001',
            name: '张三',
            status: { is_activated: true }
          }
        ]
      }
    );

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('failed');
    expect(result.blockingIssues).toContain('用户 department_ids 字段未返回，无法建立可靠用户部门关系');
    expect(result.nextActions).toContain(
      '补齐用户组织架构字段权限 contact:user.department:readonly，用于读取 department_ids 和 orders'
    );
  });

  it('用户和部门名称缺失时返回强警告', async () => {
    const client = new MockFeishuClient(
      { '0': [{ open_department_id: 'od-001' }] },
      {
        '0': [],
        'od-001': [
          {
            user_id: 'u001',
            status: { is_activated: true },
            department_ids: ['od-001']
          }
        ]
      }
    );

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('warning');
    expect(result.loginReadiness.ready).toBe(true);
    expect(result.warnings).toContain('部门 name 字段未返回，管理端会使用部门 ID 占位');
    expect(result.warnings).toContain('用户 name 字段未返回，管理端会使用 user_id 占位');
  });

  it('抽样不到用户时返回阻断项', async () => {
    const client = new MockFeishuClient(
      { '0': [{ department_id: 'D001', name: '总部' }] },
      { D001: [] }
    );

    const result = await new FeishuDiagnosticsService(client).getFieldDiagnostics();

    expect(result.status).toBe('failed');
    expect(result.sampleCounts.users).toBe(0);
    expect(result.blockingIssues).toContain('未抽样到飞书用户，请检查通讯录可见范围');
  });

  it('飞书配置缺失时返回 not_configured 诊断', async () => {
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;

    const result = await new FeishuDiagnosticsService(new MockFeishuClient()).getFieldDiagnostics();

    expect(result.status).toBe('not_configured');
    expect(result.loginReadiness.ready).toBe(false);
    expect(result.nextActions).toContain('配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET 后重新运行字段诊断');
  });
});
