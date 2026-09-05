import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { ERROR_CODES, type ApiErrorResponse } from '@home-inventory/shared';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || 'unknown';
  const timestamp = new Date().toISOString();

  // Handle known AppError
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        requestId,
        timestamp,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));

    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid request input',
        details,
      },
      meta: {
        requestId,
        timestamp,
      },
    };
    res.status(400).json(response);
    return;
  }

  // Handle unexpected errors (never leak stack trace to client)
  logger.error({ err, requestId, url: req.originalUrl, method: req.method }, 'Unhandled Exception');

  const response: ApiErrorResponse = {
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'An internal server error occurred',
    },
    meta: {
      requestId,
      timestamp,
    },
  };
  res.status(500).json(response);
}
