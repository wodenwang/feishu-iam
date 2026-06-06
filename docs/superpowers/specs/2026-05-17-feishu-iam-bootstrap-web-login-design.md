# Feishu IAM v0.5.0 破窗 Web 登录设计

## 背景

`v0.5.0` 管理后台的日常登录使用飞书管理员身份。localhost 或未登记飞书 OAuth 回调地址的环境无法完成真实飞书跳转，会导致首次绑定平台管理员和本地手工验收进入死结。

## 目标

- 提供一个不依赖飞书 OAuth 的破窗 Web 登录入口。
- 破窗入口只用于 localhost 验收、首次绑定平台管理员和紧急恢复。
- 不改变日常管理必须使用飞书管理员身份的产品边界。
- 不在代码、文档、日志或 cookie 中记录明文密码。

## 方案

新增 `/admin/auth/bootstrap`：

- `GET /admin/auth/bootstrap` 返回传统后台风格的破窗登录页。
- `POST /admin/auth/bootstrap` 使用 `BOOTSTRAP_SUPER_ADMIN_USERNAME` 和 `BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH=sha256:<hex>` 校验用户名密码。
- 校验成功后写入短期 HttpOnly cookie：`feishu_iam_admin_bootstrap_session`。
- cookie 只保存带签名的过期时间，不保存用户名、密码或权限明文；服务端使用环境变量中的密码哈希参与签名校验。
- 有效期为 30 分钟。

## 权限边界

破窗登录后的管理员上下文为：

- `adminUserId=bootstrap-super-admin`
- `displayName=破窗超级管理员`
- `roles=[]`
- `bootstrap=true`

后端权限继续只允许 `bootstrap=true` 管理管理员授权，不开放应用、权限模型、飞书同步、审计查询等日常功能。

## 前端体验

- 未登录页提供两个入口：飞书登录、破窗登录。
- 破窗登录成功后进入后台，但只显示管理员授权工作区。
- 管理员授权工作区支持创建管理员，便于把真实飞书用户绑定为 `platform_admin`。
- 完成绑定后，用户退出破窗入口，再通过飞书管理员身份登录进入完整后台。

## 验证

- 后端 e2e 覆盖破窗登录页、登录成功 cookie、密码错误、cookie 访问 `/api/v1/admin/me`。
- 前端测试覆盖未登录入口、bootstrap 模式只加载管理员授权、bootstrap 模式可创建管理员。
