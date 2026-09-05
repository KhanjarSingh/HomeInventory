import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Setup connection with postgres client
export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: 'require',
  onnotice: (notice) => logger.debug({ notice }, 'Postgres notice'),
});

export const db = drizzle(sql);

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 as connected`;
    return Boolean(result && result[0]?.connected === 1);
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}
