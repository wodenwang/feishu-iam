import crypto from 'node:crypto';
import type { DbPool } from '../../db/pool';
import { HttpError } from '../errors/httpError';
import type { DirectorySyncAdapter } from './directorySyncAdapter';
import { startDirectorySync } from './syncService';

export interface SyncSchedulerConfig {
  enabled: boolean;
  intervalMinutes: number;
  startDelaySeconds: number;
}

export type ScheduledSyncResult =
  | { status: 'disabled' }
  | { status: 'succeeded' | 'failed'; runId: string }
  | { status: 'skipped_running' };

export interface SyncScheduler {
  start(): void;
  stop(): void;
  runOnce(): Promise<ScheduledSyncResult>;
}

export async function runScheduledDirectorySync(pool: DbPool, adapter: DirectorySyncAdapter): Promise<ScheduledSyncResult> {
  try {
    const run = await startDirectorySync(pool, adapter, {
      actor: null,
      requestId: `scheduled_${crypto.randomUUID()}`,
      trigger: 'scheduled',
    });
    return { status: run.status === 'failed' ? 'failed' : 'succeeded', runId: run.id };
  } catch (error) {
    if (error instanceof HttpError && error.code === 'SYNC_ALREADY_RUNNING') {
      return { status: 'skipped_running' };
    }
    throw error;
  }
}

export function createSyncScheduler(pool: DbPool, adapter: DirectorySyncAdapter, config: SyncSchedulerConfig): SyncScheduler {
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;
  let running = false;

  const runOnce = async (): Promise<ScheduledSyncResult> => {
    if (!config.enabled) {
      return { status: 'disabled' };
    }
    if (running) {
      return { status: 'skipped_running' };
    }

    running = true;
    try {
      return await runScheduledDirectorySync(pool, adapter);
    } finally {
      running = false;
    }
  };

  return {
    start() {
      if (!config.enabled || startTimer || intervalTimer) {
        return;
      }

      const intervalMs = config.intervalMinutes * 60 * 1000;
      startTimer = setTimeout(() => {
        void runOnce().catch((error) => {
          console.error('Scheduled Feishu directory sync failed', error);
        });
        intervalTimer = setInterval(() => {
          void runOnce().catch((error) => {
            console.error('Scheduled Feishu directory sync failed', error);
          });
        }, intervalMs);
      }, config.startDelaySeconds * 1000);
    },
    stop() {
      if (startTimer) {
        clearTimeout(startTimer);
        startTimer = undefined;
      }
      if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = undefined;
      }
    },
    runOnce,
  };
}
