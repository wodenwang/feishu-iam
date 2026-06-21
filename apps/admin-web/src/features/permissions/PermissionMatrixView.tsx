import type { SyntheticEvent } from "react";
import { useMemo, useState } from "react";
import type { AdminMe } from "../../admin-types";
import {
  fetchPermissionMatrix,
  type PermissionMatrixApplication,
  type PermissionMatrixResult,
  type PermissionMatrixSubjectType,
} from "../../api/permission";
import { PageHeader } from "../../components/admin/PageHeader";
import { PageState } from "../../components/admin/PageState";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

type MatrixState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; result: PermissionMatrixResult }
  | { status: "failed"; message: string; forbidden: boolean; requestId?: string };

export function PermissionMatrixView({ admin }: { admin: AdminMe }) {
  const canQuery = admin.roles.includes("platform_admin");
  const [subjectType, setSubjectType] = useState<PermissionMatrixSubjectType>("user");
  const [subjectId, setSubjectId] = useState("");
  const [state, setState] = useState<MatrixState>({ status: "idle" });
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null);
  const selectedPoint = useMemo(() => {
    if (state.status !== "loaded" || !selectedPointKey) {
      return null;
    }
    for (const application of state.result.applications) {
      const point = application.permission_points.find((item) => item.key === selectedPointKey);
      if (point) {
        return { application, point };
      }
    }
    return null;
  }, [selectedPointKey, state]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSubjectId = subjectId.trim();
    if (!trimmedSubjectId) {
      return;
    }
    setState({ status: "loading" });
    setSelectedPointKey(null);
    try {
      const result = await fetchPermissionMatrix({ subjectType, subjectId: trimmedSubjectId });
      setState({ status: "loaded", result });
      setSelectedPointKey(result.applications[0]?.permission_points[0]?.key ?? null);
    } catch (error: unknown) {
      setState({
        status: "failed",
        message: error instanceof Error ? error.message : "无法查询权限矩阵",
        forbidden: isForbiddenError(error),
        requestId: readRequestId(error),
      });
    }
  }

  return (
    <main className="flex min-h-full flex-col bg-muted/20" role="region" aria-label="权限矩阵">
      <PageHeader
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "权限管理", href: "/admin/permissions" },
          { label: "权限矩阵", current: true },
        ]}
        description="按用户或组织查询最终权限和来源解释。权限矩阵只读，不在此编辑角色、权限组或权限点。"
        title="权限矩阵"
      />
      <section className="flex flex-1 flex-col gap-4 p-6">
        {!canQuery ? (
          <PageState
            description="当前管理员无权查询权限矩阵。"
            title="没有权限"
            type="forbidden"
          />
        ) : (
          <>
            <form className="grid gap-3 rounded-md border bg-background p-4 lg:grid-cols-[auto_minmax(220px,360px)_auto]" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-1.5 text-sm font-medium">
                <span>查询类型</span>
                <div className="inline-flex rounded-md border bg-muted p-1" role="group" aria-label="查询类型">
                  <Button
                    aria-pressed={subjectType === "user"}
                    size="sm"
                    type="button"
                    variant={subjectType === "user" ? "default" : "ghost"}
                    onClick={() => { setSubjectType("user"); }}
                  >
                    用户
                  </Button>
                  <Button
                    aria-pressed={subjectType === "department"}
                    size="sm"
                    type="button"
                    variant={subjectType === "department" ? "default" : "ghost"}
                    onClick={() => { setSubjectType("department"); }}
                  >
                    组织
                  </Button>
                </div>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                <span>主体 ID</span>
                <Input
                  aria-label="主体 ID"
                  placeholder={subjectType === "user" ? "输入飞书 user_id" : "输入飞书 department_id"}
                  value={subjectId}
                  onChange={(event) => { setSubjectId(event.target.value); }}
                />
              </label>
              <div className="flex items-end">
                <Button disabled={!subjectId.trim() || state.status === "loading"} type="submit">
                  {state.status === "loading" ? "查询中" : "查询"}
                </Button>
              </div>
            </form>

            {state.status === "idle" ? (
              <PageState
                description="请选择用户或组织后查询最终权限。组织查询首版只统计直接绑定该组织的角色，不展开组织下用户。"
                title="选择查询主体"
                type="empty"
              />
            ) : null}
            {state.status === "loading" ? <PageState title="正在查询权限矩阵" type="loading" /> : null}
            {state.status === "failed" ? (
              <PageState
                description={state.requestId ? `${state.message} / request id: ${state.requestId}` : state.message}
                title={state.forbidden ? "没有权限" : "查询失败"}
                type={state.forbidden ? "forbidden" : "error"}
              />
            ) : null}
            {state.status === "loaded" && state.result.applications.length === 0 ? (
              <PageState
                description={state.result.scope_note}
                title="未查询到有效权限"
                type="empty"
              />
            ) : null}
            {state.status === "loaded" && state.result.applications.length > 0 ? (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid min-w-0 content-start gap-3">
                  <div className="rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <strong className="text-foreground">{state.result.subject.name}</strong>
                    <span> / {state.result.subject.id}</span>
                    <p className="mt-1">{state.result.scope_note}</p>
                  </div>
                  {state.result.applications.map((application) => (
                    <ApplicationMatrixCard
                      application={application}
                      key={application.app_key}
                      selectedPointKey={selectedPointKey}
                      onSelectPoint={setSelectedPointKey}
                    />
                  ))}
                </div>
                <PermissionExplanationPanel selected={selectedPoint} />
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function ApplicationMatrixCard(props: {
  application: PermissionMatrixApplication;
  selectedPointKey: string | null;
  onSelectPoint: (pointKey: string) => void;
}) {
  return (
    <article className="grid min-w-0 gap-3 rounded-md border bg-background p-4">
      <div className="grid min-w-0 gap-1">
        <h2 className="text-base font-semibold">{props.application.name}</h2>
        <code className="break-all text-xs text-muted-foreground">{props.application.app_key}</code>
      </div>
      <div className="grid gap-2 text-sm">
        <h3 className="text-sm font-semibold">命中角色</h3>
        <div className="flex flex-wrap gap-2">
          {props.application.matched_roles.map((role) => (
            <span className="rounded-md border px-2 py-1" key={`${role.key}:${role.match_type}`}>
              {role.name} / <code>{role.key}</code>
              <span className="ml-2 text-xs text-muted-foreground">
                {formatMatchType(role.match_type)}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <h3 className="text-sm font-semibold">权限点</h3>
        <div className="grid gap-2">
          {props.application.permission_points.map((point) => (
            <button
              aria-pressed={props.selectedPointKey === point.key}
              className="grid min-w-0 gap-1 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary/10"
              key={point.key}
              type="button"
              onClick={() => { props.onSelectPoint(point.key); }}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium">{point.name}</span>
                <StatusBadge tone="success">有效</StatusBadge>
              </span>
              <code className="break-all text-xs text-muted-foreground">{point.key}</code>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function PermissionExplanationPanel(props: {
  selected: { application: PermissionMatrixApplication; point: PermissionMatrixApplication["permission_points"][number] } | null;
}) {
  if (!props.selected) {
    return (
      <aside className="grid content-start gap-3 rounded-md border bg-background p-4 lg:sticky lg:top-4" role="region" aria-label="权限来源解释">
        <h2 className="text-base font-semibold">权限来源解释</h2>
        <p className="text-sm text-muted-foreground">请选择一个权限点查看来源角色和权限组。</p>
      </aside>
    );
  }

  const { application, point } = props.selected;
  return (
    <aside className="grid content-start gap-3 rounded-md border bg-background p-4 lg:sticky lg:top-4" role="region" aria-label="权限来源解释">
      <div>
        <h2 className="text-base font-semibold">权限来源解释</h2>
        <p className="text-sm text-muted-foreground">{application.name}</p>
      </div>
      <div className="grid gap-1">
        <span className="text-sm font-medium">{point.name}</span>
        <code className="break-all text-xs text-muted-foreground">{point.key}</code>
      </div>
      <div className="grid gap-1 text-sm">
        <span className="font-medium">来源角色</span>
        <ul className="grid gap-1 text-muted-foreground">
          {point.source_roles.map((roleKey) => <li className="break-all" key={roleKey}>{roleKey}</li>)}
        </ul>
      </div>
      <div className="grid gap-1 text-sm">
        <span className="font-medium">来源权限组</span>
        <ul className="grid gap-1 text-muted-foreground">
          {point.source_groups.length > 0
            ? point.source_groups.map((groupKey) => <li className="break-all" key={groupKey}>{groupKey}</li>)
            : <li>直接绑定</li>}
        </ul>
      </div>
    </aside>
  );
}

function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 403
  );
}

function formatMatchType(matchType: PermissionMatrixApplication["matched_roles"][number]["match_type"]): string {
  return matchType === "department" ? "通过组织继承" : "直接绑定";
}

function readRequestId(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "requestId" in error &&
    typeof (error as { requestId?: unknown }).requestId === "string"
    ? (error as { requestId: string }).requestId
    : undefined;
}
