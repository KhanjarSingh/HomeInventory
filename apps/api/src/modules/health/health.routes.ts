import { Router } from 'express';
import { checkDatabaseConnection } from '../../config/db.js';
import { env } from '../../config/env.js';
import type { HealthCheckDto, ApiSuccessResponse } from '@home-inventory/shared';

export const healthRouter: Router = Router();

const startTime = Date.now();

healthRouter.get('/', async (req, res, next) => {
  try {
    const isDbConnected = await checkDatabaseConnection();
    const isCloudinaryConfigured = Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
    );

    const isHealthy = isDbConnected;
    const status = isHealthy ? 'ok' : 'degraded';

    const data: HealthCheckDto = {
      status,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      services: {
        database: isDbConnected ? 'connected' : 'disconnected',
        cloudinary: isCloudinaryConfigured ? 'configured' : 'unconfigured',
      },
    };

    const response: ApiSuccessResponse<HealthCheckDto> = {
      data,
      meta: {
        requestId: req.id,
      },
    };

    res.status(isHealthy ? 200 : 503).json(response);
  } catch (error) {
    next(error);
  }
});
