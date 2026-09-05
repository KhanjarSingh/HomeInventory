import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../modules/auth/tokens';
import { db } from '../config/db';
import { households, householdMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import type { HouseholdRole } from '@home-inventory/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      tokenPayload?: AccessTokenPayload;
      household?: {
        id: string;
        name: string;
      };
      memberRole?: HouseholdRole;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined = undefined;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw AppError.unauthorized('Authentication required');
    }

    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.userId,
      email: payload.email,
    };
    req.tokenPayload = payload;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(AppError.unauthorized('Invalid or expired authentication token'));
    }
  }
}

export async function requireHousehold(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }

    const headerHouseholdId = req.headers['x-household-id'] as string | undefined;
    const householdId = headerHouseholdId || req.tokenPayload?.householdId;

    if (!householdId) {
      throw AppError.badRequest('No active household specified');
    }

    // Verify user is a member of this household
    const [membership] = await db
      .select({
        householdId: households.id,
        householdName: households.name,
        role: householdMembers.role,
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!membership) {
      throw AppError.forbidden('You are not a member of this household');
    }

    req.household = {
      id: membership.householdId,
      name: membership.householdName,
    };
    req.memberRole = membership.role as HouseholdRole;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: HouseholdRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.memberRole) {
      next(AppError.forbidden('Household membership role not resolved'));
      return;
    }

    if (!allowedRoles.includes(req.memberRole)) {
      next(
        AppError.forbidden(
          `Insufficient permissions. Requires one of [${allowedRoles.join(', ')}], but current role is '${req.memberRole}'`
        )
      );
      return;
    }

    next();
  };
}
