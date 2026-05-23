# feishu-iam v0.1 QA Report

- Date: 2026-05-23
- Target: http://127.0.0.1:5173
- Viewports: 1440x900, 1280x800, 768x1024
- Screenshots: /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa

## Results

- PASS | console | 未捕获浏览器 console.error / pageerror | 所有 viewport 和交互路径
- PASS | routes | Login / Initialize / Admin pages / 403 / fallback 均可打开 | 3 个 viewport
- PASS | layout | Sidebar / Header / Breadcrumb 在主要页面可见，平板视口未阻塞内容访问 | 截图已保存
- PASS | crud | Applications / Roles / Directory / Sync / Audit 的 Drawer、Popconfirm、Modal 交互可打开关闭 | 交互截图已保存
- PASS | states | Empty / No Permission / Global Error 可见；Loading/Error 由单测覆盖 | 浏览器 empty search + /403 + /fallback；单测覆盖 rejectNext* error
- PASS | security | 登录仅保留飞书入口；Onboarding Agent Prompt 不暴露真实或 masked secret preview | 浏览器断言 + 截图

## Screenshots

- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/login-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/initialize-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/dashboard-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/applications-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/application-detail-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/onboarding-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/roles-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/directory-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/sync-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/audit-logs-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/forbidden-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/fallback-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/login-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/initialize-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/dashboard-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/applications-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/application-detail-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/onboarding-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/roles-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/directory-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/sync-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/audit-logs-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/forbidden-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/fallback-laptop-1280.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/login-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/initialize-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/dashboard-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/applications-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/application-detail-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/onboarding-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/roles-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/directory-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/sync-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/audit-logs-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/forbidden-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/fallback-tablet-768.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/applications-empty-search-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/applications-create-drawer-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/applications-disable-confirm-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/application-detail-config-tab-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/application-detail-rotate-appsecret-confirm-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/onboarding-secret-copy-warning-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/onboarding-agent-prompt-and-check-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/roles-create-drawer-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/roles-authorization-drawer-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/roles-authorization-summary-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/directory-user-detail-drawer-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/sync-detail-drawer-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/sync-retry-feedback-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/audit-detail-drawer-desktop-1440.png
- /Users/wenzhewang/workspace/dev_project/feishu-iam/.gstack/qa-reports/screenshots/20260523-feishu-iam-qa/fallback-copy-request-id-desktop-1440.png

## Console

- No console.error or pageerror captured.