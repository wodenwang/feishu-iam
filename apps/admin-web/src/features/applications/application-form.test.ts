import { describe, expect, it } from 'vitest';
import { validateApplicationCreateInput } from './application-form';

describe('application form validation', () => {
  it('requires app key, name and redirect uri', () => {
    expect(validateApplicationCreateInput({ appKey: '', name: '', redirectUri: '' })).toEqual({
      appKey: '应用 key 不能为空',
      name: '应用名称不能为空',
      redirectUri: 'Redirect URI 不能为空'
    });
  });

  it('rejects non-url redirect uri', () => {
    expect(validateApplicationCreateInput({ appKey: 'crm', name: 'CRM', redirectUri: '/callback' }).redirectUri).toBe(
      'Redirect URI 必须是完整 URL'
    );
  });
});
