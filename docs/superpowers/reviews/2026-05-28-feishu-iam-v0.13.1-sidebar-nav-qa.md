# Feishu IAM v0.13.1 左侧导航层级 QA 报告

日期：2026-05-28
状态：通过

## 1. QA 范围

本轮 QA 聚焦 GitLab issue `#12`：后台左侧导航一级目录和二级目录层级不清晰。

覆盖路径：

- `/admin/workspace`
- `/admin/applications`
- `/admin/permissions`
- `/admin/system/admins`
- `/admin/system/audit?tab=security`
- `/admin/system/feishu`
- `/admin/system/info`

覆盖视口：

- mobile：390x844
- narrow：768x900
- desktop：1280x900
- wide：1440x900

## 2. 手工 Browser QA

使用 `@Browser` 打开 `http://localhost:3000/admin/system/audit`，临时 mock API 只用于本地 QA，不写入仓库。

验证结果：

- 桌面展开态：`系统管理` 父级可见，二级菜单缩进展示，`操作审计` 高亮。
- 当前二级页：父级展开按钮为 `当前页面保持系统管理子菜单展开`，`aria-expanded="true"`，按钮 disabled，避免当前上下文被折叠丢失。
- 父级链接语义：`系统管理` 父级链接不再设置 `aria-current`，当前页只落在具体二级项。
- 桌面收缩态：主菜单宽度 80px，二级 link 不直接展示，避免挤压。
- 移动抽屉：390px 下 `系统管理` 和四个二级入口完整可见，当前 `操作审计` 高亮清晰。
- 布局：Browser 检查未发现明显遮挡、异常空白或横向溢出。

## 3. 自动化 QA

已执行：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/admin-components.test.tsx src/App.test.tsx
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web build
ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive
```

结果：

- 组件和 App 路由测试：55 个用例通过。
- lint：通过。
- build：通过，仅保留既有 Vite chunk size warning。
- 响应式检查：7 条路由 x 4 个视口全部通过，`failures: []`，未发现 console error、request failed 或横向溢出。

## 4. 发现与处理

| 编号   | 严重级别 | 问题                                                                   | 处理                                                                        |
| ------ | -------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| QA-001 | 重要     | 移动 Sheet 复用 sidebar text token，未激活二级菜单在浅色背景可读性不足 | 已修复：`PrimaryNav` 增加 `surface` tone，移动 Sheet 使用浅色面板文字 token |
| QA-002 | 轻微     | 移动 Sheet 缺少描述导致测试打开时出现 Radix 无障碍告警                 | 已修复：补充 sr-only `SheetDescription`                                     |

## 5. 结论

本轮 QA 未发现剩余阻塞问题。当前实现可进入版本元数据、发布材料和 Git 收口阶段。
