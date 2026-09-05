import argon2 from 'argon2';
import crypto from 'node:crypto';
import { db } from '../../config/db';
import {
  users,
  households,
  householdMembers,
  refreshTokens,
  categories,
  locations,
} from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import {
  createAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_EXPIRY_MS,
} from './tokens';
import { AppError } from '../../utils/errors';
import type { RegisterInput, LoginInput, HouseholdRole } from '@home-inventory/shared';

const DEFAULT_CATEGORIES = [
  { name: 'Kitchen & Dining', icon: 'coffee', color: '#f59e0b' },
  { name: 'Electronics & Gadgets', icon: 'laptop', color: '#6366f1' },
  { name: 'Bags & Luggage', icon: 'briefcase', color: '#8b5cf6' },
  { name: 'Books & Stationery', icon: 'book', color: '#ec4899' },
  { name: 'Storage & Containers', icon: 'box', color: '#10b981' },
  { name: 'Tools & Hardware', icon: 'wrench', color: '#f97316' },
  { name: 'Health & Fitness', icon: 'heart-pulse', color: '#ef4444' },
  { name: 'Home & Living', icon: 'home', color: '#06b6d4' },
  { name: 'Seasonal & Festive', icon: 'sparkles', color: '#eab308' },
];

const DEFAULT_HOME_AREAS = [
  { name: 'Small Bedroom', kind: 'room', icon: 'bed-single', color: '#60a5fa', path: '/small-bedroom/' },
  { name: 'Big Bedroom', kind: 'room', icon: 'bed-double', color: '#3b82f6', path: '/big-bedroom/' },
  { name: 'Hall', kind: 'room', icon: 'sofa', color: '#10b981', path: '/hall/' },
  { name: 'Passage', kind: 'room', icon: 'footprints', color: '#94a3b8', path: '/passage/' },
  { name: 'Kitchen', kind: 'room', icon: 'utensils', color: '#f59e0b', path: '/kitchen/' },
  { name: 'Store Room', kind: 'room', icon: 'archive', color: '#64748b', path: '/store-room/' },
  { name: 'Attic / Roof', kind: 'room', icon: 'warehouse', color: '#a855f7', path: '/attic-roof/' },
];

export class AuthService {
  static async register(input: RegisterInput) {
    // 1. Check existing email
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      throw AppError.conflict('An account with this email address already exists');
    }

    // 2. Hash password with Argon2id
    const passwordHash = await argon2.hash(input.password);

    // 3. Database transaction: User + Household + Member + Seed initial structure
    return await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash,
          fullName: input.fullName,
        })
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!newUser) throw AppError.internal('Failed to create user record');

      // Create initial household
      const [newHousehold] = await tx
        .insert(households)
        .values({
          name: input.householdName || 'My Home',
        })
        .returning();

      if (!newHousehold) throw AppError.internal('Failed to create household record');

      // Create owner membership
      await tx.insert(householdMembers).values({
        householdId: newHousehold.id,
        userId: newUser.id,
        role: 'owner',
      });

      // Seed default categories for this household
      await tx.insert(categories).values(
        DEFAULT_CATEGORIES.map((cat, i) => ({
          ...cat,
          householdId: newHousehold.id,
          sortOrder: i,
          isSystem: true,
        }))
      );

      // Seed major initial home locations for this household
      await tx.insert(locations).values(
        DEFAULT_HOME_AREAS.map((loc, i) => ({
          ...loc,
          householdId: newHousehold.id,
          sortOrder: i,
          depth: 0,
        }))
      );

      // Issue tokens
      const accessToken = createAccessToken({
        userId: newUser.id,
        email: newUser.email,
        householdId: newHousehold.id,
        role: 'owner',
      });

      const rawRefreshToken = generateRefreshToken();
      const tokenHash = hashToken(rawRefreshToken);
      const familyId = crypto.randomUUID();

      await tx.insert(refreshTokens).values({
        userId: newUser.id,
        tokenHash,
        familyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      });

      return {
        user: newUser,
        household: {
          id: newHousehold.id,
          name: newHousehold.name,
          role: 'owner' as HouseholdRole,
        },
        accessToken,
        refreshToken: rawRefreshToken,
      };
    });
  }

  static async login(input: LoginInput) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Verify Argon2id password hash
    const isValidPassword = await argon2.verify(user.passwordHash, input.password);
    if (!isValidPassword) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Retrieve active household membership
    const memberships = await db
      .select({
        householdId: households.id,
        householdName: households.name,
        role: householdMembers.role,
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(eq(householdMembers.userId, user.id));

    if (memberships.length === 0) {
      throw AppError.forbidden('User does not belong to any household');
    }

    // Pick first household (prefer owner role if available)
    const primaryMembership =
      memberships.find((m) => m.role === 'owner') || memberships[0]!;

    const activeRole = primaryMembership.role as HouseholdRole;

    const accessToken = createAccessToken({
      userId: user.id,
      email: user.email,
      householdId: primaryMembership.householdId,
      role: activeRole,
    });

    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const familyId = crypto.randomUUID();

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      household: {
        id: primaryMembership.householdId,
        name: primaryMembership.householdName,
        role: activeRole,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  static async refresh(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw AppError.unauthorized('Refresh token required');
    }

    const tokenHash = hashToken(rawRefreshToken);

    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!storedToken) {
      throw AppError.unauthorized('Invalid refresh token');
    }

    // Reuse detection: If token is already revoked, an attacker or compromised token is in play!
    if (storedToken.revokedAt !== null) {
      // Invalidate all tokens in this family immediately!
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.familyId, storedToken.familyId));

      throw AppError.unauthorized('Security alert: Token reuse detected. All sessions revoked.');
    }

    // Check expiration
    if (new Date() > storedToken.expiresAt) {
      throw AppError.unauthorized('Refresh token expired');
    }

    // Revoke the used token as part of rotation
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, storedToken.id));

    // Get user and memberships
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId))
      .limit(1);

    if (!user) throw AppError.unauthorized('User not found');

    const memberships = await db
      .select({
        householdId: households.id,
        householdName: households.name,
        role: householdMembers.role,
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(eq(householdMembers.userId, user.id));

    const primaryMembership =
      memberships.find((m) => m.role === 'owner') || memberships[0]!;

    const activeRole = primaryMembership.role as HouseholdRole;

    // Issue rotated tokens
    const accessToken = createAccessToken({
      userId: user.id,
      email: user.email,
      householdId: primaryMembership.householdId,
      role: activeRole,
    });

    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: newTokenHash,
      familyId: storedToken.familyId, // Maintain same family for chain tracking
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });

    return {
      accessToken,
      newRefreshToken: newRawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      household: {
        id: primaryMembership.householdId,
        name: primaryMembership.householdName,
        role: activeRole,
      },
    };
  }

  static async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.tokenHash, tokenHash));
    }
  }

  static async getMe(userId: string, activeHouseholdId?: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw AppError.notFound('User not found');

    const memberships = await db
      .select({
        householdId: households.id,
        householdName: households.name,
        role: householdMembers.role,
        joinedAt: householdMembers.createdAt,
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(eq(householdMembers.userId, user.id));

    const selectedHouseholdId = activeHouseholdId || memberships[0]?.householdId;
    const activeMembership =
      memberships.find((m) => m.householdId === selectedHouseholdId) || memberships[0];

    return {
      user,
      activeHousehold: activeMembership
        ? {
            id: activeMembership.householdId,
            name: activeMembership.householdName,
            role: activeMembership.role as HouseholdRole,
          }
        : null,
      households: memberships.map((m) => ({
        id: m.householdId,
        name: m.householdName,
        role: m.role as HouseholdRole,
      })),
    };
  }

  static async switchHousehold(userId: string, targetHouseholdId: string) {
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
          eq(householdMembers.userId, userId),
          eq(householdMembers.householdId, targetHouseholdId)
        )
      )
      .limit(1);

    if (!membership) {
      throw AppError.forbidden('You do not belong to this household');
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw AppError.notFound('User not found');

    const activeRole = membership.role as HouseholdRole;
    const accessToken = createAccessToken({
      userId: user.id,
      email: user.email,
      householdId: membership.householdId,
      role: activeRole,
    });

    return {
      user,
      household: {
        id: membership.householdId,
        name: membership.householdName,
        role: activeRole,
      },
      accessToken,
    };
  }
}

