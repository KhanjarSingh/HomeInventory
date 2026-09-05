import { Router, type Request, type Response, type NextFunction } from 'express';
import { AuthService } from './auth.service';
import { setAuthCookies, clearAuthCookies } from './tokens';
import { authenticate } from '../../middleware/auth';
import { registerSchema, loginSchema, type ApiSuccessResponse } from '@home-inventory/shared';

export const authRouter: Router = Router();

// POST /api/v1/auth/register
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await AuthService.register(validated);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    const response: ApiSuccessResponse<{
      user: typeof result.user;
      household: typeof result.household;
      accessToken: string;
      refreshToken: string;
    }> = {
      data: {
        user: result.user,
        household: result.household,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/profiles
authRouter.get('/profiles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.getProfiles();
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
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await AuthService.login(validated);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    const response: ApiSuccessResponse<{
      user: typeof result.user;
      household: typeof result.household;
      accessToken: string;
      refreshToken: string;
    }> = {
      data: {
        user: result.user,
        household: result.household,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken: string | undefined = req.cookies?.refreshToken || req.body?.refreshToken;

    const result = await AuthService.refresh(rawToken || '');

    setAuthCookies(res, result.accessToken, result.newRefreshToken);

    const response: ApiSuccessResponse<{
      user: typeof result.user;
      household: typeof result.household;
      accessToken: string;
      refreshToken: string;
    }> = {
      data: {
        user: result.user,
        household: result.household,
        accessToken: result.accessToken,
        refreshToken: result.newRefreshToken,
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    clearAuthCookies(res);
    next(error);
  }
});

// POST /api/v1/auth/logout
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken: string | undefined = req.cookies?.refreshToken || req.body?.refreshToken;
    await AuthService.logout(rawToken);

    clearAuthCookies(res);

    const response: ApiSuccessResponse<{ success: boolean }> = {
      data: { success: true },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/me
authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.getMe(
      req.user!.id,
      req.tokenPayload?.householdId || (req.headers['x-household-id'] as string)
    );

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
});

// POST /api/v1/auth/switch-household
authRouter.post('/switch-household', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { householdId } = req.body;
    if (!householdId) {
      res.status(400).json({ error: { message: 'householdId is required', code: 'BAD_REQUEST' } });
      return;
    }

    const result = await AuthService.switchHousehold(req.user!.id, householdId);
    const rawRefreshToken = req.cookies?.refreshToken;
    setAuthCookies(res, result.accessToken, rawRefreshToken);

    const response: ApiSuccessResponse<{
      user: typeof result.user;
      household: typeof result.household;
      accessToken: string;
    }> = {
      data: {
        user: result.user,
        household: result.household,
        accessToken: result.accessToken,
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

