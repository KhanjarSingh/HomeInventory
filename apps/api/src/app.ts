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

  // Trust reverse proxy (Render, Cloudflare, AWS) for HTTPS cookies and accurate IPs
  app.set('trust proxy', 1);

  // Normalize duplicate /api/v1 prefixes defensively (e.g. /api/v1/api/v1/items -> /api/v1/items)
  app.use((req, _res, next) => {
    while (req.url.startsWith('/api/v1/api/v1')) {
      req.url = req.url.replace('/api/v1/api/v1', '/api/v1');
    }
    next();
  });

  // Security headers
  app.use(helmet());

  // CORS configuration supporting production domains, comma-separated lists, and Vercel preview domains
  const allowedOrigins = [
    env.CORS_ORIGIN,
    env.WEB_URL,
    ...env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    ...env.WEB_URL.split(',').map((s) => s.trim()),
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Allow Vercel preview and production deployments
        if (origin.endsWith('.vercel.app')) return callback(null, true);
        // If in development/test, allow localhost
        if (env.NODE_ENV !== 'production' && origin.includes('localhost')) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
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
