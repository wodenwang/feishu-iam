export type ApiStatus = {
  health: 'ok' | 'error';
  ready: 'ready' | 'not_ready' | 'error';
  version: string;
};

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${String(response.status)}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchApiStatus(): Promise<ApiStatus> {
  const [health, ready, version] = await Promise.all([
    readJson<{ status: 'ok' }>('/health'),
    readJson<{ status: 'ready' | 'not_ready' }>('/ready'),
    readJson<{ version: string }>('/version')
  ]);

  return {
    health: health.status,
    ready: ready.status,
    version: version.version
  };
}
