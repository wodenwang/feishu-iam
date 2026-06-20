# 会话目标

清理 Feishu IAM 仓库、部署配置、本地 Docker tag 和验证镜像中的旧内部域名与旧内部 Registry 痕迹，重点解决服务器 `docker ps` 中镜像名暴露旧 Registry 的问题。

# 用户关键要求摘要

- 用户发现服务器 `docker ps` 中 `feishu-iam-web-1` 使用的镜像名仍指向旧内部 Registry。
- 要求全局盘点并清理旧内部域名痕迹。

# 关键约束

- 遵守项目 `AGENTS.md`：修改前查看工作树、优先用 `rg` 搜索、手工编辑用 `apply_patch`、不记录密钥。
- 不修改或回显任何真实 secret、token、cookie、密码。
- `.pen` 文件必须通过 Pencil MCP 修改，不能用普通文本方式直接编辑；本次 Pencil MCP 无法连接本机 Pencil app。

# 重要决策

- Docker Compose 和升级脚本默认镜像名改为 `feishu-iam:<tag>`，不再默认绑定旧内部 Registry。
- 文档和测试样例中的旧内部域名统一替换为 `example.com` 系列中性占位。
- `.dockerignore` 排除历史文档、设计源文件、本地运行目录和会话材料，避免这些内容进入 Docker build context。
- 本地已有旧 Registry tag 被重新标记为 `feishu-iam:v1.0.0`、`feishu-iam:v1.0.1`、`feishu-iam:v1.0.2`、`feishu-iam:latest`，并移除旧 tag；镜像内容保留。

# 修改过的文件

- `.dockerignore`
- `deploy/docker-compose.yml`
- `deploy/upgrade.sh`
- `deploy/server.env.example`
- `apps/api/test/integration-prompt.service.spec.ts`
- `CHANGELOG.md`
- `docs/acceptance/`
- `docs/codex-sessions/`
- `docs/deploy-v0.6.0.md`
- `docs/superpowers/plans/`
- `docs/superpowers/prototypes/`
- `docs/superpowers/specs/`

# 关键命令和验证结果

- `git status --short`：确认修改前工作树状态。
- 全仓 `rg`：普通文本文件已无旧域名命中；剩余命中仅在 3 个 `.pen` 设计源文件中。
- `docker images`：本地旧 Registry tag 已移除，当前 Feishu IAM 镜像均为 `feishu-iam:*` 或 demo 本地 tag。
- `docker build -f deploy/api.Dockerfile -t feishu-iam:domain-clean-check .`：构建通过；构建上下文约 36KB，说明历史 docs/design 未进入 context。
- `docker run --rm --entrypoint sh feishu-iam:domain-clean-check ...`：新验证镜像 `/app` 内无旧域名命中。
- `docker inspect feishu-iam:domain-clean-check ...`：镜像元数据无旧域名命中。
- 服务器 `/home/bpmt/feishu-iam/.env` 已改为 `FEISHU_IAM_IMAGE=feishu-iam`，保留 `FEISHU_IAM_IMAGE_TAG=v1.0.2` 和 `FEISHU_IAM_PULL_POLICY=never`。
- 服务器已给当前 v1.0.2 镜像增加 `feishu-iam:v1.0.2` 和 `feishu-iam:latest` tag，重建 `feishu-iam-web-1`，并移除旧 Registry tag。
- 服务器部署目录内的 `upgrade.sh`、`docker-compose.yaml` 和历史 `.env.backup-*` 中的旧 Registry 默认值已替换为 `feishu-iam`。
- 服务器 `docker ps` 当前显示 `feishu-iam-web-1` 使用 `feishu-iam:v1.0.2`。
- 服务器部署目录排除 data/logs 后的文本检索无旧域名命中。
- 服务器 `curl -fsS http://127.0.0.1:8002/ready` 返回数据库 ok，`/version` 返回 `1.0.2 / 20dc324`。
- `pnpm --filter @feishu-iam/api test -- integration-prompt.service.spec.ts`：通过，2 个测试通过。
- `git diff --check`：通过，无空白错误。
- `pnpm check`：typecheck、lint、API 测试通过；admin-web 既有测试 `admin-components.test.tsx` 中 4 个用例失败，错误为 `localStorage.clear is not a function`，与本次域名清理无关。

# 未完成事项和下一步

- 剩余 3 个 `.pen` 文件需要在 Pencil app 可连接后通过 Pencil MCP 替换可见文本中的旧内部域名：
  - `design/admin-console.pen`
  - `design/admin-console-v0.10.0.pen`
  - `design/admin-console-v0.11.2.pen`
- admin-web 既有 `localStorage.clear` 测试失败可作为单独问题处理。
