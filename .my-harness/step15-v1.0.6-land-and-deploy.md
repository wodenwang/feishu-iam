# Step 15 gstack /land-and-deploy - v1.0.6

## 目标

收口 Feishu IAM `v1.0.6` 权限管理 UI/UX 小版本的镜像构建、上传和生产部署。

## 输入基线

- GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.6`
- Release commit：`31db6aa96b5dedac89d8943150b599561843cff7`
- Tag：`v1.0.6`
- 当前 main handoff commit：`5fe84a731f353fb2ad2f8be462f14f1f0f10c4f9`
- 构建策略：从 detached worktree `/tmp/feishu-iam-v1.0.6-build` checkout `v1.0.6`，避免把 release 后 handoff 文档提交混入镜像。

## 部署目标

- SSH：`bpmt@120.24.236.92`
- 远端目录：`/home/bpmt/feishu-iam`
- Compose 文件：`/home/bpmt/feishu-iam/docker-compose.yaml`
- 公网入口：`https://feishu-iam.riversoft.com.cn/`
- 镜像 tag：`feishu-iam:v1.0.6`
- 升级方式：离线 tar 上传 + `FEISHU_IAM_PULL_POLICY=never` + `upgrade.sh` 停机升级。

## 敏感信息边界

- 未输出 `.env` 全量内容。
- 只检查版本控制变量：`FEISHU_IAM_IMAGE_TAG`、`APP_VERSION`、`GIT_COMMIT`、`FEISHU_IAM_PULL_POLICY`、`FEISHU_IAM_GIT_SYNC`。
- 未输出 secret、token、cookie、authorization、数据库密码或飞书密钥。

## 执行命令

```bash
git status --short --branch
git rev-parse v1.0.6^{}
gh release view v1.0.6 --json url,tagName,targetCommitish,isDraft,isPrerelease,publishedAt,name
git worktree add --detach /tmp/feishu-iam-v1.0.6-build v1.0.6
docker buildx build --platform linux/amd64 -f deploy/api.Dockerfile -t feishu-iam:v1.0.6 --load .
docker image inspect feishu-iam:v1.0.6 --format 'ID={{.Id}} Arch={{.Architecture}} OS={{.Os}} RepoTags={{json .RepoTags}} Created={{.Created}}'
docker save feishu-iam:v1.0.6 -o /tmp/feishu-iam-v1.0.6-linux-amd64.tar
shasum -a 256 /tmp/feishu-iam-v1.0.6-linux-amd64.tar
scp /tmp/feishu-iam-v1.0.6-linux-amd64.tar bpmt@120.24.236.92:/home/bpmt/feishu-iam/
ssh bpmt@120.24.236.92 'cd /home/bpmt/feishu-iam && docker load -i feishu-iam-v1.0.6-linux-amd64.tar && FEISHU_IAM_GIT_SYNC=false FEISHU_IAM_PULL_POLICY=never FEISHU_IAM_IMAGE_TAG=v1.0.6 APP_VERSION=1.0.6 GIT_COMMIT=31db6aa ./upgrade.sh'
curl -fsS https://feishu-iam.riversoft.com.cn/ready
curl -fsS https://feishu-iam.riversoft.com.cn/version
```

## 镜像证据

- 本地镜像：`feishu-iam:v1.0.6`
- 本地镜像 ID：`sha256:1bf04b6ec9c7c04c331dce7ff3e3bc09ef370d989099d1e2ee9616aad65624b5`
- 本地镜像平台：`linux/amd64`
- 离线包：`/tmp/feishu-iam-v1.0.6-linux-amd64.tar`
- 离线包大小：约 157M。
- 离线包 SHA-256：`0e79ad15c748318769d372c6d98131340410dc589c7df98c2a86da2a48709e08`
- 远端运行镜像 ID：`sha256:58e6f5dbb5ee00564995595b25d06545d4e49f602007597c65dc4fd8c6b29abc`

## 生产升级证据

- 升级脚本：`/home/bpmt/feishu-iam/upgrade.sh`
- 升级备份目录：`/home/bpmt/feishu-iam/backups/20260621-032848`
- 数据库备份：`/home/bpmt/feishu-iam/backups/20260621-032848/feishu_iam.sql`
- 版本备份：`/home/bpmt/feishu-iam/backups/20260621-032848/version.json`
- 运行容器：`feishu-iam-web-1 feishu-iam:v1.0.6`
- 数据库容器：`feishu-iam-db-1 postgres:16-alpine`，healthy。

## 健康检查

公网 `/ready`：

```json
{"status":"ready","checks":{"database":"ok"}}
```

公网 `/version`：

```json
{"name":"feishu-iam-api","version":"1.0.6","commit":"31db6aa","node_env":"production"}
```

本机 `/ready` 和 `/version` 在生产机 `127.0.0.1:8002` 也返回同样结果。

## Smoke / Canary

以下公网路由均返回 HTTP 200：

- `https://feishu-iam.riversoft.com.cn/admin/permissions`
- `https://feishu-iam.riversoft.com.cn/admin/permissions/roles/a5dac1d8-7e54-4571-870f-4b191908b7cd?appKey=base-portal&from=%2Fadmin%2Fpermissions&tab=subjects`
- `https://feishu-iam.riversoft.com.cn/admin/permissions/roles/a5dac1d8-7e54-4571-870f-4b191908b7cd?appKey=base-portal&from=%2Fadmin%2Fpermissions&tab=permissions`

本次 smoke 覆盖权限管理入口、用户截图标注的 `组织与用户` tab deep link 和 `应用权限` tab deep link。页面级视觉回归证据继续保留在 `output/playwright/v1.0.6-permission-uiux-audit/`。

## 回滚信息

- 上一版线上镜像：`feishu-iam:v1.0.5`
- 上一版线上版本读回：`1.0.5 / ed98409`
- 本次升级备份目录：`/home/bpmt/feishu-iam/backups/20260621-032848`
- 镜像回滚命令参考：

```bash
cd /home/bpmt/feishu-iam
FEISHU_IAM_GIT_SYNC=false FEISHU_IAM_PULL_POLICY=never FEISHU_IAM_IMAGE_TAG=v1.0.5 APP_VERSION=1.0.5 GIT_COMMIT=ed98409 ./upgrade.sh
```

本版本不新增 DDL；如需数据库回滚，先评估备份目录中的 `feishu_iam.sql`，不要直接覆盖生产库。

## 下一步提示词

```text
请继续完成 Feishu IAM v1.0.6 发布后 canary 观察：基于当前已部署的 `https://feishu-iam.riversoft.com.cn/`、GitHub Release `https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.6`、生产镜像 `feishu-iam:v1.0.6`、部署目录 `bpmt@120.24.236.92:/home/bpmt/feishu-iam`，只读复核 `/ready`、`/version`、权限管理关键页面、角色配置工作台 `组织与用户` 和 `应用权限` 两个 tab、以及第三方 SSO Demo 基础链路；不要修改代码、不要上传镜像、不要 deploy，除非我另行明确授权。执行完毕后，请按照 my-harness 规定的流程输出 `流程执行情况一览：` 15 步进度表，并在末尾继续给出下一步可直接复制执行的 `推荐提示词`。如果项目已经在使用 my-harness，请创建或更新 `.my-harness/` 快速索引，记录步骤状态、关键决策、证据链接、验证命令和下一步提示词。Superpowers、gstack、Product Design、Pencil 等第三方技能生成的文档必须继续保留在其规范目录中，`.my-harness/` 只保存链接和简短摘要。这个末尾提示词必须同时包含本句要求，让用户后续只需要复制末尾提示词继续推进，不需要重新询问 next action。
```
