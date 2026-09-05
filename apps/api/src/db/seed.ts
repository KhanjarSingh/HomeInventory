import argon2 from 'argon2';
import { db, sql } from '../config/db';
import {
  users,
  households,
  householdMembers,
  locations,
  categories,
  tags,
  collections,
  items,
  itemPlacements,
  itemImages,
  priceHistory,
  itemTags,
  collectionItems,
  movements,
  inventoryAdjustments,
  loans,
  reminders,
  auditLog,
} from './schema';
import { logger } from '../utils/logger';

export async function runSeeds(): Promise<void> {
  logger.info('🌱 Starting realistic household seed data insertion (Real-Home Physical Hierarchy)...');

  try {
    // 1. Clean existing seed data in reverse dependency order
    await db.delete(auditLog);
    await db.delete(reminders);
    await db.delete(loans);
    await db.delete(movements);
    await db.delete(inventoryAdjustments);
    await db.delete(priceHistory);
    await db.delete(itemImages);
    await db.delete(itemTags);
    await db.delete(collectionItems);
    await db.delete(itemPlacements);
    await db.delete(items);
    await db.delete(collections);
    await db.delete(tags);
    await db.delete(categories);
    await db.delete(locations);
    await db.delete(householdMembers);
    await db.delete(households);
    await db.delete(users);

    // 2. Create Users
    // Family Profiles for Tandalwade's Residency
    const [vithalUser] = await db
      .insert(users)
      .values({
        email: 'vithal@tandalwade.local',
        passwordHash: await argon2.hash('1973'),
        fullName: 'Vithal Tandalwade',
      })
      .returning();

    const [shailajaUser] = await db
      .insert(users)
      .values({
        email: 'shailaja@tandalwade.local',
        passwordHash: await argon2.hash('1979'),
        fullName: 'Shailaja Tandalwade',
      })
      .returning();

    const [rutujaUser] = await db
      .insert(users)
      .values({
        email: 'rutuja@tandalwade.local',
        passwordHash: await argon2.hash('2003'),
        fullName: 'Rutuja Tandalwade',
      })
      .returning();

    const [parthUser] = await db
      .insert(users)
      .values({
        email: 'parth@tandalwade.local',
        passwordHash: await argon2.hash('2007'),
        fullName: 'Parth Tandalwade',
      })
      .returning();

    // Isolated neighbor user & test viewer in secondary household (for RBAC & isolation tests)
    const [neighborUser] = await db
      .insert(users)
      .values({
        email: 'neighbor@example.com',
        passwordHash: await argon2.hash('Password123!'),
        fullName: 'Vikram Patel',
      })
      .returning();

    const [testViewerUser] = await db
      .insert(users)
      .values({
        email: 'viewer@example.com',
        passwordHash: await argon2.hash('Password123!'),
        fullName: 'Test Viewer',
      })
      .returning();

    if (!vithalUser || !shailajaUser || !rutujaUser || !parthUser || !neighborUser || !testViewerUser) {
      throw new Error('Failed to create users');
    }

    const ownerUser = vithalUser;

    // 3. Create Households & Members
    const [mainHousehold] = await db
      .insert(households)
      .values({ name: "Tandalwade's Residency" })
      .returning();

    const [neighborHousehold] = await db
      .insert(households)
      .values({ name: 'Patel Home (Neighbor)' })
      .returning();

    if (!mainHousehold || !neighborHousehold) {
      throw new Error('Failed to create households');
    }

    // Default household: Vithal (Owner), Shailaja (Owner), Rutuja (Editor), Parth (Editor). NO viewer profile.
    await db.insert(householdMembers).values([
      { householdId: mainHousehold.id, userId: vithalUser.id, role: 'owner' },
      { householdId: mainHousehold.id, userId: shailajaUser.id, role: 'owner' },
      { householdId: mainHousehold.id, userId: rutujaUser.id, role: 'editor' },
      { householdId: mainHousehold.id, userId: parthUser.id, role: 'editor' },
      { householdId: neighborHousehold.id, userId: neighborUser.id, role: 'owner' },
      { householdId: neighborHousehold.id, userId: testViewerUser.id, role: 'viewer' },
    ]);

    // Also insert a dummy location in neighborHousehold so read-only viewer queries succeed
    await db.insert(locations).values({
      householdId: neighborHousehold.id,
      name: 'Neighbor Living Room',
      kind: 'room',
      path: '/neighbor-living-room/',
      depth: 0,
      sortOrder: 1,
    });

    const hId = mainHousehold.id;

    // 4. Create Real-Home Physical Locations (Arbitrary Depth, Materialized Path)
    // Major Top-Level Areas (Depth 0)
    // - Small Bedroom
    // - Big Bedroom
    // - Hall
    // - Passage
    // - Kitchen
    // - Store Room
    // - Attic / Roof

    // 4. Create Simple Clean Home Locations (No nested hierarchy)
    const [hall] = await db.insert(locations).values({
      householdId: hId,
      name: 'Hall',
      kind: 'room',
      icon: 'sofa',
      color: '#10b981',
      path: '/hall/',
      depth: 0,
      sortOrder: 1,
    }).returning();

    const [smallBedroom] = await db.insert(locations).values({
      householdId: hId,
      name: 'Small Bedroom',
      kind: 'room',
      icon: 'bed-single',
      color: '#60a5fa',
      path: '/small-bedroom/',
      depth: 0,
      sortOrder: 2,
    }).returning();

    const [bigBedroom] = await db.insert(locations).values({
      householdId: hId,
      name: 'Big Bedroom',
      kind: 'room',
      icon: 'bed-double',
      color: '#3b82f6',
      path: '/big-bedroom/',
      depth: 0,
      sortOrder: 3,
    }).returning();

    const [passage] = await db.insert(locations).values({
      householdId: hId,
      name: 'Passage',
      kind: 'room',
      icon: 'footprints',
      color: '#94a3b8',
      path: '/passage/',
      depth: 0,
      sortOrder: 4,
    }).returning();

    const [kitchen] = await db.insert(locations).values({
      householdId: hId,
      name: 'Kitchen',
      kind: 'room',
      icon: 'utensils',
      color: '#f59e0b',
      path: '/kitchen/',
      depth: 0,
      sortOrder: 5,
    }).returning();

    const [attic] = await db.insert(locations).values({
      householdId: hId,
      name: 'Attic',
      kind: 'room',
      icon: 'warehouse',
      color: '#a855f7',
      path: '/attic/',
      depth: 0,
      sortOrder: 6,
    }).returning();

    if (!hall || !smallBedroom || !bigBedroom || !passage || !kitchen || !attic) {
      throw new Error('Failed to create home locations');
    }

    // 5. Create Categories
    const categoryData = [
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

    await db.insert(categories).values(
      categoryData.map((c) => ({
        householdId: hId,
        ...c,
      }))
    );

    // 6. Create Common Tags
    const tagData = [
      { name: 'fragile', color: '#ef4444' },
      { name: 'daily-use', color: '#3b82f6' },
      { name: 'electronics', color: '#6366f1' },
      { name: 'documents', color: '#eab308' },
      { name: 'valuable', color: '#10b981' },
      { name: 'spare', color: '#64748b' },
    ];

    await db.insert(tags).values(
      tagData.map((t) => ({
        householdId: hId,
        ...t,
      }))
    );

    // 7. Audit Trail
    await db.insert(auditLog).values([
      {
        householdId: hId,
        userId: ownerUser.id,
        entityType: 'household',
        entityId: hId,
        action: 'created',
        metadata: { name: "Tandalwade's Residency" },
      },
      {
        householdId: hId,
        userId: ownerUser.id,
        entityType: 'location',
        entityId: bigBedroom.id,
        action: 'created',
        metadata: { name: 'Big Bedroom', kind: 'room' },
      },
    ]);

    logger.info('✅ Real-home household seed data insertion completed successfully.');
  } catch (error) {
    logger.error({ error }, '❌ Seed data insertion failed');
    throw error;
  }
}

// Run directly if invoked from CLI
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runSeeds()
    .then(async () => {
      await sql.end({ timeout: 5 });
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await sql.end({ timeout: 5 });
      process.exit(1);
    });
}
