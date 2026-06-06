# Feishu IAM v0.10.3 GitLab issue 修复计划

## 版本定位

`v0.10.3` 是 `v0.10.1` 之后的管理后台 UI bugfix 小版本，只处理当前 GitLab open bugs 中已经登记的后台布局问题。

本版本不新增后端权限模型、数据库 DDL、SSO 协议、部署拓扑或新的业务功能。

## GitLab issue 范围

- `#1 页面框架布局bug需要修复`：顶部栏布局需要优化。
- `#2 重新设计右上角用户状态区域`：右上角用户状态区域需要展示 `user_id`，退出入口应收拢到用户菜单。
- `#3 管理员授权模块操作按钮布局异常`：管理员授权表格操作区需要稳定列宽和按钮排列。

## 实施决策

### 顶部栏和用户状态

- `AppShell` 顶部栏保留固定高度和 sticky 结构，补齐 `min-w-0` 和可收缩的右侧区域，避免用户信息撑破 header。
- 右上角用户状态从“文字 + 平铺退出链接”改为 shadcn/Radix `DropdownMenu`。
- 桌面端用户按钮展示当前登录人、角色和截断后的 `feishuUserId`。
- 用户菜单展示完整用户信息和退出入口，退出仍指向 `/admin/auth/logout`。
- 窄屏下用户按钮收缩为头像式入口，菜单中仍能看到 `user_id`。
- 下拉菜单沿用 shadcn/Radix portal，但层级高于固定顶部栏和页面主操作按钮，避免展开时被页面按钮短暂遮挡。

### 管理员授权操作列

- 操作列固定为窄列，继续 sticky right，避免操作按钮把表格撑宽。
- 行内操作改为稳定的 icon button 组，按钮通过 `aria-label`、`title` 和 `sr-only` 文案保持可访问性。
- 历史只读角色用短标签展示，不再与操作按钮混排换行。

## 验收标准

- `pnpm --filter admin-web test -- --run App.test.tsx AdminAuthorizationView.test.tsx admin-components.test.tsx` 通过。
- `pnpm check` 通过。
- `pnpm --filter @feishu-iam/admin-web build` 通过。
- 使用浏览器打开本地管理后台，确认顶部栏、用户菜单、管理员授权操作列无明显错位、溢出或遮挡。
- 浏览器 console 无非预期错误；未登录访问管理端接口的 401 属于预期状态。

## 发布边界

- 本分支完成源码修复、版本号更新、README/CHANGELOG 记录和会话归档。
- 已发布 `v0.10.3` 多架构镜像并完成远端停机升级验证。
- GitLab MR、tag、release 和 issue close 在最终收口阶段完成。
