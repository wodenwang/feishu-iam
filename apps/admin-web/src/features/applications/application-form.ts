export type ApplicationCreateDraft = {
  appKey: string;
  name: string;
  description?: string;
  redirectUri: string;
};

export type ApplicationCreateErrors = Partial<Record<keyof ApplicationCreateDraft, string>>;

export function validateApplicationCreateInput(input: ApplicationCreateDraft): ApplicationCreateErrors {
  const errors: ApplicationCreateErrors = {};
  if (!input.appKey.trim()) {
    errors.appKey = '应用 key 不能为空';
  }
  if (!input.name.trim()) {
    errors.name = '应用名称不能为空';
  }
  if (!input.redirectUri.trim()) {
    errors.redirectUri = 'Redirect URI 不能为空';
  } else {
    try {
      new URL(input.redirectUri);
    } catch {
      errors.redirectUri = 'Redirect URI 必须是完整 URL';
    }
  }
  return errors;
}
