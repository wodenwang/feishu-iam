# Feishu IAM v0.8.1 应用接入包设计

日期：2026-05-22
状态：已确认设计方向，待用户审阅书面规格

## 1. 版本目标

`v0.8.1` 聚焦把第三方应用接入 Feishu IAM 的链路做成清晰、可复制、可部署的闭环。

一句话边界：

`v0.8.1 = 应用创建接入包 + 彻底去环境化 + 应用级开发者 API 凭证 + 一键部署升级增强 + 多架构镜像发布`。

版本完成后，管理员应能在后台点击 `新增应用`，一次完成应用基础信息、回调地址、登录凭证、开发者 API 凭证和第三方 Codex 接入提示词生成。第三方项目拿到提示词后，可以把 Feishu IAM 接入约定写入自身 `AGENTS.md` 或 `CLAUDE.md`，并用应用专属开发者 API 凭证维护本应用权限点和权限组。

## 2. 不纳入范围

本版本不处理以下事项：

- GitLab issue #1 修复和关闭。
- HTTPS、反向代理、高可用、滚动升级或多实例部署。
- 完整 OIDC Discovery、JWKS、ID Token、refresh token 或 SAML。
- 资源级权限、ABAC、deny 规则或数据范围权限。
- 飞书角色同步或飞书用户组同步。
- 后台管理员授权模型重构。
- 常规硬删除应用、回调地址、权限点、权限组或凭证。

## 3. 核心模型

`v0.8.1` 彻底删除应用接入中的 `dev`、`test`、`prod` 环境概念。应用是唯一接入边界，回调地址、OAuth 登录凭证和开发者 API 凭证都直接归属应用。

保留的核心对象：

- `Application`：保存 `app_key`、名称、描述、负责人和启停状态。
- 应用级回调地址：保存 `application_id`、`redirect_uri` 和启停状态。
- 应用登录凭证：保存 OAuth 授权码流程使用的 `client_id` 和 `client_secret` 校验材料。
- 应用开发者 API 凭证：保存第三方项目维护本应用权限点和权限组所需的专属凭证。
- 权限点、权限组和权限组权限点绑定：继续按应用隔离。

退出业务模型的对象：

- `application_environments`。
- 所有面向管理员或第三方开发者的 `environment_key`、`dev`、`test`、`prod` 文案。
- 管理员手动创建或理解 `client` 的流程。

实现时可以保留必要历史字段用于迁移和兼容旧 token，但新业务流程、后台 UI、文档、提示词和新增 API 都不能继续暴露环境概念。

## 4. 迁移策略

旧数据迁移必须保证已有应用可继续接入。

迁移规则：

1. 旧 `application_environments` 下的回调地址全部合并为应用级回调地址。
2. 如果同一应用在多个旧环境中存在相同回调地址，只保留一条应用级记录。
3. 旧 `application_clients` 迁移为应用登录凭证。
4. 如果同一应用存在多个旧 client，实施计划中需要明确迁移选择策略。推荐优先选择最近使用或最新创建的 active client 作为主登录凭证，其余旧 client 仅保留兼容数据，不在后台主流程展示。
5. 已签发的授权码和 access token 可以保留历史环境字段，直到自然过期或撤销；新签发数据不再依赖环境上下文。
6. 迁移必须写入 `schema_versions`，并纳入 `upgrade.sh` 的版本化 DDL 执行链路。

迁移完成后，所有新建应用都不再创建环境记录。

## 5. 回调地址规则

回调地址只遵守以下规则：

- 必须是完整 URL。
- 必须与 Feishu IAM 登记值精确匹配。
- 不允许通配符、前缀匹配或正则匹配。
- 不按协议额外限制：配置 HTTP 就允许该精确 HTTP 回调，配置 HTTPS 就允许该精确 HTTPS 回调。

登录失败仍必须展示 Feishu IAM 统一错误页，不能显示裸 JSON、堆栈、secret、token 或框架默认错误。

## 6. 后台应用管理体验

应用管理首页必须补齐清晰可见的 `新增应用` 主按钮。

创建应用不再是单一基础信息表单，而是一个“创建应用接入包”的完整界面。该界面一次完成：

1. 应用基础信息：`app_key`、应用名称、描述、负责人。
2. 回调地址：至少填写一个完整 URL，可添加多条。
3. 登录凭证：系统自动生成 `client_id` 和只展示一次的 `client_secret`。
4. 开发者 API 凭证：系统自动生成应用专属开发者 API token 或等价凭证。
5. Codex 接入提示词：创建成功后在同一界面展示完整可复制提示词。

创建成功界面必须清楚区分两类敏感凭证：

- `client_secret`：第三方应用后端用于 OAuth 授权码换取 Feishu IAM access token。
- `developer_api_secret` 或开发者 API token：第三方项目开发和初始化时用于维护本应用权限点、权限组及绑定，不用于用户登录。

两类 secret 都只允许明文展示一次。关闭创建成功界面后，后台只能轮换 secret，不能长期查看明文 secret。

应用详情建议简化为四个 tab：

- `基础信息`：应用名称、描述、负责人、启停状态。
- `接入配置`：回调地址、登录凭证状态、secret 轮换、Codex 接入提示词。
- `开发者 API`：开发者 API 凭证状态、轮换、可调用范围、最近使用时间。
- `操作记录`：应用相关审计日志和安全事件入口。

原 `环境与回调` 和 `Client` tab 删除。后台文案不再出现环境和 client 概念。

## 7. Codex 接入提示词

创建应用后，后台必须支持一键复制第三方应用对接提示词。提示词默认面向“空白 Codex 第三方项目”，用于指导第三方项目把 Feishu IAM 接入约定写入自身 `AGENTS.md` 或 `CLAUDE.md`。

完整提示词至少包含：

- 第三方项目应该把本提示词整理进自身 `AGENTS.md` 或 `CLAUDE.md`。
- Feishu IAM 服务地址，例如 `FEISHU_IAM_URL=http://feishu-iam.example.com`。
- `app_key`、`client_id`、`client_secret` 的用途。
- 回调地址必须与 Feishu IAM 中登记值完全一致。
- OAuth 授权码流程：`/oauth/authorize`、`/oauth/token`、`/oauth/userinfo`。
- 权限查询接口：`/api/v1/apps/{app_key}/me/permissions`。
- 开发者 API 凭证的用途和权限边界。
- 如何创建、更新、禁用权限点。
- 如何创建、更新、禁用权限组。
- 如何维护权限组与权限点绑定。
- 禁止把明文 secret 写入仓库、日志、截图、聊天消息、测试快照或会话归档。
- 第三方项目完成接入后的验收 checklist。

提示词分为两种形态：

- 完整版：仅在创建成功后或确认轮换 secret 后生成，包含当次明文 secret。
- 安全版：后续从应用详情复制时生成，不包含明文 secret，并提示如需完整提示词必须轮换相关 secret。

## 8. 管理后台 API

新增或调整的管理后台 API 建议如下：

- `POST /api/v1/admin/applications`：创建应用接入包，返回应用、回调地址、登录凭证一次性 secret、开发者 API 凭证一次性 secret 和完整接入提示词。
- `GET /api/v1/admin/applications`：应用清单。
- `PATCH /api/v1/admin/applications/{app_key}`：编辑应用基础信息。
- `POST /api/v1/admin/applications/{app_key}/enable`：启用应用。
- `POST /api/v1/admin/applications/{app_key}/disable`：停用应用。
- `GET /api/v1/admin/applications/{app_key}/redirect-uris`：查询应用级回调地址。
- `POST /api/v1/admin/applications/{app_key}/redirect-uris`：新增应用级回调地址。
- `POST /api/v1/admin/applications/{app_key}/oauth-credential/rotate-secret`：轮换登录 secret。
- `POST /api/v1/admin/applications/{app_key}/developer-credential/rotate-secret`：轮换开发者 API secret。
- `GET /api/v1/admin/applications/{app_key}/integration-prompt`：生成不含明文 secret 的安全版接入提示词。
- `POST /api/v1/admin/applications/{app_key}/integration-prompt/with-rotated-secrets`：确认后轮换必要 secret 并生成完整接入提示词。

管理员权限边界保持不变：

- 平台管理员可以创建和管理全部应用。
- 应用管理员只能管理自己被授权的应用。
- 应用管理员不能创建应用，也不能管理其他应用。

## 9. 开发者 API 凭证

每个应用拥有专属开发者 API 凭证。该凭证用于第三方项目维护本应用权限目录，不用于用户登录。

推荐鉴权方式：

```http
Authorization: Bearer <developer_api_token>
```

开发者 API 凭证的权限边界固定为：

- 只能访问当前应用范围。
- 只能管理本应用权限点、权限组和权限组权限点绑定。
- 不能修改应用基础信息。
- 不能修改回调地址。
- 不能轮换 OAuth 登录 secret。
- 不能维护 IAM 角色或成员授权。
- 不能管理后台管理员。
- 不能修改系统设置或飞书同步配置。

开发者 API 写操作必须写审计日志。审计 actor 建议为 `application_developer_credential`，actor id 使用凭证 id，不使用明文 token。

凭证还需要记录：

- 创建时间。
- 更新时间。
- 状态。
- 最近使用时间。
- 最近轮换时间。

## 10. 开发者 API 范围

开发者 API 建议提供以下能力：

- 查询本应用权限点。
- 创建权限点。
- 更新权限点名称和描述。
- 禁用或启用权限点。
- 查询本应用权限组。
- 创建权限组。
- 更新权限组名称和描述。
- 禁用或启用权限组。
- 查询权限组与权限点绑定。
- 替换或更新权限组与权限点绑定。

开发者 API 不提供常规硬删除。所谓“删除权限点”或“删除权限组”在本版本中解释为禁用；如果后续需要软删除字段，应单独设计。

权限点 key 仍必须以 `${app_key}.` 开头，并复用后端已有校验逻辑。开发者 API 和管理后台必须使用同一套权限 key、权限组 key 和跨应用隔离校验逻辑。

## 11. 安全与审计

以下动作必须写审计日志：

- 创建应用接入包。
- 新增、启用、禁用回调地址。
- 轮换登录 secret。
- 轮换开发者 API 凭证。
- 开发者 API 创建、更新、启用、禁用权限点。
- 开发者 API 创建、更新、启用、禁用权限组。
- 开发者 API 修改权限组与权限点绑定。

以下动作或异常必须写安全事件：

- 登录凭证校验失败。
- 开发者 API 凭证校验失败。
- 已禁用应用继续发起 OAuth 或开发者 API 调用。
- 尝试跨应用访问权限目录。
- secret 轮换。

安全要求：

- 明文 secret 只展示一次。
- secret 不能进入审计日志、安全事件、应用日志、错误响应、测试快照或文档。
- 错误响应必须使用稳定错误码和中文排查文案。
- 错误响应不能暴露 hash、secret、token、cookie、堆栈或数据库错误。

## 12. 部署与升级

部署目标保持单机 Docker Compose 和停机升级，不引入高可用。

README 需要提供 one-liner 一键部署方式。建议流程：

1. 下载 `install.sh`。
2. 创建 `~/feishu-iam` 部署目录。
3. 拉取指定版本的 `docker-compose.yaml`、`.env.example` 和 `upgrade.sh`。
4. 生成服务器本地 `.env` 骨架。
5. 提示用户只在服务器本地填写真实密钥和飞书配置。
6. 执行 `./upgrade.sh` 完成首次启动。

one-liner 不得包含真实 secret。

已运行实例继续使用 `./upgrade.sh` 升级。升级流程固定为：

1. 同步部署脚本和 Compose 配置。
2. 拉取目标镜像。
3. 停止 Web 服务。
4. 保持或启动数据库。
5. 备份数据库。
6. 执行版本 DDL。
7. 启动 Web 服务。
8. 检查 `/ready`。
9. 检查 `/version`。

升级脚本必须支持：

- 指定版本：`FEISHU_IAM_IMAGE_TAG=v0.8.1 ./upgrade.sh`。
- 标准拉取镜像：`FEISHU_IAM_PULL_POLICY=always`。
- 预加载镜像 fallback：`FEISHU_IAM_PULL_POLICY=never`。

`FEISHU_IAM_PULL_POLICY=never` 仅作为无法直连 Registry 时的兜底路径，README 中不能把它写成推荐路径。

## 13. 多架构镜像

`v0.8.1` 镜像发布必须兼容以下架构：

- `linux/amd64`
- `linux/arm64`

推荐构建命令：

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --provenance=false \
  --sbom=false \
  -f deploy/api.Dockerfile \
  -t feishu-iam:v0.8.1 \
  -t feishu-iam:latest \
  --push .
```

README 需要记录：

- 镜像完整路径。
- 版本 tag。
- manifest digest。
- `docker pull` 命令。
- `docker buildx imagetools inspect` 或等价架构验证命令。

## 14. 验收标准

代码和文档验收：

- `pnpm check` 通过。
- Prisma Client 重新生成并通过类型检查。
- 版本化 DDL 可重复执行或幂等跳过。
- 文档不存在未处理模板变量。
- 文档说明性正文保持中文。
- 文档不包含真实 secret、token、cookie、密码或敏感凭证。

业务验收：

- 应用管理首页可见 `新增应用` 主按钮。
- 创建应用可一次性配置基础信息、回调地址、登录凭证和开发者 API 凭证。
- 创建成功后展示完整 Codex 接入提示词。
- 关闭创建成功界面后，不能再次查看旧明文 secret。
- 安全版提示词不包含明文 secret。
- 回调地址不再要求环境上下文。
- OAuth 授权码流程不再依赖环境参数。
- `/oauth/authorize`、`/oauth/token`、`/oauth/userinfo` 和 `/api/v1/apps/{app_key}/me/permissions` 在去环境化后可用。
- 开发者 API 可维护本应用权限点、权限组和绑定。
- 开发者 API 不能越权访问其他应用。
- 开发者 API 不能修改应用配置、登录凭证、角色授权或管理员授权。

前端验收：

- 使用 `@Browser` 打开本地页面做真实浏览器自检。
- 应用管理新增、详情、回调、凭证轮换、复制提示词可用。
- 桌面和窄屏下无明显布局错位、内容溢出、元素遮挡或异常空白。
- 浏览器 console 无错误。
- Network 无非预期失败请求。

部署验收：

- 本地 Compose 可启动。
- `./upgrade.sh` 可完成停机升级。
- `/ready` 返回 ready。
- `/version` 返回 `0.8.1` 和正确 commit。
- amd64 与 arm64 镜像 manifest 均存在。

## 15. 后续实施提示

实施计划应优先拆成以下任务：

1. 数据模型和迁移设计。
2. OAuth 去环境化。
3. 应用接入包创建 API。
4. 开发者 API 凭证和权限目录 API。
5. 管理后台应用创建和详情重构。
6. Codex 接入提示词生成。
7. 一键部署、升级脚本和 README。
8. 多架构镜像构建发布。
9. 全量测试、浏览器验收和会话归档。

实现时应先完成最小可验证闭环，再扩展 UI 细节和部署文档。
