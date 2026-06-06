# Feishu IAM v0.15.2 组织用户选择器落地前 Review

日期：2026-05-28

## Review 范围

- `OrgBrowser` 和 `OrgUserSelector` 相关前端改动。
- 应用级飞书部门候选接口和系统飞书部门查询接口的根组织哨兵解析。
- 权限管理测试、版本号、README、CHANGELOG、AGENTS 阶段说明和规格/计划文档。

## 结论

未发现需要阻断落地的问题。

## 重点检查

- `parent_department_id=__root__` 只在前端明确请求顶层组织时发送；关键词搜索仍不传父组织过滤，保持全局搜索语义。
- 后端只把 `__root__` 解析为 `parentDepartmentId: null`；未传参数仍表示不按父组织过滤。
- 保存结构继续使用 `feishu_department` 与 `feishu_user`，未新增 DDL，未扩大权限模型。
- `OrgBrowser` 的只读分支仍保留，可继续支撑飞书同步页本地镜像浏览。
- 版本文档明确 `v0.15.2` 已实现待发布，未记录未发生的镜像、tag、release 或 112 升级事实。

## Review Loop 指标

| 指标 | 结果 |
| --- | --- |
| 轮次 | 1 |
| 发现问题 | 0 |
| 已修复问题 | 0 |
| 剩余问题 | 0 |
| 最终状态 | 通过 |
