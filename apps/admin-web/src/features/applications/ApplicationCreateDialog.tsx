import type { ReactNode, SyntheticEvent } from 'react';
import { useState } from 'react';
import { createApplication } from '../../api/permission';
import type { ApplicationOnboardingPackage } from '../../api/permission';
import { FormDialog } from '../../components/admin/FormDialog';
import { SecretRevealPanel } from '../../components/admin/SecretRevealPanel';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import type { ApplicationCreateDraft, ApplicationCreateErrors } from './application-form';
import { validateApplicationCreateInput } from './application-form';

export type ApplicationCreateDialogProps = {
  defaultOwnerUserId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (createdPackage: ApplicationOnboardingPackage) => void;
};

const emptyDraft: ApplicationCreateDraft = {
  appKey: '',
  name: '',
  description: '',
  redirectUri: ''
};

export function ApplicationCreateDialog({ defaultOwnerUserId, open, onOpenChange, onCreated }: ApplicationCreateDialogProps) {
  const [draft, setDraft] = useState<ApplicationCreateDraft>(emptyDraft);
  const [errors, setErrors] = useState<ApplicationCreateErrors>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [createdPackage, setCreatedPackage] = useState<ApplicationOnboardingPackage | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateApplicationCreateInput(draft);
    setErrors(validationErrors);
    setSubmitError(undefined);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setPending(true);
    try {
      const created = await createApplication({
        appKey: draft.appKey.trim(),
        name: draft.name.trim(),
        description: cleanOptional(draft.description),
        ownerUserId: cleanOptional(defaultOwnerUserId ?? undefined),
        redirectUris: [draft.redirectUri.trim()]
      });
      setCreatedPackage(created);
      onCreated(created);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : '无法创建应用接入包');
    } finally {
      setPending(false);
    }
  }

  function updateDraft(field: keyof ApplicationCreateDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function resetState() {
    setDraft(emptyDraft);
    setErrors({});
    setPending(false);
    setSubmitError(undefined);
    setCreatedPackage(null);
  }

  return (
    <FormDialog
      error={submitError}
      onOpenChange={handleOpenChange}
      open={open}
      pending={pending}
      title="新增应用接入包"
    >
      {createdPackage ? (
        <CreatedPackageResult createdPackage={createdPackage} onClose={() => { handleOpenChange(false); }} />
      ) : (
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <FormField error={errors.appKey} label="应用 key">
            <Input
              aria-label="应用 key"
              placeholder="crm"
              value={draft.appKey}
              onChange={(event) => { updateDraft('appKey', event.target.value); }}
            />
          </FormField>
          <FormField error={errors.name} label="应用名称">
            <Input
              aria-label="应用名称"
              placeholder="CRM 系统"
              value={draft.name}
              onChange={(event) => { updateDraft('name', event.target.value); }}
            />
          </FormField>
          <FormField label="描述">
            <Textarea
              aria-label="描述"
              placeholder="说明应用用途和接入边界"
              value={draft.description}
              onChange={(event) => { updateDraft('description', event.target.value); }}
            />
          </FormField>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            负责人默认使用当前登录管理员
            {defaultOwnerUserId ? <span className="block break-all text-foreground">飞书 user_id: {defaultOwnerUserId}</span> : null}
          </div>
          <FormField error={errors.redirectUri} label="Redirect URI">
            <Input
              aria-label="Redirect URI"
              placeholder="https://crm.example.com/callback"
              value={draft.redirectUri}
              onChange={(event) => { updateDraft('redirectUri', event.target.value); }}
            />
          </FormField>
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={pending} type="button" variant="outline" onClick={() => { handleOpenChange(false); }}>
              取消
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? '创建中' : '创建接入包'}
            </Button>
          </div>
        </form>
      )}
    </FormDialog>
  );
}

function CreatedPackageResult(props: { createdPackage: ApplicationOnboardingPackage; onClose: () => void }) {
  return (
    <section aria-label="应用接入包已创建" className="grid gap-4">
      <div className="grid gap-3 rounded-md border bg-muted/20 p-4">
        <h3 className="text-sm font-semibold text-foreground">{props.createdPackage.application.name}</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <InfoItem label="app_key" value={props.createdPackage.application.appKey} />
          <InfoItem label="client_id" value={props.createdPackage.oauthCredential.clientId} />
          <InfoItem label="开发者凭证" value={props.createdPackage.developerCredential.name} />
          <InfoItem label="Redirect URI" value={props.createdPackage.redirectUris[0]?.redirectUri ?? '-'} />
        </dl>
      </div>
      <SecretRevealPanel label="client_secret" value={props.createdPackage.clientSecret} />
      <SecretRevealPanel label="developer_api_token" value={props.createdPackage.developerApiToken} />
      <Textarea aria-label="Codex 接入提示词" readOnly value={props.createdPackage.integrationPrompt} />
      <div className="flex justify-end">
        <Button type="button" onClick={props.onClose}>
          我已保存，关闭
        </Button>
      </div>
    </section>
  );
}

function FormField(props: { children: ReactNode; error?: string; label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{props.label}</span>
      {props.children}
      {props.error ? <span className="text-sm font-normal text-destructive">{props.error}</span> : null}
    </label>
  );
}

function InfoItem(props: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="break-all font-medium text-foreground">{props.value}</dd>
    </div>
  );
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}
