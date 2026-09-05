import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { householdsRouter } from './modules/households/households.routes';
import { locationsRouter } from './modules/locations/locations.routes';
import {
  placementsRouter,
  containersRouter,
  itemLocationsRouter,
} from './modules/placements/placements.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { itemsRouter } from './modules/items/items.routes';
import { AppError } from './utils/errors';

export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: [env.CORS_ORIGIN, env.WEB_URL],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    })
  );

  // Request correlation
  app.use(requestIdMiddleware);

  // Body and cookie parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // Health check routes
  app.use('/health', healthRouter);
  app.use('/api/v1/health', healthRouter);

  // Core domain routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/households', householdsRouter);
  app.use('/api/v1/locations', locationsRouter);
  app.use('/api/v1/placements', placementsRouter);
  app.use('/api/v1/containers', containersRouter);
  app.use('/api/v1/uploads', uploadsRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/items', itemLocationsRouter);
  app.use('/api/v1/items', itemsRouter);

  // Catch-all 404 handler
  app.use((req, _res, next) => {
    next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
