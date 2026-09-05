import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { sql } from './config/db.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `🚀 Home Inventory API server running on http://localhost:${env.PORT}`
  );
  logger.info(`🔍 Health check available at http://localhost:${env.PORT}/health`);
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal. Closing server...');
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await sql.end({ timeout: 5 });
      logger.info('Database connections closed.');
    } catch (err) {
      logger.error({ err }, 'Error closing database connections');
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
