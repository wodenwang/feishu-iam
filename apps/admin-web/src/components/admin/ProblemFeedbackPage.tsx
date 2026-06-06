import { AlertTriangle, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "../ui/button";

export type ProblemFeedbackPageProps = {
  title: string;
  description: string;
  errorCode: string;
  requestId: string;
  occurredAt: string;
  path: string;
  primaryAction?: { label: string; href: string };
  appKey?: string;
  clientId?: string;
  userIdentifier?: string;
};

export function ProblemFeedbackPage(props: ProblemFeedbackPageProps) {
  const [copied, setCopied] = useState(false);

  async function copyRequestId() {
    await navigator.clipboard.writeText(props.requestId);
    setCopied(true);
  }

  return (
    <main
      className="grid min-h-screen place-items-center bg-muted/20 p-4 sm:p-6"
      aria-label="Feishu IAM 问题提示"
    >
      <section className="grid w-full max-w-2xl gap-5 rounded-md border bg-background p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-[hsl(var(--status-warning))]/15 p-2 text-[hsl(var(--status-warning))]" aria-hidden="true">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Feishu IAM</p>
            <h1 className="mt-1 text-xl font-semibold leading-tight text-foreground sm:text-2xl">
              {props.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{props.description}</p>
          </div>
        </div>

        <dl className="grid gap-3 rounded-md border bg-muted/20 p-4">
          <ProblemRow label="错误码" value={props.errorCode} />
          <ProblemRow
            label="request id"
            value={props.requestId}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyRequestId()}
              >
                <Copy aria-hidden="true" size={14} />
                {copied ? "已复制" : "复制 request id"}
              </Button>
            }
          />
          <ProblemRow label="发生时间" value={props.occurredAt} />
          <ProblemRow label="页面路径" value={props.path} />
        </dl>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {props.primaryAction ? (
            <Button asChild>
              <a href={props.primaryAction.href}>{props.primaryAction.label}</a>
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ProblemRow(props: { label: string; value: string; action?: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center">
      <dt className="text-sm text-muted-foreground">{props.label}</dt>
      <dd className="break-all font-mono text-sm text-foreground">{props.value}</dd>
      {props.action ? <div>{props.action}</div> : null}
    </div>
  );
}
