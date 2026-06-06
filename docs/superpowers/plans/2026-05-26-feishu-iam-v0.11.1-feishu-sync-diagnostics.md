# Feishu IAM v0.11.1 飞书同步可信诊断实施计划

本计划与仓库根目录 `IMPLEMENTATION_PLAN.md` 内容一致，用于纳入项目计划归档和 README 索引。

## 版本目标

处理 GitLab issue `#5`：把 112 飞书同步失败从现场问题修成可恢复、可诊断、可验收的生产同步能力。

## 纳入范围

- 释放进程重启后遗留的 `running` 同步记录。
- 修复飞书用户 `open_id` / `union_id` 已存在但 `user_id` 变化时的主键迁移。
- 同步失败记录安全的失败阶段和 request id。
- 管理后台同步历史和详情展示诊断信息。
- 发布 `v0.11.1` 镜像并升级 112。

## 不纳入范围

- 不新增飞书角色同步、飞书用户组同步、资源级权限或 ABAC。
- 不重做应用管理、角色授权工作区或权限组绑定。
- 不新增 DDL，不记录明文凭证。

## 验收

- 112 真实飞书同步成功：最新 run `2e2327f8-9379-4fa0-863a-e0b9f75d2918` 为 `success`，旧 run `119008c6-0531-4d9e-8b35-dd9db0b02f6a` 自动标记为 `FEISHU_SYNC_STALE_RUNNING`。
- 后端测试覆盖 stale running、用户主键迁移和失败诊断字段；管理后台测试覆盖失败阶段和 request id 展示。
- `pnpm check`、admin-web build、响应式检查和 Playwright 浏览器自检通过。
- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.1`，digest `sha256:802e0691e86b2d94f0237099b1f738484968b967bf18af1fe3183cc2ab817654`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/ready` 正常，`/version` 返回 `0.11.1 / v0.11.1`。
