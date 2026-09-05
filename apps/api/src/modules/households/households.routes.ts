import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '../../config/db';
import { households, householdMembers, users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate, requireHousehold, requireRole } from '../../middleware/auth';
import { AppError } from '../../utils/errors';
import { householdRoleSchema, type ApiSuccessResponse } from '@home-inventory/shared';
import { z } from 'zod';

export const householdsRouter: Router = Router();

// Require authentication for all household routes
householdsRouter.use(authenticate);

// GET /api/v1/households - List households user belongs to
householdsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await db
      .select({
        id: households.id,
        name: households.name,
        role: householdMembers.role,
        createdAt: households.createdAt,
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(eq(householdMembers.userId, req.user!.id));

    const response: ApiSuccessResponse<typeof list> = {
      data: list,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/households - Create a new household
const createHouseholdSchema = z.object({
  name: z.string().min(1).max(255),
});

householdsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = createHouseholdSchema.parse(req.body);

    const result = await db.transaction(async (tx) => {
      const [newHousehold] = await tx
        .insert(households)
        .values({ name })
        .returning();

      if (!newHousehold) throw AppError.internal('Failed to create household');

      await tx.insert(householdMembers).values({
        householdId: newHousehold.id,
        userId: req.user!.id,
        role: 'owner',
      });

      return newHousehold;
    });

    const response: ApiSuccessResponse<typeof result> = {
      data: result,
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/households/members - List members of the active household
householdsRouter.get(
  '/members',
  requireHousehold,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await db
        .select({
          id: householdMembers.id,
          userId: users.id,
          fullName: users.fullName,
          email: users.email,
          avatarUrl: users.avatarUrl,
          role: householdMembers.role,
          joinedAt: householdMembers.createdAt,
        })
        .from(householdMembers)
        .innerJoin(users, eq(users.id, householdMembers.userId))
        .where(eq(householdMembers.householdId, req.household!.id));

      const response: ApiSuccessResponse<typeof members> = {
        data: members,
        meta: {
          requestId: req.id,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/households/members/:memberId - Update member role (Owner only)
const updateRoleSchema = z.object({
  role: householdRoleSchema,
});

householdsRouter.patch(
  '/members/:memberId',
  requireHousehold,
  requireRole(['owner']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = updateRoleSchema.parse(req.body);
      const memberId = z.string().uuid().parse(req.params.memberId);

      const [updated] = await db
        .update(householdMembers)
        .set({ role, updatedAt: new Date() })
        .where(
          and(
            eq(householdMembers.id, memberId),
            eq(householdMembers.householdId, req.household!.id)
          )
        )
        .returning();

      if (!updated) {
        throw AppError.notFound('Member not found in this household');
      }

      const response: ApiSuccessResponse<typeof updated> = {
        data: updated,
        meta: {
          requestId: req.id,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
