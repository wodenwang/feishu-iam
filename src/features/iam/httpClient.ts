import { getIamApiBaseUrl } from './apiMode';
import type { IamHttpError } from './types';

interface HttpRequestOptions {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

interface ErrorPayload {
  requestId?: string;
  code?: string;
  message?: string;
  details?: unknown;
}

export async function httpRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = await readJson(response);
    if (!response.ok) {
      throw createIamHttpError(response.status, payload);
    }

    return payload as T;
  } catch (error) {
    if (isIamHttpError(error)) {
      throw error;
    }
    throw createIamHttpError(0, {
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : '网络请求失败',
    });
  }
}

export function isIamHttpError(error: unknown): error is IamHttpError {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'IamHttpError';
}

function buildUrl(path: string, query?: HttpRequestOptions['query']) {
  const baseUrl = getIamApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { code: 'INVALID_JSON_RESPONSE', message: text };
  }
}

function createIamHttpError(status: number, payload: unknown): IamHttpError {
  const errorPayload = normalizeErrorPayload(payload);
  const error = new Error(errorPayload.message) as IamHttpError;
  error.name = 'IamHttpError';
  error.status = status;
  error.code = errorPayload.code ?? fallbackCode(status);
  error.requestId = errorPayload.requestId;
  error.details = errorPayload.details;
  error.fieldErrors = extractFieldErrors(errorPayload.details);
  return error;
}

function normalizeErrorPayload(payload: unknown): ErrorPayload {
  if (typeof payload !== 'object' || payload === null) {
    return { message: '服务暂时不可用' };
  }
  const record = payload as Record<string, unknown>;
  return {
    requestId: typeof record.requestId === 'string' ? record.requestId : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : '服务暂时不可用',
    details: record.details,
  };
}

function fallbackCode(status: number) {
  if (status === 0) {
    return 'NETWORK_ERROR';
  }
  return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR';
}

function extractFieldErrors(details: unknown): Record<string, string> | undefined {
  if (typeof details !== 'object' || details === null || !('fieldErrors' in details)) {
    return undefined;
  }
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (typeof fieldErrors !== 'object' || fieldErrors === null) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(fieldErrors as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}
