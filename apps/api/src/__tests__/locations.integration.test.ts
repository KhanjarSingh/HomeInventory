import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { db } from '../config/db';
import { items, itemPlacements, locations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { LocationTreeItemDto, LocationDetailDto } from '@home-inventory/shared';

const extractCookie = (res: request.Response, name: string): string => {
  const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) || [];
  for (const c of cookies) {
    const match = c.match(new RegExp(`${name}=([^;]+)`));
    if (match && match[1]) return match[1];
  }
  return '';
};

describe('Phase 3: Physical Location & Hierarchy Engine Test Suite', () => {
  const app = createApp();

  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let neighborToken: string;
  let neighborHouseholdId: string;

  let createdLocationId: string;
  let childLocationId: string;
  let deepChildLocationId: string;

  beforeAll(async () => {
    // 1. Authenticate Owner
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' });
    ownerToken = extractCookie(ownerRes, 'accessToken');

    // 2. Authenticate Editor
    const editorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'editor@example.com', password: 'Password123!' });
    editorToken = extractCookie(editorRes, 'accessToken');

    // 3. Authenticate Viewer
    const viewerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'viewer@example.com', password: 'Password123!' });
    viewerToken = extractCookie(viewerRes, 'accessToken');

    // 4. Authenticate Neighbor (Isolated household)
    const neighborRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'neighbor@example.com', password: 'Password123!' });
    neighborToken = extractCookie(neighborRes, 'accessToken');
    neighborHouseholdId = neighborRes.body.data.household.id;
  }, 30000);

  // 1. Tree & List Query
  describe('Location Hierarchy Tree (GET /api/v1/locations)', () => {
    it('returns the 7 major top-level real-home areas at depth 0', async () => {
      const res = await request(app)
        .get('/api/v1/locations')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      const tree: LocationTreeItemDto[] = res.body.data;

      const topLevelNames = tree.map((node) => node.name);
      expect(topLevelNames).toContain('Small Bedroom');
      expect(topLevelNames).toContain('Big Bedroom');
      expect(topLevelNames).toContain('Hall');
      expect(topLevelNames).toContain('Passage');
      expect(topLevelNames).toContain('Kitchen');
      expect(topLevelNames).toContain('Store Room');
      expect(topLevelNames).toContain('Attic / Roof');

      // Verify all root nodes have depth 0 and parentId null
      for (const node of tree) {
        expect(node.depth).toBe(0);
        expect(node.parentId).toBeNull();
      }
    });

    it('verifies nested children and subtree counts for Big Bedroom', async () => {
      const res = await request(app)
        .get('/api/v1/locations')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      const tree: LocationTreeItemDto[] = res.body.data;
      const bigBedroom = tree.find((n) => n.name === 'Big Bedroom');
      expect(bigBedroom).toBeDefined();

      // Big Bedroom should have nested furniture / wardrobes
      expect(bigBedroom!.children.length).toBeGreaterThanOrEqual(2);
      const wardrobe = bigBedroom!.children.find((c) => c.name === 'Wardrobe');
      expect(wardrobe).toBeDefined();

      // Wardrobe should have shelves
      expect(wardrobe!.children.length).toBeGreaterThanOrEqual(2);
      const bottomShelf = wardrobe!.children.find((s) => s.name === 'Bottom Shelf');
      expect(bottomShelf).toBeDefined();

      // Verify subtree counts roll up to root
      expect(bigBedroom!.subtreeItemCount).toBeGreaterThan(0);
      expect(bigBedroom!.subtreeContainerCount).toBeGreaterThan(0);
    });

    it('allows read-only viewer to view location tree', async () => {
      const res = await request(app)
        .get('/api/v1/locations')
        .set('Cookie', [`accessToken=${viewerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(7);
    });
  });

  // 2. Location Detail Query
  describe('Location Detail & Breadcrumbs (GET /api/v1/locations/:id)', () => {
    it('returns location detail, physical breadcrumb trail, direct items, and containers', async () => {
      // Find "Bottom Shelf" ID from tree
      const treeRes = await request(app)
        .get('/api/v1/locations')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      const tree: LocationTreeItemDto[] = treeRes.body.data;
      const bigBedroom = tree.find((n) => n.name === 'Big Bedroom')!;
      const wardrobe = bigBedroom.children.find((c) => c.name === 'Wardrobe')!;
      const bottomShelf = wardrobe.children.find((s) => s.name === 'Bottom Shelf')!;

      const detailRes = await request(app)
        .get(`/api/v1/locations/${bottomShelf.id}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(detailRes.status).toBe(200);
      const detail: LocationDetailDto = detailRes.body.data;

      // 1. Breadcrumb trail: Big Bedroom -> Wardrobe -> Bottom Shelf
      expect(detail.breadcrumbs.length).toBe(3);
      expect(detail.breadcrumbs[0]!.name).toBe('Big Bedroom');
      expect(detail.breadcrumbs[1]!.name).toBe('Wardrobe');
      expect(detail.breadcrumbs[2]!.name).toBe('Bottom Shelf');

      // 2. Direct items placed on bottom shelf: HealthSense Weight Machine
      const directItemNames = detail.directItems.map((i) => i.displayName || i.name);
      expect(directItemNames).toContain('Weight Machine');

      // 3. Direct containers placed on bottom shelf: Large Blue Storage Box
      const containerNames = detail.directContainers.map((c) => c.displayName || c.name);
      expect(containerNames).toContain('Large Blue Storage Box');

      // 4. Large Blue Storage Box should contain the nested container
      const blueBox = detail.directContainers.find((c) => c.name.includes('Large Blue Storage Box'));
      expect(blueBox).toBeDefined();
      expect(blueBox!.containedItemCount).toBeGreaterThanOrEqual(1);

      // 5. Summary counts
      expect(detail.summary.directItemCount).toBeGreaterThanOrEqual(1);
      expect(detail.summary.directContainerCount).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent location ID', async () => {
      const res = await request(app)
        .get('/api/v1/locations/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // 3. Location Creation & Arbitrary Nesting Depth
  describe('Location Creation (POST /api/v1/locations)', () => {
    it('creates a new top-level room (depth 0)', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          name: 'Balcony Garden',
          kind: 'room',
          description: 'South-facing balcony with plant racks',
          color: '#10b981',
          icon: 'flower',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Balcony Garden');
      expect(res.body.data.depth).toBe(0);
      expect(res.body.data.parentId).toBeNull();
      expect(res.body.data.path).toContain('/balcony-garden-');

      createdLocationId = res.body.data.id;
    });

    it('creates a child location under the new room (depth 1)', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          parentId: createdLocationId,
          name: 'Green Planter Stand',
          kind: 'rack',
          description: '3-tier iron plant stand',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.parentId).toBe(createdLocationId);
      expect(res.body.data.depth).toBe(1);

      childLocationId = res.body.data.id;
    });

    it('creates an arbitrary deep descendant (depth 2)', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          parentId: childLocationId,
          name: 'Top Tier Shelf',
          kind: 'shelf',
          description: 'Top shelf of plant stand for succulents',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.parentId).toBe(childLocationId);
      expect(res.body.data.depth).toBe(2);

      deepChildLocationId = res.body.data.id;
    });

    it('rejects creation with invalid/non-existent parent ID', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          parentId: '00000000-0000-0000-0000-000000000000',
          name: 'Ghost Location',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Parent location does not exist');
    });
  });

  // 4. Location Metadata Update
  describe('Location Metadata Update (PATCH /api/v1/locations/:id)', () => {
    it('updates location name, kind, notes, and icon', async () => {
      const res = await request(app)
        .patch(`/api/v1/locations/${createdLocationId}`)
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          name: 'Main Balcony Garden',
          description: 'Updated balcony description',
          notes: 'Water plants every morning',
          kind: 'storage_area',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Main Balcony Garden');
      expect(res.body.data.kind).toBe('storage_area');
      expect(res.body.data.notes).toBe('Water plants every morning');
    });
  });

  // 5. Reparenting & Cycle Prevention
  describe('Reparenting & Cycle Prevention (POST /api/v1/locations/:id/reparent)', () => {
    it('moves a location under a new parent and cascades path updates to descendants', async () => {
      // Find Kitchen ID
      const treeRes = await request(app)
        .get('/api/v1/locations')
        .set('Cookie', [`accessToken=${ownerToken}`]);
      const kitchen = treeRes.body.data.find((n: LocationTreeItemDto) => n.name === 'Kitchen')!;

      // Move `Green Planter Stand` (childLocationId) from `Main Balcony Garden` to `Kitchen`
      const reparentRes = await request(app)
        .post(`/api/v1/locations/${childLocationId}/reparent`)
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({ newParentId: kitchen.id });

      expect(reparentRes.status).toBe(200);
      expect(reparentRes.body.data.parentId).toBe(kitchen.id);
      expect(reparentRes.body.data.depth).toBe(1);
      expect(reparentRes.body.data.path).toContain(kitchen.path);

      // Verify that descendant `Top Tier Shelf` (deepChildLocationId) path and depth cascaded
      const deepRes = await request(app)
        .get(`/api/v1/locations/${deepChildLocationId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(deepRes.status).toBe(200);
      expect(deepRes.body.data.location.depth).toBe(2);
      expect(deepRes.body.data.location.path).toContain(kitchen.path);
    });

    it('rejects self-parenting (newParentId === locationId)', async () => {
      const res = await request(app)
        .post(`/api/v1/locations/${childLocationId}/reparent`)
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({ newParentId: childLocationId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('cannot be its own parent');
    });

    it('rejects circular hierarchy: moving a parent location under its own descendant', async () => {
      // Attempt to move `Green Planter Stand` under its own child `Top Tier Shelf`
      const res = await request(app)
        .post(`/api/v1/locations/${childLocationId}/reparent`)
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({ newParentId: deepChildLocationId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('circular hierarchy detected');
    });

    it('supports moving a location to the top-level root (newParentId: null)', async () => {
      const res = await request(app)
        .post(`/api/v1/locations/${childLocationId}/reparent`)
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({ newParentId: null });

      expect(res.status).toBe(200);
      expect(res.body.data.parentId).toBeNull();
      expect(res.body.data.depth).toBe(0);
    });
  });

  // 6. Multi-Tenant Household Isolation
  describe('Multi-Tenant Household Isolation', () => {
    it('prevents user in Household A from viewing locations in Household B', async () => {
      // Neighbor tries to access `createdLocationId` (owned by main household)
      const res = await request(app)
        .get(`/api/v1/locations/${createdLocationId}`)
        .set('Cookie', [`accessToken=${neighborToken}`]);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Location not found in this household');
    });

    it('prevents user in Household A from reparenting to a parent in Household B', async () => {
      // Owner of main household tries to reparent a location to `neighborHouseholdId`
      const res = await request(app)
        .post(`/api/v1/locations/${createdLocationId}/reparent`)
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({ newParentId: neighborHouseholdId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Destination parent location not found in this household');
    });
  });

  // 7. Role-Based Access Control (RBAC)
  describe('Role-Based Access Control (RBAC)', () => {
    it('rejects Viewer from creating locations (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Cookie', [`accessToken=${viewerToken}`])
        .send({ name: 'Unauthorized Viewer Room' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects Viewer from updating locations (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/locations/${createdLocationId}`)
        .set('Cookie', [`accessToken=${viewerToken}`])
        .send({ name: 'Tampered Room Name' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects Viewer from reparenting locations (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/locations/${createdLocationId}/reparent`)
        .set('Cookie', [`accessToken=${viewerToken}`])
        .send({ newParentId: null });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects Viewer from deleting locations (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/locations/${createdLocationId}`)
        .set('Cookie', [`accessToken=${viewerToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // 8. Safe Archive & Deletion
  describe('Safe Location Archiving and Deletion (DELETE /api/v1/locations/:id)', () => {
    it('safely archives a location when items/containers are placed within it', async () => {
      // 1. Create a dedicated test location
      const locRes = await request(app)
        .post('/api/v1/locations')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({ name: 'Archive Test Area', kind: 'storage_area' });

      expect(locRes.status).toBe(201);
      const testLocId = locRes.body.data.id;
      const hId = locRes.body.data.householdId;

      // 2. Place a test item in it
      const [testItem] = await db
        .select()
        .from(items)
        .where(and(eq(items.householdId, hId), eq(items.isContainer, false)))
        .limit(1);

      const [tempPlacement] = await db
        .insert(itemPlacements)
        .values({
          householdId: hId,
          itemId: testItem!.id,
          locationId: testLocId,
          quantity: '1',
        })
        .returning();

      // 3. Delete location -> Must be safely archived rather than hard deleted
      const res = await request(app)
        .delete(`/api/v1/locations/${testLocId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.action).toBe('archived');

      // Cleanup test placement and location
      await db.delete(itemPlacements).where(eq(itemPlacements.id, tempPlacement!.id));
      await db.delete(locations).where(eq(locations.id, testLocId));
    });

    it('completely deletes an empty location with no placed items', async () => {
      // `createdLocationId` (Balcony Garden) has no placed items
      const res = await request(app)
        .delete(`/api/v1/locations/${createdLocationId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.action).toBe('deleted');
    });
  });
}, 30000);
