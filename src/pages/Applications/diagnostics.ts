import type { Application, ApplicationDiagnostics } from '../../features/iam/types';

const statusLabels: Record<ApplicationDiagnostics['status'], string> = {
  healthy: '健康',
  warning: '需关注',
  failed: '失败',
};

const severityLabels: Record<ApplicationDiagnostics['findings'][number]['severity'], string> = {
  critical: '阻塞',
  warning: '警告',
  info: '提示',
};

const secretStatusLabels: Record<'issued' | 'missing', string> = {
  issued: '已签发',
  missing: '缺失',
};

function formatList(values: string[]) {
  return values.length ? values.map((value) => `  - ${value}`).join('\n') : '  - 无';
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

export function buildApplicationDiagnosticsMarkdown(input: {
  application: Application;
  diagnostics: ApplicationDiagnostics;
}) {
  const { application, diagnostics } = input;
  const findings = diagnostics.findings.length
    ? diagnostics.findings
        .map((finding) =>
          [
            `- [${severityLabels[finding.severity]}] ${finding.code}: ${finding.title}`,
            `  - 说明：${finding.description}`,
            `  - 下一步：${finding.nextAction}`,
            finding.relatedRequestId ? `  - requestId：${finding.relatedRequestId}` : undefined,
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n')
    : '- 无';
  const recentEvents = diagnostics.recentEvents.length
    ? diagnostics.recentEvents
        .map(
          (event) =>
            `- ${formatDateTime(event.createdAt)} ${event.action} ${event.result === 'success' ? '成功' : '失败'} requestId=${event.requestId}`,
        )
        .join('\n')
    : '- 无';

  return [
    `# ${application.name} 接入诊断包`,
    '',
    '## 基本信息',
    `- 应用 ID：${diagnostics.applicationId}`,
    `- appKey：${diagnostics.appKey}`,
    `- 应用状态：${application.status}`,
    `- 诊断状态：${statusLabels[diagnostics.status]}`,
    `- 检查时间：${formatDateTime(diagnostics.checkedAt)}`,
    '',
    '## 接入端点',
    `- OAuth authorize：${diagnostics.endpoints.oauthAuthorize}`,
    `- OAuth token：${diagnostics.endpoints.oauthToken}`,
    `- 权限查询：${diagnostics.endpoints.applicationPermissions}`,
    '',
    '## Redirect URI',
    '- 启用：',
    formatList(diagnostics.redirectUris.active),
    '- 停用：',
    formatList(diagnostics.redirectUris.disabled),
    '',
    '## 凭证状态',
    `- appSecret：${secretStatusLabels[diagnostics.secrets.appSecret.status]}，最近轮换：${formatDateTime(diagnostics.secrets.appSecret.rotatedAt)}`,
    `- API secret：${secretStatusLabels[diagnostics.secrets.apiSecret.status]}，最近轮换：${formatDateTime(diagnostics.secrets.apiSecret.rotatedAt)}`,
    '- 诊断包不包含任何 secret、token、authorization code、签名、cookie 或 hash 原文。',
    '',
    '## 配置计数',
    `- 应用管理员：${diagnostics.counts.applicationAdmins}`,
    `- 权限组：${diagnostics.counts.permissionGroups}`,
    `- 权限点：${diagnostics.counts.permissionPoints}`,
    `- 角色：${diagnostics.counts.roles}`,
    `- 授权绑定：${diagnostics.counts.roleBindings}`,
    `- 已同步在职用户：${diagnostics.counts.syncedUsers}`,
    '',
    '## 诊断发现',
    findings,
    '',
    '## 最近接入事件',
    recentEvents,
  ].join('\n');
}
