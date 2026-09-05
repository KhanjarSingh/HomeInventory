import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, sql } from '../config/db';
import {
  users,
  households,
  locations,
  categories,
  tags,
  items,
  itemPlacements,
} from '../db/schema';
import { eq, and } from 'drizzle-orm';

describe('Database & Domain Integrity Verification Suite', () => {
  let mainHouseholdId: string;
  let neighborHouseholdId: string;

  beforeAll(async () => {
    // Retrieve seeded households
    const [main] = await db
      .select()
      .from(households)
      .where(eq(households.name, 'The Sharma Residence'));
    const [neighbor] = await db
      .select()
      .from(households)
      .where(eq(households.name, 'Patel Home (Neighbor)'));

    expect(main).toBeDefined();
    expect(neighbor).toBeDefined();

    mainHouseholdId = main!.id;
    neighborHouseholdId = neighbor!.id;
  });

  afterAll(async () => {
    // Note: Do not close pool here if other tests run, or close if last
  });

  // 1. Extensions and Indexes
  describe('Extensions and Performance Indexes', () => {
    it('verifies pg_trgm and uuid-ossp extensions are installed', async () => {
      const extensions = await sql`SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'uuid-ossp');`;
      const extNames = extensions.map((e) => e.extname);
      expect(extNames).toContain('pg_trgm');
      expect(extNames).toContain('uuid-ossp');
    });

    it('verifies trigram and FTS indexes exist on items', async () => {
      const indexes = await sql`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'items' AND indexname IN ('idx_items_name_trgm', 'idx_items_search_vector');
      `;
      const indexNames = indexes.map((i) => i.indexname);
      expect(indexNames).toContain('idx_items_name_trgm');
      expect(indexNames).toContain('idx_items_search_vector');
    });

    it('verifies materialized path index exists on locations', async () => {
      const indexes = await sql`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'locations' AND indexname = 'idx_locations_household_path';
      `;
      expect(indexes.length).toBe(1);
    });
  });

  // 2. Household Isolation
  describe('Multi-Tenant Household Isolation', () => {
    it('prevents cross-household placement: Household A placement referencing Household B location', async () => {
      // Create an item in Main Household
      const [itemA] = await db
        .insert(items)
        .values({
          householdId: mainHouseholdId,
          name: 'Isolation Test Item A',
          totalQuantity: '1',
        })
        .returning();

      // Create a location in Neighbor Household
      const [locationB] = await db
        .insert(locations)
        .values({
          householdId: neighborHouseholdId,
          name: 'Neighbor Garage',
          path: '/neighbor-garage/',
        })
        .returning();

      expect(itemA).toBeDefined();
      expect(locationB).toBeDefined();

      // Attempt to place Item A (Main) in Location B (Neighbor) with Main Household ID
      // This violates fk_placements_household_location composite foreign key!
      await expect(
        db.insert(itemPlacements).values({
          householdId: mainHouseholdId,
          itemId: itemA!.id,
          locationId: locationB!.id,
          quantity: '1',
        })
      ).rejects.toThrow();

      // Cleanup
      await db.delete(items).where(eq(items.id, itemA!.id));
      await db.delete(locations).where(eq(locations.id, locationB!.id));
    });

    it('ensures queries strictly scope items by householdId', async () => {
      const mainItems = await db
        .select()
        .from(items)
        .where(eq(items.householdId, mainHouseholdId));
      const neighborItems = await db
        .select()
        .from(items)
        .where(eq(items.householdId, neighborHouseholdId));

      expect(mainItems.length).toBeGreaterThan(0);
      expect(neighborItems.length).toBe(0);
    });
  });

  // 3. Placement Target XOR Behavior
  describe('Placement Target XOR Rules', () => {
    it('rejects placement pointing to BOTH location and container', async () => {
      const [item] = await db
        .select()
        .from(items)
        .where(and(eq(items.householdId, mainHouseholdId), eq(items.isContainer, false)))
        .limit(1);
      const [location] = await db
        .select()
        .from(locations)
        .where(eq(locations.householdId, mainHouseholdId))
        .limit(1);
      const [container] = await db
        .select()
        .from(items)
        .where(and(eq(items.householdId, mainHouseholdId), eq(items.isContainer, true)))
        .limit(1);

      await expect(
        db.insert(itemPlacements).values({
          householdId: mainHouseholdId,
          itemId: item!.id,
          locationId: location!.id,
          containerItemId: container!.id, // BOTH!
          quantity: '1',
        })
      ).rejects.toThrow(); // Violates chk_placement_target_xor
    });

    it('rejects placement pointing to NEITHER location nor container', async () => {
      const [item] = await db
        .select()
        .from(items)
        .where(and(eq(items.householdId, mainHouseholdId), eq(items.isContainer, false)))
        .limit(1);

      await expect(
        db.insert(itemPlacements).values({
          householdId: mainHouseholdId,
          itemId: item!.id,
          locationId: null,
          containerItemId: null, // NEITHER!
          quantity: '1',
        })
      ).rejects.toThrow(); // Violates chk_placement_target_xor
    });
  });

  // 4. Self-Containment Prevention
  describe('Self-Containment Prevention', () => {
    it('rejects an item being placed inside itself (chk_placement_not_self)', async () => {
      const [container] = await db
        .select()
        .from(items)
        .where(and(eq(items.householdId, mainHouseholdId), eq(items.isContainer, true)))
        .limit(1);

      // Attempt to place container inside itself
      await expect(
        db.insert(itemPlacements).values({
          householdId: mainHouseholdId,
          itemId: container!.id,
          containerItemId: container!.id, // Self-containment!
          quantity: '1',
        })
      ).rejects.toThrow(); // Violates chk_placement_not_self
    });
  });

  // 5. Quantity Invariant & Unplaced Items
  describe('Quantity Rules & Legitimate Unplaced Items', () => {
    it('rejects placement with zero or negative quantity', async () => {
      const [item] = await db
        .select()
        .from(items)
        .where(eq(items.householdId, mainHouseholdId))
        .limit(1);
      const [location] = await db
        .select()
        .from(locations)
        .where(eq(locations.householdId, mainHouseholdId))
        .limit(1);

      await expect(
        db.insert(itemPlacements).values({
          householdId: mainHouseholdId,
          itemId: item!.id,
          locationId: location!.id,
          quantity: '0', // Invalid!
        })
      ).rejects.toThrow();

      await expect(
        db.insert(itemPlacements).values({
          householdId: mainHouseholdId,
          itemId: item!.id,
          locationId: location!.id,
          quantity: '-5', // Invalid!
        })
      ).rejects.toThrow();
    });

    it('permits legitimate unplaced items with total_quantity > 0 and 0 placements (Quick Capture)', async () => {
      const [unplacedItem] = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.householdId, mainHouseholdId),
            eq(items.name, 'Philips Ojas Rechargeable Emergency LED Lantern')
          )
        );

      expect(unplacedItem).toBeDefined();
      expect(Number(unplacedItem!.totalQuantity)).toBe(1);

      // Verify it has 0 placements
      const placements = await db
        .select()
        .from(itemPlacements)
        .where(eq(itemPlacements.itemId, unplacedItem!.id));
      expect(placements.length).toBe(0);
    });

    it('verifies split stock reconciliation: total_quantity equals sum of placements', async () => {
      const [whiteMug] = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.householdId, mainHouseholdId),
            eq(items.name, 'White Ceramic Coffee Mug 350ml')
          )
        );

      expect(whiteMug).toBeDefined();
      const placements = await db
        .select()
        .from(itemPlacements)
        .where(eq(itemPlacements.itemId, whiteMug!.id));

      expect(placements.length).toBe(2);
      const sumQuantity = placements.reduce((acc, p) => acc + Number(p.quantity), 0);
      expect(sumQuantity).toBe(Number(whiteMug!.totalQuantity));
      expect(sumQuantity).toBe(8);
    });
  });

  // 6. Container Nesting and Resolution
  describe('Container Nesting & Hierarchy', () => {
    it('verifies container nesting: Small Electronics Box inside Medium Box', async () => {
      const [smallBox] = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.householdId, mainHouseholdId),
            eq(items.name, 'Small Electronics Organizer Box')
          )
        );
      const [mediumBox] = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.householdId, mainHouseholdId),
            eq(items.name, 'Medium Transparent Storage Box')
          )
        );

      expect(smallBox).toBeDefined();
      expect(mediumBox).toBeDefined();

      const [smallBoxPlacement] = await db
        .select()
        .from(itemPlacements)
        .where(eq(itemPlacements.itemId, smallBox!.id));

      expect(smallBoxPlacement).toBeDefined();
      expect(smallBoxPlacement!.containerItemId).toBe(mediumBox!.id);
    });

    it('resolves physical location of item inside nested container', async () => {
      // Find backup mouse placed in Small Electronics Box
      const [mouse] = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.householdId, mainHouseholdId),
            eq(items.name, 'Logitech B100 Optical USB Wired Mouse (Backup)')
          )
        );

      expect(mouse).toBeDefined();

      // Recursive query resolving item -> small box -> medium box -> location
      const resolved = await sql`
        WITH RECURSIVE container_chain AS (
          -- Base: direct placement of mouse
          SELECT ip.item_id, ip.container_item_id, ip.location_id, 1 as depth
          FROM item_placements ip
          WHERE ip.item_id = ${mouse!.id}

          UNION ALL

          -- Recursive: trace parent container's placement
          SELECT c.id as item_id, ip2.container_item_id, ip2.location_id, cc.depth + 1
          FROM container_chain cc
          JOIN items c ON c.id = cc.container_item_id
          JOIN item_placements ip2 ON ip2.item_id = c.id
          WHERE cc.container_item_id IS NOT NULL
        )
        SELECT cc.depth, l.name as location_name, l.path as location_path
        FROM container_chain cc
        JOIN locations l ON l.id = cc.location_id
        WHERE cc.location_id IS NOT NULL;
      `;

      expect(resolved.length).toBe(1);
      expect(resolved[0]!.location_name).toBe('Shelf 1 (Top)');
      expect(resolved[0]!.location_path).toContain('/store-room/');
    });
  });

  // 7. Subtree Queries via Materialized Path
  describe('Location Materialized Path Subtree Queries', () => {
    it('retrieves all items in Store Room and its descendants in a single query', async () => {
      const itemsInStoreRoom = await sql`
        SELECT DISTINCT i.name
        FROM items i
        JOIN item_placements ip ON ip.item_id = i.id
        LEFT JOIN locations l ON l.id = ip.location_id
        WHERE ip.household_id = ${mainHouseholdId}
          AND l.path LIKE '/store-room/%';
      `;

      expect(itemsInStoreRoom.length).toBeGreaterThan(0);
      const names = itemsInStoreRoom.map((r) => r.name);
      // Stanley hammer is on Shelf 2 of Rack 1 in Store Room
      expect(names).toContain('Stanley 16oz Steel Curved Claw Hammer');
    });
  });

  // 8. Unique Constraints
  describe('Unique Constraints', () => {
    it('enforces unique category name per household (uq_categories_household_name)', async () => {
      await expect(
        db.insert(categories).values({
          householdId: mainHouseholdId,
          name: 'Kitchen & Dining', // Duplicate!
        })
      ).rejects.toThrow();
    });

    it('enforces unique tag name per household (uq_tags_household_name)', async () => {
      await expect(
        db.insert(tags).values({
          householdId: mainHouseholdId,
          name: 'fragile', // Duplicate!
        })
      ).rejects.toThrow();
    });

    it('enforces unique user email globally', async () => {
      await expect(
        db.insert(users).values({
          email: 'owner@example.com', // Duplicate!
          fullName: 'Imposter',
          passwordHash: 'hash',
        })
      ).rejects.toThrow();
    });
  });
});
