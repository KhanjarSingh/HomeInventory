import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { db } from '../config/db';
import { items, locations, itemPlacements, itemImages, movements, categories } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type {
  ItemDetailDto,
  ItemSummaryDto,
  SignedUploadParamsDto,
} from '@home-inventory/shared';

const extractCookie = (res: request.Response, name: string): string => {
  const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) || [];
  for (const c of cookies) {
    const match = c.match(new RegExp(`${name}=([^;]+)`));
    if (match && match[1]) return match[1];
  }
  return '';
};

describe('Phase 5: Photos & Mobile-First Item Capture Test Suite', { timeout: 30000 }, () => {
  const app = createApp();

  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let neighborToken: string;
  let householdId: string;

  let testLocationId: string;
  let testContainerId: string;
  let testCategoryId: string;

  // Track created test item IDs for cleanup
  const createdItemIds: string[] = [];

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

    // 5. Query or seed a test category
    const [existingCat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.householdId, householdId))
      .limit(1);

    if (existingCat) {
      testCategoryId = existingCat.id;
    } else {
      const [newCat] = await db
        .insert(categories)
        .values({
          householdId,
          name: 'Kitchen & Dining Test',
          icon: 'coffee',
          color: '#f59e0b',
        })
        .returning();
      testCategoryId = newCat!.id;
    }

    // 6. Query or seed a test location
    const [existingLoc] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.householdId, householdId), eq(locations.name, 'Kitchen')))
      .limit(1);

    if (existingLoc) {
      testLocationId = existingLoc.id;
    } else {
      const [newLoc] = await db
        .insert(locations)
        .values({
          householdId,
          name: 'Kitchen (Phase 5 Test)',
          kind: 'room',
          path: '/kitchen-p5-test/',
          depth: 0,
        })
        .returning();
      testLocationId = newLoc!.id;
    }

    // 7. Seed a test storage container
    const [container] = await db
      .insert(items)
      .values({
        householdId,
        name: 'Phase 5 Red Plastic Bin',
        isContainer: true,
        totalQuantity: '1',
        unit: 'pcs',
      })
      .returning();
    testContainerId = container!.id;
    createdItemIds.push(testContainerId);

    // Place container in the test location
    await db.insert(itemPlacements).values({
      householdId,
      itemId: testContainerId,
      locationId: testLocationId,
      quantity: '1',
    });
  });

  afterAll(async () => {
    if (createdItemIds.length > 0) {
      await db.delete(itemImages).where(and(eq(itemImages.householdId, householdId), inArray(itemImages.itemId, createdItemIds)));
      await db.delete(movements).where(and(eq(movements.householdId, householdId), inArray(movements.itemId, createdItemIds)));
      await db.delete(itemPlacements).where(and(eq(itemPlacements.householdId, householdId), inArray(itemPlacements.itemId, createdItemIds)));
      await db.delete(items).where(and(eq(items.householdId, householdId), inArray(items.id, createdItemIds)));
    }
  });

  // --- 1. Cloudinary Signed Upload Authorization ---
  describe('Cloudinary Signed Upload Endpoint (POST /api/v1/uploads/sign)', () => {
    it('generates valid Cloudinary signature params for Owner', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/sign')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({ folder: `households/${householdId}/items` });

      expect(res.status).toBe(200);
      const data: SignedUploadParamsDto = res.body.data;
      expect(data.signature).toBeDefined();
      expect(typeof data.signature).toBe('string');
      expect(data.signature.length).toBeGreaterThan(10);
      expect(data.timestamp).toBeDefined();
      expect(data.apiKey).toBeDefined();
      expect(data.cloudName).toBeDefined();
      expect(data.folder).toContain(householdId);

      // SECURITY CRITICAL: api_secret must never be in response
      expect((res.body.data as any).apiSecret).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('XX03Or4ARCe');
    });

    it('generates valid Cloudinary signature params for Editor', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/sign')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.signature).toBeDefined();
    });

    it('rejects Viewer with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/sign')
        .set('Cookie', [`accessToken=${viewerToken}`])
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // --- 2. Categories Listing Endpoint ---
  describe('Categories Endpoint (GET /api/v1/categories)', () => {
    it('lists all categories for the household', async () => {
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const first = res.body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
    });

    it('allows Viewer to view categories (read-only)', async () => {
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Cookie', [`accessToken=${viewerToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // --- 3. Item Creation: Quick Add Workflow ---
  describe('Item Creation & Quick Add (POST /api/v1/items)', () => {
    it('creates an unplaced item with minimum fields', async () => {
      const res = await request(app)
        .post('/api/v1/items')
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          name: 'Milton Steel Thermos Flask',
          categoryId: testCategoryId,
          totalQuantity: 1,
          unit: 'pcs',
        });

      expect(res.status).toBe(201);
      const item: ItemDetailDto = res.body.data;
      expect(item.id).toBeDefined();
      expect(item.name).toBe('Milton Steel Thermos Flask');
      expect(item.totalQuantity).toBe(1);
      expect(item.placedQuantity).toBe(0);
      expect(item.unplacedQuantity).toBe(1);
      expect(item.resolvedPlacements.length).toBe(0);
      createdItemIds.push(item.id);
    });

    it('creates item with photo and direct location placement in one atomic call', async () => {
      const res = await request(app)
        .post('/api/v1/items')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          name: 'Ceramic Pour-Over Coffee Dripper',
          categoryId: testCategoryId,
          totalQuantity: 2,
          unit: 'pcs',
          condition: 'new',
          initialLocationId: testLocationId,
          placementNotes: 'Top rack near grinder',
          initialImage: {
            cloudinaryPublicId: 'inventory/dripper_sample_1',
            url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/coffee.jpg',
            secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/samples/coffee.jpg',
            width: 800,
            height: 600,
            format: 'jpg',
            bytes: 102400,
            kind: 'primary',
            altText: 'Coffee dripper photo',
            isPrimary: true,
          },
        });

      expect(res.status).toBe(201);
      const item: ItemDetailDto = res.body.data;
      expect(item.name).toBe('Ceramic Pour-Over Coffee Dripper');
      expect(item.totalQuantity).toBe(2);
      expect(item.placedQuantity).toBe(2);
      expect(item.unplacedQuantity).toBe(0);

      // Primary cover photo should be attached
      expect(item.primaryImage).toBeDefined();
      expect(item.primaryImage?.cloudinaryPublicId).toBe('inventory/dripper_sample_1');
      expect(item.images?.length).toBe(1);

      // Resolved placement should be present
      expect(item.resolvedPlacements?.length).toBe(1);
      expect(item.resolvedPlacements?.[0]?.locationId).toBe(testLocationId);
      expect(item.resolvedPlacements?.[0]?.notes).toBe('Top rack near grinder');
      createdItemIds.push(item.id);
    });

    it('creates item inside a Storage Container with resolved container breadcrumbs', async () => {
      const res = await request(app)
        .post('/api/v1/items')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          name: 'Reusable Silicone Sipper Straws',
          categoryId: testCategoryId,
          totalQuantity: 6,
          unit: 'pcs',
          initialContainerItemId: testContainerId,
          placementNotes: 'Small pouch inside red bin',
        });

      expect(res.status).toBe(201);
      const item: ItemDetailDto = res.body.data;
      expect(item.name).toBe('Reusable Silicone Sipper Straws');
      expect(item.resolvedPlacements?.length).toBe(1);
      expect(item.resolvedPlacements?.[0]?.containerItemId).toBe(testContainerId);
      // Breadcrumbs should resolve through the red bin container to the location!
      expect(item.resolvedPlacements?.[0]?.breadcrumbString).toContain('Phase 5 Red Plastic Bin');
      createdItemIds.push(item.id);
    });

    it('rejects Viewer with 403 Forbidden on item creation', async () => {
      const res = await request(app)
        .post('/api/v1/items')
        .set('Cookie', [`accessToken=${viewerToken}`])
        .send({
          name: 'Unauthorized Item',
          totalQuantity: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // --- 4. Item Detail & Image Lifecycle ---
  describe('Item Details & Image Management', () => {
    let itemId: string;
    let firstImageId: string;
    let secondImageId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/items')
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({
          name: 'Glass Water Bottle with Bamboo Lid',
          categoryId: testCategoryId,
          totalQuantity: 1,
          unit: 'pcs',
          initialImage: {
            cloudinaryPublicId: 'inventory/bottle_front',
            url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/bottle_front.jpg',
            secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/samples/bottle_front.jpg',
            width: 800,
            height: 1200,
            format: 'jpg',
            bytes: 204800,
            kind: 'primary',
            isPrimary: true,
          },
        });
      itemId = res.body.data.id;
      firstImageId = res.body.data.primaryImage!.id;
      createdItemIds.push(itemId);
    });

    it('retrieves item details with images and placements (GET /api/v1/items/:id)', async () => {
      const res = await request(app)
        .get(`/api/v1/items/${itemId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      const item: ItemDetailDto = res.body.data;
      expect(item.id).toBe(itemId);
      expect(item.name).toBe('Glass Water Bottle with Bamboo Lid');
      expect(item.primaryImage).toBeDefined();
      expect(item.images?.length).toBe(1);
    });

    it('adds a second photo to the item (POST /api/v1/items/:id/images)', async () => {
      const res = await request(app)
        .post(`/api/v1/items/${itemId}/images`)
        .set('Cookie', [`accessToken=${editorToken}`])
        .send({
          cloudinaryPublicId: 'inventory/bottle_lid_detail',
          url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/bottle_lid.jpg',
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/samples/bottle_lid.jpg',
          width: 800,
          height: 800,
          format: 'jpg',
          bytes: 153600,
          kind: 'context',
          isPrimary: false,
        });

      expect(res.status).toBe(201);
      secondImageId = res.body.data.id;
      expect(secondImageId).toBeDefined();
      expect(res.body.data.isPrimary).toBe(false);

      // Verify item now has 2 images
      const checkRes = await request(app)
        .get(`/api/v1/items/${itemId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(checkRes.body.data.images.length).toBe(2);
      expect(checkRes.body.data.primaryImage!.id).toBe(firstImageId);
    });

    it('sets second photo as primary cover photo (PATCH /api/v1/items/:id/images/:imageId/primary)', async () => {
      const res = await request(app)
        .patch(`/api/v1/items/${itemId}/images/${secondImageId}/primary`)
        .set('Cookie', [`accessToken=${ownerToken}`])
        .send({});

      expect(res.status).toBe(200);

      // Verify primary cover changed
      const checkRes = await request(app)
        .get(`/api/v1/items/${itemId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(checkRes.body.data.primaryImage!.id).toBe(secondImageId);
    });

    it('deletes primary photo and automatically promotes remaining photo to primary (DELETE /api/v1/items/:id/images/:imageId)', async () => {
      const res = await request(app)
        .delete(`/api/v1/items/${itemId}/images/${secondImageId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);

      // Verify firstImageId is promoted back to primary cover
      const checkRes = await request(app)
        .get(`/api/v1/items/${itemId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(checkRes.body.data.images.length).toBe(1);
      expect(checkRes.body.data.primaryImage!.id).toBe(firstImageId);
    });

    it('enforces household isolation: neighbor cannot view or modify items', async () => {
      const getRes = await request(app)
        .get(`/api/v1/items/${itemId}`)
        .set('Cookie', [`accessToken=${neighborToken}`]);

      expect(getRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/items/${itemId}/images/${firstImageId}`)
        .set('Cookie', [`accessToken=${neighborToken}`]);

      expect(deleteRes.status).toBe(404);
    });
  });

  // --- 5. Item List & Search ---
  describe('Item List & Filtering (GET /api/v1/items)', () => {
    it('lists all items in the household with thumbnails and breadcrumbs', async () => {
      const res = await request(app)
        .get('/api/v1/items')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const found = res.body.data.find(
        (i: ItemSummaryDto) => i.name === 'Ceramic Pour-Over Coffee Dripper'
      );
      expect(found).toBeDefined();
      expect(found.primaryImage).toBeDefined();
      expect(found.breadcrumbs).toBeDefined();
    });

    it('filters items by search term', async () => {
      const res = await request(app)
        .get('/api/v1/items?search=Pour-Over')
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const item of res.body.data) {
        expect(item.name.toLowerCase()).toContain('pour-over');
      }
    });

    it('filters items by category', async () => {
      const res = await request(app)
        .get(`/api/v1/items?categoryId=${testCategoryId}`)
        .set('Cookie', [`accessToken=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const item of res.body.data) {
        expect(item.categoryId).toBe(testCategoryId);
      }
    });
  });
});
