import { Router } from 'express';
import { authenticate, requireHousehold } from '../../middleware/auth';
import { CategoriesService } from './categories.service';

export const categoriesRouter: Router = Router();

// Require authentication and active household membership
categoriesRouter.use(authenticate);
categoriesRouter.use(requireHousehold);

/**
 * GET /api/v1/categories
 * Returns all categories for the active household.
 */
categoriesRouter.get('/', async (req, res, next) => {
  try {
    const list = await CategoriesService.getCategories(req.household!.id);
    res.json({ data: list });
  } catch (err) {
    next(err);
  }
});
