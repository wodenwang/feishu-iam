import type { ApiMode } from './types';

export function getIamApiMode(): ApiMode {
  const value = import.meta.env.VITE_IAM_API_MODE;

  if (!value) {
    return 'mock';
  }
  if (value === 'mock' || value === 'http') {
    return value;
  }
  throw new Error('VITE_IAM_API_MODE must be mock or http');
}

export function getIamApiBaseUrl(): string {
  const value = import.meta.env.VITE_IAM_API_BASE_URL ?? '';
  return value.replace(/\/+$/, '');
}

export function isHttpApiMode(): boolean {
  return getIamApiMode() === 'http';
}
