import { describe, it, expect, beforeAll } from 'vitest';
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
      .where(eq(households.name, "Tandalwade's Residency"));
    const [neighbor] = await db
      .select()
      .from(households)
      .where(eq(households.name, 'Patel Home (Neighbor)'));

    expect(main).toBeDefined();
    expect(neighbor).toBeDefined();

    mainHouseholdId = main!.id;
    neighborHouseholdId = neighbor!.id;
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

  // 2. Real-Home Physical Hierarchy & Arbitrary Depth
  describe('Real-Home Physical Hierarchy & Structure', () => {
    it('verifies all major top-level home locations exist as dynamic household records', async () => {
      const topLocations = await db
        .select()
        .from(locations)
        .where(and(eq(locations.householdId, mainHouseholdId), eq(locations.depth, 0)));

      const names = topLocations.map((l) => l.name);
      expect(names).toContain('Small Bedroom');
      expect(names).toContain('Big Bedroom');
      expect(names).toContain('Hall');
      expect(names).toContain('Passage');
      expect(names).toContain('Kitchen');
      expect(names).toContain('Store Room');
      expect(names).toContain('Attic / Roof');
    });

    it('verifies multi-level nesting depth (Room -> Furniture -> Shelf / Drawer)', async () => {
      const allLocations = await db
        .select()
        .from(locations)
        .where(eq(locations.householdId, mainHouseholdId));

      const depth0 = allLocations.filter((l) => l.depth === 0);
      const depth1 = allLocations.filter((l) => l.depth === 1);
      const depth2 = allLocations.filter((l) => l.depth === 2);

      expect(depth0.length).toBeGreaterThanOrEqual(7);
      expect(depth1.length).toBeGreaterThanOrEqual(8);
      expect(depth2.length).toBeGreaterThanOrEqual(8);

      // Verify specific path nesting
      const bbWardrobeBottom = allLocations.find(
        (l) => l.name === 'Bottom Shelf' && l.path.includes('/big-bedroom/')
      );
      expect(bbWardrobeBottom).toBeDefined();
      expect(bbWardrobeBottom!.depth).toBe(2);
      expect(bbWardrobeBottom!.path).toMatch(/^\/big-bedroom\/[a-f0-9-]+\/wardrobe\/[a-f0-9-]+\/bottom-shelf\/$/);

      const sbDrawer1 = allLocations.find(
        (l) => l.name === 'Drawer 1' && l.path.includes('/small-bedroom/')
      );
      expect(sbDrawer1).toBeDefined();
      expect(sbDrawer1!.kind).toBe('drawer');
      expect(sbDrawer1!.depth).toBe(2);
    });

    it('strictly preserves the Location vs Container distinction', async () => {
      // 1. Containers must exist in `items` table with is_container = true
      const containers = await db
        .select()
        .from(items)
        .where(and(eq(items.householdId, mainHouseholdId), eq(items.isContainer, true)));

      const containerNames = containers.map((c) => c.displayName || c.name);
      expect(containerNames).toContain('Large Blue Storage Box');
      expect(containerNames).toContain('Small Electronics Box');
      expect(containerNames).toContain('Clear Box (Medium)');
      expect(containerNames).toContain('Black Duffel Bag');

      // 2. None of these containers should exist in `locations` table!
      const locationNames = (
        await db.select().from(locations).where(eq(locations.householdId, mainHouseholdId))
      ).map((l) => l.name);

      expect(locationNames).not.toContain('Large Blue Storage Box');
      expect(locationNames).not.toContain('Small Electronics Box');
    });
  });

  // 3. User Scenario: USB Mouse in Nested Container Chain to Physical Shelf
  describe('Nested Container Resolution & Breadcrumbs', () => {
    it('resolves complete physical hierarchy for USB Mouse: Mouse -> Small Box -> Large Blue Box -> Big Bedroom -> Wardrobe -> Bottom Shelf', async () => {
      const [mouse] = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.householdId, mainHouseholdId),
            eq(items.displayName, 'USB Mouse')
          )
        );

      expect(mouse).toBeDefined();

      // Recursive CTE to trace: Item -> Container 1 -> Container 2 -> Location -> Ancestor Locations
      const chain = await sql`
        WITH RECURSIVE container_hierarchy AS (
          -- Step 1: Base item placement
          SELECT
            ip.item_id,
            ip.container_item_id,
            ip.location_id,
            1 as level
          FROM item_placements ip
          WHERE ip.item_id = ${mouse!.id}

          UNION ALL

          -- Step 2: Trace upward through parent container items
          SELECT
            parent_item.id as item_id,
            parent_ip.container_item_id,
            parent_ip.location_id,
            ch.level + 1
          FROM container_hierarchy ch
          JOIN items parent_item ON parent_item.id = ch.container_item_id
          JOIN item_placements parent_ip ON parent_ip.item_id = parent_item.id
          WHERE ch.container_item_id IS NOT NULL
        )
        SELECT
          ch.level,
          c_item.display_name as container_name,
          loc.name as location_name,
          loc.path as location_path
        FROM container_hierarchy ch
        LEFT JOIN items c_item ON c_item.id = ch.container_item_id
        LEFT JOIN locations loc ON loc.id = ch.location_id
        ORDER BY ch.level ASC;
      `;

      expect(chain.length).toBe(3);
      // Level 1: placed in container 'Small Electronics Box'
      expect(chain[0]!.container_name).toBe('Small Electronics Box');
      // Level 2: 'Small Electronics Box' is placed in container 'Large Blue Storage Box'
      expect(chain[1]!.container_name).toBe('Large Blue Storage Box');
      // Level 3: 'Large Blue Storage Box' resolves to physical location 'Bottom Shelf' in Big Bedroom
      expect(chain[2]!.location_name).toBe('Bottom Shelf');
      expect(chain[2]!.location_path).toContain('/big-bedroom/');
    });
  });

  // 4. Subtree Queries for Major Home Locations
  describe('Major Locations Subtree Resolution', () => {
    it('queries all items inside Big Bedroom (direct on furniture and inside containers)', async () => {
      const bigBedroomItems = await sql`
        WITH RECURSIVE resolved_placements AS (
          -- Placements directly targeting a location
          SELECT ip.item_id, ip.location_id
          FROM item_placements ip
          WHERE ip.household_id = ${mainHouseholdId} AND ip.location_id IS NOT NULL

          UNION ALL

          -- Placements targeting a container that is placed somewhere
          SELECT child_ip.item_id, parent_rp.location_id
          FROM item_placements child_ip
          JOIN resolved_placements parent_rp ON parent_rp.item_id = child_ip.container_item_id
          WHERE child_ip.container_item_id IS NOT NULL
        )
        SELECT DISTINCT i.name, i.display_name
        FROM resolved_placements rp
        JOIN items i ON i.id = rp.item_id
        JOIN locations l ON l.id = rp.location_id
        WHERE l.path LIKE '/big-bedroom/%';
      `;

      const itemNames = bigBedroomItems.map((r) => r.display_name || r.name);
      // Directly on bottom shelf:
      expect(itemNames).toContain('Weight Machine');
      // Directly on study desk:
      expect(itemNames).toContain('Logitech MX Master 3S Wireless Performance Mouse');
      // Inside container inside wardrobe:
      expect(itemNames).toContain('Large Blue Storage Box');
      // Inside nested container inside large blue box:
      expect(itemNames).toContain('USB Mouse');
      expect(itemNames).toContain('Anker PowerLine III USB-C to USB-C Cable 2m');
    });

    it('queries all items inside Store Room across racks and shelves', async () => {
      const storeItems = await sql`
        SELECT DISTINCT i.name
        FROM items i
        JOIN item_placements ip ON ip.item_id = i.id
        JOIN locations l ON l.id = ip.location_id
        WHERE ip.household_id = ${mainHouseholdId}
          AND l.path LIKE '/store-room/%';
      `;

      const names = storeItems.map((r) => r.name);
      expect(names).toContain('Samsonite Omni 28" Hardside Spinner Trolley Bag');
      expect(names).toContain('Moleskine Classic Hardcover Ruled Notebook - Large');
      expect(names).toContain('Medium Transparent Storage Box 30L');
    });

    it('queries all items inside Attic / Roof (storage area & rack)', async () => {
      const atticItems = await sql`
        SELECT DISTINCT i.name
        FROM items i
        JOIN item_placements ip ON ip.item_id = i.id
        JOIN locations l ON l.id = ip.location_id
        WHERE ip.household_id = ${mainHouseholdId}
          AND l.path LIKE '/attic-roof/%';
      `;

      const names = atticItems.map((r) => r.name);
      expect(names).toContain('Warm White Waterproof LED Fairy String Lights 50m');
      expect(names).toContain('Coleman Multi-Panel Rechargeable LED Camping Lantern');
    });

    it('queries Passage storage area for household cleaning items', async () => {
      const passageItems = await sql`
        SELECT DISTINCT i.name
        FROM items i
        JOIN item_placements ip ON ip.item_id = i.id
        JOIN locations l ON l.id = ip.location_id
        WHERE ip.household_id = ${mainHouseholdId}
          AND l.path LIKE '/passage/%';
      `;

      const names = passageItems.map((r) => r.name);
      expect(names).toContain('Eureka Forbes Quick Clean DX Vacuum Cleaner');
    });
  });

  // 5. Reparenting & Cycle Prevention Logic
  describe('Location Reparenting & Cycle Prevention Logic', () => {
    it('correctly detects cycle if attempting to reparent a node under its own descendant', async () => {
      const [bb] = await db
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.name, 'Big Bedroom'),
            eq(locations.householdId, mainHouseholdId)
          )
        );
      const [wardrobe] = await db
        .select()
        .from(locations)
        .where(and(eq(locations.name, 'Wardrobe'), eq(locations.parentId, bb!.id)));
      const [bottomShelf] = await db
        .select()
        .from(locations)
        .where(and(eq(locations.name, 'Bottom Shelf'), eq(locations.parentId, wardrobe!.id)));

      expect(bb).toBeDefined();
      expect(wardrobe).toBeDefined();
      expect(bottomShelf).toBeDefined();

      // In Phase 3 reparenting: To move node A under node B:
      // Cycle rule: Destination B's path MUST NOT start with Source A's path!
      const isCycle = (sourcePath: string, destPath: string): boolean => {
        return destPath.startsWith(sourcePath);
      };

      // Moving Wardrobe under Bottom Shelf:
      // Wardrobe path: '/big-bedroom/<id>/wardrobe/'
      // Bottom Shelf path: '/big-bedroom/<id>/wardrobe/<id>/bottom-shelf/'
      expect(isCycle(wardrobe!.path, bottomShelf!.path)).toBe(true);

      // Moving Bedside Table under Wardrobe (valid, not a cycle):
      const [bedsideTable] = await db
        .select()
        .from(locations)
        .where(and(eq(locations.name, 'Bedside Table'), eq(locations.parentId, bb!.id)));
      expect(isCycle(bedsideTable!.path, wardrobe!.path)).toBe(false);
    });
  });

  // 6. Multi-Tenant Household Isolation
  describe('Multi-Tenant Household Isolation', () => {
    it('prevents cross-household placement: Household A placement referencing Household B location', async () => {
      const [itemA] = await db
        .insert(items)
        .values({
          householdId: mainHouseholdId,
          name: 'Isolation Test Item A',
          totalQuantity: '1',
        })
        .returning();

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

      // Attempting cross-household reference throws FK violation
      await expect(
        db.insert(itemPlacements).values({
          householdId: mainHouseholdId,
          itemId: itemA!.id,
          locationId: locationB!.id,
          quantity: '1',
        })
      ).rejects.toThrow();

      await db.delete(items).where(eq(items.id, itemA!.id));
      await db.delete(locations).where(eq(locations.id, locationB!.id));
    });
  });

  // 7. Placement Target XOR Rules
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
          containerItemId: container!.id,
          quantity: '1',
        })
      ).rejects.toThrow();
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
          containerItemId: null,
          quantity: '1',
        })
      ).rejects.toThrow();
    });
  });

  // 8. Self-Containment Prevention
  describe('Self-Containment Prevention', () => {
    it('rejects an item being placed inside itself (chk_placement_not_self)', async () => {
      const [container] = await db
        .select()
        .from(items)
        .where(and(eq(items.householdId, mainHouseholdId), eq(items.isContainer, true)))
        .limit(1);

      await expect(
        db.insert(itemPlacements).values({
          householdId: mainHouseholdId,
          itemId: container!.id,
          containerItemId: container!.id,
          quantity: '1',
        })
      ).rejects.toThrow();
    });
  });

  // 9. Quantity Rules & Legitimate Unplaced Items
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
          quantity: '0',
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

  // 10. Unique Constraints
  describe('Unique Constraints', () => {
    it('enforces unique category name per household', async () => {
      await expect(
        db.insert(categories).values({
          householdId: mainHouseholdId,
          name: 'Kitchen & Dining',
        })
      ).rejects.toThrow();
    });

    it('enforces unique tag name per household', async () => {
      await expect(
        db.insert(tags).values({
          householdId: mainHouseholdId,
          name: 'fragile',
        })
      ).rejects.toThrow();
    });

    it('enforces unique user email globally', async () => {
      await expect(
        db.insert(users).values({
          email: 'vithal@tandalwade.local',
          fullName: 'Imposter',
          passwordHash: 'hash',
        })
      ).rejects.toThrow();
    });
  });
});
