import { Router, type Request, type Response, type NextFunction } from 'express';
import { LocationsService } from './locations.service';
import { authenticate, requireHousehold, requireRole } from '../../middleware/auth';
import {
  createLocationSchema,
  updateLocationSchema,
  reparentLocationSchema,
  type ApiSuccessResponse,
  type LocationTreeItemDto,
  type LocationDetailDto,
  type LocationDto,
} from '@home-inventory/shared';
import { z } from 'zod';

export const locationsRouter: Router = Router();

// All location endpoints require authentication and household resolution
locationsRouter.use(authenticate, requireHousehold);

// GET /api/v1/locations - Full hierarchical tree of active locations
locationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = await LocationsService.getTree(req.household!.id);

    const response: ApiSuccessResponse<LocationTreeItemDto[]> = {
      data: tree,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/locations/:id - Single location details, breadcrumbs, children & direct items/containers
locationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = z.string().uuid().parse(req.params.id);
    const detail = await LocationsService.getById(req.household!.id, locationId);

    const response: ApiSuccessResponse<LocationDetailDto> = {
      data: detail,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/locations - Create a new location (Owner or Editor only)
locationsRouter.post(
  '/',
  requireRole(['owner', 'editor']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = createLocationSchema.parse(req.body);
      const created = await LocationsService.create(req.household!.id, validated);

      const response: ApiSuccessResponse<LocationDto> = {
        data: created,
        meta: {
          requestId: req.id,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/locations/:id - Update location metadata (Owner or Editor only)
locationsRouter.patch(
  '/:id',
  requireRole(['owner', 'editor']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const locationId = z.string().uuid().parse(req.params.id);
      const validated = updateLocationSchema.parse(req.body);
      const updated = await LocationsService.update(req.household!.id, locationId, validated);

      const response: ApiSuccessResponse<LocationDto> = {
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

// POST /api/v1/locations/:id/reparent - Move location to new parent or root (Owner or Editor only)
locationsRouter.post(
  '/:id/reparent',
  requireRole(['owner', 'editor']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const locationId = z.string().uuid().parse(req.params.id);
      const { newParentId } = reparentLocationSchema.parse(req.body);

      const reparented = await LocationsService.reparent(
        req.household!.id,
        locationId,
        newParentId
      );

      const response: ApiSuccessResponse<LocationDto> = {
        data: reparented,
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

// DELETE /api/v1/locations/:id - Safe archive or delete (Owner or Editor only)
locationsRouter.delete(
  '/:id',
  requireRole(['owner', 'editor']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const locationId = z.string().uuid().parse(req.params.id);
      const result = await LocationsService.archiveOrDelete(req.household!.id, locationId);

      const response: ApiSuccessResponse<typeof result> = {
        data: result,
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
