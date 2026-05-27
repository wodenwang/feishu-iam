export type FeishuAuthMode = 'mock' | 'real';

export interface ServerConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  sessionCookieName: string;
  sessionSecret: string;
  feishuAuthMode: FeishuAuthMode;
  feishuAppId?: string;
  feishuAppSecret?: string;
  feishuRedirectUri?: string;
  staticAssetsDir?: string;
  syncScheduleEnabled: boolean;
  syncScheduleIntervalMinutes: number;
  syncScheduleStartDelaySeconds: number;
  syncStaleAfterHours: number;
  feishuEventVerificationToken?: string;
  feishuEventEncryptKey?: string;
}

export function parseEnv(env: NodeJS.ProcessEnv): ServerConfig {
  const nodeEnv = normalizeNodeEnv(env.NODE_ENV);
  const databaseUrl = requireValue(env.DATABASE_URL, 'DATABASE_URL');
  const sessionSecret = requireValue(env.SESSION_SECRET, 'SESSION_SECRET');
  const feishuAuthMode = normalizeFeishuAuthMode(env.FEISHU_AUTH_MODE);

  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }

  if (nodeEnv === 'production' && feishuAuthMode === 'mock') {
    throw new Error('FEISHU_AUTH_MODE=mock is not allowed in production');
  }

  const feishuAppId = env.FEISHU_APP_ID;
  const feishuAppSecret = env.FEISHU_APP_SECRET;
  const feishuRedirectUri = env.FEISHU_REDIRECT_URI;

  if (feishuAuthMode === 'real') {
    if (!feishuAppId) {
      throw new Error('FEISHU_APP_ID is required when FEISHU_AUTH_MODE=real');
    }
    if (!feishuAppSecret) {
      throw new Error('FEISHU_APP_SECRET is required when FEISHU_AUTH_MODE=real');
    }
    if (!feishuRedirectUri) {
      throw new Error('FEISHU_REDIRECT_URI is required when FEISHU_AUTH_MODE=real');
    }
  }

  return {
    nodeEnv,
    port: parsePort(env.PORT),
    databaseUrl,
    sessionCookieName: env.SESSION_COOKIE_NAME ?? 'iam_session',
    sessionSecret,
    feishuAuthMode,
    feishuAppId,
    feishuAppSecret,
    feishuRedirectUri,
    staticAssetsDir: env.STATIC_ASSETS_DIR ?? (nodeEnv === 'production' ? 'dist' : undefined),
    syncScheduleEnabled: parseBoolean(env.FEISHU_SYNC_SCHEDULE_ENABLED),
    syncScheduleIntervalMinutes: parsePositiveInteger(env.FEISHU_SYNC_SCHEDULE_INTERVAL_MINUTES, 1440, 'FEISHU_SYNC_SCHEDULE_INTERVAL_MINUTES'),
    syncScheduleStartDelaySeconds: parseNonNegativeInteger(
      env.FEISHU_SYNC_SCHEDULE_START_DELAY_SECONDS,
      60,
      'FEISHU_SYNC_SCHEDULE_START_DELAY_SECONDS',
    ),
    syncStaleAfterHours: parsePositiveInteger(env.FEISHU_SYNC_STALE_AFTER_HOURS, 24, 'FEISHU_SYNC_STALE_AFTER_HOURS'),
    feishuEventVerificationToken: env.FEISHU_EVENT_VERIFICATION_TOKEN,
    feishuEventEncryptKey: env.FEISHU_EVENT_ENCRYPT_KEY,
  };
}

function requireValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeNodeEnv(value: string | undefined): ServerConfig['nodeEnv'] {
  if (value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

function normalizeFeishuAuthMode(value: string | undefined): FeishuAuthMode {
  if (!value) {
    return 'mock';
  }
  if (value === 'real') {
    return 'real';
  }
  if (value === 'mock') {
    return 'mock';
  }
  throw new Error('FEISHU_AUTH_MODE must be mock or real');
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return 4100;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number, name: string): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}
