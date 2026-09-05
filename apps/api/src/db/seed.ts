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

    const defaultPasswordHash = await argon2.hash('Password123!');

    // 2. Create Users
    const [ownerUser] = await db
      .insert(users)
      .values({
        email: 'owner@example.com',
        passwordHash: defaultPasswordHash,
        fullName: 'Aarav Sharma (Owner)',
      })
      .returning();

    const [editorUser] = await db
      .insert(users)
      .values({
        email: 'editor@example.com',
        passwordHash: defaultPasswordHash,
        fullName: 'Priya Sharma (Editor)',
      })
      .returning();

    const [viewerUser] = await db
      .insert(users)
      .values({
        email: 'viewer@example.com',
        passwordHash: defaultPasswordHash,
        fullName: 'Rohan Sharma (Viewer)',
      })
      .returning();

    // Isolated user in second household (for multi-tenant isolation tests)
    const [neighborUser] = await db
      .insert(users)
      .values({
        email: 'neighbor@example.com',
        passwordHash: defaultPasswordHash,
        fullName: 'Vikram Patel',
      })
      .returning();

    if (!ownerUser || !editorUser || !viewerUser || !neighborUser) {
      throw new Error('Failed to create users');
    }

    // 3. Create Households & Members
    const [mainHousehold] = await db
      .insert(households)
      .values({ name: 'The Sharma Residence' })
      .returning();

    const [neighborHousehold] = await db
      .insert(households)
      .values({ name: 'Patel Home (Neighbor)' })
      .returning();

    if (!mainHousehold || !neighborHousehold) {
      throw new Error('Failed to create households');
    }

    await db.insert(householdMembers).values([
      { householdId: mainHousehold.id, userId: ownerUser.id, role: 'owner' },
      { householdId: mainHousehold.id, userId: editorUser.id, role: 'editor' },
      { householdId: mainHousehold.id, userId: viewerUser.id, role: 'viewer' },
      { householdId: neighborHousehold.id, userId: neighborUser.id, role: 'owner' },
    ]);

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

    // --- Depth 0: Rooms ---
    const [smallBedroom] = await db.insert(locations).values({
      householdId: hId,
      name: 'Small Bedroom',
      kind: 'room',
      icon: 'bed-single',
      color: '#60a5fa',
      path: '/small-bedroom/',
      depth: 0,
      sortOrder: 1,
    }).returning();

    const [bigBedroom] = await db.insert(locations).values({
      householdId: hId,
      name: 'Big Bedroom',
      kind: 'room',
      icon: 'bed-double',
      color: '#3b82f6',
      path: '/big-bedroom/',
      depth: 0,
      sortOrder: 2,
    }).returning();

    const [hall] = await db.insert(locations).values({
      householdId: hId,
      name: 'Hall',
      kind: 'room',
      icon: 'sofa',
      color: '#10b981',
      path: '/hall/',
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

    const [storeRoom] = await db.insert(locations).values({
      householdId: hId,
      name: 'Store Room',
      kind: 'room',
      icon: 'archive',
      color: '#64748b',
      path: '/store-room/',
      depth: 0,
      sortOrder: 6,
    }).returning();

    const [atticRoof] = await db.insert(locations).values({
      householdId: hId,
      name: 'Attic / Roof',
      kind: 'room',
      icon: 'warehouse',
      color: '#a855f7',
      path: '/attic-roof/',
      depth: 0,
      sortOrder: 7,
    }).returning();

    if (!smallBedroom || !bigBedroom || !hall || !passage || !kitchen || !storeRoom || !atticRoof) {
      throw new Error('Failed to create top-level home locations');
    }

    // --- Depth 1 & 2: Small Bedroom Hierarchy ---
    // Small Bedroom -> Wardrobe -> Top, Middle, Bottom Shelf
    const [sbWardrobe] = await db.insert(locations).values({
      householdId: hId,
      parentId: smallBedroom.id,
      name: 'Wardrobe',
      kind: 'wardrobe',
      path: `/small-bedroom/${smallBedroom.id}/wardrobe/`,
      depth: 1,
    }).returning();

    const [sbWardrobeTop] = await db.insert(locations).values({
      householdId: hId,
      parentId: sbWardrobe!.id,
      name: 'Top Shelf',
      kind: 'shelf',
      path: `/small-bedroom/${smallBedroom.id}/wardrobe/${sbWardrobe!.id}/top-shelf/`,
      depth: 2,
    }).returning();

    await db.insert(locations).values([
      {
        householdId: hId,
        parentId: sbWardrobe!.id,
        name: 'Middle Shelf',
        kind: 'shelf',
        path: `/small-bedroom/${smallBedroom.id}/wardrobe/${sbWardrobe!.id}/middle-shelf/`,
        depth: 2,
      },
      {
        householdId: hId,
        parentId: sbWardrobe!.id,
        name: 'Bottom Shelf',
        kind: 'shelf',
        path: `/small-bedroom/${smallBedroom.id}/wardrobe/${sbWardrobe!.id}/bottom-shelf/`,
        depth: 2,
      },
    ]);

    // Small Bedroom -> Bedside Table -> Drawer 1, Drawer 2
    const [sbBedsideTable] = await db.insert(locations).values({
      householdId: hId,
      parentId: smallBedroom.id,
      name: 'Bedside Table',
      kind: 'furniture',
      path: `/small-bedroom/${smallBedroom.id}/bedside-table/`,
      depth: 1,
    }).returning();

    const [sbDrawer1] = await db.insert(locations).values({
      householdId: hId,
      parentId: sbBedsideTable!.id,
      name: 'Drawer 1',
      kind: 'drawer',
      path: `/small-bedroom/${smallBedroom.id}/bedside-table/${sbBedsideTable!.id}/drawer-1/`,
      depth: 2,
    }).returning();

    await db.insert(locations).values({
      householdId: hId,
      parentId: sbBedsideTable!.id,
      name: 'Drawer 2',
      kind: 'drawer',
      path: `/small-bedroom/${smallBedroom.id}/bedside-table/${sbBedsideTable!.id}/drawer-2/`,
      depth: 2,
    });

    // --- Depth 1 & 2: Big Bedroom Hierarchy ---
    // Big Bedroom -> Wardrobe -> Top, Middle, Bottom Shelf
    const [bbWardrobe] = await db.insert(locations).values({
      householdId: hId,
      parentId: bigBedroom.id,
      name: 'Wardrobe',
      kind: 'wardrobe',
      path: `/big-bedroom/${bigBedroom.id}/wardrobe/`,
      depth: 1,
    }).returning();

    const [bbWardrobeTop] = await db.insert(locations).values({
      householdId: hId,
      parentId: bbWardrobe!.id,
      name: 'Top Shelf',
      kind: 'shelf',
      path: `/big-bedroom/${bigBedroom.id}/wardrobe/${bbWardrobe!.id}/top-shelf/`,
      depth: 2,
    }).returning();

    await db.insert(locations).values({
      householdId: hId,
      parentId: bbWardrobe!.id,
      name: 'Middle Shelf',
      kind: 'shelf',
      path: `/big-bedroom/${bigBedroom.id}/wardrobe/${bbWardrobe!.id}/middle-shelf/`,
      depth: 2,
    });

    const [bbWardrobeBottom] = await db.insert(locations).values({
      householdId: hId,
      parentId: bbWardrobe!.id,
      name: 'Bottom Shelf',
      kind: 'shelf',
      path: `/big-bedroom/${bigBedroom.id}/wardrobe/${bbWardrobe!.id}/bottom-shelf/`,
      depth: 2,
    }).returning();

    // Big Bedroom -> Bedside Table & Study Desk
    await db.insert(locations).values({
      householdId: hId,
      parentId: bigBedroom.id,
      name: 'Bedside Table',
      kind: 'furniture',
      path: `/big-bedroom/${bigBedroom.id}/bedside-table/`,
      depth: 1,
    });

    const [bbStudyDesk] = await db.insert(locations).values({
      householdId: hId,
      parentId: bigBedroom.id,
      name: 'Study Desk',
      kind: 'furniture',
      path: `/big-bedroom/${bigBedroom.id}/study-desk/`,
      depth: 1,
    }).returning();

    // --- Depth 1 & 2: Hall Hierarchy ---
    // Hall -> TV Unit -> Shelf 1, Shelf 2
    const [hallTvUnit] = await db.insert(locations).values({
      householdId: hId,
      parentId: hall.id,
      name: 'TV Unit',
      kind: 'furniture',
      path: `/hall/${hall.id}/tv-unit/`,
      depth: 1,
    }).returning();

    const [hallTvShelf1] = await db.insert(locations).values({
      householdId: hId,
      parentId: hallTvUnit!.id,
      name: 'Shelf 1',
      kind: 'shelf',
      path: `/hall/${hall.id}/tv-unit/${hallTvUnit!.id}/shelf-1/`,
      depth: 2,
    }).returning();

    await db.insert(locations).values([
      {
        householdId: hId,
        parentId: hallTvUnit!.id,
        name: 'Shelf 2',
        kind: 'shelf',
        path: `/hall/${hall.id}/tv-unit/${hallTvUnit!.id}/shelf-2/`,
        depth: 2,
      },
      {
        householdId: hId,
        parentId: hall.id,
        name: 'Cabinet',
        kind: 'cabinet',
        path: `/hall/${hall.id}/cabinet/`,
        depth: 1,
      },
    ]);

    // --- Depth 1: Passage Hierarchy ---
    const [passageStorage] = await db.insert(locations).values({
      householdId: hId,
      parentId: passage.id,
      name: 'Storage Area',
      kind: 'storage_area',
      path: `/passage/${passage.id}/storage-area/`,
      depth: 1,
    }).returning();

    // --- Depth 1 & 2: Kitchen Hierarchy ---
    // Kitchen -> Cabinet -> Shelf 1, Shelf 2
    const [kitchenCabinet] = await db.insert(locations).values({
      householdId: hId,
      parentId: kitchen.id,
      name: 'Cabinet',
      kind: 'cabinet',
      path: `/kitchen/${kitchen.id}/cabinet/`,
      depth: 1,
    }).returning();

    const [kitchenCabShelf1] = await db.insert(locations).values({
      householdId: hId,
      parentId: kitchenCabinet!.id,
      name: 'Shelf 1',
      kind: 'shelf',
      path: `/kitchen/${kitchen.id}/cabinet/${kitchenCabinet!.id}/shelf-1/`,
      depth: 2,
    }).returning();

    const [kitchenCabShelf2] = await db.insert(locations).values({
      householdId: hId,
      parentId: kitchenCabinet!.id,
      name: 'Shelf 2',
      kind: 'shelf',
      path: `/kitchen/${kitchen.id}/cabinet/${kitchenCabinet!.id}/shelf-2/`,
      depth: 2,
    }).returning();

    await db.insert(locations).values({
      householdId: hId,
      parentId: kitchen.id,
      name: 'Counter Storage',
      kind: 'storage_area',
      path: `/kitchen/${kitchen.id}/counter-storage/`,
      depth: 1,
    });

    // --- Depth 1 & 2: Store Room Hierarchy ---
    // Store Room -> Rack 1 (Shelf 1, Shelf 2) & Rack 2 (Shelf 1, Shelf 2)
    const [storeRack1] = await db.insert(locations).values({
      householdId: hId,
      parentId: storeRoom.id,
      name: 'Rack 1',
      kind: 'rack',
      path: `/store-room/${storeRoom.id}/rack-1/`,
      depth: 1,
    }).returning();

    const [storeRack1Shelf1] = await db.insert(locations).values({
      householdId: hId,
      parentId: storeRack1!.id,
      name: 'Shelf 1',
      kind: 'shelf',
      path: `/store-room/${storeRoom.id}/rack-1/${storeRack1!.id}/shelf-1/`,
      depth: 2,
    }).returning();

    const [storeRack1Shelf2] = await db.insert(locations).values({
      householdId: hId,
      parentId: storeRack1!.id,
      name: 'Shelf 2',
      kind: 'shelf',
      path: `/store-room/${storeRoom.id}/rack-1/${storeRack1!.id}/shelf-2/`,
      depth: 2,
    }).returning();

    const [storeRack2] = await db.insert(locations).values({
      householdId: hId,
      parentId: storeRoom.id,
      name: 'Rack 2',
      kind: 'rack',
      path: `/store-room/${storeRoom.id}/rack-2/`,
      depth: 1,
    }).returning();

    const [storeRack2Shelf1] = await db.insert(locations).values({
      householdId: hId,
      parentId: storeRack2!.id,
      name: 'Shelf 1',
      kind: 'shelf',
      path: `/store-room/${storeRoom.id}/rack-2/${storeRack2!.id}/shelf-1/`,
      depth: 2,
    }).returning();

    await db.insert(locations).values({
      householdId: hId,
      parentId: storeRack2!.id,
      name: 'Shelf 2',
      kind: 'shelf',
      path: `/store-room/${storeRoom.id}/rack-2/${storeRack2!.id}/shelf-2/`,
      depth: 2,
    });

    // --- Depth 1: Attic / Roof Hierarchy ---
    const [atticStorage] = await db.insert(locations).values({
      householdId: hId,
      parentId: atticRoof.id,
      name: 'Storage Area',
      kind: 'storage_area',
      path: `/attic-roof/${atticRoof.id}/storage-area/`,
      depth: 1,
    }).returning();

    const [atticRack] = await db.insert(locations).values({
      householdId: hId,
      parentId: atticRoof.id,
      name: 'Rack',
      kind: 'rack',
      path: `/attic-roof/${atticRoof.id}/rack/`,
      depth: 1,
    }).returning();

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

    const insertedCategories = await db
      .insert(categories)
      .values(categoryData.map((c, i) => ({ ...c, householdId: hId, sortOrder: i })))
      .returning();

    const catMap = new Map(insertedCategories.map((c) => [c.name, c.id]));

    // 6. Create Tags
    const tagData = [
      { name: 'daily-use', color: '#3b82f6' },
      { name: 'fragile', color: '#ef4444' },
      { name: 'travel', color: '#10b981' },
      { name: 'office', color: '#8b5cf6' },
      { name: 'backup', color: '#f59e0b' },
      { name: 'health', color: '#ec4899' },
      { name: 'winter', color: '#06b6d4' },
      { name: 'festive', color: '#eab308' },
    ];
    const insertedTags = await db
      .insert(tags)
      .values(tagData.map((t) => ({ ...t, householdId: hId })))
      .returning();
    const tagMap = new Map(insertedTags.map((t) => [t.name, t.id]));

    // 7. Create Collections
    const [coffeeCollection] = await db
      .insert(collections)
      .values({
        householdId: hId,
        name: 'Coffee Mugs & Tumblers',
        description: 'All drinkware, travel mugs, and artisan coffee mugs',
        color: '#f59e0b',
        icon: 'coffee',
      })
      .returning();

    const [travelCollection] = await db
      .insert(collections)
      .values({
        householdId: hId,
        name: 'Travel Packing Essentials',
        description: 'Bags, organizers, and portable essentials',
        color: '#3b82f6',
        icon: 'plane',
      })
      .returning();

    // 8. Create Movable Storage Objects as Inventory Items (is_container = true)
    // Container 1: Large Blue Storage Box placed in:
    // Big Bedroom -> Wardrobe -> Bottom Shelf
    const [largeBlueStorageBox] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Large Blue Storage Box (Cello MaxiBox 60L)',
        displayName: 'Large Blue Storage Box',
        description: '60L heavy duty plastic storage container with locking handles',
        categoryId: catMap.get('Storage & Containers'),
        brand: 'Cello',
        model: 'MaxiBox 60',
        color: 'Blue',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'box',
        isContainer: true,
        completenessScore: 95,
      })
      .returning();

    // Container 2: Small Electronics Box NESTED inside Large Blue Storage Box!
    const [smallElectronicsBox] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Small Electronics Box (Mini Cable Caddy)',
        displayName: 'Small Electronics Box',
        description: 'Multi-compartment organizer caddy for cables, mice, and adapters',
        categoryId: catMap.get('Storage & Containers'),
        color: 'Grey',
        condition: 'like_new',
        status: 'active',
        totalQuantity: '1',
        unit: 'box',
        isContainer: true,
        completenessScore: 90,
      })
      .returning();

    // Container 3: Medium Transparent Storage Box placed in:
    // Store Room -> Rack 1 -> Shelf 1
    const [mediumStorageBox] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Medium Transparent Storage Box 30L',
        displayName: 'Clear Box (Medium)',
        description: 'Clear plastic box for tools and stationery',
        categoryId: catMap.get('Storage & Containers'),
        brand: 'Joyo',
        color: 'Transparent',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'box',
        isContainer: true,
        completenessScore: 85,
      })
      .returning();

    // Container 4: Black Travel Duffel Bag placed in:
    // Big Bedroom -> Wardrobe -> Top Shelf
    const [blackDuffelBag] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Wildcraft Black Travel Duffel Bag 45L',
        displayName: 'Black Duffel Bag',
        categoryId: catMap.get('Bags & Luggage'),
        brand: 'Wildcraft',
        color: 'Black',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        isContainer: true,
        completenessScore: 85,
      })
      .returning();

    if (!largeBlueStorageBox || !smallElectronicsBox || !mediumStorageBox || !blackDuffelBag) {
      throw new Error('Failed to create container items');
    }

    // Place containers physically in the real-home hierarchy:
    await db.insert(itemPlacements).values([
      // Large Blue Storage Box -> Big Bedroom -> Wardrobe -> Bottom Shelf
      {
        householdId: hId,
        itemId: largeBlueStorageBox.id,
        locationId: bbWardrobeBottom!.id,
        quantity: '1',
        notes: 'Placed flat on the bottom shelf of the big bedroom wardrobe',
      },
      // Small Electronics Box -> NESTED inside Large Blue Storage Box!
      {
        householdId: hId,
        itemId: smallElectronicsBox.id,
        containerItemId: largeBlueStorageBox.id, // NESTED CONTAINER!
        quantity: '1',
        notes: 'Kept inside the Large Blue Storage Box',
      },
      // Medium Storage Box -> Store Room -> Rack 1 -> Shelf 1
      {
        householdId: hId,
        itemId: mediumStorageBox.id,
        locationId: storeRack1Shelf1!.id,
        quantity: '1',
      },
      // Black Duffel Bag -> Big Bedroom -> Wardrobe -> Top Shelf
      {
        householdId: hId,
        itemId: blackDuffelBag.id,
        locationId: bbWardrobeTop!.id,
        quantity: '1',
      },
    ]);

    // 9. Create Inventory Items Exercising All Real-Home Scenarios:

    // --- Exact User Scenario: USB Mouse inside Nested Container ---
    // Physical Path:
    // USB Mouse -> Small Electronics Box -> Large Blue Storage Box -> Big Bedroom -> Wardrobe -> Bottom Shelf
    const [usbMouse] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Logitech B100 Optical USB Wired Mouse',
        displayName: 'USB Mouse',
        description: 'Standard wired USB computer mouse with optical sensor',
        categoryId: catMap.get('Electronics & Gadgets'),
        brand: 'Logitech',
        model: 'B100',
        color: 'Black',
        condition: 'good',
        status: 'stored',
        totalQuantity: '2',
        unit: 'pcs',
        completenessScore: 95,
      })
      .returning();

    if (usbMouse) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: usbMouse.id,
        containerItemId: smallElectronicsBox.id, // Inside nested container!
        quantity: '2',
        notes: 'Spare USB mice in the mini cable caddy',
      });
      await db.insert(priceHistory).values({
        householdId: hId,
        itemId: usbMouse.id,
        amountMinor: 37500, // ₹375.00
        currency: 'INR',
        type: 'purchase',
      });
    }

    // USB-C Cables inside the same Small Electronics Box
    const [usbCables] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Anker PowerLine III USB-C to USB-C Cable 2m',
        categoryId: catMap.get('Electronics & Gadgets'),
        brand: 'Anker',
        color: 'White',
        condition: 'new',
        status: 'stored',
        totalQuantity: '4',
        unit: 'pcs',
        completenessScore: 85,
      })
      .returning();

    if (usbCables) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: usbCables.id,
        containerItemId: smallElectronicsBox.id,
        quantity: '4',
      });
    }

    // --- HealthSense Weight Machine prominent in Big Bedroom Wardrobe Bottom Shelf ---
    const [weightMachine] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'HealthSense Ultra-Lite PS 126 Digital Personal Weighing Scale',
        displayName: 'Weight Machine',
        description: 'High precision digital scale with tempered glass platform and step-on activation',
        categoryId: catMap.get('Health & Fitness'),
        brand: 'HealthSense',
        model: 'PS 126',
        color: 'Grey',
        condition: 'like_new',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 100,
      })
      .returning();

    if (weightMachine) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: weightMachine.id,
        locationId: bbWardrobeBottom!.id, // Big Bedroom -> Wardrobe -> Bottom Shelf
        quantity: '1',
        notes: 'Kept on bottom wardrobe shelf next to blue storage box',
      });
      await db.insert(priceHistory).values({
        householdId: hId,
        itemId: weightMachine.id,
        amountMinor: 149900, // ₹1,499.00
        currency: 'INR',
        type: 'purchase',
      });
      const healthTag = tagMap.get('health');
      if (healthTag) {
        await db.insert(itemTags).values({ householdId: hId, itemId: weightMachine.id, tagId: healthTag });
      }
    }

    // --- Split Stock: 8 White Ceramic Coffee Mugs (5 in Kitchen, 3 in Large Blue Storage Box) ---
    const [whiteMugs] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'White Ceramic Coffee Mug 350ml',
        displayName: 'Daily White Coffee Mug',
        description: 'Stoneware cylindrical ceramic mug',
        categoryId: catMap.get('Kitchen & Dining'),
        brand: 'ClayCraft',
        color: 'White',
        material: 'Ceramic',
        condition: 'good',
        status: 'active',
        totalQuantity: '8', // 5 + 3 = 8
        unit: 'pcs',
        completenessScore: 100,
      })
      .returning();

    if (whiteMugs) {
      await db.insert(itemPlacements).values([
        {
          householdId: hId,
          itemId: whiteMugs.id,
          locationId: kitchenCabShelf1!.id, // Kitchen -> Cabinet -> Shelf 1
          quantity: '5',
          notes: 'Daily mugs in kitchen cabinet',
        },
        {
          householdId: hId,
          itemId: whiteMugs.id,
          containerItemId: largeBlueStorageBox.id, // Inside Large Blue Storage Box!
          quantity: '3',
          notes: 'Spare guest mugs in bedroom storage box',
        },
      ]);

      await db.insert(priceHistory).values([
        {
          householdId: hId,
          itemId: whiteMugs.id,
          amountMinor: 20000, // ₹200.00
          currency: 'INR',
          type: 'purchase',
          source: 'Home Centre',
        },
        {
          householdId: hId,
          itemId: whiteMugs.id,
          amountMinor: 25000, // ₹250.00
          currency: 'INR',
          type: 'estimated_value',
          source: 'Current Market Estimate',
        },
      ]);

      await db.insert(itemImages).values({
        householdId: hId,
        itemId: whiteMugs.id,
        cloudinaryPublicId: 'inventory/white_mug_sample',
        url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/coffee.jpg',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/samples/coffee.jpg',
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 124500,
        kind: 'primary',
        isPrimary: true,
        altText: 'White ceramic coffee mug',
      });

      const fragileTag = tagMap.get('fragile');
      const dailyTag = tagMap.get('daily-use');
      if (fragileTag) await db.insert(itemTags).values({ householdId: hId, itemId: whiteMugs.id, tagId: fragileTag });
      if (dailyTag) await db.insert(itemTags).values({ householdId: hId, itemId: whiteMugs.id, tagId: dailyTag });
      if (coffeeCollection) {
        await db.insert(collectionItems).values({
          householdId: hId,
          collectionId: coffeeCollection.id,
          itemId: whiteMugs.id,
        });
      }
    }

    // --- Water Bottles: Milton Thermos Flask (Kitchen + Duffel Bag) ---
    const [miltonFlask] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Milton Thermosteel Flip Lid Flask 1L',
        description: 'Vacuum insulated flask for hot and cold beverages',
        categoryId: catMap.get('Kitchen & Dining'),
        brand: 'Milton',
        color: 'Silver',
        material: 'Stainless Steel',
        condition: 'good',
        status: 'active',
        totalQuantity: '2',
        unit: 'bottle',
        completenessScore: 90,
      })
      .returning();

    if (miltonFlask) {
      await db.insert(itemPlacements).values([
        {
          householdId: hId,
          itemId: miltonFlask.id,
          locationId: kitchenCabShelf2!.id, // Kitchen -> Cabinet -> Shelf 2
          quantity: '1',
        },
        {
          householdId: hId,
          itemId: miltonFlask.id,
          containerItemId: blackDuffelBag.id, // Inside Black Travel Duffel Bag!
          quantity: '1',
          notes: 'Packed in duffel for trips',
        },
      ]);
    }

    // --- Samsonite 28" Trolley Bag in Store Room -> Rack 2 -> Shelf 1 ---
    const [samsoniteTrolley] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Samsonite Omni 28" Hardside Spinner Trolley Bag',
        categoryId: catMap.get('Bags & Luggage'),
        brand: 'Samsonite',
        color: 'Charcoal Grey',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 90,
      })
      .returning();

    if (samsoniteTrolley) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: samsoniteTrolley.id,
        locationId: storeRack2Shelf1!.id,
        quantity: '1',
      });
      await db.insert(priceHistory).values({
        householdId: hId,
        itemId: samsoniteTrolley.id,
        amountMinor: 1450000, // ₹14,500.00
        currency: 'INR',
        type: 'purchase',
      });
      if (travelCollection) {
        await db.insert(collectionItems).values({
          householdId: hId,
          collectionId: travelCollection.id,
          itemId: samsoniteTrolley.id,
        });
      }
    }

    // --- Small Bedroom Items: Blankets on Wardrobe Top & Reading Glasses in Bedside Drawer ---
    const [winterBlanket] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Signature Microfiber Double Bed Warm Blanket',
        categoryId: catMap.get('Home & Living'),
        color: 'Maroon',
        condition: 'good',
        status: 'stored',
        totalQuantity: '2',
        unit: 'set',
        completenessScore: 80,
      })
      .returning();

    if (winterBlanket) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: winterBlanket.id,
        locationId: sbWardrobeTop!.id, // Small Bedroom -> Wardrobe -> Top Shelf
        quantity: '2',
      });
      const winterTag = tagMap.get('winter');
      if (winterTag) await db.insert(itemTags).values({ householdId: hId, itemId: winterBlanket.id, tagId: winterTag });
    }

    const [readingGlasses] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Lenskart Air Flex Lightweight Reading Glasses (+1.5)',
        categoryId: catMap.get('Health & Fitness'),
        brand: 'Lenskart',
        condition: 'like_new',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 85,
      })
      .returning();

    if (readingGlasses) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: readingGlasses.id,
        locationId: sbDrawer1!.id, // Small Bedroom -> Bedside Table -> Drawer 1
        quantity: '1',
      });
    }

    // --- Hall Items: Streaming Remotes on TV Unit Shelf 1 ---
    const [fireTvRemote] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Amazon Fire TV Stick 4K Remote & HDMI Extender',
        categoryId: catMap.get('Electronics & Gadgets'),
        brand: 'Amazon',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 85,
      })
      .returning();

    if (fireTvRemote) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: fireTvRemote.id,
        locationId: hallTvShelf1!.id, // Hall -> TV Unit -> Shelf 1
        quantity: '1',
      });
    }

    // --- Passage Items: Vacuum Cleaner in Passage Storage Area ---
    const [vacuumCleaner] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Eureka Forbes Quick Clean DX Vacuum Cleaner',
        categoryId: catMap.get('Home & Living'),
        brand: 'Eureka Forbes',
        color: 'Red/Black',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 85,
      })
      .returning();

    if (vacuumCleaner) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: vacuumCleaner.id,
        locationId: passageStorage!.id, // Passage -> Storage Area
        quantity: '1',
      });
    }

    // --- Attic / Roof Items: Festive Lights in Storage Area & Camping Lantern on Rack ---
    const [diwaliLights] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Warm White Waterproof LED Fairy String Lights 50m',
        categoryId: catMap.get('Seasonal & Festive'),
        condition: 'good',
        status: 'stored',
        totalQuantity: '4',
        unit: 'pack',
        completenessScore: 85,
      })
      .returning();

    if (diwaliLights) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: diwaliLights.id,
        locationId: atticStorage!.id, // Attic / Roof -> Storage Area
        quantity: '4',
      });
      const festiveTag = tagMap.get('festive');
      if (festiveTag) await db.insert(itemTags).values({ householdId: hId, itemId: diwaliLights.id, tagId: festiveTag });
    }

    const [campingLantern] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Coleman Multi-Panel Rechargeable LED Camping Lantern',
        categoryId: catMap.get('Home & Living'),
        brand: 'Coleman',
        condition: 'good',
        status: 'stored',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 80,
      })
      .returning();

    if (campingLantern) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: campingLantern.id,
        locationId: atticRack!.id, // Attic / Roof -> Rack
        quantity: '1',
      });
    }

    // --- Store Room Items: Moleskine Notebooks on Shelf 2 ---
    const [moleskineJournal] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Moleskine Classic Hardcover Ruled Notebook - Large',
        categoryId: catMap.get('Books & Stationery'),
        brand: 'Moleskine',
        color: 'Black',
        condition: 'new',
        status: 'stored',
        totalQuantity: '3',
        unit: 'pcs',
        completenessScore: 80,
      })
      .returning();

    if (moleskineJournal) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: moleskineJournal.id,
        locationId: storeRack1Shelf2!.id, // Store Room -> Rack 1 -> Shelf 2
        quantity: '3',
      });
    }

    // --- Performance Mouse on Big Bedroom Study Desk ---
    const [mxMasterMouse] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Logitech MX Master 3S Wireless Performance Mouse',
        categoryId: catMap.get('Electronics & Gadgets'),
        brand: 'Logitech',
        model: 'MX Master 3S',
        color: 'Graphite',
        condition: 'like_new',
        status: 'in_use',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 95,
      })
      .returning();

    if (mxMasterMouse) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: mxMasterMouse.id,
        locationId: bbStudyDesk!.id, // Big Bedroom -> Study Desk
        quantity: '1',
      });
      await db.insert(priceHistory).values({
        householdId: hId,
        itemId: mxMasterMouse.id,
        amountMinor: 899500, // ₹8,995.00
        currency: 'INR',
        type: 'purchase',
      });
    }

    // --- Legitimate Unplaced Items (Quick Capture / Unsorted) ---
    // Philips Rechargeable Emergency Lantern (Total: 1, 0 Placements)
    await db.insert(items).values({
      householdId: hId,
      name: 'Philips Ojas Rechargeable Emergency LED Lantern',
      categoryId: catMap.get('Home & Living'),
      brand: 'Philips',
      totalQuantity: '1',
      unit: 'pcs',
      condition: 'good',
      status: 'active',
      completenessScore: 40,
    });

    // Vintage Brass Candle Stand (Total: 2, 0 Placements)
    await db.insert(items).values({
      householdId: hId,
      name: 'Vintage Engraved Brass Candle Holders',
      totalQuantity: '2',
      unit: 'pair',
      condition: 'good',
      status: 'active',
      completenessScore: 30,
    });

    // --- Loaned Item: Sony A7 IV Camera ---
    const [camera] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Sony Alpha 7 IV Full-Frame Mirrorless Camera',
        categoryId: catMap.get('Electronics & Gadgets'),
        brand: 'Sony',
        model: 'ILCE-7M4',
        condition: 'like_new',
        status: 'loaned',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 90,
      })
      .returning();

    if (camera) {
      await db.insert(loans).values({
        householdId: hId,
        itemId: camera.id,
        borrowerName: 'Rahul Verma (Colleague)',
        borrowerContact: '+91 98765 43210',
        quantity: '1',
        lentAt: '2026-09-01',
        dueAt: '2026-09-15',
        status: 'active',
        notes: 'Lent for photography workshop with 24-70mm GM lens',
        createdBy: ownerUser.id,
      });

      await db.insert(reminders).values({
        householdId: hId,
        itemId: camera.id,
        title: 'Collect Sony A7 IV camera from Rahul',
        dueDate: '2026-09-15',
        type: 'loan',
      });
    }

    // 10. Audit Trail
    await db.insert(auditLog).values([
      {
        householdId: hId,
        userId: ownerUser.id,
        entityType: 'household',
        entityId: hId,
        action: 'created',
        metadata: { name: 'The Sharma Residence' },
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
