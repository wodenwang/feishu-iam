import {
  Activity,
  AlertTriangle,
  Clock3,
  Database,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { AdminMe } from "../../admin-types";
import type { FeishuStatus } from "../../api/feishu";
import type { ApiStatus } from "../../api/status";
import { PageHeader } from "../../components/admin/PageHeader";
import { PageState } from "../../components/admin/PageState";
import { StatusBadge } from "../../components/admin/StatusBadge";
import type { StatusBadgeTone } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import {
  collectWorkspaceRisks,
  createWorkspaceHealthItems,
  createWorkspaceSyncSummary,
} from "./workspace-risks";
import type { WorkspaceHealthItem, WorkspaceRisk } from "./workspace-risks";

export type WorkspaceViewProps = {
  admin: AdminMe;
  apiStatus?: ApiStatus;
  feishuStatus?: FeishuStatus;
  onNavigate: (href: string) => void;
};

export function WorkspaceView({
  admin,
  apiStatus,
  feishuStatus,
  onNavigate,
}: WorkspaceViewProps) {
  const risks = collectWorkspaceRisks({ apiStatus, feishuStatus });
  const healthItems = createWorkspaceHealthItems({ apiStatus, feishuStatus });
  const syncSummary = createWorkspaceSyncSummary(feishuStatus);

  return (
    <main
      aria-label="工作台"
      className="flex min-h-full flex-col bg-muted/20"
    >
      <PageHeader
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "工作台", current: true },
        ]}
        title="工作台"
        description="优先处理会阻断登录、同步和授权的运营风险，再查看系统健康与最近操作审计。"
        badges={
          risks.length > 0 ? (
            <StatusBadge tone="warning" ariaLabel={`${String(risks.length)} 个待处理风险`}>
              {risks.length} 个风险
            </StatusBadge>
          ) : (
            <StatusBadge tone="success">暂无风险</StatusBadge>
          )
        }
      />

      <section className="grid flex-1 gap-4 p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="min-w-0 rounded-md border bg-background p-4" aria-label="待处理风险">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">待处理风险</h2>
              <p className="text-sm text-muted-foreground">
                风险项按阻断程度排序，每项都提供可刷新、可复制的处置入口。
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>

          {risks.length > 0 ? (
            <div className="grid gap-3">
              {risks.map((risk) => (
                <RiskRow key={risk.id} risk={risk} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <PageState
                type="empty"
                title="暂无待处理风险"
                description="继续关注同步记录、系统运行和审计事件，发现异常时从目标模块进入详情。"
              />
              <Button asChild variant="outline">
                <Link to="/admin/system/audit?tab=sync">查看同步记录</Link>
              </Button>
            </div>
          )}
        </section>

        <aside className="grid min-w-0 gap-4" aria-label="工作台辅助信息">
          <section className="rounded-md border bg-background p-4" aria-label="系统健康">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">系统健康</h2>
              <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {healthItems.map((item) => (
                <HealthCard key={item.key} item={item} />
              ))}
            </div>
          </section>

          <section className="rounded-md border bg-background p-4" aria-label="飞书同步概览">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">最近飞书同步</h2>
              <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="grid gap-3 text-sm">
              <SummaryLine label="配置状态" value={syncSummary.configStatus} icon={<Settings className="h-4 w-4" />} />
              <SummaryLine label="最近同步" value={syncSummary.latestRunStatus} icon={<Clock3 className="h-4 w-4" />} />
              <SummaryLine label="有效部门" value={syncSummary.activeDepartments} icon={<Database className="h-4 w-4" />} />
            </div>
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link to={syncSummary.latestRunHref}>查看同步记录</Link>
            </Button>
          </section>

          <section className="rounded-md border bg-background p-4" aria-label="最近操作审计">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">最近操作审计</h2>
              <ScrollText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>审计和安全事件仍以操作审计为事实源，工作台只提供入口，避免重复维护摘要数据。</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/system/audit?tab=audit">查看审计日志</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/system/audit?tab=security">查看安全事件</Link>
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-md border bg-background p-4" aria-label="当前管理员">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">当前管理员</div>
                <div className="truncate text-sm font-medium text-foreground">{admin.displayName}</div>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function RiskRow({
  risk,
  onNavigate,
}: {
  risk: WorkspaceRisk;
  onNavigate: (href: string) => void;
}) {
  return (
    <article className="grid gap-3 rounded-md border bg-muted/20 p-4 md:grid-cols-[104px_minmax(0,1fr)_auto] md:items-center">
      <StatusBadge tone={risk.level === "danger" ? "danger" : "warning"}>
        {risk.level === "danger" ? "严重" : "关注"}
      </StatusBadge>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{risk.title}</h3>
          <span className="text-xs text-muted-foreground">{risk.source}</span>
        </div>
        <p className="break-words text-sm leading-6 text-muted-foreground">{risk.description}</p>
      </div>
      <Button
        className="w-full md:w-auto"
        type="button"
        variant="outline"
        onClick={() => {
          onNavigate(risk.href);
        }}
      >
        {risk.actionLabel}
      </Button>
    </article>
  );
}

function HealthCard({ item }: { item: WorkspaceHealthItem }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{item.label}</span>
        <StatusBadge tone={healthToneToBadge(item.tone)}>{healthToneLabel(item.tone)}</StatusBadge>
      </div>
      <div className="break-words text-sm font-semibold text-foreground">{item.value}</div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <strong className="break-words text-right text-foreground">{value}</strong>
    </div>
  );
}

function healthToneToBadge(tone: WorkspaceHealthItem["tone"]): StatusBadgeTone {
  if (tone === "success") {
    return "success";
  }
  if (tone === "danger") {
    return "danger";
  }
  if (tone === "warning") {
    return "warning";
  }
  return "muted";
}

function healthToneLabel(tone: WorkspaceHealthItem["tone"]): string {
  if (tone === "success") {
    return "正常";
  }
  if (tone === "danger") {
    return "异常";
  }
  if (tone === "warning") {
    return "关注";
  }
  return "读取中";
}
