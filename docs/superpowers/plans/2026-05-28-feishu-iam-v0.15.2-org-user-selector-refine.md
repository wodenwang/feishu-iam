# Feishu IAM v0.15.2 组织用户选择器重构实施计划

日期：2026-05-28

## 1. 目标

收口 GitLab issue `#26`，把角色组织与用户绑定选择器从“组织列表 + 用户列表”改为“同一个待选列表中区分组织和用户”，并保证顶层组织从真实根级开始。

## 2. 实施任务

### Task 1：明确顶层组织查询契约

- 在 API 查询层定义 `__root__` 为顶层组织哨兵值。
- 应用级飞书部门候选接口把 `parent_department_id=__root__` 转为 `parentDepartmentId: null`。
- 系统飞书部门查询接口同样支持该哨兵值。
- 前端部门查询参数允许传入 `null`，由 API client 序列化为 `__root__`。

### Task 2：重构 `OrgBrowser` 待选列表

- 根级非搜索状态请求 `parentDepartmentId: null`。
- 搜索状态不传父组织过滤，仍搜索全部可见本地镜像。
- 把组织和用户合并为单个候选列表。
- 组织行展示组织图标、名称、ID、下钻按钮和选择按钮。
- 用户行展示用户图标、名称、ID、选择按钮和不可选状态。
- 保留错误、空状态、加载更多、返回上级和路径说明。

### Task 3：保持 `OrgUserSelector` 已选与摘要稳定

- 保持已选列表由父组件草稿状态驱动，不跟随待选列表路径变化。
- 保持保存 payload 中 `feishu_department` 与 `feishu_user` 类型不变。
- 保持移动端 `待选 / 已选 / 摘要` 分步面板。

### Task 4：测试和浏览器自检

- 调整权限管理测试，验证用户和组织来自同一待选列表，并能分别选择保存。
- 补充根级组织查询参数断言。
- 运行前端定向测试、类型检查和 lint。
- 启动本地页面，用 Browser 检查桌面和窄屏组织用户选择器。

## 3. 风险和控制

- 风险：飞书同步页复用 `OrgBrowser`，组件改动可能影响只读排障浏览。
  - 控制：保留 `readonly` 分支和 `onInspectDepartment` / `onInspectUser` 回调，并用 Browser 覆盖飞书同步入口。
- 风险：根级组织查询语义改变影响旧搜索。
  - 控制：只有明确传 `__root__` 才过滤 `parentDepartmentId: null`；关键词搜索仍不传父组织过滤。
- 风险：用户误解组织主体会自动展开用户。
  - 控制：保留现有说明和保存摘要中的语义提示。

## 4. 验证命令

```bash
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web test:responsive
```
