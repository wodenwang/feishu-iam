import { Inject, Injectable } from '@nestjs/common';
import { FEISHU_CLIENT, type FeishuClient } from './feishu-client';
import {
  isFeishuUserActive,
  type FeishuDepartmentItem,
  type FeishuDiagnosticField,
  type FeishuDiagnosticRequiredLevel,
  type FeishuFieldDiagnostics,
  type FeishuUserItem
} from './feishu.types';

type FieldDefinition = {
  field: string;
  requiredLevel: FeishuDiagnosticRequiredLevel;
};

type FieldCounters = {
  presentCount: number;
  missingCount: number;
  emptyCount: number;
};

const MAX_DEPARTMENT_SAMPLE = 5;
const MAX_USER_SAMPLE = 20;

const DEPARTMENT_FIELDS: FieldDefinition[] = [
  { field: 'department_id', requiredLevel: 'warning' },
  { field: 'open_department_id', requiredLevel: 'warning' },
  { field: 'name', requiredLevel: 'strong_warning' },
  { field: 'i18n_name', requiredLevel: 'warning' },
  { field: 'parent_department_id', requiredLevel: 'warning' }
];

const USER_FIELDS: FieldDefinition[] = [
  { field: 'user_id', requiredLevel: 'blocking' },
  { field: 'open_id', requiredLevel: 'warning' },
  { field: 'union_id', requiredLevel: 'warning' },
  { field: 'name', requiredLevel: 'strong_warning' },
  { field: 'status', requiredLevel: 'blocking' },
  { field: 'email', requiredLevel: 'warning' },
  { field: 'mobile', requiredLevel: 'warning' },
  { field: 'department_ids', requiredLevel: 'blocking' }
];

@Injectable()
export class FeishuDiagnosticsService {
  constructor(@Inject(FEISHU_CLIENT) private readonly feishuClient: FeishuClient) {}

  async getFieldDiagnostics(): Promise<FeishuFieldDiagnostics> {
    if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
      return this.notConfiguredDiagnostics();
    }

    const departments = await this.sampleDepartments();
    const users = await this.sampleUsers(departments);
    const departmentFields = this.evaluateFields(departments, DEPARTMENT_FIELDS);
    const userFields = this.evaluateFields(users, USER_FIELDS);
    const activeUsers = users.filter((user) => isFeishuUserActive(user.status)).length;
    const blockingIssues = this.buildBlockingIssues(users, userFields, activeUsers);
    const warnings = this.buildWarnings(departmentFields, userFields);

    return {
      status: blockingIssues.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
      loginReadiness: {
        ready: blockingIssues.length === 0,
        reason:
          blockingIssues[0] ??
          (warnings.length > 0 ? '关键字段满足登录准备要求，但展示字段仍需补齐' : '字段满足后续 SSO 准备要求')
      },
      sampleCounts: {
        departments: departments.length,
        users: users.length,
        activeUsers
      },
      departmentFields,
      userFields,
      blockingIssues,
      warnings,
      nextActions: this.buildNextActions(blockingIssues, warnings)
    };
  }

  private async sampleDepartments(): Promise<FeishuDepartmentItem[]> {
    const page = await this.feishuClient.listDepartmentChildren({
      departmentId: '0',
      pageSize: MAX_DEPARTMENT_SAMPLE
    });
    return page.items.slice(0, MAX_DEPARTMENT_SAMPLE);
  }

  private async sampleUsers(departments: FeishuDepartmentItem[]): Promise<FeishuUserItem[]> {
    const departmentIds = [
      '0',
      ...departments
        .map((department) => department.department_id ?? department.open_department_id)
        .filter((departmentId): departmentId is string => Boolean(departmentId))
    ];
    const users: FeishuUserItem[] = [];

    for (const departmentId of departmentIds) {
      if (users.length >= MAX_USER_SAMPLE) {
        break;
      }
      const page = await this.feishuClient.listDepartmentUsers({
        departmentId,
        pageSize: MAX_USER_SAMPLE - users.length
      });
      users.push(...page.items);
    }

    return users.slice(0, MAX_USER_SAMPLE);
  }

  private evaluateFields(items: object[], definitions: FieldDefinition[]): FeishuDiagnosticField[] {
    return definitions.map((definition) => {
      if (items.length === 0) {
        return {
          field: definition.field,
          status: 'not_sampled',
          presentCount: 0,
          missingCount: 0,
          emptyCount: 0,
          requiredLevel: definition.requiredLevel
        };
      }

      const counters = items.reduce<FieldCounters>(
        (acc, item) => {
          const record = item as Record<string, unknown>;
          if (!(definition.field in record)) {
            acc.missingCount += 1;
            return acc;
          }
          if (this.isEmptyValue(record[definition.field])) {
            acc.emptyCount += 1;
            return acc;
          }
          acc.presentCount += 1;
          return acc;
        },
        { presentCount: 0, missingCount: 0, emptyCount: 0 }
      );

      return {
        field: definition.field,
        status:
          counters.presentCount > 0
            ? 'present'
            : counters.emptyCount > 0
              ? 'empty'
              : counters.missingCount > 0
                ? 'missing'
                : 'not_sampled',
        ...counters,
        requiredLevel: definition.requiredLevel
      };
    });
  }

  private isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    return false;
  }

  private buildBlockingIssues(
    users: FeishuUserItem[],
    userFields: FeishuDiagnosticField[],
    activeUsers: number
  ): string[] {
    const issues: string[] = [];
    if (users.length === 0) {
      issues.push('未抽样到飞书用户，请检查通讯录可见范围');
    }
    if (this.fieldIsUnavailable(userFields, 'status')) {
      issues.push('用户 status 字段未返回，无法判断可登录用户');
    }
    if (this.fieldIsUnavailable(userFields, 'department_ids')) {
      issues.push('用户 department_ids 字段未返回，无法建立可靠用户部门关系');
    }
    if (users.length > 0 && !this.fieldIsUnavailable(userFields, 'status') && activeUsers === 0) {
      issues.push('抽样用户中没有可登录用户，请确认用户状态和通讯录范围');
    }
    return issues;
  }

  private buildWarnings(
    departmentFields: FeishuDiagnosticField[],
    userFields: FeishuDiagnosticField[]
  ): string[] {
    const warnings: string[] = [];
    if (this.fieldIsUnavailable(departmentFields, 'name')) {
      warnings.push('部门 name 字段未返回，管理端会使用部门 ID 占位');
    }
    if (this.fieldIsUnavailable(userFields, 'name')) {
      warnings.push('用户 name 字段未返回，管理端会使用 user_id 占位');
    }
    for (const optionalField of ['email', 'mobile']) {
      if (this.fieldIsUnavailable(userFields, optionalField)) {
        warnings.push(`用户 ${optionalField} 字段未返回，相关展示信息会缺失`);
      }
    }
    return warnings;
  }

  private fieldIsUnavailable(fields: FeishuDiagnosticField[], field: string): boolean {
    const diagnostic = fields.find((item) => item.field === field);
    return diagnostic?.status === 'missing' || diagnostic?.status === 'empty' || diagnostic?.status === 'not_sampled';
  }

  private buildNextActions(blockingIssues: string[], warnings: string[]): string[] {
    if (blockingIssues.length === 0 && warnings.length === 0) {
      return ['字段完整性满足 v0.2.x 身份镜像发布门槛，可以执行真实同步验收'];
    }

    const actions = [
      '检查飞书应用的通讯录只读权限和通讯录可见范围',
      '若希望一次性补齐通讯录读取字段，可申请 contact:contact:readonly_as_app 或 contact:contact:access_as_app'
    ];
    if (blockingIssues.some((issue) => issue.includes('status'))) {
      actions.push('补齐用户状态字段权限 contact:user.employee:readonly，补齐后重新运行字段诊断和全量同步');
    }
    if (blockingIssues.some((issue) => issue.includes('department_ids'))) {
      actions.push('补齐用户组织架构字段权限 contact:user.department:readonly，用于读取 department_ids 和 orders');
    }
    if (warnings.some((warning) => warning.includes('name'))) {
      actions.push(
        '补齐名称字段权限 contact:user.base:readonly 和 contact:department.base:readonly，用于读取用户姓名和部门名称'
      );
    }
    if (warnings.some((warning) => warning.includes('email'))) {
      actions.push('如果管理端需要展示邮箱，请补齐 contact:user.email:readonly');
    }
    if (warnings.some((warning) => warning.includes('mobile'))) {
      actions.push('如果管理端需要展示手机号，请补齐 contact:user.phone:readonly');
    }
    return actions;
  }

  private notConfiguredDiagnostics(): FeishuFieldDiagnostics {
    return {
      status: 'not_configured',
      loginReadiness: {
        ready: false,
        reason: '飞书应用配置缺失'
      },
      sampleCounts: {
        departments: 0,
        users: 0,
        activeUsers: 0
      },
      departmentFields: this.evaluateFields([], DEPARTMENT_FIELDS),
      userFields: this.evaluateFields([], USER_FIELDS),
      blockingIssues: ['飞书应用配置缺失'],
      warnings: [],
      nextActions: ['配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET 后重新运行字段诊断']
    };
  }
}
