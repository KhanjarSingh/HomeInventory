import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { db } from '../config/db';
import { items, locations, itemPlacements, movements } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type {
  ResolvedPlacementDto,
  ItemLocationsSummaryDto,
  ContainerSummaryDto,
} from '@home-inventory/shared';

const extractCookie = (res: request.Response, name: string): string => {
  const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) || [];
  for (const c of cookies) {
    const match = c.match(new RegExp(`${name}=([^;]+)`));
    if (match && match[1]) return match[1];
  }
  return '';
};

describe('Phase 4: Container Nesting & Placement Engine Test Suite', () => {
  const app = createApp();

  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let neighborToken: string;
  let householdId: string;
  let neighborHouseholdId: string;

  // Test Entities
  let livingRoomId: string;
  let bedroomShelfId: string;
  let outerBoxId: string; // Container 1
  let innerBoxId: string; // Container 2
  let testItemId: string;  // Normal Item (Weight Machine or Mouse)
  let splitItemId: string; // Split item (Coffee Mugs)
  let nonContainerItemId: string;

  beforeAll(async () => {
    // 1. Authenticate Owner
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'vithal@tandalwade.local', password: '1973' });
    ownerToken = extractCookie(ownerRes, 'accessToken');
    householdId = ownerRes.body.data.household.id;

    // 2. Authenticate Editor
    const editorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parth@tandalwade.local', password: '2007' });
    editorToken = extractCookie(editorRes, 'accessToken');

    // 3. Authenticate Viewer
    const viewerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'viewer@example.com', password: 'Password123!' });
    viewerToken = extractCookie(viewerRes, 'accessToken');

    // 4. Authenticate Neighbor
    const neighborRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'neighbor@example.com', password: 'Password123!' });
    neighborToken = extractCookie(neighborRes, 'accessToken');
    neighborHouseholdId = neighborRes.body.data.household.id;

    // Clean up any stale test records from previous runs in correct FK order
    const staleItems = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          inArray(items.name, [
            'Large Blue Storage Box',
            'Small Electronics Box',
            'Logitech USB Mouse',
            'Ceramic Coffee Mugs',
            'Heavy Dumbbell',
          ])
        )
      );
    const staleItemIds = staleItems.map((i) => i.id);

    const staleLocations = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          inArray(locations.name, ['Bottom Shelf (Test)', 'Hall (Test)'])
        )
      );
    const staleLocIds = staleLocations.map((l) => l.id);

    if (staleItemIds.length > 0) {
      await db.delete(movements).where(and(eq(movements.householdId, householdId), inArray(movements.itemId, staleItemIds)));
      await db.delete(itemPlacements).where(and(eq(itemPlacements.householdId, householdId), inArray(itemPlacements.itemId, staleItemIds)));
      await db.delete(itemPlacements).where(and(eq(itemPlacements.householdId, householdId), inArray(itemPlacements.containerItemId, staleItemIds)));
      await db.delete(items).where(and(eq(items.householdId, householdId), inArray(items.id, staleItemIds)));
    }

    if (staleLocIds.length > 0) {
      await db.delete(itemPlacements).where(and(eq(itemPlacements.householdId, householdId), inArray(itemPlacements.locationId, staleLocIds)));
      await db.delete(locations).where(and(eq(locations.householdId, householdId), inArray(locations.id, staleLocIds)));
    }

    // 5. Seed Test Locations in Main Household
    const [livingRoom] = await db
      .insert(locations)
      .values({
        householdId,
        name: 'Hall (Test)',
        kind: 'room',
        path: '/hall-test/',
        depth: 0,
      })
      .returning();
    livingRoomId = livingRoom!.id;

    const [bedroomShelf] = await db
      .insert(locations)
      .values({
        householdId,
        parentId: livingRoomId,
        name: 'Bottom Shelf (Test)',
        kind: 'shelf',
        path: '/hall-test/bottom-shelf-test/',
        depth: 1,
      })
      .returning();
    bedroomShelfId = bedroomShelf!.id;

    // 6. Seed Containers and Items
    const [outer] = await db
      .insert(items)
      .values({
        householdId,
        name: 'Large Blue Storage Box',
        isContainer: true,
        totalQuantity: '1',
        unit: 'pcs',
      })
      .returning();
    outerBoxId = outer!.id;

    const [inner] = await db
      .insert(items)
      .values({
        householdId,
        name: 'Small Electronics Box',
        isContainer: true,
        totalQuantity: '1',
        unit: 'pcs',
      })
      .returning();
    innerBoxId = inner!.id;

    const [testItem] = await db
      .insert(items)
      .values({
        householdId,
        name: 'Logitech USB Mouse',
        isContainer: false,
        totalQuantity: '1',
        unit: 'pcs',
      })
      .returning();
    testItemId = testItem!.id;

    const [splitItem] = await db
      .insert(items)
      .values({
        householdId,
        name: 'Ceramic Coffee Mugs',
        isContainer: false,
        totalQuantity: '10',
        unit: 'pcs',
      })
      .returning();
    splitItemId = splitItem!.id;

    const [nonContainer] = await db
      .insert(items)
      .values({
        householdId,
        name: 'Standard Pencil',
        isContainer: false,
        totalQuantity: '5',
        unit: 'pcs',
      })
      .returning();
    nonContainerItemId = nonContainer!.id;
  }, 30000);

  // --- 1. Basic Item Placement in Location ---
  describe('Direct Location Placement', () => {
    let placementId: string;

    it('places an item directly inside a physical location', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          itemId: testItemId,
          locationId: bedroomShelfId,
          quantity: 1,
          notes: 'Placed on test shelf',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      placementId = res.body.data.id;

      const placement: ResolvedPlacementDto = res.body.data;
      expect(placement.locationId).toBe(bedroomShelfId);
      expect(placement.containerItemId).toBeNull();
      expect(placement.quantity).toBe(1);

      // Verify breadcrumbs
      expect(placement.breadcrumbs.length).toBe(2);
      expect(placement.breadcrumbs[0]!.name).toBe('Hall (Test)');
      expect(placement.breadcrumbs[1]!.name).toBe('Bottom Shelf (Test)');
      expect(placement.breadcrumbString).toBe('Hall (Test) → Bottom Shelf (Test)');
    });

    it('retrieves item locations and confirms 0 unplaced stock remaining', async () => {
      const res = await request(app)
        .get(`/api/v1/items/${testItemId}/locations`)
        .set('Cookie', [`accessToken=${editorToken}`]);

      expect(res.status).toBe(200);
      const summary: ItemLocationsSummaryDto = res.body.data;
      expect(summary.totalQuantity).toBe(1);
      expect(summary.placedQuantity).toBe(1);
      expect(summary.unplacedQuantity).toBe(0);
      expect(summary.placements.length).toBe(1);
    });

    it('unplaces item by deleting placement, returning quantity to unplaced stock', async () => {
      const res = await request(app)
        .delete(`/api/v1/placements/${placementId}`)
        .set('Cookie', [`accessToken=${editorToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.unplacedQuantity).toBe(1);

      // Confirm item is now legitimately unplaced
      const checkRes = await request(app)
        .get(`/api/v1/items/${testItemId}/locations`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(checkRes.body.data.placedQuantity).toBe(0);
      expect(checkRes.body.data.unplacedQuantity).toBe(1);
      expect(checkRes.body.data.placements.length).toBe(0);
    });
  });

  // --- 2. Container Nesting Engine: Location -> Container -> Container -> Item ---
  describe('Container Nesting & Full Breadcrumb Resolution', () => {
    let outerPlacementId: string;

    it('places Outer Container inside a physical Location', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          itemId: outerBoxId,
          locationId: bedroomShelfId,
          quantity: 1,
        });

      expect(res.status).toBe(201);
      outerPlacementId = res.body.data.id;
      expect(res.body.data.breadcrumbString).toBe('Hall (Test) → Bottom Shelf (Test)');
    });

    it('nests Inner Container inside Outer Container', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          itemId: innerBoxId,
          containerItemId: outerBoxId,
          quantity: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();

      // Inner container should automatically resolve through Outer Box to physical location!
      const placement: ResolvedPlacementDto = res.body.data;
      expect(placement.breadcrumbString).toBe(
        'Hall (Test) → Bottom Shelf (Test) → Large Blue Storage Box'
      );
    });

    it('places USB Mouse inside Inner Container', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          itemId: testItemId,
          containerItemId: innerBoxId,
          quantity: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();

      // Complete physical breadcrumb:
      // Hall -> Bottom Shelf -> Large Blue Storage Box -> Small Electronics Box
      const placement: ResolvedPlacementDto = res.body.data;
      expect(placement.breadcrumbString).toBe(
        'Hall (Test) → Bottom Shelf (Test) → Large Blue Storage Box → Small Electronics Box'
      );
    });

    it('verifies container contents listing endpoint (GET /api/v1/containers/:id/contents)', async () => {
      const res = await request(app)
        .get(`/api/v1/containers/${outerBoxId}/contents`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.container.name).toBe('Large Blue Storage Box');
      expect(res.body.data.contents.length).toBe(1);
      expect(res.body.data.contents[0].name).toBe('Small Electronics Box');
      expect(res.body.data.contents[0].isContainer).toBe(true);
      expect(res.body.data.contents[0].containedItemCount).toBe(1); // Mouse is inside inner box
    });

    it('automatically updates descendants resolved breadcrumbs when outer container moves', async () => {
      // Move Outer Box from Bedroom Shelf to Living Room
      const moveRes = await request(app)
        .post(`/api/v1/placements/${outerPlacementId}/move`)
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          destinationType: 'location',
          destinationId: livingRoomId,
        });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.data.breadcrumbString).toBe('Hall (Test)');

      // Verify that the USB Mouse (descendant) NOW resolves to the new physical location automatically!
      const mouseLocationsRes = await request(app)
        .get(`/api/v1/items/${testItemId}/locations`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(mouseLocationsRes.status).toBe(200);
      expect(mouseLocationsRes.body.data.placements[0].breadcrumbString).toBe(
        'Hall (Test) → Large Blue Storage Box → Small Electronics Box'
      );
    });
  });

  // --- 3. Circular Nesting & Constraint Protection ---
  describe('Container Cycle & Constraint Prevention', () => {
    it('rejects placing a container inside itself', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          itemId: outerBoxId,
          containerItemId: outerBoxId,
          quantity: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('cannot be placed inside itself');
    });

    it('rejects circular nesting: placing Outer Container inside Inner Container', async () => {
      // Outer Box currently contains Inner Box.
      // Trying to place Outer Box inside Inner Box must be blocked!
      const [outerPlacement] = await db
        .select()
        .from(itemPlacements)
        .where(eq(itemPlacements.itemId, outerBoxId))
        .limit(1);

      const res = await request(app)
        .post(`/api/v1/placements/${outerPlacement!.id}/move`)
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          destinationType: 'container',
          destinationId: innerBoxId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Circular container nesting');
    });

    it('rejects using a non-container item as a container target', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          itemId: testItemId,
          containerItemId: nonContainerItemId, // Standard Pencil is not a container!
          quantity: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not a container');
    });

    it('rejects placement with BOTH locationId and containerItemId', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          itemId: testItemId,
          locationId: livingRoomId,
          containerItemId: outerBoxId,
          quantity: 1,
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('not both');
    });
  });

  // --- 4. Split Quantities & Reconciliation ---
  describe('Split Stock Placements & Stock Reconciliation', () => {
    let placement1Id: string;

    it('supports split placement 1: placing 5 out of 10 coffee mugs in Living Room', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          itemId: splitItemId,
          locationId: livingRoomId,
          quantity: 5,
        });

      expect(res.status).toBe(201);
      placement1Id = res.body.data.id;
    });

    it('supports split placement 2: placing 3 out of 10 coffee mugs on Shelf', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          itemId: splitItemId,
          locationId: bedroomShelfId,
          quantity: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
    });

    it('verifies split reconciliation: 8 placed, 2 unplaced out of 10 total', async () => {
      const res = await request(app)
        .get(`/api/v1/items/${splitItemId}/locations`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      const summary: ItemLocationsSummaryDto = res.body.data;
      expect(summary.totalQuantity).toBe(10);
      expect(summary.placedQuantity).toBe(8);
      expect(summary.unplacedQuantity).toBe(2);
      expect(summary.placements.length).toBe(2);
    });

    it('rejects placement exceeding remaining unplaced stock (trying to place 5 when only 2 available)', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          itemId: splitItemId,
          locationId: bedroomShelfId,
          quantity: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('exceeds available unplaced quantity');
    });

    it('supports partial move: moving 2 out of 5 mugs from Living Room to Shelf', async () => {
      const res = await request(app)
        .post(`/api/v1/placements/${placement1Id}/move`)
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          destinationType: 'location',
          destinationId: bedroomShelfId,
          quantity: 2,
        });

      expect(res.status).toBe(200);

      // Verify total stock remains reconciled to 10: 8 placed (3 + 3 + 2) and 2 unplaced
      const checkRes = await request(app)
        .get(`/api/v1/items/${splitItemId}/locations`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(checkRes.body.data.placedQuantity).toBe(8);
      expect(checkRes.body.data.unplacedQuantity).toBe(2);
    });
  });

  // --- 5. RBAC & Multi-Tenant Household Isolation ---
  describe('RBAC & Household Isolation Enforcement', () => {
    it('Viewer is rejected with 403 Forbidden when creating placements', async () => {
      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${viewerToken}`])
        .send({
          itemId: testItemId,
          locationId: livingRoomId,
          quantity: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Cross-Household Isolation: User in Household B cannot place items in Household A location', async () => {
      // Neighbor (Household B) attempts to place their item inside livingRoomId (Household A)
      const [neighborItem] = await db
        .insert(items)
        .values({
          householdId: neighborHouseholdId,
          name: 'Neighbor Tool',
          totalQuantity: '1',
        })
        .returning();

      const res = await request(app)
        .post('/api/v1/placements')
        .set('Cookie', [`accessToken=${neighborToken}`])
        .send({
          itemId: neighborItem!.id,
          locationId: livingRoomId, // Belongs to Household A!
          quantity: 1,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('lists all containers in household (GET /api/v1/containers)', async () => {
      const res = await request(app)
        .get('/api/v1/containers')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const containerNames = res.body.data.map((c: ContainerSummaryDto) => c.name);
      expect(containerNames).toContain('Large Blue Storage Box');
      expect(containerNames).toContain('Small Electronics Box');
    }, 30000);
  });

  afterAll(async () => {
    const allItemIds = [outerBoxId, innerBoxId, testItemId, splitItemId, nonContainerItemId].filter(Boolean);
    if (allItemIds.length > 0) {
      await db.delete(movements).where(and(eq(movements.householdId, householdId), inArray(movements.itemId, allItemIds)));
      await db.delete(itemPlacements).where(and(eq(itemPlacements.householdId, householdId), inArray(itemPlacements.itemId, allItemIds)));
      await db.delete(items).where(and(eq(items.householdId, householdId), inArray(items.id, allItemIds)));
    }
    const allLocIds = [livingRoomId, bedroomShelfId].filter(Boolean);
    if (allLocIds.length > 0) {
      await db.delete(itemPlacements).where(and(eq(itemPlacements.householdId, householdId), inArray(itemPlacements.locationId, allLocIds)));
      await db.delete(locations).where(and(eq(locations.householdId, householdId), inArray(locations.id, allLocIds)));
    }
  });
});
