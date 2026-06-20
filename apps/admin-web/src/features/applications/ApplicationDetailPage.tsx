import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { AdminMe } from "../../admin-types";
import {
  disableApplication,
  enableApplication,
  fetchApplicationPage,
} from "../../api/permission";
import type { Application } from "../../api/permission";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { PageHeader } from "../../components/admin/PageHeader";
import { PageState } from "../../components/admin/PageState";
import { Button } from "../../components/ui/button";
import {
  ApplicationDetailSheet,
  isApplicationDetailTab,
} from "./ApplicationDetailSheet";
import type { StatusAction } from "./ApplicationDetailSheet";
import type { OpenApplicationRecordsOptions } from "./ApplicationDetailSheet";

export function ApplicationDetailWorkspace(props: {
  admin: AdminMe;
  onManagePermissions: (appKey: string) => void;
  onOpenRecords: (applicationId: string, options?: OpenApplicationRecordsOptions) => void;
}) {
  const { appKey } = useParams<{ appKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "loaded"; application: Application }
    | { status: "failed"; message: string; forbidden: boolean }
  >({ status: "loading" });
  const [statusConfirmation, setStatusConfirmation] = useState<{
    action: StatusAction;
    application: Application;
  } | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState<string>();
  const latestRequestRef = useRef(0);
  const returnTo = useMemo(() => {
    const from = searchParams.get("from");
    return from?.startsWith("/admin/applications")
      ? from
      : "/admin/applications";
  }, [searchParams]);
  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return isApplicationDetailTab(tab) ? tab : "details";
  }, [searchParams]);

  function handleTabChange(tab: string) {
    if (!isApplicationDetailTab(tab)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (tab === "details") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    void navigate(
      { search: next.toString() ? `?${next.toString()}` : "" },
      { replace: true },
    );
  }

  useEffect(() => {
    if (!appKey) {
      setState({
        status: "failed",
        message: "缺少应用 app_key",
        forbidden: false,
      });
      return;
    }
    const requestSeq = latestRequestRef.current + 1;
    latestRequestRef.current = requestSeq;
    setState({ status: "loading" });
    void fetchApplicationPage({
      page: 1,
      pageSize: 100,
      query: appKey,
      status: "all",
    })
      .then((page) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        const application = page.items.find((item) => item.appKey === appKey);
        if (application) {
          setState({ status: "loaded", application });
        } else {
          setState({
            status: "failed",
            message: "应用不存在或不在当前管理员范围内",
            forbidden: false,
          });
        }
      })
      .catch((error: unknown) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : "无法读取应用详情",
          forbidden: isForbiddenError(error),
        });
      });
  }, [appKey, props.admin.adminUserId]);

  function handleApplicationChanged(application: Application) {
    setState({ status: "loaded", application });
  }

  async function handleStatusConfirm() {
    if (!statusConfirmation) {
      return;
    }
    setStatusPending(true);
    setStatusError(undefined);
    try {
      const updated =
        statusConfirmation.action === "enable"
          ? await enableApplication(statusConfirmation.application.appKey)
          : await disableApplication(statusConfirmation.application.appKey);
      handleApplicationChanged(updated);
      setStatusConfirmation(null);
    } catch (error: unknown) {
      setStatusError(
        error instanceof Error ? error.message : "无法更新应用状态",
      );
    } finally {
      setStatusPending(false);
    }
  }

  const statusConfirmCopy = statusConfirmation
    ? statusActionCopy[statusConfirmation.action]
    : null;

  return (
    <main
      className="flex min-h-full flex-col bg-muted/20"
      aria-label="应用详情"
    >
      <PageHeader
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "应用管理", href: returnTo },
          {
            label:
              state.status === "loaded"
                ? state.application.name
                : (appKey ?? "应用详情"),
            current: true,
          },
        ]}
        description="独立应用详情页，承载基础信息、回调地址、OAuth 凭证、接入提示词、权限资产查看和状态操作。"
        primaryAction={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigate(returnTo);
            }}
          >
            <ArrowLeft aria-hidden="true" size={16} />
            返回应用列表
          </Button>
        }
        title="应用详情"
      />
      <section className="flex flex-1 flex-col gap-4 p-6">
        {state.status === "loading" ? (
          <PageState type="loading" title="正在读取应用详情" />
        ) : null}
        {state.status === "failed" ? (
          <PageState
            description={
              state.forbidden ? "当前管理员无权查看该应用。" : state.message
            }
            type={state.forbidden ? "forbidden" : "error"}
            title="无法打开应用详情"
          />
        ) : null}
        {state.status === "loaded" ? (
          <ApplicationDetailSheet
            activeTab={activeTab}
            application={state.application}
            open
            onApplicationChanged={handleApplicationChanged}
            onActiveTabChange={handleTabChange}
            onOpenChange={() => {
              void navigate(returnTo);
            }}
            onOpenRecords={props.onOpenRecords}
            onRequestStatusChange={(action, application) => {
              setStatusError(undefined);
              setStatusConfirmation({ action, application });
            }}
            presentation="page"
            statusError={statusError}
            statusPending={statusPending}
          />
        ) : null}
      </section>
      {statusConfirmCopy ? (
        <ConfirmDialog
          danger={statusConfirmation?.action === "disable"}
          description={statusConfirmCopy.description}
          onConfirm={() => void handleStatusConfirm()}
          onOpenChange={(open) => {
            if (!open && !statusPending) {
              setStatusConfirmation(null);
            }
          }}
          open
          pending={statusPending}
          title={statusConfirmCopy.title}
        />
      ) : null}
    </main>
  );
}

const statusActionCopy: Record<
  StatusAction,
  { title: string; description: string }
> = {
  enable: {
    title: "确认启用应用",
    description:
      "启用后该应用可以继续用于接入、授权和凭证校验，该操作会写入审计日志。",
  },
  disable: {
    title: "确认停用应用",
    description:
      "停用后该应用的授权、换取 token、userinfo、权限查询和 developer API 都会被阻断；配置、凭证摘要和角色元数据保留可读。该操作会写入审计日志。",
  },
};

function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 403
  );
}
