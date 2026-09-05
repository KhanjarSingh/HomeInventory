import { Router } from 'express';
import { authenticate, requireHousehold, requireRole } from '../../middleware/auth';
import {
  createItemSchema,
  updateItemSchema,
  confirmImageUploadSchema,
} from '@home-inventory/shared';
import { ItemsService } from './items.service';

export const itemsRouter: Router = Router();

// Require authentication and active household membership
itemsRouter.use(authenticate);
itemsRouter.use(requireHousehold);

/**
 * GET /api/v1/items
 * Lists all active inventory items in the household.
 */
itemsRouter.get('/', async (req, res, next) => {
  try {
    const { categoryId, search, isContainer } = req.query;
    const items = await ItemsService.getItems(req.household!.id, {
      categoryId: categoryId as string | undefined,
      search: search as string | undefined,
      isContainer: isContainer !== undefined ? isContainer === 'true' : undefined,
    });

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/items
 * Creates a new item, optionally with initial photo and placement.
 * Restricted to owners and editors.
 */
itemsRouter.post(
  '/',
  requireRole(['owner', 'editor']),
  async (req, res, next) => {
    try {
      const validated = createItemSchema.parse(req.body);
      const created = await ItemsService.createItem(
        req.household!.id,
        validated,
        req.user?.id
      );

      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/items/:id
 * Retrieves detailed item information including gallery and placements.
 */
itemsRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await ItemsService.getItemById(req.household!.id, req.params.id as string);
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/items/:id
 * Updates item metadata. Restricted to owners and editors.
 */
itemsRouter.patch(
  '/:id',
  requireRole(['owner', 'editor']),
  async (req, res, next) => {
    try {
      const validated = updateItemSchema.parse(req.body);
      const updated = await ItemsService.updateItem(
        req.household!.id,
        req.params.id as string,
        validated,
        req.user?.id
      );

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/items/:id
 * Soft deletes an item. Restricted to owners and editors.
 */
itemsRouter.delete(
  '/:id',
  requireRole(['owner', 'editor']),
  async (req, res, next) => {
    try {
      await ItemsService.deleteItem(
        req.household!.id,
        req.params.id as string,
        req.user?.id
      );

      res.json({ message: 'Item deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/items/:id/images
 * Confirms and attaches an uploaded photo to an item.
 */
itemsRouter.post(
  '/:id/images',
  requireRole(['owner', 'editor']),
  async (req, res, next) => {
    try {
      const validated = confirmImageUploadSchema.parse(req.body);
      const image = await ItemsService.addImageToItem(
        req.household!.id,
        req.params.id as string,
        validated,
        req.user?.id
      );

      res.status(201).json({ data: image });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/items/:id/images/:imageId/primary
 * Sets a photo as the primary cover photo for the item.
 */
itemsRouter.patch(
  '/:id/images/:imageId/primary',
  requireRole(['owner', 'editor']),
  async (req, res, next) => {
    try {
      await ItemsService.setPrimaryImage(
        req.household!.id,
        req.params.id as string,
        req.params.imageId as string,
        req.user?.id
      );

      res.json({ message: 'Cover photo updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/items/:id/images/:imageId
 * Deletes a photo from an item's gallery.
 */
itemsRouter.delete(
  '/:id/images/:imageId',
  requireRole(['owner', 'editor']),
  async (req, res, next) => {
    try {
      await ItemsService.deleteImage(
        req.household!.id,
        req.params.id as string,
        req.params.imageId as string,
        req.user?.id
      );

      res.json({ message: 'Photo deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);
