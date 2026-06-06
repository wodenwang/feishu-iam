# Feishu IAM v0.9.1 管理后台重构 Pencil 原型输入

状态：DRAFT_FOR_PENCIL
适用阶段：v0.9.1
设计对象：admin-console
界面类型：企业级后台管理系统 / Admin Console
UI 框架：shadcn/ui
后台风格参考：tweakcn
主题/品牌素材来源：Feishu IAM 既有深青绿后台风格 + shadcn/ui + tweakcn modern minimal/neutral admin 方向

## 1. 设计目标

- 将 Feishu IAM 管理后台从旧 CSS/自研控件重构为 shadcn/ui + Tailwind CSS variables + tweakcn 风格的项目自有组件体系。
- 原型不沿用旧版交互作为硬约束，可以重新组织导航、详情、创建流程和风险确认，但必须保持传统后台系统的信息密度和可操作性。
- 让一个平台管理员可以完成：查看系统状态、创建应用接入包、管理应用凭证、授权管理员、查询审计记录、检查系统设置。
- 让一个应用管理员可以完成：查看被授权应用、复制安全版接入提示词、查看权限和审计记录，但不能越权管理其他应用。
- 前端实现时不引入 Ant Design 或其他 UI 框架；shadcn/ui 组件进入项目代码后由项目维护。

## 2. 视觉和主题输入

- 主体：neutral admin，浅背景、白色/近白面板、清晰边框、轻量阴影。
- 品牌：沿用 Feishu IAM 既有深青绿，作为 sidebar、primary、focus ring 和关键强调色来源。
- 推荐 token 方向：
  - `--background`: 接近 `#f6f8f7`
  - `--foreground`: 接近 `#10201f`
  - `--card`: `#ffffff`
  - `--primary`: 深青绿，接近 `#0f766e`
  - `--accent`: 青绿，接近 `#14b8a6`
  - `--destructive`: 红色语义 token，不用品牌色替代
  - `--sidebar`: 深青绿色，接近 `#082f2d`
- 圆角默认 8px；按钮、输入和 badge 不使用过度胶囊形态。
- 不使用营销 hero、大面积渐变、漂浮装饰、玻璃拟态或低密度大卡片堆叠。

## 2. 页面范围

本阶段必须覆盖：

1. `00 设计系统和组件基线`
2. `01 登录与异常态`
3. `02 工作台`
4. `03 应用管理清单`
5. `04 创建应用接入包`
6. `05 应用详情和凭证治理`
7. `06 权限管理`
8. `07 管理员授权`
9. `08 记录查询`
10. `09 系统设置`

不在本阶段范围：

- 后端权限模型重做。
- 第三方业务系统页面。
- 完整 OIDC、SAML、refresh token、ABAC、资源级权限。
- 飞书用户组同步或飞书角色同步。
- 生产 HTTPS、反向代理、高可用。

## 3. 页面要求

每个页面必须写清：

- 页面用途
- shadcn/ui component composition
- Table columns
- Filter fields
- Toolbar actions
- Row actions
- Drawer / Modal interactions
- Form fields
- Permission rules
- Loading / Empty / Error states
- Theme token decision
- Brand/material interpretation
- Implementation notes

## 4. 关键交互重新规划

### 应用创建

- 不再用简单弹窗创建应用。
- 使用 `Dialog` 或全高 `Sheet` 呈现“创建应用接入包”流程，步骤为：基础信息、回调地址、凭证生成、接入提示词。
- 创建成功页必须把 `client_secret` 与开发者 API secret 分区展示，并明确“只展示一次”。
- 关闭成功页后只能复制安全版提示词或轮换 secret，不能再次查看明文 secret。

### 应用详情

- 使用 `Sheet` 承载详情，但可以改成宽 Sheet + 左侧局部导航。
- 建议分区：概览、接入配置、开发者 API、授权范围、操作记录。
- 回调地址、OAuth 凭证和开发者 API 凭证要有状态、最近使用、轮换、禁用和审计提示。

### 权限管理

- 后台不把权限点和权限组 CRUD 做成主操作中心。
- 页面重点是“应用 -> IAM 角色 -> 授权对象 -> 权限组效果”的可解释关系。
- 绑定权限组时使用可搜索列表、勾选和差异预览；不提供按用户直接绑定权限点。

### 管理员授权

- 平台管理员和应用管理员分开展示。
- 应用管理员必须明确作用域，授权动作必须展示影响说明和审计提示。
- 禁用、恢复、调整作用域都进入统一 `AlertDialog`。

### 记录查询

- 审计日志、安全事件、同步记录可以统一在同一页面用 tab 或 segmented control 切换。
- 列表默认紧凑，详情用 Sheet；导出必须进入确认，并说明导出范围。

## 5. shadcn/ui 组件映射

- Shell：`Sidebar` + project `TopBar` + `Breadcrumb`
- 页面头：project `PageHeader`
- 列表：`Table` + TanStack Table + project `DataTable`
- 筛选：`Input`、`Select`、`DatePicker`、`Button`
- 详情：`Sheet`
- 创建/编辑：`Dialog` 或 `Sheet` + React Hook Form / Zod
- 高风险确认：`AlertDialog`
- 状态：`Badge`、`Skeleton`、`EmptyState`、`Toast`/`Sonner`
- 复杂搜索：`Command`
- 长文本/密钥占位：`ScrollArea` + monospace code block + copy button

## 6. 原型验收标准

- 每个一级页面都能看出主操作、筛选、列表/详情、空态和错误态位置。
- 创建应用接入包必须有完整步骤和成功后 secret 展示态。
- 管理员授权和 secret 轮换必须有确认弹框。
- 窄屏至少说明 sidebar 折叠/横向导航、表格横向滚动和 Sheet 全宽策略。
- 原型图完成后再进入前端代码重构；如需边做边调，必须先确认第一版信息架构。
