import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { Response } from 'express';
import { env } from '../../config/env';
import type { HouseholdRole } from '@home-inventory/shared';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  householdId: string;
  role: HouseholdRole;
}

export const ACCESS_TOKEN_EXPIRY = '15m';
export const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  const isProduction = env.NODE_ENV === 'production';
  // Cross-site cookies between Vercel (frontend) and Render (API) require SameSite=None and Secure=true.
  // In development/test over localhost HTTP, SameSite=Lax and Secure=false is used.
  const sameSite = env.COOKIE_SAME_SITE ?? (isProduction ? 'none' : 'lax');
  const secure = env.COOKIE_SECURE ?? isProduction;

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: ACCESS_TOKEN_EXPIRY_MS,
    path: '/',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/api/v1/auth',
  });
}

export function clearAuthCookies(res: Response): void {
  const isProduction = env.NODE_ENV === 'production';
  const sameSite = env.COOKIE_SAME_SITE ?? (isProduction ? 'none' : 'lax');
  const secure = env.COOKIE_SECURE ?? isProduction;

  res.clearCookie('accessToken', {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/v1/auth',
  });
}
