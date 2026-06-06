# Feishu IAM v0.14.0 工程评审

日期：2026-05-28
状态：通过，可进入实施计划

## 评审输入

- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages.md`
- `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages-design-review.md`
- 当前 `apps/admin-web` 实现
- GitLab issue `#16/#6/#7/#9`

## 结论

`v0.14.0` 可以在不新增 DDL 的前提下推进。现有前端已经具备应用详情抽屉和角色详情抽屉的大部分交互逻辑，后端 API 也已覆盖应用基础信息、回调地址、OAuth credential、接入提示词、角色元数据、角色主体绑定和权限组绑定。本版本工程重点是路由承载、状态保留、导航补齐和测试更新。

## 架构方案

### 路由

新增前端路由：

- `/admin/applications/:appKey`
- `/admin/permissions/:appKey/roles/:roleId`

列表页继续保留：

- `/admin/applications`
- `/admin/permissions`

旧 `sheet=app:*` 和 `sheet=role:*` 查询状态不作为新入口，但可以兼容跳转到新详情页，避免旧深链直接失效。

### 组件边界

- 将 `ApplicationDetailSheet` 的核心逻辑迁移或包装为 `ApplicationDetailPage`。
- 将 `PermissionRoleDetailSheet` 的核心逻辑迁移或包装为 `PermissionRoleDetailPage`。
- 可保留旧文件名一段时间，但页面入口必须不再使用 `DetailSheet` 作为默认承载。
- `AppShell` 继续作为导航事实源，补齐父级展开状态、子项图标和树形层级。

### 数据流

- 应用详情页根据 `appKey` 自行加载应用列表或应用详情所需数据。
- 如果现有 API 没有单应用读取接口，短期可使用应用列表查询并从结果中定位；若数据不在当前页，必须降级为读取足够列表或显示稳定错误。
- 角色详情页根据 `appKey` 加载角色、权限组和目标 role。
- 返回列表上下文用 `from` 查询参数或显式构造的返回 URL 保留。

## 测试策略

必须新增或更新：

- `AppShell` 组件测试：系统管理整行展开收起、二级图标、active child。
- `admin-url-state` 测试：应用详情 Tab、角色详情 Tab、返回上下文解析。
- 应用管理测试：点击详情进入独立页面；不再打开抽屉。
- 权限管理测试：点击角色详情进入独立页面；不再打开抽屉。
- 路由测试：详情 URL 刷新后可渲染目标详情状态。

## 发布风险

- `v0.14.0` 是前端路由和体验重构，不应改变管理员 session、权限后端和部署拓扑。
- 由于会新增路由，生产部署后必须用 Browser 验证刷新详情页不返回 404。
- 应用和角色详情都涉及写操作，必须确认错误提示稳定，不泄露 secret、token、cookie 或堆栈。

## 放行条件

- 生成 `IMPLEMENTATION_PLAN.md`。
- S1/S2 分步实施，每个切片有测试证据。
- 完成 Browser 自检、design-review、qa、pre-landing review。
- 版本、README、CHANGELOG、AGENTS、归档、镜像、GitLab release 和 112 部署全部收口。
