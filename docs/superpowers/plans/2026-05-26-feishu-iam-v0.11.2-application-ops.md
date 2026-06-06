# Feishu IAM v0.11.2 应用管理生产闭环实施计划

本计划对应根目录 `IMPLEMENTATION_PLAN.md`，用于 README 和后续会话索引。

## 范围

- 应用清单接入摘要。
- 应用详情分区工作区。
- 基础信息编辑。
- 回调地址新增和停用。
- 安全版接入提示词复制。
- 应用启用和停用确认。
- 应用详情内 IAM 角色元数据清单、新增角色、编辑角色基础信息、启用和停用角色。

## 不纳入

- 不做 GitLab issue `#7` 的组织树授权、成员绑定和权限组绑定。
- 不做 GitLab issue `#13` 飞书同步控制台。
- 不扩展完整 OIDC、ABAC、资源级权限、HTTPS、反向代理、高可用或滚动升级。
- 不新增 DDL。

## 执行入口

详细数据契约、API、审计、前端状态、测试、Browser 自检、release 和 deploy 路径见仓库根目录：

```text
IMPLEMENTATION_PLAN.md
```
