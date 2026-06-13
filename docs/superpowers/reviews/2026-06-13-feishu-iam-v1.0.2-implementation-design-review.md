# Feishu IAM v1.0.2 实现后设计 QA

日期：2026-06-13

## 评审范围

- 管理后台资源列表在 390px、768px、1280px、1440px 视口下的布局稳定性。
- 应用详情、角色详情和操作审计多 Tab 页面在窄屏下的横向溢出风险。
- OAuth 公开错误页复制边界与公开文案。

## 结论

通过。当前实现符合 `DESIGN.md` 的后台管理系统基线：保留左侧导航、顶部用户区、内容工作区、表格/卡片资源列表和克制的信息密度；未引入营销页、hero、装饰性渐变或新的 UI 体系。

## 发现与处理

- 发现：角色详情 `权限组绑定` Tab 在 390px 下仍有 485px 页面级横向溢出。
  - 处理：为 `ResponsiveTabsList`、详情页 Tabs 根节点、Tab 内容面板和权限组预览内容补充 `min-w-0`、`break-all` 等收缩约束。
  - 复验：`ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive` 通过，角色详情 390px `scrollWidth` 回到 390。
- 发现：管理员授权移动端卡片最初缺少启用/停用入口。
  - 处理：移动端卡片保留详情、编辑、启用/停用；历史只读角色显示只读提示。
  - 复验：目标前端测试和全量 `pnpm check` 通过。

## 设计验收

- 移动端资源列表使用卡片呈现，长 `app_key`、角色 key、request id 和 Feishu user id 均可换行，不再逐字竖排。
- 多 Tab 页面横向滚动收敛在 Tab 列表内部，不再撑破页面。
- 公开 OAuth 错误页只围绕 `request id` 呈现和复制，不再鼓励复制整段问题信息。
