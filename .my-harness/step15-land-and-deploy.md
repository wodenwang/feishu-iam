# Feishu IAM v1.0.5 step15 - gstack /land-and-deploy

## 结论

`v1.0.5 - 权限管理角色配置工作台` 已完成远端部署和生产验证。

本次按 gstack `/land-and-deploy` 口径执行，但项目采用单机 Docker Compose 停机升级，因此跳过 PR merge / CI 等不适用步骤，改为 release 镜像构建、离线传输、远端 `upgrade.sh` 升级和生产读回验证。

## 发布物

- release commit：`ed98409 feat: add permission role workbench v1.0.5`
- tag：`v1.0.5`
- GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.5`
- 离线镜像包：`/tmp/feishu-iam-v1.0.5-linux-amd64.tar`
- 生产部署目录：`bpmt@120.24.236.92:/home/bpmt/feishu-iam`
- 生产升级备份目录：`/home/bpmt/feishu-iam/backups/20260620-235502`

## 执行记录

### 1. 远端预检

生产升级前状态：

- 生产容器运行 `feishu-iam:v1.0.4`。
- `schema_versions` 包含 `1.0.4`，不包含 `1.0.5`。
- 重复角色 key 检查无返回行，满足 `V1_0_5__role_application_bindings.sql` 前置条件。

### 2. 构建和传输

已构建 linux/amd64 镜像并导出离线包：

```bash
docker buildx build --platform linux/amd64 -f deploy/api.Dockerfile -t feishu-iam:v1.0.5 --load .
docker save feishu-iam:v1.0.5 -o /tmp/feishu-iam-v1.0.5-linux-amd64.tar
scp /tmp/feishu-iam-v1.0.5-linux-amd64.tar bpmt@120.24.236.92:/home/bpmt/feishu-iam/
```

### 3. 远端升级

远端执行：

```bash
cd /home/bpmt/feishu-iam
docker load -i feishu-iam-v1.0.5-linux-amd64.tar
FEISHU_IAM_GIT_SYNC=false FEISHU_IAM_PULL_POLICY=never FEISHU_IAM_IMAGE_TAG=v1.0.5 APP_VERSION=1.0.5 GIT_COMMIT=ed98409 ./upgrade.sh
```

升级结果：

- `docker load` 返回 `Loaded image: feishu-iam:v1.0.5`。
- `upgrade.sh` 创建备份目录 `/home/bpmt/feishu-iam/backups/20260620-235502`。
- 已应用 `V1_0_5__role_application_bindings.sql`。
- web 容器重建并启动。

## 生产验证

### 健康和版本

```bash
curl -fsS https://feishu-iam.riversoft.com.cn/ready
curl -fsS https://feishu-iam.riversoft.com.cn/version
```

结果：

```json
{"status":"ready","checks":{"database":"ok"}}
{"name":"feishu-iam-api","version":"1.0.5","commit":"ed98409","node_env":"production"}
```

### 容器状态

- `feishu-iam-web-1` 运行 `feishu-iam:v1.0.5`。
- `feishu-iam-db-1` 仍为 healthy。
- 生产端 `docker image inspect feishu-iam:v1.0.5` 返回 `amd64 linux`。

### 数据库迁移

只读验证结果：

- `schema_versions` 包含 `1.0.5`。
- `iam_roles.application_id` 已移除，查询结果为 `0`。
- `iam_role_applications` 表存在，查询结果为 `1`。
- `iam_role_applications` 当前包含 `3` 条绑定。
- 未绑定角色数为 `0`。
- 重复角色 key 检查无返回行。
- 外键 `iam_role_permission_groups_role_application_fkey` 存在。
- 外键 `iam_role_permission_points_role_application_fkey` 存在。
- `iam_role_permission_groups` 脱离 `iam_role_applications` 的记录数为 `0`。
- `iam_role_permission_points` 脱离 `iam_role_applications` 的记录数为 `0`。

### 路由 smoke

以下生产路由均返回 `200 OK` 并交由管理后台前端承接：

- `https://feishu-iam.riversoft.com.cn/admin/permissions`
- `https://feishu-iam.riversoft.com.cn/admin/permissions/base-portal/roles/a5dac1d8-7e54-4571-870f-4b191908b7cd?tab=subjects`
- `https://feishu-iam.riversoft.com.cn/admin/applications/base-portal?tab=roles`

## 风险和后续观察

- 生产目录同时存在 `docker-compose.yml` 和 `docker-compose.yaml`，Docker Compose 默认提示使用 `docker-compose.yml`；升级脚本本次使用自身解析到的 compose 文件完成升级。当前运行容器已验证为 `feishu-iam:v1.0.5`，但后续可单独清理重复 compose 文件以降低运维歧义。
- 本次未执行真实管理员浏览器登录后的线上交互回归；step9-step11 已完成本地浏览器和系统化 QA，step15 只做生产健康、迁移和路由 smoke。

## my-harness 状态

step15 已完成。`v1.0.5` 的 my-harness step1-step15 全部完成。
