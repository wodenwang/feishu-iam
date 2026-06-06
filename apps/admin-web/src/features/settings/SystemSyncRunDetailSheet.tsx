import type { FeishuSyncRun } from "../../api/feishu";
import type { ReactNode } from "react";
import { DetailSheet } from "../../components/admin/DetailSheet";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import {
  durationText,
  formatDateTime,
  formatRunChange,
  formatRunStatus,
} from "./settings-format";

export function SystemSyncRunDetailSheet(props: {
  open: boolean;
  run: FeishuSyncRun | null;
  loading?: boolean;
  error?: string | null;
  onOpenTrace?: (run: FeishuSyncRun) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const title = props.run ? `同步记录 ${props.run.id}` : "同步记录详情";

  return (
    <DetailSheet
      open={props.open}
      title={title}
      description={<span>查看飞书组织与用户同步的安全摘要。</span>}
      defaultSize="wide"
      sizeStorageKey="feishu-iam:settings-sync-run-sheet-size"
      onOpenChange={props.onOpenChange}
    >
      {props.loading ? (
        <p className="text-sm text-muted-foreground">正在读取同步记录...</p>
      ) : props.error ? (
        <p className="text-sm text-destructive">{props.error}</p>
      ) : props.run ? (
        <SyncRunDetail run={props.run} onOpenTrace={props.onOpenTrace} />
      ) : (
        <p className="text-sm text-muted-foreground">
          同步记录不存在或已不在最近记录中。
        </p>
      )}
    </DetailSheet>
  );
}

function SyncRunDetail({ run, onOpenTrace }: { run: FeishuSyncRun; onOpenTrace?: (run: FeishuSyncRun) => void }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <DetailItem
          label="状态"
          value={
            <StatusBadge
              tone={statusTone(run.status)}
              ariaLabel={`同步状态：${formatRunStatus(run.status)}`}
            >
              {formatRunStatus(run.status)}
            </StatusBadge>
          }
        />
        <DetailItem
          label="触发来源"
          value={<span className="break-all">{run.triggerSource}</span>}
        />
        <DetailItem label="开始时间" value={formatDateTime(run.startedAt)} />
        <DetailItem
          label="结束时间"
          value={run.finishedAt ? formatDateTime(run.finishedAt) : "运行中"}
        />
        <DetailItem label="耗时" value={durationText(run)} />
        <DetailItem
          label="记录 ID"
          value={<span className="break-all">{run.id}</span>}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="同步计数">
        <DetailItem
          label="部门"
          value={formatRunChange(
            null,
            run.departmentCreatedCount,
            run.departmentUpdatedCount,
            run.departmentDeletedCount,
          )}
        />
        <DetailItem
          label="用户"
          value={formatRunChange(
            null,
            run.userCreatedCount,
            run.userUpdatedCount,
            run.userDeletedCount,
          )}
        />
        <DetailItem
          label="关系"
          value={formatRunChange(
            null,
            run.relationCreatedCount,
            run.relationUpdatedCount,
            run.relationDeletedCount,
          )}
        />
      </section>

      <section
        className="rounded-md border bg-muted/20 p-4"
        aria-label="错误摘要"
      >
        <h3 className="text-sm font-medium">错误摘要</h3>
        <dl className="mt-3 grid gap-3 text-sm">
          <DetailRow label="错误码" value={run.errorCode ?? "无错误"} />
          <DetailRow label="错误信息" value={run.errorMessage ?? "无错误"} />
          <DetailRow label="失败阶段" value={run.errorStage ?? "未记录"} />
          <DetailRow label="request id" value={run.requestId ?? "未记录"} />
        </dl>
        {onOpenTrace && run.requestId ? (
          <Button
            className="mt-4"
            type="button"
            variant="outline"
            onClick={() => {
              onOpenTrace(run);
            }}
          >
            查看同步追踪
          </Button>
        ) : null}
      </section>

      <section
        className="rounded-md border bg-background p-4"
        aria-label="诊断建议"
      >
        <h3 className="text-sm font-medium">诊断建议</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {diagnosticSuggestions(run).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DetailItem(props: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">
        {props.value}
      </div>
    </div>
  );
}

function DetailRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className="break-all">{props.value}</dd>
    </div>
  );
}

function statusTone(
  status: FeishuSyncRun["status"],
): "success" | "warning" | "danger" {
  if (status === "success") {
    return "success";
  }
  if (status === "running") {
    return "warning";
  }
  return "danger";
}

function diagnosticSuggestions(run: FeishuSyncRun): string[] {
  if (run.status === "success") {
    return ["同步已成功完成，可继续核对组织、用户和关系统计。"];
  }
  if (run.status === "running") {
    return ["同步仍在运行中，请等待结束后再查看错误摘要或触发新的同步。"];
  }

  const code = run.errorCode ?? "";
  const stage = run.errorStage ?? "";
  const suggestions = [
    "使用 request id 在服务日志中定位同一次飞书请求。",
    "打开字段诊断页核对通讯录 scope、可见范围和身份字段完整性。",
  ];

  if (/PERMISSION|SCOPE|FORBIDDEN/i.test(code)) {
    suggestions.unshift("检查飞书自建应用通讯录权限和可见范围是否覆盖目标部门。");
  }
  if (/CONFIG|TOKEN/i.test(code)) {
    suggestions.unshift("检查飞书应用配置和 tenant access token 获取链路。");
  }
  if (/TARGET_NOT_FOUND/i.test(code)) {
    suggestions.unshift("先确认本地镜像中目标用户或部门关系仍然存在，再执行轻量同步。");
  }
  if (stage) {
    suggestions.push(`优先排查失败阶段：${stage}。`);
  }

  return suggestions;
}
