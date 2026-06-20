import {
  Copy,
  Edit2,
  Eye,
  KeyRound,
  Power,
  PowerOff,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { Application, IamRole } from "../../api/permission";
import {
  createIamRole,
  disableIamRole,
  enableIamRole,
  fetchIamRoles,
  updateApplication,
  updateIamRole,
} from "../../api/permission";
import type {
  ApplicationClientSecretResult,
  ApplicationDeveloperCredential,
  ApplicationOauthCredential,
  ApplicationRedirectUri,
} from "../../api/oauth";
import {
  createApplicationRedirectUri,
  disableApplicationRedirectUri,
  fetchApplicationDeveloperCredential,
  fetchApplicationOauthCredential,
  fetchApplicationRedirectUris,
  refreshApplicationIntegrationPrompt,
  rotateApplicationClientSecret,
  viewApplicationClientSecret,
} from "../../api/oauth";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { CopyField } from "../../components/admin/CopyField";
import { DetailSheet } from "../../components/admin/DetailSheet";
import type { DetailSheetProps } from "../../components/admin/DetailSheet";
import { ResponsiveTabsList } from "../../components/admin/ResponsiveTabsList";
import { SecretRevealPanel } from "../../components/admin/SecretRevealPanel";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";

export const applicationDetailTabs = [
  "details",
  "roles",
  "development",
  "danger",
] as const;

export type ApplicationDetailTab = (typeof applicationDetailTabs)[number];
export type OpenApplicationRecordsOptions = {
  tab?: "trace" | "audit";
  clientId?: string;
};

export function isApplicationDetailTab(
  value: string | null,
): value is ApplicationDetailTab {
  return applicationDetailTabs.some((item) => item === value);
}

export type ApplicationDetailSheetProps = {
  application: Application | undefined;
  open: boolean;
  activeTab?: ApplicationDetailTab;
  onActiveTabChange?: (tab: ApplicationDetailTab) => void;
  onOpenChange: (open: boolean) => void;
  onApplicationChanged: (application: Application) => void;
  onRequestStatusChange: (
    action: StatusAction,
    application: Application,
  ) => void;
  statusPending?: boolean;
  statusError?: string;
  onOpenRecords: (applicationId: string, options?: OpenApplicationRecordsOptions) => void;
  presentation?: DetailSheetProps["presentation"];
};

type DetailState =
  | { status: "idle" | "loading" }
  | {
      status: "loaded";
      redirectUris: ApplicationRedirectUri[];
      oauthCredential: ApplicationOauthCredential | null;
      developerCredential: ApplicationDeveloperCredential | null;
    }
  | { status: "failed"; message: string; forbidden: boolean };

type RoleState =
  | { status: "idle" | "loading" }
  | { status: "loaded"; roles: IamRole[] }
  | { status: "failed"; message: string; forbidden: boolean };

type BasicDraft = {
  name: string;
  description: string;
};

type RoleFormState =
  | { mode: "create"; key: string; name: string; description: string }
  | { mode: "edit"; role: IamRole; name: string; description: string };

type RoleStatusConfirmation = {
  action: StatusAction;
  role: IamRole;
};

type SecretAction = "view" | "rotate";
type SecretResult = ApplicationClientSecretResult & { action: SecretAction };
type PromptRefreshResult = {
  clientId: string;
  developerCredentialId: string;
  integrationPrompt: string;
};
export type StatusAction = "enable" | "disable";

export function ApplicationDetailSheet({
  activeTab,
  application,
  open,
  onActiveTabChange,
  onOpenChange,
  onApplicationChanged,
  onRequestStatusChange,
  statusPending = false,
  statusError,
  onOpenRecords,
  presentation,
}: ApplicationDetailSheetProps) {
  const [state, setState] = useState<DetailState>({ status: "idle" });
  const [roleState, setRoleState] = useState<RoleState>({ status: "idle" });
  const [editBasic, setEditBasic] = useState(false);
  const [basicDraft, setBasicDraft] = useState<BasicDraft>({
    name: "",
    description: "",
  });
  const [basicPending, setBasicPending] = useState(false);
  const [basicError, setBasicError] = useState<string>();
  const [redirectDraft, setRedirectDraft] = useState("");
  const [redirectPending, setRedirectPending] = useState(false);
  const [redirectError, setRedirectError] = useState<string>();
  const [redirectDisableTarget, setRedirectDisableTarget] =
    useState<ApplicationRedirectUri | null>(null);
  const [promptCopyState, setPromptCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [promptRefreshOpen, setPromptRefreshOpen] = useState(false);
  const [promptPending, setPromptPending] = useState(false);
  const [promptError, setPromptError] = useState<string>();
  const [promptResult, setPromptResult] = useState<PromptRefreshResult | null>(
    null,
  );
  const [roleForm, setRoleForm] = useState<RoleFormState | null>(null);
  const [rolePending, setRolePending] = useState(false);
  const [roleError, setRoleError] = useState<string>();
  const [roleStatusConfirmation, setRoleStatusConfirmation] =
    useState<RoleStatusConfirmation | null>(null);
  const [secretAction, setSecretAction] = useState<SecretAction | null>(null);
  const [secretPending, setSecretPending] = useState(false);
  const [secretError, setSecretError] = useState<string>();
  const [secretResult, setSecretResult] = useState<SecretResult | null>(null);
  const [localActiveTab, setLocalActiveTab] =
    useState<ApplicationDetailTab>("details");
  const latestRequestRef = useRef(0);
  const resolvedActiveTab = activeTab ?? localActiveTab;

  function setResolvedActiveTab(value: string) {
    if (!isApplicationDetailTab(value)) {
      return;
    }
    if (onActiveTabChange) {
      onActiveTabChange(value);
      return;
    }
    setLocalActiveTab(value);
  }

  useEffect(() => {
    if (!open || !application) {
      resetTransientState();
      return;
    }

    setBasicDraft(readBasicDraft(application));
    setEditBasic(false);
    setBasicError(undefined);
    setRedirectDraft("");
    setRedirectError(undefined);
    setRoleForm(null);
    setRoleError(undefined);
    setPromptCopyState("idle");
    setPromptRefreshOpen(false);
    setPromptPending(false);
    setPromptError(undefined);
    setPromptResult(null);
    setLocalActiveTab("details");

    const requestSeq = latestRequestRef.current + 1;
    latestRequestRef.current = requestSeq;
    setState({ status: "loading" });
    setRoleState({ status: "loading" });
    setSecretAction(null);
    setSecretPending(false);
    setSecretError(undefined);
    setSecretResult(null);

    void loadConnectionSummary(application.appKey, requestSeq);
    void loadRoles(application.appKey, requestSeq);
  }, [application, open]);

  function resetTransientState() {
    setState({ status: "idle" });
    setRoleState({ status: "idle" });
    setEditBasic(false);
    setBasicPending(false);
    setBasicError(undefined);
    setRedirectDraft("");
    setRedirectPending(false);
    setRedirectError(undefined);
    setRedirectDisableTarget(null);
    setPromptCopyState("idle");
    setPromptRefreshOpen(false);
    setPromptPending(false);
    setPromptError(undefined);
    setPromptResult(null);
    setRoleForm(null);
    setRolePending(false);
    setRoleError(undefined);
    setRoleStatusConfirmation(null);
    setSecretAction(null);
    setSecretPending(false);
    setSecretError(undefined);
    setSecretResult(null);
  }

  async function loadConnectionSummary(appKey: string, requestSeq: number) {
    try {
      const [
        redirectUris,
        oauthCredential,
        developerCredential,
      ] = await Promise.all([
        fetchApplicationRedirectUris(appKey),
        fetchApplicationOauthCredential(appKey),
        fetchApplicationDeveloperCredential(appKey),
      ]);
      if (latestRequestRef.current !== requestSeq) {
        return;
      }
      setState({
        status: "loaded",
        redirectUris,
        oauthCredential,
        developerCredential,
      });
    } catch (error: unknown) {
      if (latestRequestRef.current !== requestSeq) {
        return;
      }
      setState({
        status: "failed",
        message: errorMessage(error, "无法读取应用接入摘要"),
        forbidden: isForbiddenError(error),
      });
    }
  }

  async function loadRoles(
    appKey: string,
    requestSeq = latestRequestRef.current,
  ) {
    try {
      const roles = await fetchIamRoles(appKey);
      if (latestRequestRef.current !== requestSeq) {
        return;
      }
      setRoleState({ status: "loaded", roles });
    } catch (error: unknown) {
      if (latestRequestRef.current !== requestSeq) {
        return;
      }
      setRoleState({
        status: "failed",
        message: errorMessage(error, "无法读取应用角色"),
        forbidden: isForbiddenError(error),
      });
    }
  }

  async function handleBasicSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) {
      return;
    }
    setBasicPending(true);
    setBasicError(undefined);
    try {
      const updated = await updateApplication(application.appKey, {
        name: basicDraft.name.trim(),
        description: nullableTrim(basicDraft.description),
      });
      onApplicationChanged(updated);
      setEditBasic(false);
    } catch (error: unknown) {
      setBasicError(errorMessage(error, "无法保存应用基础信息"));
    } finally {
      setBasicPending(false);
    }
  }

  async function handleCreateRedirectUri(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!application || state.status !== "loaded") {
      return;
    }
    setRedirectPending(true);
    setRedirectError(undefined);
    try {
      const created = await createApplicationRedirectUri(application.appKey, {
        redirectUri: redirectDraft.trim(),
      });
      setState({
        ...state,
        redirectUris: [...state.redirectUris, created],
      });
      setRedirectDraft("");
    } catch (error: unknown) {
      setRedirectError(errorMessage(error, "无法新增回调地址"));
    } finally {
      setRedirectPending(false);
    }
  }

  async function handleDisableRedirectUri() {
    if (!application || state.status !== "loaded" || !redirectDisableTarget) {
      return;
    }
    setRedirectPending(true);
    setRedirectError(undefined);
    try {
      const updated = await disableApplicationRedirectUri(
        application.appKey,
        redirectDisableTarget.id,
      );
      setState({
        ...state,
        redirectUris: state.redirectUris.map((redirectUri) =>
          redirectUri.id === updated.id ? updated : redirectUri,
        ),
      });
      setRedirectDisableTarget(null);
    } catch (error: unknown) {
      setRedirectError(errorMessage(error, "无法停用回调地址"));
    } finally {
      setRedirectPending(false);
    }
  }

  async function handleCopyPrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopyState("copied");
    } catch {
      setPromptCopyState("failed");
    }
  }

  async function handleRefreshIntegrationPrompt() {
    if (!application) {
      return;
    }
    setPromptPending(true);
    setPromptError(undefined);
    setPromptCopyState("idle");
    try {
      const result = await refreshApplicationIntegrationPrompt(application.appKey);
      setPromptResult(result);
      setPromptRefreshOpen(false);
      if (state.status === "loaded") {
        setState({
          ...state,
          oauthCredential: state.oauthCredential
            ? {
                ...state.oauthCredential,
                clientId: result.clientId,
              }
            : state.oauthCredential,
          developerCredential: state.developerCredential
            ? {
                ...state.developerCredential,
                id: result.developerCredentialId,
                status: "active",
                rotatedAt: new Date().toISOString(),
              }
            : state.developerCredential,
        });
      }
    } catch (error: unknown) {
      setPromptError(errorMessage(error, "无法生成完整接入提示词"));
    } finally {
      setPromptPending(false);
    }
  }

  async function handleSecretAction(action: SecretAction) {
    if (!application || state.status !== "loaded" || !state.oauthCredential) {
      return;
    }

    const requestSeq = latestRequestRef.current;
    const clientReference = state.oauthCredential.clientId;
    setSecretPending(true);
    setSecretError(undefined);
    try {
      const result =
        action === "view"
          ? await viewApplicationClientSecret(
              application.appKey,
              clientReference,
            )
          : await rotateApplicationClientSecret(
              application.appKey,
              clientReference,
            );
      if (latestRequestRef.current !== requestSeq) {
        return;
      }
      setSecretResult({ ...result, action });
      setSecretAction(null);
    } catch (error: unknown) {
      if (latestRequestRef.current === requestSeq) {
        setSecretError(errorMessage(error, "OAuth secret 操作失败"));
      }
    } finally {
      if (latestRequestRef.current === requestSeq) {
        setSecretPending(false);
      }
    }
  }

  async function handleRoleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application || !roleForm || roleState.status !== "loaded") {
      return;
    }
    setRolePending(true);
    setRoleError(undefined);
    try {
      const saved =
        roleForm.mode === "create"
          ? await createIamRole(application.appKey, {
              key: roleForm.key.trim(),
              name: roleForm.name.trim(),
              description: nullableTrim(roleForm.description) ?? undefined,
            })
          : await updateIamRole(application.appKey, roleForm.role.id, {
              name: roleForm.name.trim(),
              description: nullableTrim(roleForm.description),
            });
      setRoleState({
        status: "loaded",
        roles:
          roleForm.mode === "create"
            ? [...roleState.roles, saved]
            : roleState.roles.map((role) =>
                role.id === saved.id ? saved : role,
              ),
      });
      setRoleForm(null);
    } catch (error: unknown) {
      setRoleError(errorMessage(error, "无法保存应用角色"));
    } finally {
      setRolePending(false);
    }
  }

  async function handleRoleStatusConfirm() {
    if (
      !application ||
      !roleStatusConfirmation ||
      roleState.status !== "loaded"
    ) {
      return;
    }
    setRolePending(true);
    setRoleError(undefined);
    try {
      const updated =
        roleStatusConfirmation.action === "enable"
          ? await enableIamRole(
              application.appKey,
              roleStatusConfirmation.role.id,
            )
          : await disableIamRole(
              application.appKey,
              roleStatusConfirmation.role.id,
            );
      setRoleState({
        status: "loaded",
        roles: roleState.roles.map((role) =>
          role.id === updated.id ? updated : role,
        ),
      });
      setRoleStatusConfirmation(null);
    } catch (error: unknown) {
      setRoleError(errorMessage(error, "无法更新角色状态"));
    } finally {
      setRolePending(false);
    }
  }

  const oauthCredential =
    state.status === "loaded" ? state.oauthCredential : null;
  const confirmCopy = secretAction ? secretActionCopy[secretAction] : null;
  const readonly = application?.status === "disabled";

  return (
    <DetailSheet
      description={
        application ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{application.name}</span>
            <StatusBadge
              tone={application.status === "active" ? "success" : "muted"}
            >
              {formatEntityStatus(application.status)}
            </StatusBadge>
          </span>
        ) : undefined
      }
      defaultSize="normal"
      onOpenChange={onOpenChange}
      open={open}
      presentation={presentation}
      sizeStorageKey="feishu-iam:applications-detail-sheet-size"
      title="应用详情"
    >
      {application ? (
        <div className="pt-4">
          <Tabs className="min-w-0" value={resolvedActiveTab} onValueChange={setResolvedActiveTab}>
            <ResponsiveTabsList aria-label="应用详情标签">
              <TabsTrigger value="details">详细资料</TabsTrigger>
              <TabsTrigger value="roles">角色管理</TabsTrigger>
              <TabsTrigger value="development">开发信息</TabsTrigger>
              <TabsTrigger value="danger">危险操作</TabsTrigger>
            </ResponsiveTabsList>

            <TabsContent value="details" className="mt-4 min-w-0">
              <Section title="详细资料">
                {readonly ? (
                  <Notice>
                    应用已停用：接入、授权、凭证校验、userinfo、权限查询和
                    developer API 将被阻断；配置、凭证摘要和角色元数据保留可读。
                  </Notice>
                ) : null}
                {editBasic ? (
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => void handleBasicSubmit(event)}
                  >
                    <Field label="应用名称">
                      <Input
                        aria-label="应用名称"
                        value={basicDraft.name}
                        onChange={(event) => {
                          setBasicDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }));
                        }}
                      />
                    </Field>
                    <Field label="描述">
                      <Textarea
                        aria-label="应用描述"
                        value={basicDraft.description}
                        onChange={(event) => {
                          setBasicDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          }));
                        }}
                      />
                    </Field>
                    {basicError ? (
                      <ErrorMessage>{basicError}</ErrorMessage>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={basicPending} type="submit">
                        保存基础信息
                      </Button>
                      <Button
                        disabled={basicPending}
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setBasicDraft(readBasicDraft(application));
                          setEditBasic(false);
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <InfoGrid
                      items={[
                        ["应用名称", application.name],
                        ["状态", formatEntityStatus(application.status)],
                        ["负责人", formatOwnerUserId(application.ownerUserId)],
                        ["描述", application.description ?? "暂无描述"],
                        ["创建时间", formatDateTime(application.createdAt)],
                        ["更新时间", formatDateTime(application.updatedAt)],
                      ]}
                    />
                    <CopyField label="app_key" value={application.appKey} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={basicPending}
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditBasic(true);
                        }}
                      >
                        <Edit2 aria-hidden="true" size={16} />
                        编辑基础信息
                      </Button>
                    </div>
                  </>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="roles" className="mt-4 min-w-0">
              <Section title="角色管理">
                <RoleSection
                  application={application}
                  readonly={readonly}
                  roleError={roleError}
                  roleForm={roleForm}
                  rolePending={rolePending}
                  roleState={roleState}
                  setRoleForm={setRoleForm}
                  setRoleStatusConfirmation={setRoleStatusConfirmation}
                  onRoleSubmit={(event) => void handleRoleSubmit(event)}
                />
              </Section>
            </TabsContent>

            <TabsContent value="development" className="mt-4 min-w-0">
              <div className="grid gap-5">
                {state.status === "loading" ? (
                  <p className="text-sm text-muted-foreground">
                    正在读取应用接入摘要
                  </p>
                ) : null}
                {state.status === "failed" ? (
                  <div
                    className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                    role={state.forbidden ? "status" : "alert"}
                  >
                    {state.forbidden
                      ? "当前管理员无权查看应用接入摘要。"
                      : state.message}
                  </div>
                ) : null}

                {state.status === "loaded" ? (
                  <>
                    <Section title="回调地址">
                      <form
                        className="grid gap-3"
                        onSubmit={(event) =>
                          void handleCreateRedirectUri(event)
                        }
                      >
                        <Field label="新增 Redirect URI">
                          <div
                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                            data-ui="redirect-uri-action-group"
                          >
                            <Input
                              aria-label="新增 Redirect URI"
                              className="min-w-0 flex-1"
                              placeholder="https://example.com/auth/callback"
                              value={redirectDraft}
                              onChange={(event) => {
                                setRedirectDraft(event.target.value);
                              }}
                            />
                            <Button
                              className="shrink-0 whitespace-nowrap"
                              disabled={
                                redirectPending || !redirectDraft.trim()
                              }
                              type="submit"
                            >
                              <Plus aria-hidden="true" size={16} />
                              新增回调地址
                            </Button>
                          </div>
                        </Field>
                        {redirectError ? (
                          <ErrorMessage>{redirectError}</ErrorMessage>
                        ) : null}
                      </form>
                      {state.redirectUris.length > 0 ? (
                        <div className="grid gap-3">
                          <p className="text-sm text-muted-foreground">
                            共 {state.redirectUris.length} 个精确回调地址，
                            {
                              state.redirectUris.filter(
                                (item) => item.status === "active",
                              ).length
                            }
                            个启用。
                          </p>
                          {state.redirectUris.map((redirectUri) => (
                            <div
                              className="grid gap-2 rounded-md border bg-muted/20 p-3"
                              key={redirectUri.id}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <StatusBadge
                                  tone={
                                    redirectUri.status === "active"
                                      ? "success"
                                      : "muted"
                                  }
                                >
                                  {formatEntityStatus(redirectUri.status)}
                                </StatusBadge>
                                <Button
                                  disabled={
                                    redirectPending ||
                                    redirectUri.status !== "active"
                                  }
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setRedirectDisableTarget(redirectUri);
                                  }}
                                >
                                  停用
                                </Button>
                              </div>
                              <CopyField
                                label="Redirect URI"
                                value={redirectUri.redirectUri}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          暂无 Redirect URI。新增后第三方应用才能完成授权回调。
                        </p>
                      )}
                    </Section>

                    <Section title="OAuth credential">
                      {state.oauthCredential ? (
                        <div className="grid gap-3">
                          <CopyField
                            label="client_id"
                            value={state.oauthCredential.clientId}
                          />
                          <InfoGrid
                            items={[
                              [
                                "状态",
                                formatEntityStatus(
                                  state.oauthCredential.status,
                                ),
                              ],
                              [
                                "最近使用",
                                formatDateTime(
                                  state.oauthCredential.lastUsedAt,
                                ),
                              ],
                            ]}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                onOpenRecords(application.id, {
                                  tab: "trace",
                                  clientId: state.oauthCredential?.clientId,
                                });
                              }}
                            >
                              <Search aria-hidden="true" size={16} />
                              查看接入追踪
                            </Button>
                            <Button
                              disabled={secretPending}
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setSecretAction("view");
                              }}
                            >
                              <Eye aria-hidden="true" size={16} />
                              查看凭证
                            </Button>
                            <Button
                              disabled={secretPending}
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setSecretAction("rotate");
                              }}
                            >
                              <RotateCw aria-hidden="true" size={16} />
                              轮换凭证
                            </Button>
                          </div>
                          {secretError ? (
                            <ErrorMessage>{secretError}</ErrorMessage>
                          ) : null}
                          {secretResult ? (
                            <SecretRevealPanel
                              label={
                                secretResult.action === "rotate"
                                  ? "OAuth 凭证已轮换"
                                  : "OAuth 凭证查看结果"
                              }
                              value={secretResult.clientSecret}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          暂无 OAuth credential。
                        </p>
                      )}
                    </Section>

                    <Section title="Developer credential">
                      {state.developerCredential ? (
                        <InfoGrid
                          items={[
                            ["credential id", state.developerCredential.id],
                            ["凭证名称", state.developerCredential.name],
                            [
                              "状态",
                              formatEntityStatus(
                                state.developerCredential.status,
                              ),
                            ],
                            [
                              "最近使用",
                              formatDateTime(
                                state.developerCredential.lastUsedAt,
                              ),
                            ],
                            [
                              "最近轮换",
                              formatDateTime(
                                state.developerCredential.rotatedAt,
                              ),
                            ],
                          ]}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          暂无 developer credential。
                        </p>
                      )}
                    </Section>

                    <Section title="接入提示词">
                      <div className="grid gap-3">
                        <Notice>
                          完整提示词会包含新的 client_secret 和
                          developer_api_token。生成前会轮换旧凭证，第三方项目必须同步更新后端
                          env 或密钥系统。
                        </Notice>
                        <IntegrationPreflight
                          developerCredential={state.developerCredential}
                          oauthCredential={state.oauthCredential}
                          redirectUris={state.redirectUris}
                        />
                        {promptError ? (
                          <ErrorMessage>{promptError}</ErrorMessage>
                        ) : null}
                        {promptResult ? (
                          <>
                            <Textarea
                              aria-label="Codex 完整接入提示词"
                              readOnly
                              value={promptResult.integrationPrompt}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  void handleCopyPrompt(
                                    promptResult.integrationPrompt,
                                  )
                                }
                              >
                                <Copy aria-hidden="true" size={16} />
                                复制完整提示词
                              </Button>
                              {promptCopyState === "copied" ? (
                                <span className="text-sm text-[hsl(var(--status-success))]">
                                  已复制
                                </span>
                              ) : null}
                              {promptCopyState === "failed" ? (
                                <span className="text-sm text-destructive">
                                  无法写入剪贴板
                                </span>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={
                              promptPending ||
                              !state.oauthCredential ||
                              state.redirectUris.filter(
                                (item) => item.status === "active",
                              ).length === 0
                            }
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setPromptError(undefined);
                              setPromptRefreshOpen(true);
                            }}
                          >
                            <RotateCw aria-hidden="true" size={16} />
                            刷新凭证并生成完整提示词
                          </Button>
                        </div>
                      </div>
                    </Section>
                  </>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="danger" className="mt-4 min-w-0">
              <Section title="危险操作">
                <Notice>
                  应用启停会影响授权、换取 token、userinfo、权限查询和 developer
                  API。操作会写入审计日志，配置和角色元数据会保留。
                </Notice>
                <InfoGrid
                  items={[
                    ["当前状态", formatEntityStatus(application.status)],
                    ["审计对象", application.appKey],
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled
                    title="角色授权工作区已在权限管理中承载"
                    type="button"
                    variant="outline"
                  >
                    <ShieldCheck aria-hidden="true" size={16} />
                    角色授权在权限管理
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onOpenRecords(application.id, { tab: "audit" });
                    }}
                  >
                    查看审计记录
                  </Button>
                  <Button
                    disabled={statusPending}
                    type="button"
                    variant={
                      application.status === "active"
                        ? "destructive"
                        : "outline"
                    }
                    onClick={() => {
                      onRequestStatusChange(
                        application.status === "active" ? "disable" : "enable",
                        application,
                      );
                    }}
                  >
                    {application.status === "active" ? "停用应用" : "启用应用"}
                  </Button>
                </div>
                {statusError ? (
                  <ErrorMessage>{statusError}</ErrorMessage>
                ) : null}
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div />
      )}

      {confirmCopy && oauthCredential ? (
        <ConfirmDialog
          danger={secretAction === "rotate"}
          description={confirmCopy.description}
          onConfirm={() => {
            if (secretAction) {
              void handleSecretAction(secretAction);
            }
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !secretPending) {
              setSecretAction(null);
            }
          }}
          open
          pending={secretPending}
          title={confirmCopy.title}
        />
      ) : null}

      {promptRefreshOpen ? (
        <ConfirmDialog
          danger
          description="确认后会轮换 OAuth client_secret 和 developer_api_token，旧凭证立即失效。完整提示词只在本次结果中展示，请复制后写入第三方项目后端 env 或密钥系统。"
          onConfirm={() => void handleRefreshIntegrationPrompt()}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !promptPending) {
              setPromptRefreshOpen(false);
            }
          }}
          open
          pending={promptPending}
          title="刷新凭证并生成完整提示词"
        />
      ) : null}

      {redirectDisableTarget ? (
        <ConfirmDialog
          danger
          description="停用后该回调地址不能再用于 OAuth 授权回调，配置会保留并写入审计日志。"
          onConfirm={() => void handleDisableRedirectUri()}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !redirectPending) {
              setRedirectDisableTarget(null);
            }
          }}
          open
          pending={redirectPending}
          title="确认停用回调地址"
        />
      ) : null}

      {roleStatusConfirmation ? (
        <ConfirmDialog
          danger={roleStatusConfirmation.action === "disable"}
          description={
            roleStatusConfirmation.action === "disable"
              ? "停用后该角色元数据保留，但后续授权绑定不应继续使用该角色。该操作会写入审计日志。"
              : "启用后该角色可继续作为后续授权绑定的角色元数据使用。该操作会写入审计日志。"
          }
          onConfirm={() => void handleRoleStatusConfirm()}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !rolePending) {
              setRoleStatusConfirmation(null);
            }
          }}
          open
          pending={rolePending}
          title={
            roleStatusConfirmation.action === "disable"
              ? "确认停用角色"
              : "确认启用角色"
          }
        />
      ) : null}
    </DetailSheet>
  );
}

function RoleSection(props: {
  application: Application;
  readonly: boolean;
  roleState: RoleState;
  roleForm: RoleFormState | null;
  rolePending: boolean;
  roleError?: string;
  setRoleForm: (value: RoleFormState | null) => void;
  setRoleStatusConfirmation: (value: RoleStatusConfirmation) => void;
  onRoleSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  const [rolePreview, setRolePreview] = useState<IamRole | null>(null);

  function updateRoleForm(
    patch: Partial<{ key: string; name: string; description: string }>,
  ) {
    const current = props.roleForm;
    if (!current) {
      return;
    }
    if (current.mode === "create") {
      props.setRoleForm({ ...current, ...patch });
      return;
    }
    props.setRoleForm({ ...current, ...patch });
  }

  if (props.roleState.status === "loading") {
    return <p className="text-sm text-muted-foreground">正在读取应用角色</p>;
  }
  if (props.roleState.status === "failed") {
    return (
      <div
        className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        role={props.roleState.forbidden ? "status" : "alert"}
      >
        {props.roleState.forbidden
          ? "当前管理员无权查看该应用角色。"
          : props.roleState.message}
      </div>
    );
  }
  if (props.roleState.status !== "loaded") {
    return null;
  }

  return (
    <div className="grid gap-3">
      {props.readonly ? (
        <Notice>
          应用已停用，角色元数据保持只读。启用应用后再新增或编辑角色。
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          仅维护角色 key、名称、描述和状态；授权绑定继续在权限管理中处理。
        </p>
        <Button
          disabled={props.readonly || props.rolePending}
          type="button"
          variant="outline"
          onClick={() => {
            props.setRoleForm({
              mode: "create",
              key: "",
              name: "",
              description: "",
            });
          }}
        >
          <Plus aria-hidden="true" size={16} />
          新增角色
        </Button>
      </div>

      {props.roleForm ? (
        <form
          className="grid gap-3 rounded-md border p-3"
          onSubmit={props.onRoleSubmit}
        >
          {props.roleForm.mode === "create" ? (
            <Field label="角色 key">
              <Input
                aria-label="角色 key"
                placeholder={`${props.application.appKey}.admin`}
                value={props.roleForm.key}
                onChange={(event) => {
                  updateRoleForm({ key: event.target.value });
                }}
              />
            </Field>
          ) : (
            <CopyField label="角色 key" value={props.roleForm.role.key} />
          )}
          <Field label="角色名称">
            <Input
              aria-label="角色名称"
              value={props.roleForm.name}
              onChange={(event) => {
                updateRoleForm({ name: event.target.value });
              }}
            />
          </Field>
          <Field label="角色描述">
            <Textarea
              aria-label="角色描述"
              value={props.roleForm.description}
              onChange={(event) => {
                updateRoleForm({ description: event.target.value });
              }}
            />
          </Field>
          {props.roleError ? (
            <ErrorMessage>{props.roleError}</ErrorMessage>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={props.rolePending} type="submit">
              {props.roleForm.mode === "create" ? "创建角色" : "保存角色"}
            </Button>
            <Button
              disabled={props.rolePending}
              type="button"
              variant="outline"
              onClick={() => {
                props.setRoleForm(null);
              }}
            >
              取消
            </Button>
          </div>
        </form>
      ) : null}

      {rolePreview ? (
        <div
          aria-label="角色关键信息"
          className="grid gap-3 rounded-md border bg-muted/20 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {rolePreview.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {rolePreview.description ?? "暂无描述"}
              </p>
            </div>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setRolePreview(null);
              }}
            >
              关闭
            </Button>
          </div>
          <InfoGrid
            items={[
              ["角色 key", rolePreview.key],
              ["状态", formatEntityStatus(rolePreview.status)],
              ["创建时间", formatDateTime(rolePreview.createdAt)],
              ["更新时间", formatDateTime(rolePreview.updatedAt)],
            ]}
          />
        </div>
      ) : null}

      {props.roleState.roles.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          暂无应用角色。先新增角色元数据，再进入权限管理完成授权绑定。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-background">
          <table
            aria-label="应用角色清单"
            className="w-full table-fixed text-sm"
          >
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="w-[180px] px-3 py-2 font-medium">
                  角色名称
                </th>
                <th className="w-[220px] px-3 py-2 font-medium">角色 key</th>
                <th className="w-[88px] px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">描述摘要</th>
                <th className="w-[150px] px-3 py-2 font-medium">创建时间</th>
                <th className="w-[150px] px-3 py-2 font-medium">更新时间</th>
                <th
                  className="px-3 py-2 text-right font-medium"
                  style={{ width: "132px", minWidth: "132px" }}
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {props.roleState.roles.map((role) => (
                <tr className="border-b last:border-b-0" key={role.id}>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {role.name}
                  </td>
                  <td className="px-3 py-2">
                    <code
                      className="block max-w-[200px] truncate rounded bg-muted px-2 py-1 text-xs"
                      title={role.key}
                    >
                      {role.key}
                    </code>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      tone={role.status === "active" ? "success" : "muted"}
                    >
                      {formatEntityStatus(role.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span
                      className="block max-w-[240px] truncate"
                      title={role.description ?? "暂无描述"}
                    >
                      {role.description ?? "暂无描述"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateTime(role.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateTime(role.updatedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        aria-label={`查看 ${role.key}`}
                        className="h-8 min-h-8 w-8 p-0"
                        size="sm"
                        title="查看"
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setRolePreview(role);
                        }}
                      >
                        <Eye aria-hidden="true" size={14} />
                      </Button>
                      <Button
                        aria-label={`编辑 ${role.key}`}
                        className="h-8 min-h-8 w-8 p-0"
                        disabled={props.readonly || props.rolePending}
                        size="sm"
                        title="编辑"
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setRolePreview(null);
                          props.setRoleForm({
                            mode: "edit",
                            role,
                            name: role.name,
                            description: role.description ?? "",
                          });
                        }}
                      >
                        <Edit2 aria-hidden="true" size={14} />
                      </Button>
                      <Button
                        aria-label={`${
                          role.status === "active" ? "停用" : "启用"
                        } ${role.key}`}
                        className="h-8 min-h-8 w-8 p-0"
                        disabled={props.readonly || props.rolePending}
                        size="sm"
                        title={role.status === "active" ? "停用" : "启用"}
                        type="button"
                        variant={
                          role.status === "active" ? "destructive" : "outline"
                        }
                        onClick={() => {
                          setRolePreview(null);
                          props.setRoleStatusConfirmation({
                            action:
                              role.status === "active" ? "disable" : "enable",
                            role,
                          });
                        }}
                      >
                        {role.status === "active" ? (
                          <PowerOff aria-hidden="true" size={14} />
                        ) : (
                          <Power aria-hidden="true" size={14} />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IntegrationPreflight(props: {
  redirectUris: ApplicationRedirectUri[];
  oauthCredential: ApplicationOauthCredential | null;
  developerCredential: ApplicationDeveloperCredential | null;
}) {
  const activeRedirectCount = props.redirectUris.filter(
    (item) => item.status === "active",
  ).length;
  const checks = [
    {
      label: "启用回调地址",
      ok: activeRedirectCount > 0,
      detail:
        activeRedirectCount > 0
          ? `${String(activeRedirectCount)} 个 Redirect URI 可用`
          : "至少需要 1 个启用的 Redirect URI",
    },
    {
      label: "OAuth 登录凭证",
      ok: props.oauthCredential?.status === "active",
      detail: props.oauthCredential
        ? `client_id: ${props.oauthCredential.clientId}`
        : "请先创建 OAuth 登录凭证",
    },
    {
      label: "Developer API 凭证",
      ok: props.developerCredential?.status === "active",
      detail: props.developerCredential
        ? `credential id: ${props.developerCredential.id}`
        : "生成完整提示词时会创建默认 developer API 凭证",
    },
    {
      label: "排障方式",
      ok: true,
      detail: "失败时只复制 request id，不复制 token、cookie 或整段问题信息",
    },
  ];

  return (
    <dl className="grid gap-2">
      {checks.map((check) => (
        <div
          className="grid gap-1 rounded-md border bg-muted/20 p-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start"
          key={check.label}
        >
          <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span
              aria-hidden="true"
              className={
                check.ok
                  ? "h-2 w-2 rounded-full bg-[hsl(var(--status-success))]"
                  : "h-2 w-2 rounded-full bg-[hsl(var(--status-warning))]"
              }
            />
            {check.label}
          </dt>
          <dd className="min-w-0 break-words text-sm text-muted-foreground">
            {check.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section(props: { children: ReactNode; title: string }) {
  return (
    <section
      className="grid gap-3 rounded-md border bg-background p-4"
      aria-label={props.title}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyRound aria-hidden="true" size={16} />
        {props.title}
      </h3>
      {props.children}
    </section>
  );
}

function Field(props: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

function Notice(props: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-[hsl(var(--status-warning))]/35 bg-[hsl(var(--status-warning))]/10 p-3 text-sm text-foreground">
      {props.children}
    </p>
  );
}

function ErrorMessage(props: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {props.children}
    </p>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div className="min-w-0 rounded-md border bg-muted/20 p-3" key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 break-all text-sm font-medium text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function readBasicDraft(application: Application): BasicDraft {
  return {
    name: application.name,
    description: application.description ?? "",
  };
}

function formatOwnerUserId(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? `飞书 user_id: ${trimmed}` : "未配置";
}

function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatEntityStatus(status: string): string {
  const labels: Record<string, string> = {
    active: "启用",
    disabled: "停用",
  };
  return labels[status] ?? status;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "尚未记录";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const requestIdValue =
    "requestId" in error
      ? (error as { requestId?: unknown }).requestId
      : undefined;
  const requestId = typeof requestIdValue === "string" ? requestIdValue : "";
  return requestId && !error.message.includes(requestId)
    ? `${error.message} / request id: ${requestId}`
    : error.message;
}

function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 403
  );
}

const secretActionCopy: Record<
  SecretAction,
  { title: string; description: string }
> = {
  view: {
    title: "确认查看 OAuth 凭证",
    description:
      "查看后会在当前页面临时展示明文凭证，请避免在共享屏幕或不可信环境操作。",
  },
  rotate: {
    title: "确认轮换 OAuth 凭证",
    description:
      "轮换后旧凭证将失效，第三方应用需要更新配置后才能继续完成授权换取。",
  },
};
