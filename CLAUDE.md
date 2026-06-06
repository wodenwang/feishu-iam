# Feishu IAM Claude 工作补充

本文件补充 `AGENTS.md`，用于让 Claude 类 Agent 在本仓库中更稳定地选择 gstack 技能。项目通用约束、语言要求、安全边界和会话归档规则仍以 `AGENTS.md` 为准。

## Skill routing

当用户请求与可用 gstack 技能匹配时，应优先调用对应技能，再继续普通实现流程。不要把技能当作所有任务的默认前置条件；只有用户显式指定技能，或请求明显匹配以下场景时才使用。

- 产品想法、是否值得做、需求取舍：使用 `/office-hours`。
- Bug、错误、500、为什么坏了：使用 `/investigate`。
- 发布、部署、推送、创建 PR：使用 `/ship`。
- QA、测试站点、找 bug：使用 `/qa`。
- 代码审查、检查 diff：使用 `/review`。
- 发布后更新文档：使用 `/document-release`。
- 周度工程复盘：使用 `/retro`。
- 设计系统、品牌和视觉方向：使用 `/design-consultation`。
- 视觉审查、设计打磨：使用 `/design-review`。
- 架构和工程计划审查：使用 `/plan-eng-review`。
- 保存进度、checkpoint、恢复上下文：使用 `/checkpoint`。
- 代码质量和健康检查：使用 `/health`。
