# Feishu IAM v0.15.2 组织用户选择器设计审查

日期：2026-05-28

## 审查范围

- GitLab issue `#26` 对应的角色详情页 `组织与用户绑定` 工作区。
- `OrgBrowser` 候选区从“组织列表 + 用户列表”改为“待选组织与用户”同列表展示。
- 顶层组织加载、下钻、移动端 `待选 / 已选 / 摘要` 分步面板、长 ID 换行和按钮尺寸。

## 审查方法

- 使用本地 Vite 页面 `http://localhost:5173/admin/permissions/crm/roles/role-1?tab=subjects`。
- 使用 Playwright 拦截后台 API，注入长组织名、长组织 ID、长用户 ID 和可下钻组织数据。
- 覆盖视口：
  - 桌面：`1440x900`
  - 窄屏：`390x844`

## 审查结果

- 桌面候选列表和已选摘要稳定展示，无横向溢出。
- 窄屏 `待选 / 已选 / 摘要` 分步面板可切换，候选区按钮尺寸稳定。
- 组织和用户在同一待选列表中展示，并通过图标、主体类型标签和 ID 区分。
- 顶层组织请求包含 `parent_department_id=__root__`。
- 下钻请求包含真实父组织 ID：`parent_department_id=od-root`。
- 下钻后已选组织 `od-root` 和用户 `ou_admin` 仍保留在草稿中。
- Console 无错误，Network 无非预期失败请求。

## 截图证据

- `/tmp/feishu-iam-v0.15.2-design-review/desktop-1440x900.png`
- `/tmp/feishu-iam-v0.15.2-design-review/mobile-390x844.png`

## Review Loop 指标

| 指标 | 结果 |
| --- | --- |
| 轮次 | 1 |
| 发现问题 | 0 |
| 已修复问题 | 0 |
| 剩余问题 | 0 |
| 最终状态 | 通过 |
