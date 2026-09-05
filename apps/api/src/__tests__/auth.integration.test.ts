import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { db } from '../config/db';
import { refreshTokens } from '../db/schema';
import { eq } from 'drizzle-orm';
import { hashToken } from '../modules/auth/tokens';

const extractCookie = (res: request.Response, name: string): string => {
  const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) || [];
  for (const c of cookies) {
    const match = c.match(new RegExp(`${name}=([^;]+)`));
    if (match && match[1]) return match[1];
  }
  return '';
};

describe('Phase 2: Authentication & Household Isolation Test Suite', () => {
  const app = createApp();

  const testUserEmail = `test_user_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';
  let userAccessToken: string;
  let userRefreshToken: string;
  let userHouseholdId: string;

  // 1. Registration
  describe('Registration (POST /api/v1/auth/register)', () => {
    it('successfully registers new user, auto-creates default household, and sets httpOnly cookies', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUserEmail,
          password: testPassword,
          fullName: 'Test Resident',
          householdName: 'My Sweet Home',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.user.email).toBe(testUserEmail.toLowerCase());
      expect(res.body.data.household.name).toBe('My Sweet Home');
      expect(res.body.data.household.role).toBe('owner');

      userHouseholdId = res.body.data.household.id;

      // Verify cookies
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      const cookieStr = cookies.join('; ');
      expect(cookieStr).toContain('accessToken=');
      expect(cookieStr).toContain('refreshToken=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');

      // Extract tokens from cookies for subsequent tests
      const accessMatch = cookieStr.match(/accessToken=([^;]+)/);
      const refreshMatch = cookieStr.match(/refreshToken=([^;]+)/);
      userAccessToken = accessMatch![1]!;
      userRefreshToken = refreshMatch![1]!;

      // Verify raw refresh token was NOT stored in database (hashed only)
      const tokenHash = hashToken(userRefreshToken);
      const [storedToken] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash));

      expect(storedToken).toBeDefined();
      expect(storedToken!.tokenHash).not.toBe(userRefreshToken);
    });

    it('rejects registration with existing email (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUserEmail,
          password: 'AnotherPassword123!',
          fullName: 'Duplicate Resident',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects invalid password format (Zod validation error)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid_pass@example.com',
          password: 'short',
          fullName: 'Short Pass',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 2. Login
  describe('Login (POST /api/v1/auth/login)', () => {
    it('authenticates valid credentials using Argon2id and sets auth cookies', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(testUserEmail.toLowerCase());
      expect(res.body.data.household.role).toBe('owner');

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
    });

    it('rejects incorrect password with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects non-existent email with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        });

      expect(res.status).toBe(401);
    });
  });

  // 3. Protected Profile (GET /api/v1/auth/me)
  describe('Protected Current User Profile (GET /api/v1/auth/me)', () => {
    it('returns current user and active household using access token cookie', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [`accessToken=${userAccessToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(testUserEmail.toLowerCase());
      expect(res.body.data.activeHousehold.id).toBe(userHouseholdId);
      expect(res.body.data.activeHousehold.role).toBe('owner');
    });

    it('returns current user using Authorization Bearer header', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(testUserEmail.toLowerCase());
    });

    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects forged/tampered JWT with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer forged.invalid.token');

      expect(res.status).toBe(401);
    });
  });

  // 4. Refresh Token Rotation & Reuse Detection
  describe('Refresh Token Rotation & Security Reuse Detection', () => {
    let rotatedRefreshToken: string;

    it('rotates refresh token and issues fresh access token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${userRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('user');

      const cookies = (res.headers['set-cookie'] as unknown as string[]).join('; ');
      const newAccessMatch = cookies.match(/accessToken=([^;]+)/);
      const newRefreshMatch = cookies.match(/refreshToken=([^;]+)/);

      expect(newAccessMatch).toBeDefined();
      expect(newRefreshMatch).toBeDefined();
      expect(newAccessMatch![1]).toBeDefined();

      rotatedRefreshToken = newRefreshMatch![1]!;

      // Crucial: New refresh token must be distinct from old refresh token!
      expect(rotatedRefreshToken).not.toBe(userRefreshToken);

      // Old refresh token must now be marked as revoked in database
      const oldHash = hashToken(userRefreshToken);
      const [oldStoredToken] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, oldHash));

      expect(oldStoredToken!.revokedAt).not.toBeNull();
    });

    it('detects token reuse: Reusing the previous refresh token revokes entire token family', async () => {
      // Attacker attempts to replay old `userRefreshToken` which was already revoked!
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${userRefreshToken}`]);

      // Must be rejected with 401 security alert
      expect(res.status).toBe(401);

      // Entire family should now be revoked (including the newest rotated token)
      const newestHash = hashToken(rotatedRefreshToken);
      const [newestStoredToken] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, newestHash));

      expect(newestStoredToken!.revokedAt).not.toBeNull();
    });
  });

  // 5. RBAC & Cross-Household Isolation
  describe('RBAC & Multi-Tenant Household Scope', () => {
    let ownerToken: string;
    let editorToken: string;
    let viewerToken: string;
    let neighborHousehold: string;

    beforeAll(async () => {
      // Login seeded Owner (Vithal Tandalwade - 1973)
      const ownerRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'vithal@tandalwade.local', password: '1973' });
      ownerToken = extractCookie(ownerRes, 'accessToken');

      // Login seeded Editor (Parth Tandalwade - 2007)
      const editorRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'parth@tandalwade.local', password: '2007' });
      editorToken = extractCookie(editorRes, 'accessToken');

      // Login seeded Viewer
      const viewerRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'viewer@example.com', password: 'Password123!' });
      viewerToken = extractCookie(viewerRes, 'accessToken');

      // Login seeded Neighbor (isolated household)
      const neighborRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'neighbor@example.com', password: 'Password123!' });
      neighborHousehold = neighborRes.body.data.household.id;
    });

    it('Owner can view members of their household', async () => {
      const res = await request(app)
        .get('/api/v1/households/members')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('Viewer can view household members in read-only mode', async () => {
      const res = await request(app)
        .get('/api/v1/households/members')
        .set('Cookie', [`accessToken=${viewerToken}`]);

      expect(res.status).toBe(200);
    });

    it('Viewer is rejected with 403 Forbidden when attempting to update member role', async () => {
      // Viewer attempts to change member role
      const res = await request(app)
        .patch('/api/v1/households/members/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [`accessToken=${viewerToken}`])
        .send({ role: 'owner' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Editor is rejected with 403 Forbidden when attempting to update member role (Owner only)', async () => {
      const res = await request(app)
        .patch('/api/v1/households/members/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({ role: 'viewer' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Cross-Household Isolation: User in Household A cannot access Household B members', async () => {
      // Seeded Neighbor is in `neighborHousehold`. Attempting to access `mainHousehold` with x-household-id header:
      const res = await request(app)
        .get('/api/v1/households/members')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .set('x-household-id', neighborHousehold); // Tampered header pointing to neighbor!

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('not a member of this household');
    });
  });

  // 6. Family Profile PIN Unlock Verification
  describe('Family Profile PIN Unlock Verification', () => {
    it('GET /api/v1/auth/profiles returns the 4 family profiles with household name and no credentials', async () => {
      const res = await request(app).get('/api/v1/auth/profiles');
      expect(res.status).toBe(200);
      expect(res.body.data.householdName).toBe("Tandalwade's Residency");
      expect(res.body.data.profiles.length).toBe(4);

      const names = res.body.data.profiles.map((p: any) => p.fullName);
      expect(names).toEqual([
        'Vithal Tandalwade',
        'Shailaja Tandalwade',
        'Rutuja Tandalwade',
        'Parth Tandalwade',
      ]);

      // Verify no password hash or secret is exposed
      for (const p of res.body.data.profiles) {
        expect(p).not.toHaveProperty('password');
        expect(p).not.toHaveProperty('passwordHash');
        expect(p).not.toHaveProperty('pin');
        expect(p).toHaveProperty('initials');
      }
    });

    it('Vithal Tandalwade can unlock with birth year 1973 (Owner role)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'vithal@tandalwade.local', password: '1973' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe('Vithal Tandalwade');
      expect(res.body.data.household.role).toBe('owner');
      expect(res.body.data.household.name).toBe("Tandalwade's Residency");

      const cookies = (res.headers['set-cookie'] as unknown as string[]).join('; ');
      expect(cookies).toContain('accessToken=');
      expect(cookies).toContain('refreshToken=');
    });

    it('Shailaja Tandalwade can unlock with birth year 1979 (Owner role)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'shailaja@tandalwade.local', password: '1979' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe('Shailaja Tandalwade');
      expect(res.body.data.household.role).toBe('owner');
    });

    it('Rutuja Tandalwade can unlock with birth year 2003 (Editor role)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'rutuja@tandalwade.local', password: '2003' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe('Rutuja Tandalwade');
      expect(res.body.data.household.role).toBe('editor');
    });

    it('Parth Tandalwade can unlock with birth year 2007 (Editor role)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'parth@tandalwade.local', password: '2007' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe('Parth Tandalwade');
      expect(res.body.data.household.role).toBe('editor');
    });

    it('rejects incorrect unlock PIN with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'parth@tandalwade.local', password: '1999' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects another profile PIN on a different profile (Vithal PIN on Parth profile)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'parth@tandalwade.local', password: '1973' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // 7. Logout
  describe('Logout (POST /api/v1/auth/logout)', () => {
    it('clears auth cookies and invalidates session', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`accessToken=${userAccessToken}`, `refreshToken=${userRefreshToken}`]);

      expect(res.status).toBe(200);
      const cookies = (res.headers['set-cookie'] as unknown as string[]).join('; ');
      expect(cookies).toContain('accessToken=;');
      expect(cookies).toContain('refreshToken=;');
    });
  });
});
