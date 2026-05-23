import { Pool } from 'pg';

export type DbPool = Pool;
export type DbClient = Pick<Pool, 'query'>;

export function createPool(databaseUrl: string): DbPool {
  return new Pool({ connectionString: databaseUrl });
}
