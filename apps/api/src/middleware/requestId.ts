import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.header('x-request-id');
  const reqId = existingId || `req_${nanoid(16)}`;
  req.id = reqId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', reqId);
  next();
}
