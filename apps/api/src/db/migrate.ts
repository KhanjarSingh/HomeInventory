import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, sql } from '../config/db';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  logger.info('⏳ Applying database migrations...');
  const migrationsFolder = path.resolve(__dirname, './migrations');

  try {
    await migrate(db, { migrationsFolder });
    logger.info('✅ Database migrations applied successfully.');
  } catch (error) {
    logger.error({ error }, '❌ Database migration failed');
    throw error;
  }
}

// Run directly if invoked from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await sql.end({ timeout: 5 });
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await sql.end({ timeout: 5 });
      process.exit(1);
    });
}
