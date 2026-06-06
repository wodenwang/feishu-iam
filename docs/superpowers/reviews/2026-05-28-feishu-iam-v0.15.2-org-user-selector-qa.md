# Feishu IAM v0.15.2 组织用户选择器 QA 记录

日期：2026-05-28

## QA 范围

- 角色详情页 `组织与用户绑定` Tab。
- 组织和用户同列表候选区。
- 顶层组织加载、组织下钻、组织选择、用户选择、移动端摘要和保存确认。

## QA 方法

- 使用本地 Vite 页面 `http://localhost:5173/admin/permissions/crm/roles/role-1?tab=subjects`。
- 使用 Playwright 拦截后台 API，避免依赖未启动的本地 API 服务。
- 覆盖桌面 `1440x900` 和移动 `390x844`。

## QA 结果

- 桌面和移动端均可选择组织 `od-root` 与用户 `ou_admin`。
- 组织下钻后仍可看到下级组织或用户，已选草稿不丢失。
- 保存前摘要显示新增组织 1 个、新增用户 1 个。
- 保存确认弹窗显示新增 2 个主体。
- 两个视口保存请求均符合后端契约：

```json
{
  "org_subjects": ["od-root"],
  "user_subjects": ["ou_existing", "ou_admin"]
}
```

- 顶层组织请求包含 `parent_department_id=__root__`。
- 下钻请求包含 `parent_department_id=od-root`。
- Console 无错误，Network 无非预期失败请求，页面无横向溢出。

## Review Loop 指标

| 指标 | 结果 |
| --- | --- |
| 轮次 | 1 |
| 发现问题 | 0 |
| 已修复问题 | 0 |
| 剩余问题 | 0 |
| 最终状态 | 通过 |
