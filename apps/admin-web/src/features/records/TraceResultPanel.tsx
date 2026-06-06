import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import type { AdminTraceResult, AdminTraceTimelineItem } from "../../api/admin";
import { CopyField } from "../../components/admin/CopyField";
import { PageState } from "../../components/admin/PageState";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { resultLabel, stageLabel } from "./trace-format";

export function TraceResultPanel(props: {
  result: AdminTraceResult | null;
  loading?: boolean;
  error?: string | null;
  forbidden?: boolean;
  returnTo?: string;
}) {
  if (props.forbidden) {
    return <PageState type="forbidden" title="无权查看追踪结果" description="当前管理员无权查看该范围内的生产追踪数据。" />;
  }
  if (props.error) {
    return <PageState type="error" title={props.error} description="请检查 request id、应用、client 或时间窗口。" />;
  }
  if (props.loading) {
    return <PageState type="loading" title="正在生成追踪视角" />;
  }
  if (!props.result) {
    return (
      <PageState
        type="empty"
        title="输入 request id 或上下文后查询"
        description="优先粘贴终端用户反馈的 request id；没有 request id 时，再补充应用、client、飞书 user_id 和时间窗口。"
      />
    );
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-md border bg-background p-4" aria-label="诊断摘要">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">诊断摘要</h2>
              <StatusBadge tone={summaryTone(props.result.summary.status)}>
                {summaryLabel(props.result.summary.status)}
              </StatusBadge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{props.result.summary.diagnosis}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {props.returnTo ? (
              <Button asChild type="button" variant="outline">
                <Link to={props.returnTo}>返回来源页面</Link>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="审计日志" value={props.result.coverage.auditLogs} />
          <Metric label="安全事件" value={props.result.coverage.securityEvents} />
          <Metric label="同步 run" value={props.result.coverage.feishuSyncRuns} />
          <Metric label="token 上下文" value={props.result.coverage.oauthContexts} />
        </div>
        {props.result.context.requestId ? <CopyField label="request id" value={props.result.context.requestId} /> : null}
        {props.result.summary.missingStages.length > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            缺少阶段：{props.result.summary.missingStages.map(stageLabel).join("、")}
          </p>
        ) : null}
      </section>

      {props.result.timeline.length === 0 ? (
        <section className="rounded-md border border-dashed bg-muted/20 p-6 text-center">
          <SearchX className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-medium">没有可见追踪结果</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            请确认 request id 是否来自 Feishu IAM，或扩大时间窗口后重试。
          </p>
        </section>
      ) : (
        <section className="grid gap-3" aria-label="追踪时间线">
          <h2 className="text-base font-semibold">时间线</h2>
          {props.result.timeline.map((item) => (
            <TraceEvent key={`${item.source}:${item.id}`} item={item} />
          ))}
        </section>
      )}
    </div>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-lg font-semibold">{props.value}</div>
    </div>
  );
}

function TraceEvent({ item }: { item: AdminTraceTimelineItem }) {
  return (
    <article className="grid gap-3 rounded-md border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={item.result === "failed" ? "danger" : item.result === "success" ? "success" : "muted"}>
              {resultLabel(item.result)}
            </StatusBadge>
            <span className="text-sm text-muted-foreground">{stageLabel(item.stage)}</span>
          </div>
          <h3 className="mt-2 break-words text-sm font-semibold text-foreground">{item.title}</h3>
          <p className="mt-1 break-words text-sm text-muted-foreground">{item.summary}</p>
        </div>
        <time className="shrink-0 text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString("zh-CN")}</time>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <Detail label="应用" value={item.applicationId ?? "-"} />
        <Detail label="client" value={item.clientId ?? "-"} />
        <Detail label="飞书 user_id" value={item.feishuUserId ?? "-"} />
        <Detail label="request id" value={item.requestId ?? "-"} />
      </dl>
      <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
        {JSON.stringify(item.details, null, 2)}
      </pre>
    </article>
  );
}

function Detail(props: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="break-all font-mono text-xs text-foreground">{props.value}</dd>
    </div>
  );
}

function summaryLabel(status: AdminTraceResult["summary"]["status"]): string {
  if (status === "complete") return "完整命中";
  if (status === "partial") return "部分命中";
  if (status === "forbidden") return "权限不足";
  return "无结果";
}

function summaryTone(status: AdminTraceResult["summary"]["status"]) {
  if (status === "complete") return "success";
  if (status === "partial") return "warning";
  if (status === "forbidden") return "danger";
  return "muted";
}
