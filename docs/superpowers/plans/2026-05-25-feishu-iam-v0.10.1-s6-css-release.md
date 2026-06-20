# Feishu IAM v0.10.1-S6 CSS 清理与版本发布实施计划

本计划的执行事实源为仓库根目录 `IMPLEMENTATION_PLAN.md`。本文件保留长期文档索引，便于后续版本盘点和会话追溯。

## 目标

`v0.10.1-S6` 是 `v0.10.1` 正式发布前的最后切片：在 S1-S5 已完成共享基础、权限管理、管理员授权、系统设置和工作台迁移后，清理旧后台主结构 CSS、未使用旧组件和迁移期测试债，并完成 `v0.10.1` 版本号、文档、镜像、远端停机升级、MR、tag 和 GitLab Release。

S6 按原规划保持发布收口定位，不再合并新业务能力。真实生产数据 QA、生产细节补丁、权限管理后端分页、更多工作台风险来源、飞书镜像质量增强和新的运营聚合 API 进入 `v0.10.2` 或更后版本；只有阻断 `v0.10.1` 发布的明显回归可以在 S6 内修复。

## 非目标

- 不新增后端 API、Prisma、DDL 或部署拓扑。
- 不扩展 OAuth/OIDC、refresh token、SAML、ABAC、资源级权限、飞书角色同步或飞书用户组同步。
- 不重做 S2-S5 已确认的信息架构和交互。
- 不处理 nginx、HTTPS、域名、反向代理、高可用或滚动升级。
- 不合并 `v0.10.2` 级别的真实生产数据长尾 QA、后端分页、运营聚合 API 或飞书同步质量增强。

## 执行入口

请直接读取并执行：

```text
IMPLEMENTATION_PLAN.md
```

## 验收摘要

- `apps/admin-web/src` 不再保留旧 `application-detail-drawer`、`admin-page`、`module-header`、旧 `panel`、旧 `status-badge-*` 等主结构运行时代码。
- `App.test.tsx` 不再保留只服务旧组件或旧页面结构的 skip 断言；当前新页面能力应迁移到对应 `features/*` 测试。
- 六个后台一级模块使用新 `components/admin/*` 体系，并通过 1440、1280、768、390 视口 Browser 自检。
- `package.json`、`apps/api/package.json`、`apps/admin-web/package.json`、`deploy/docker-compose.yml`、`deploy/install.sh`、`/version` fallback、README、CHANGELOG 全部对齐 `0.10.1`。
- `pnpm check`、admin-web test、admin-web build、responsive overflow check 通过。
- `feishu-iam:v0.10.1` 多架构镜像发布，并在 README 记录 digest。
- `192.168.2.112:~/feishu-iam` 停机升级验证通过，`http://feishu-iam.example.com/version` 返回 `0.10.1`。
- MR、`v0.10.1` tag、GitLab Release 和中文会话归档完成。
