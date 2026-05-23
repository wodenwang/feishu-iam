import { Pool } from 'pg';

export type DbPool = Pool;

export function createPool(databaseUrl: string): DbPool {
  return new Pool({ connectionString: databaseUrl });
}
