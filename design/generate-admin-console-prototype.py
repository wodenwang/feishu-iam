import json

seq = 1


def nid(prefix):
    global seq
    v = f"{prefix}{seq}"
    seq += 1
    return v


C = {
    "page": "#f5f5f5",
    "white": "#ffffff",
    "border": "#d9d9d9",
    "line": "#f0f0f0",
    "text": "#262626",
    "sub": "#595959",
    "weak": "#8c8c8c",
    "blue": "#1677ff",
    "green": "#52c41a",
    "orange": "#faad14",
    "red": "#ff4d4f",
    "sider": "#001529",
    "sider_text": "#bfc7d5",
}


def frame(name, **props):
    children = props.pop("children", [])
    n = {"type": "frame", "id": nid("f"), "name": name}
    n.update({k: v for k, v in props.items() if v is not None})
    n.setdefault("layout", "vertical")
    if children:
        n["children"] = children
    return n


def text(content, **props):
    n = {
        "type": "text",
        "id": nid("t"),
        "content": content,
        "fill": props.pop("fill", C["text"]),
        "fontSize": props.pop("fontSize", 14),
    }
    if "width" in props:
        n["width"] = props.pop("width")
        n["textGrowth"] = "fixed-width"
    n.update({k: v for k, v in props.items() if v is not None})
    return n


def stroke(color=None, thickness=1):
    return {"fill": color or C["border"], "thickness": thickness, "align": "inside"}


def card(name, children, **props):
    return frame(
        name,
        width=props.pop("width", "fill_container"),
        height=props.pop("height", None),
        layout=props.pop("layout", "vertical"),
        gap=props.pop("gap", 8),
        padding=props.pop("padding", 16),
        fill=props.pop("fill", C["white"]),
        stroke=props.pop("stroke", stroke()),
        cornerRadius=props.pop("cornerRadius", 4),
        justifyContent=props.pop("justifyContent", None),
        alignItems=props.pop("alignItems", None),
        layoutPosition=props.pop("layoutPosition", None),
        x=props.pop("x", None),
        y=props.pop("y", None),
        children=children,
    )


def note_block(title, details):
    content = (
        f"{title}\n"
        f"页面用途：{details['purpose']}\n"
        f"Components：{details['components']}\n"
        f"Table columns：{details.get('columns', '-')}\n"
        f"Filter fields：{details.get('filters', '-')}\n"
        f"Toolbar actions：{details.get('toolbar', '-')}\n"
        f"Row actions：{details.get('row_actions', '-')}\n"
        f"Drawer/Modal：{details.get('drawers', '-')}\n"
        f"Permission：{details.get('permissions', '-')}\n"
        f"States：{details.get('states', 'Loading / Empty / Error')}\n"
        f"Notes：{details.get('notes', '-')}"
    )
    return card("低保真实现注释", [text(content, width="fill_container", fontSize=11, fill=C["sub"], lineHeight=1.35)], width=290, height=810, padding=14, fill="#fafafa", stroke=stroke(C["line"]))


nav_text = "工作台\n应用管理\n角色授权\n组织与用户\n飞书同步\n审计日志\n系统设置"


def admin_shell(name, x, title, desc, body, note, active="工作台", actions="[主操作]"):
    return frame(name, x=x, y=0, width=1440, height=900, layout="none", fill=C["page"], clip=True, children=[
        frame("Sider", x=0, y=0, width=208, height=900, layout="vertical", fill=C["sider"], padding=[18, 18, 18, 18], gap=18, children=[
            text("feishu-iam", fill=C["white"], fontSize=18, fontWeight="600"),
            text(nav_text, fill=C["sider_text"], fontSize=14, width="fill_container", lineHeight=1.9),
        ]),
        frame("Header", x=208, y=0, width=1232, height=56, layout="horizontal", fill=C["white"], padding=[24, 0], justifyContent="space_between", alignItems="center", stroke=stroke(C["line"], {"bottom": 1}), children=[
            text("feishu-iam Admin Console", fontWeight="600"),
            text("本地部署   张三 / ou_xxx   平台管理员   帮助   退出", fill=C["sub"], fontSize=13),
        ]),
        frame("Content", x=208, y=56, width=1232, height=844, layout="vertical", fill=C["page"], padding=24, gap=14, children=[
            text(f"首页 / {active}", fill=C["weak"], fontSize=12),
            frame("PageHeader", width="fill_container", layout="horizontal", justifyContent="space_between", alignItems="center", children=[
                frame("PageHeaderText", width="fill_container", layout="vertical", gap=6, children=[
                    text(title, fontSize=22, fontWeight="600"),
                    text(desc, width="fill_container", fill=C["sub"], fontSize=13),
                ]),
                text(actions, fill=C["blue"], fontSize=14),
            ]),
            frame("MainWithNote", width="fill_container", height=750, layout="horizontal", gap=16, children=[
                frame("MainArea", width=874, height="fill_container", layout="vertical", gap=14, children=body),
                note_block(title, note),
            ]),
        ]),
    ])


def button_label(labels):
    return text(labels, fill=C["blue"], fontSize=13)


def search_form(fields):
    return card("SearchForm", [text(f"筛选项：{fields}    [查询] [重置] [高级筛选]", width="fill_container", fill=C["sub"], fontSize=13)], height=72)


def toolbar(actions):
    return frame("Toolbar", width="fill_container", layout="horizontal", justifyContent="space_between", alignItems="center", children=[
        text(actions, fill=C["blue"], fontSize=13),
        text("rowSelection / 已选 N 项 / 密度 / 刷新", fill=C["weak"], fontSize=12),
    ])


def table_box(title, columns, rows=None, height=300):
    rows = rows or "示例行 1\n示例行 2\n示例行 3"
    return card(title, [
        text(f"Ant Design Table\ncolumns：{columns}\n{rows}\nPagination：右下角，操作列固定右侧", width="fill_container", fontSize=13, lineHeight=1.45),
    ], height=height)


def right_drawer(title, content, width=520):
    drawer_x = max(16, 874 - width - 16)
    return card(title, [
        text(title, fontSize=18, fontWeight="600"),
        text(content, width="fill_container", fill=C["sub"], fontSize=13, lineHeight=1.45),
        text("Footer：取消 / 确认", fill=C["blue"], fontSize=13),
    ], layoutPosition="absolute", x=drawer_x, y=0, width=width, height=700, padding=20)


def modal(title, content, width=520):
    return card(title, [
        text(title, fontSize=17, fontWeight="600"),
        text(content, width="fill_container", fill=C["sub"], fontSize=13, lineHeight=1.45),
        text("[取消]   [确认]", fill=C["blue"], fontSize=14),
    ], layoutPosition="absolute", x=(1440 - width) // 2, y=310, width=width, height=210, padding=20)


def login_page(x):
    note = {
        "purpose": "飞书 OAuth 唯一登录入口",
        "components": "Header / Card / Button / Alert / Result / Descriptions",
        "drawers": "无；错误状态用 Alert/Result",
        "permissions": "飞书认证后再判断 IAM 管理权限",
        "states": "未登录 / 回调处理中 / 配置缺失 / 用户未同步 / 无权限",
        "notes": "不得出现 username/password、本地账号、飞书 secret/token/code 明文",
    }
    return frame("飞书登录", x=x, y=0, width=1440, height=900, layout="vertical", fill=C["page"], padding=40, gap=18, clip=True, children=[
        frame("Header", width="fill_container", height=56, layout="horizontal", fill=C["white"], padding=[24, 0], justifyContent="space_between", alignItems="center", stroke=stroke(C["line"], {"bottom": 1}), children=[text("feishu-iam", fontSize=18, fontWeight="600"), text("本地部署   查看部署文档", fill=C["sub"], fontSize=13)]),
        frame("MainWithNote", width="fill_container", height=740, layout="horizontal", gap=16, children=[
            frame("LoginContent", width=980, height="fill_container", layout="horizontal", gap=16, alignItems="center", children=[
                card("登录面板", [
                    text("feishu-iam", fontSize=28, fontWeight="600"),
                    text("飞书 OAuth 登录 / 组织与用户来自飞书", fill=C["sub"], width="fill_container"),
                    frame("PrimaryButton", width="fill_container", height=44, layout="horizontal", fill=C["blue"], alignItems="center", justifyContent="center", cornerRadius=4, children=[text("使用飞书登录", fill=C["white"], fontSize=15, fontWeight="600")]),
                    text("无 username/password，无本地超级管理员账号。", fill=C["orange"], width="fill_container"),
                    card("登录失败状态占位", [text("Alert error：飞书配置缺失 / 回调失败\nAlert warning：用户未同步\nResult 403：已通过飞书认证但无 IAM 管理权限\nRequest ID：req_login_xxx", width="fill_container", fill=C["sub"], fontSize=12, lineHeight=1.45)], fill="#fafafa"),
                ], width=460, padding=28),
                card("部署状态", [text("当前环境：本地部署\n部署地址：https://iam.example.com\n认证方式：飞书 OAuth\n飞书应用：专用自建应用\n回调地址：/auth/feishu/callback", width="fill_container", lineHeight=1.55)], width="fill_container"),
            ]),
            note_block("飞书登录", note),
        ]),
    ])


def init_page(x):
    note = {
        "purpose": "首次进入系统后绑定系统超级管理员",
        "components": "Header / PageHeader / Steps / Descriptions / Alert / Button",
        "drawers": "无；完成后进入飞书登录",
        "permissions": "超级管理员必须来自当前飞书登录用户",
        "states": "检测中 / 配置异常 / 初始化成功 / 无权限",
        "notes": "不得出现本地创建管理员账号",
    }
    return frame("首次初始化", x=x, y=0, width=1440, height=900, layout="vertical", fill=C["page"], padding=40, gap=18, clip=True, children=[
        frame("Header", width="fill_container", height=56, layout="horizontal", fill=C["white"], padding=[24, 0], justifyContent="space_between", alignItems="center", stroke=stroke(C["line"], {"bottom": 1}), children=[text("feishu-iam", fontSize=18, fontWeight="600"), text("初始化模式   本地部署", fill=C["sub"], fontSize=13)]),
        frame("MainWithNote", width="fill_container", height=740, layout="horizontal", gap=16, children=[
            frame("InitMain", width=980, height="fill_container", layout="vertical", gap=16, children=[
                text("系统初始化", fontSize=22, fontWeight="600"),
                text("当前系统尚未完成超级管理员绑定。超级管理员必须来自当前飞书登录用户。", fill=C["orange"], width="fill_container"),
                card("初始化 Steps", [text("1 飞书登录校验  →  2 确认管理员身份  →  3 绑定专用飞书应用  →  4 完成初始化", width="fill_container", fontSize=15)], height=110),
                card("配置检测 Descriptions", [text("飞书登录用户：张三 / ou_xxx\n专用飞书应用：已绑定 / 未绑定\n通讯录权限：待检测\n数据库状态：正常\n最近初始化尝试：2026-05-23 14:20", width="fill_container", lineHeight=1.5)], height=200),
                text("[重新检测] [完成初始化] [查看部署文档]", fill=C["blue"]),
            ]),
            note_block("首次初始化", note),
        ]),
    ])


def build_pages():
    pages = []
    x = 0
    pages.append(login_page(x)); x += 1500
    pages.append(init_page(x)); x += 1500

    pages.append(admin_shell("工作台", x, "工作台", "查看 IAM 接入状态、飞书同步状态和最近审计事件。", [
        frame("Metrics", width="fill_container", height=92, layout="horizontal", gap=12, children=[
            card("指标", [text("已接入应用数\n12", width="fill_container", lineHeight=1.4)], height="fill_container"),
            card("指标", [text("角色数\n36", width="fill_container", lineHeight=1.4)], height="fill_container"),
            card("指标", [text("同步状态\n成功 / 10 分钟前", width="fill_container", lineHeight=1.4)], height="fill_container"),
            card("指标", [text("最近审计事件\n248", width="fill_container", lineHeight=1.4)], height="fill_container"),
        ]),
        card("待处理事项", [text("1. 应用 CRM 接入校验失败\n2. 飞书同步存在 3 条失败记录\n3. 角色授权有未保存变更", width="fill_container", lineHeight=1.45)], height=170),
        table_box("最近操作记录", "时间、操作人、动作、资源、结果、Request ID", height=300),
    ], {
        "purpose": "运维工作台，展示关键指标和待处理事项",
        "components": "Layout / Statistic / Table / Alert",
        "columns": "最近操作：时间、操作人、动作、资源、结果、Request ID",
        "toolbar": "刷新、查看接入文档",
        "permissions": "平台管理员全局；应用管理员仅所属应用范围",
        "states": "Loading / Empty 无应用 / Error 加载失败 / No permission",
        "notes": "不是装饰 Dashboard，保持高信息密度",
    }, active="工作台", actions="[刷新] [查看接入文档]")); x += 1500

    pages.append(admin_shell("应用管理列表", x, "应用管理列表", "标准 CRUD 列表，管理第三方应用接入。", [
        search_form("应用名称、应用状态、接入类型、创建时间"),
        toolbar("[新建应用] [批量启用/停用] [导入] [导出]"),
        table_box("应用 Table", "应用名称、App ID、状态、接入类型、负责人、最近同步、创建时间、操作", "CRM 系统  app_crm  启用  OAuth  李四  10 分钟前  2026-05-20  详情 | 编辑 | 接入配置 | 停用\nOA 门户   app_oa   停用  OAuth  王五  昨天      2026-05-18  详情 | 编辑 | 启用", height=390),
        right_drawer("新建应用 Drawer", "Form vertical：应用名称、App ID、接入类型、负责人、Redirect URI、描述。校验 App ID 唯一，Redirect URI 必须合法。", 520),
    ], {
        "purpose": "应用 CRUD 列表",
        "components": "PageHeader / Form / Toolbar / Table / Drawer / Modal",
        "columns": "应用名称、App ID、状态、接入类型、负责人、最近同步、创建时间、操作",
        "filters": "应用名称、应用状态、接入类型、创建时间",
        "toolbar": "新建应用、批量启用/停用、导入/导出",
        "row_actions": "详情、编辑、接入配置、启用/停用",
        "drawers": "新建应用 Drawer 520px，完整在 screen 内",
        "permissions": "application:view/create/update/disable",
        "states": "Loading / Empty / Search no results / API error",
        "notes": "表格优先，操作列固定右侧",
    }, active="应用管理", actions="[新建应用]")); x += 1500

    pages.append(admin_shell("应用详情", x, "应用详情", "查看单个应用的基础信息、OAuth 配置、权限范围、管理员和审计记录。", [
        card("Tabs", [text("基础信息 | OAuth 配置 | 权限范围 | 管理员 | 审计记录", fill=C["blue"])], height=48),
        card("基础信息 Descriptions", [text("应用名称：CRM 系统\nApp ID：app_crm\n状态：启用\n负责人：李四\n创建时间：2026-05-20\n描述：CRM OAuth 接入应用", width="fill_container", lineHeight=1.5)], height=180),
        card("OAuth 配置", [text("Redirect URI：https://crm.example.com/oauth/callback\nScopes：user:read、department:read、permission:query\nClient ID：client_xxx\n回调状态：最近校验成功", width="fill_container", lineHeight=1.5)], height=150),
        card("危险操作区", [text("停用应用 / 删除应用。必须二次确认 Modal。", fill=C["red"], width="fill_container")], height=90, fill="#fff1f0", stroke=stroke("#ffccc7")),
        modal("确认危险操作", "确认停用或删除应用？该操作会写入审计日志。", 520),
    ], {
        "purpose": "单应用详情，不复用审计日志内容",
        "components": "PageHeader / Tabs / Descriptions / Table / Modal",
        "columns": "审计记录：时间、操作人、动作、结果、Request ID",
        "toolbar": "编辑、进入接入向导、刷新",
        "drawers": "管理员详情/审计详情可用 Drawer",
        "permissions": "application:view/update/delete",
        "states": "Loading / Not found / Error / No permission",
        "notes": "危险操作放底部整行，不放 PageHeader",
    }, active="应用管理", actions="[编辑] [接入向导] [刷新]")); x += 1500

    pages.append(admin_shell("应用接入向导", x, "应用接入向导", "核心 full page Steps，指导完成应用接入。", [
        card("Steps", [text("1 填写应用基础信息 → 2 配置 OAuth Redirect URI → 3 选择权限 Scopes → 4 生成 Agent Prompt / 接入说明 → 5 校验并完成", width="fill_container")], height=90),
        frame("WizardBody", width="fill_container", height=430, layout="horizontal", gap=14, children=[
            card("当前步骤内容", [text("步骤 2：配置 OAuth Redirect URI\nRedirect URI 输入框\n校验状态：URI 不合法 / scope 缺失 / 飞书应用配置不匹配\n[上一步] [下一步] [保存草稿]", width="fill_container", lineHeight=1.55)], width=560),
            card("接入检查清单", [text("□ 基础信息完整\n□ Redirect URI 合法\n□ Scopes 已选择\n□ Agent Prompt 已生成\n□ 飞书配置匹配\n状态：校验失败 req_wizard_xxx", width="fill_container", lineHeight=1.5)], width="fill_container"),
        ]),
    ], {
        "purpose": "应用接入核心向导",
        "components": "Steps / Form / Alert / Code block / Button / Result",
        "filters": "不适用",
        "toolbar": "上一步、下一步、保存草稿、完成",
        "drawers": "复杂流程用 full page，不用 Drawer",
        "permissions": "application:create/update、application:secret:copy",
        "states": "Redirect URI 不合法 / scope 缺失 / 飞书配置不匹配 / 校验成功",
        "notes": "Agent Prompt 不含真实 secret；右侧面板不得超出页面",
    }, active="应用管理", actions="[保存草稿] [运行校验]")); x += 1500

    pages.append(admin_shell("角色授权", x, "角色授权", "RBAC 三栏授权工作台。", [
        frame("RBACColumns", width="fill_container", height=520, layout="horizontal", gap=14, children=[
            card("左：角色列表", [text("搜索角色\nCRM 管理员\n报表查看者\n审计员", width="fill_container", lineHeight=1.6)], width=210),
            card("中：权限树 / 权限分组", [text("搜索权限\n☑ user:view\n☑ user:create\n☑ role:update\n☑ app:manage\n☑ audit:view\n[保存] [重置] [查看变更]", width="fill_container", lineHeight=1.55)], width=390),
            card("右：授权摘要 / 风险提示", [text("已选权限：5\n影响角色：CRM 管理员\n风险提示：app:manage 为高风险权限\n保存将写入审计日志", width="fill_container", lineHeight=1.5)], width="fill_container"),
        ]),
        modal("保存授权确认", "新增权限 2 个，移除权限 1 个。保存后立即影响权限查询，并写入审计日志。", 560),
    ], {
        "purpose": "清晰表达 RBAC 角色授权",
        "components": "Layout columns / Tree / Checkbox / Modal / Alert",
        "columns": "角色列表：角色名、状态、权限数；权限树为分组结构",
        "filters": "角色、权限码",
        "toolbar": "保存、重置、查看变更",
        "drawers": "保存确认 Modal；复杂详情可 Drawer",
        "permissions": "role:view/update/authorize",
        "states": "Loading / Empty no role / Error save failed / No permission readonly",
        "notes": "三栏都必须在 screen 内，避免裁切",
    }, active="角色授权", actions="[保存授权] [刷新]")); x += 1500

    pages.append(admin_shell("组织与用户", x, "组织与用户", "只读浏览飞书组织和用户，不允许本地创建用户。", [
        frame("DirectoryLayout", width="fill_container", height=560, layout="horizontal", gap=14, children=[
            card("飞书组织树", [text("飞书租户\n  总部\n    研发部\n    销售部\n    财务部", width="fill_container", lineHeight=1.6)], width=240),
            frame("UsersArea", width="fill_container", height="fill_container", layout="vertical", gap=12, children=[
                search_form("姓名/邮箱/手机号、部门、状态、同步时间"),
                table_box("用户 Table", "姓名、飞书 User ID、部门、状态、角色、最近登录、同步时间、操作", "张三  ou_xxx  研发部  在职  CRM 管理员  10:20  14:10  查看详情 | 分配角色 | 禁用本系统访问", height=360),
            ]),
        ]),
        right_drawer("用户详情 Drawer", "Descriptions：基础信息、飞书 User ID、部门、状态、角色、最近登录、同步时间。提示：用户来源为飞书，不允许本地创建。", 560),
    ], {
        "purpose": "飞书组织用户只读浏览",
        "components": "Tree / SearchForm / Table / Drawer / Descriptions",
        "columns": "姓名、飞书 User ID、部门、状态、角色、最近登录、同步时间、操作",
        "filters": "姓名/邮箱/手机号、部门、状态、同步时间",
        "row_actions": "查看详情、分配角色、禁用本系统访问",
        "drawers": "用户详情 Drawer 560px",
        "permissions": "directory:view、role:assign、user:disable_access",
        "states": "Tree loading / Empty no users / Sync error / No permission",
        "notes": "不得出现新建本地用户入口",
    }, active="组织与用户", actions="[刷新]")); x += 1500

    pages.append(admin_shell("飞书同步中心", x, "飞书同步中心", "查看和触发飞书组织用户同步。", [
        card("同步状态", [text("当前状态：Success / Loading / Error\n上次同步时间：2026-05-23 14:10\n同步范围：部门、用户、用户部门关系\n同步结果：新增 12、更新 34、失败 3", width="fill_container", lineHeight=1.5)], height=150),
        toolbar("[手动同步] [刷新]"),
        table_box("同步记录 Table", "Run ID、状态、开始时间、耗时、范围、结果、操作人、操作", "sync_1024  失败  14:10  45s  部门+用户  API 权限不足  张三  详情", height=320),
        right_drawer("失败详情 Drawer", "失败类型：API 权限不足、token 失效、部门同步失败。展示 request ID、错误码、失败批次、建议处理。", 600),
    ], {
        "purpose": "飞书同步运维页",
        "components": "Status summary / Button / Table / Drawer / Alert",
        "columns": "Run ID、状态、开始时间、耗时、范围、结果、操作人、操作",
        "toolbar": "手动同步、刷新",
        "row_actions": "查看详情",
        "drawers": "失败详情 Drawer 600px",
        "permissions": "sync:view、sync:manual",
        "states": "loading / success / error / API 权限不足 / token 失效 / 部门同步失败",
        "notes": "仅平台管理员可见",
    }, active="飞书同步", actions="[手动同步]")); x += 1500

    pages.append(admin_shell("审计日志", x, "审计日志", "标准审计查询页。", [
        search_form("操作人、资源类型、操作类型、结果、时间范围"),
        toolbar("[刷新] [导出 disabled]"),
        table_box("审计 Table", "时间、操作人、资源、动作、结果、IP、Request ID、操作", "14:22  张三  app_crm  更新授权  成功  10.0.0.8  req_abc  查看详情", height=390),
        right_drawer("审计详情 Drawer", "request context、变更前后、错误信息、脱敏 details JSON。不得混入组织用户或应用详情内容。", 640),
    ], {
        "purpose": "审计查询与详情回溯",
        "components": "SearchForm / Toolbar / Table / Drawer",
        "columns": "时间、操作人、资源、动作、结果、IP、Request ID、操作",
        "filters": "操作人、资源类型、操作类型、结果、时间范围",
        "row_actions": "查看详情",
        "drawers": "审计详情 Drawer 640px",
        "permissions": "audit:view",
        "states": "Loading / Empty / Search no results / Query error with Request ID",
        "notes": "敏感字段脱敏，不混入其他页面内容",
    }, active="审计日志", actions="[刷新]")); x += 1500

    pages.append(frame("403 无权限页", x=x, y=0, width=1440, height=900, layout="vertical", fill=C["page"], padding=40, gap=18, clip=True, children=[
        frame("Header", width="fill_container", height=56, layout="horizontal", fill=C["white"], padding=[24, 0], justifyContent="space_between", alignItems="center", stroke=stroke(C["line"], {"bottom": 1}), children=[text("feishu-iam", fontSize=18, fontWeight="600"), text("张三 / ou_xxx", fill=C["sub"], fontSize=13)]),
        frame("MainWithNote", width="fill_container", height=740, layout="horizontal", gap=16, children=[
            card("Result 403", [text("403 无权限页", fill=C["red"], fontSize=28, fontWeight="600"), text("当前用户：张三 / ou_xxx\n缺失权限码：audit:view\n请联系平台管理员分配 IAM 管理权限。", width="fill_container", lineHeight=1.5), text("[返回工作台]", fill=C["blue"])], width=980, alignItems="center", justifyContent="center"),
            note_block("403 无权限页", {"purpose": "已登录但缺少 IAM 权限", "components": "Header / Result / Button", "permissions": "显示缺失权限码", "states": "No permission", "notes": "不提示创建本地账号"}),
        ]),
    ])); x += 1500

    pages.append(frame("全局错误页", x=x, y=0, width=1440, height=900, layout="vertical", fill=C["page"], padding=40, gap=18, clip=True, children=[
        frame("Header", width="fill_container", height=56, layout="horizontal", fill=C["white"], padding=[24, 0], justifyContent="space_between", alignItems="center", stroke=stroke(C["line"], {"bottom": 1}), children=[text("feishu-iam", fontSize=18, fontWeight="600"), text("本地部署   查看部署文档", fill=C["sub"], fontSize=13)]),
        frame("MainWithNote", width="fill_container", height=740, layout="horizontal", gap=16, children=[
            card("错误诊断", [text("系统不可用 / 飞书 API 异常", fill=C["red"], fontSize=24, fontWeight="600"), text("Request ID：req_20260523_xxx\n时间：2026-05-23 14:35\n错误：飞书 API 异常 / 后端不可用 / 网络超时\n排查建议：重试、检查飞书配置、查看部署文档、复制诊断信息", width="fill_container", lineHeight=1.5), text("[重试] [返回] [查看部署文档] [复制 Request ID]", fill=C["blue"])], width=980),
            note_block("全局错误页", {"purpose": "系统级异常诊断", "components": "Header / Result / Alert / Descriptions / Button", "permissions": "所有用户可见", "states": "后端不可用 / 飞书 API 异常 / 网络超时 / 未知错误", "notes": "面向运维/管理员；不展示 secret/token/code"}),
        ]),
    ]))

    return pages


def backup_pages(start_x):
    names = ["备选 - 飞书登录 Variation B", "备选 - 应用接入向导 Variation B", "备选 - 角色授权 Variation B", "备选 - 全局错误页 Variation B"]
    pages = []
    x = start_x
    for name in names:
        pages.append(frame(name, x=x, y=0, width=1440, height=900, layout="vertical", fill=C["page"], padding=40, gap=16, clip=True, children=[
            text(name, fontSize=24, fontWeight="600"),
            card("备选页说明", [text("该页面为前期 Variation B / 探索版备选，不属于 12 页主流程。保留作为后续评审参考，不能混入主流程实现清单。", width="fill_container", fill=C["sub"], lineHeight=1.5)], height=120),
            card("结构占位", [text("保持低保真线框；如采纳，需要按主流程页面规则重新整理为实现蓝图。", width="fill_container", fill=C["sub"])], height=220),
        ]))
        x += 1500
    return pages


pages = build_pages()
pages.extend(backup_pages(18000))

with open("design/feishu-iam-v0.1.0-admin-console.pen", "w", encoding="utf-8") as f:
    json.dump({"version": "2.11", "children": pages}, f, ensure_ascii=False, indent=2)
