# Feishu IAM v0.14.1 应用详情 Tab 化设计评审

日期：2026-05-28
状态：通过

## 评审输入

- GitLab issue `#17`
- `DESIGN.md`
- `AGENTS.md`
- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs.md`
- `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs-eng-review.md`
- `design/exports/v0.14.1-application-detail-tabs/browser-qa/details-desktop.png`
- `design/exports/v0.14.1-application-detail-tabs/browser-qa/development-desktop.png`
- `design/exports/v0.14.1-application-detail-tabs/browser-qa/development-mobile.png`

## 结论

应用详情 Tab 化可以进入发布阶段。当前实现把详情信息拆成 `详细资料`、`角色管理`、`开发信息`、`危险操作` 四个稳定分区，解决了 `v0.14.0` 独立详情页内容过长、信息层级不够清晰的问题。

## 检查结果

- 信息架构：基础信息、角色元数据、接入配置和危险操作已分区，不再把所有能力堆在一个长页面。
- URL 状态：`tab=roles`、`tab=development`、`tab=danger` 可直达对应分区；默认详情不写入多余 `tab` 参数。
- 返回上下文：`from=/admin/applications` 保留，切换 Tab 不丢失返回来源。
- 旧入口兼容：旧 `sheet=app:*` 抽屉继续使用本地 Tab 状态，不依赖 URL Tab。
- 桌面视觉：Tab 位于应用摘要卡片下方，内容区边界清晰，未发现遮挡或异常空白。
- 移动视觉：390px 视口下 Tab 可换行，开发信息中的长 URL 可换行，不产生页面级横向溢出。

## 发现与处理

本轮设计评审未发现需要返工的问题。

## 后续约束

- 后续如果继续增加应用详情能力，应优先进入现有四个 Tab；只有出现新的主任务类别时才新增 Tab。
- 危险操作仍保持独立分区，不和日常编辑操作混排。
- 角色元数据仍归应用管理，不能回退到权限管理入口。
