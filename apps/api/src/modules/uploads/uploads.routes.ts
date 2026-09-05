import { Router } from 'express';
import { authenticate, requireHousehold, requireRole } from '../../middleware/auth';
import { signedUploadParamsSchema } from '@home-inventory/shared';
import { UploadsService } from './uploads.service';

export const uploadsRouter: Router = Router();

// Require authentication and active household membership
uploadsRouter.use(authenticate);
uploadsRouter.use(requireHousehold);

/**
 * POST /api/v1/uploads/sign
 * Generates signed Cloudinary upload credentials for direct browser uploads.
 * Restricted to owners and editors. Viewers are blocked.
 */
uploadsRouter.post(
  '/sign',
  requireRole(['owner', 'editor']),
  async (req, res, next) => {
    try {
      const validated = req.body && Object.keys(req.body).length > 0
        ? signedUploadParamsSchema.parse(req.body)
        : undefined;

      const signatureData = UploadsService.generateSignature(
        req.household!.id,
        validated
      );

      res.json({
        data: signatureData,
      });
    } catch (err) {
      next(err);
    }
  }
);
