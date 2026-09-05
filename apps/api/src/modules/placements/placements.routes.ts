import { Router, type Request, type Response, type NextFunction } from 'express';
import { PlacementsService } from './placements.service';
import { authenticate, requireHousehold, requireRole } from '../../middleware/auth';
import {
  createPlacementSchema,
  updatePlacementSchema,
  movePlacementSchema,
  type ApiSuccessResponse,
} from '@home-inventory/shared';

export const placementsRouter: Router = Router();

// Enforce auth & household context for all routes
placementsRouter.use(authenticate, requireHousehold);

// POST /api/v1/placements — Create placement (Owner / Editor)
placementsRouter.post('/', requireRole(['owner', 'editor']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createPlacementSchema.parse(req.body);
    const result = await PlacementsService.createPlacement(
      req.household!.id,
      validated,
      req.user?.id
    );

    const response: ApiSuccessResponse<typeof result> = {
      data: result,
      meta: { requestId: req.id },
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/placements/:id — Update placement (Owner / Editor)
placementsRouter.patch('/:id', requireRole(['owner', 'editor']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updatePlacementSchema.parse(req.body);
    const result = await PlacementsService.updatePlacement(
      req.household!.id,
      req.params.id as string,
      validated
    );

    const response: ApiSuccessResponse<typeof result> = {
      data: result,
      meta: { requestId: req.id },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/placements/:id/move — Move placement to new location or container (Owner / Editor)
placementsRouter.post('/:id/move', requireRole(['owner', 'editor']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = movePlacementSchema.parse(req.body);
    const result = await PlacementsService.movePlacement(
      req.household!.id,
      req.params.id as string,
      validated,
      req.user?.id
    );

    const response: ApiSuccessResponse<typeof result> = {
      data: result,
      meta: { requestId: req.id },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/placements/:id — Delete placement / unplace (Owner / Editor)
placementsRouter.delete('/:id', requireRole(['owner', 'editor']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PlacementsService.deletePlacement(
      req.household!.id,
      req.params.id as string,
      req.user?.id
    );

    const response: ApiSuccessResponse<typeof result> = {
      data: result,
      meta: { requestId: req.id },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// Containers Router
export const containersRouter: Router = Router();
containersRouter.use(authenticate, requireHousehold);

// GET /api/v1/containers — List all storage containers in household (All members)
containersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PlacementsService.getContainers(req.household!.id);
    const response: ApiSuccessResponse<typeof result> = {
      data: result,
      meta: { requestId: req.id },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/containers/:id/contents — Get items and nested containers inside a container (All members)
containersRouter.get('/:id/contents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PlacementsService.getContainerContents(
      req.household!.id,
      req.params.id as string
    );
    const response: ApiSuccessResponse<typeof result> = {
      data: result,
      meta: { requestId: req.id },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// Item Placements Router (e.g. GET /api/v1/items/:id/locations)
export const itemLocationsRouter: Router = Router();
itemLocationsRouter.use(authenticate, requireHousehold);

itemLocationsRouter.get('/:id/locations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PlacementsService.getItemLocations(
      req.household!.id,
      req.params.id as string
    );
    const response: ApiSuccessResponse<typeof result> = {
      data: result,
      meta: { requestId: req.id },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
