import { describe, expect, it, vi } from 'vitest';

describe('apiMode', () => {
  it('defaults to mock mode', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', undefined);
    vi.stubEnv('VITE_IAM_API_BASE_URL', undefined);
    vi.resetModules();

    const { getIamApiMode, getIamApiBaseUrl } = await import('./apiMode');

    expect(getIamApiMode()).toBe('mock');
    expect(getIamApiBaseUrl()).toBe('');
    vi.unstubAllEnvs();
  });

  it('reads http mode and trims trailing slashes from base URL', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', 'http');
    vi.stubEnv('VITE_IAM_API_BASE_URL', 'http://127.0.0.1:4100///');
    vi.resetModules();

    const { getIamApiMode, getIamApiBaseUrl } = await import('./apiMode');

    expect(getIamApiMode()).toBe('http');
    expect(getIamApiBaseUrl()).toBe('http://127.0.0.1:4100');
    vi.unstubAllEnvs();
  });

  it('throws for invalid mode', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', 'database');
    vi.resetModules();

    const { getIamApiMode } = await import('./apiMode');

    expect(() => getIamApiMode()).toThrow('VITE_IAM_API_MODE must be mock or http');
    vi.unstubAllEnvs();
  });
});
