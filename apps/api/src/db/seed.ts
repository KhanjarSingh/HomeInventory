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
  logger.info('🌱 Starting rich household seed data insertion...');

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

    // Isolated user in second household
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

    // 4. Create Locations (Hierarchical Tree with Materialized Path)
    // Level 1: Rooms
    const [storeRoom] = await db
      .insert(locations)
      .values({
        householdId: hId,
        name: 'Store Room',
        kind: 'room',
        icon: 'archive',
        color: '#64748b',
        path: '/store-room/',
        depth: 0,
      })
      .returning();

    const [kitchen] = await db
      .insert(locations)
      .values({
        householdId: hId,
        name: 'Kitchen',
        kind: 'room',
        icon: 'utensils',
        color: '#f59e0b',
        path: '/kitchen/',
        depth: 0,
      })
      .returning();

    const [bedroom] = await db
      .insert(locations)
      .values({
        householdId: hId,
        name: 'Master Bedroom',
        kind: 'room',
        icon: 'bed',
        color: '#3b82f6',
        path: '/master-bedroom/',
        depth: 0,
      })
      .returning();

    const [livingRoom] = await db
      .insert(locations)
      .values({
        householdId: hId,
        name: 'Living Room',
        kind: 'room',
        icon: 'tv',
        color: '#10b981',
        path: '/living-room/',
        depth: 0,
      })
      .returning();

    if (!storeRoom || !kitchen || !bedroom || !livingRoom) {
      throw new Error('Failed to create root locations');
    }

    // Level 2 & 3 Locations
    // Store Room -> Rack 1 & Rack 2
    const [rack1] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: storeRoom.id,
        name: 'Rack 1',
        kind: 'furniture',
        path: `/store-room/${storeRoom.id}/rack-1/`,
        depth: 1,
      })
      .returning();

    const [rack2] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: storeRoom.id,
        name: 'Rack 2',
        kind: 'furniture',
        path: `/store-room/${storeRoom.id}/rack-2/`,
        depth: 1,
      })
      .returning();

    if (!rack1 || !rack2) throw new Error('Failed to create store room racks');

    const [rack1Shelf1] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: rack1.id,
        name: 'Shelf 1 (Top)',
        kind: 'shelf',
        path: `/store-room/${storeRoom.id}/rack-1/${rack1.id}/shelf-1/`,
        depth: 2,
      })
      .returning();

    const [rack1Shelf2] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: rack1.id,
        name: 'Shelf 2 (Bottom)',
        kind: 'shelf',
        path: `/store-room/${storeRoom.id}/rack-1/${rack1.id}/shelf-2/`,
        depth: 2,
      })
      .returning();

    // Kitchen -> Cabinet 1 & Cabinet 2 -> Shelves
    const [kitchenCab1] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: kitchen.id,
        name: 'Cabinet 1 (Lower Pots)',
        kind: 'furniture',
        path: `/kitchen/${kitchen.id}/cab-1/`,
        depth: 1,
      })
      .returning();

    const [kitchenCab2] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: kitchen.id,
        name: 'Cabinet 2 (Upper Crockery)',
        kind: 'furniture',
        path: `/kitchen/${kitchen.id}/cab-2/`,
        depth: 1,
      })
      .returning();

    if (!kitchenCab1 || !kitchenCab2) throw new Error('Failed to create kitchen cabinets');

    const [cab2Shelf1] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: kitchenCab2.id,
        name: 'Shelf 1 (Daily Drinkware)',
        kind: 'shelf',
        path: `/kitchen/${kitchen.id}/cab-2/${kitchenCab2.id}/shelf-1/`,
        depth: 2,
      })
      .returning();

    const [cab2Shelf2] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: kitchenCab2.id,
        name: 'Shelf 2 (Bottles & Mugs)',
        kind: 'shelf',
        path: `/kitchen/${kitchen.id}/cab-2/${kitchenCab2.id}/shelf-2/`,
        depth: 2,
      })
      .returning();

    // Bedroom -> Wardrobe (Top & Bottom Shelf) & Desk
    const [wardrobe] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: bedroom.id,
        name: 'Wardrobe',
        kind: 'furniture',
        icon: 'box',
        path: `/master-bedroom/${bedroom.id}/wardrobe/`,
        depth: 1,
      })
      .returning();

    const [bedroomDesk] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: bedroom.id,
        name: 'Study Desk',
        kind: 'furniture',
        path: `/master-bedroom/${bedroom.id}/desk/`,
        depth: 1,
      })
      .returning();

    if (!wardrobe || !bedroomDesk) throw new Error('Failed to create wardrobe');

    const [wardrobeTopShelf] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: wardrobe.id,
        name: 'Top Shelf',
        kind: 'shelf',
        path: `/master-bedroom/${bedroom.id}/wardrobe/${wardrobe.id}/top-shelf/`,
        depth: 2,
      })
      .returning();

    const [wardrobeBottomShelf] = await db
      .insert(locations)
      .values({
        householdId: hId,
        parentId: wardrobe.id,
        name: 'Bottom Shelf',
        kind: 'shelf',
        path: `/master-bedroom/${bedroom.id}/wardrobe/${wardrobe.id}/bottom-shelf/`,
        depth: 2,
      })
      .returning();

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
        description: 'All drinkware and artisan coffee mugs',
        color: '#f59e0b',
        icon: 'coffee',
      })
      .returning();

    const [travelCollection] = await db
      .insert(collections)
      .values({
        householdId: hId,
        name: 'Travel Packing Essentials',
        description: 'Bags, organizers, and portable electronics',
        color: '#3b82f6',
        icon: 'plane',
      })
      .returning();

    // 8. Create Containers (Items with is_container = true)
    // Container 1: Large Blue Plastic Bin in Store Room -> Rack 2
    const [largeBlueBin] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Large Blue Plastic Storage Bin',
        displayName: 'Blue Box A (Large)',
        description: '60L heavy duty plastic storage container with latching lid',
        categoryId: catMap.get('Storage & Containers'),
        brand: 'Cello',
        model: 'MaxiBox 60',
        color: 'Blue',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'box',
        isContainer: true,
        completenessScore: 90,
      })
      .returning();

    // Container 2: Medium Transparent Box in Store Room -> Rack 1 -> Shelf 1
    const [mediumBox] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Medium Transparent Storage Box',
        displayName: 'Clear Box B (Medium)',
        description: 'Clear modular storage container',
        categoryId: catMap.get('Storage & Containers'),
        brand: 'Joyo',
        color: 'Transparent',
        condition: 'like_new',
        status: 'active',
        totalQuantity: '1',
        unit: 'box',
        isContainer: true,
        completenessScore: 85,
      })
      .returning();

    // Container 3: Small Electronics Organizer Box NESTED inside Medium Transparent Box!
    const [smallElectronicsBox] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Small Electronics Organizer Box',
        displayName: 'Mini Cable Caddy',
        description: 'Small divider box for cables and accessories',
        categoryId: catMap.get('Storage & Containers'),
        color: 'Grey',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'box',
        isContainer: true,
        completenessScore: 85,
      })
      .returning();

    // Container 4: Black Travel Duffel Bag placed in Master Bedroom -> Wardrobe -> Top Shelf
    const [duffelBag] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Black Travel Duffel Bag 45L',
        displayName: 'Gym & Travel Duffel',
        categoryId: catMap.get('Bags & Luggage'),
        brand: 'Wildcraft',
        color: 'Black',
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        isContainer: true,
        completenessScore: 80,
      })
      .returning();

    if (!largeBlueBin || !mediumBox || !smallElectronicsBox || !duffelBag) {
      throw new Error('Failed to create containers');
    }

    // Place the containers physically:
    await db.insert(itemPlacements).values([
      // Large Blue Bin -> Store Room Rack 2
      {
        householdId: hId,
        itemId: largeBlueBin.id,
        locationId: rack2.id,
        quantity: '1',
      },
      // Medium Box -> Store Room Rack 1 Shelf 1
      {
        householdId: hId,
        itemId: mediumBox.id,
        locationId: rack1Shelf1?.id,
        quantity: '1',
      },
      // Small Electronics Box -> NESTED inside Medium Box!
      {
        householdId: hId,
        itemId: smallElectronicsBox.id,
        containerItemId: mediumBox.id, // NESTED CONTAINER!
        quantity: '1',
        notes: 'Kept inside the transparent storage box on Shelf 1',
      },
      // Duffel Bag -> Master Bedroom Wardrobe Top Shelf
      {
        householdId: hId,
        itemId: duffelBag.id,
        locationId: wardrobeTopShelf?.id,
        quantity: '1',
      },
    ]);

    // 9. Create Inventory Items Demonstrating Scenarios:

    // --- Scenario A: Multiple identical items SPLIT across locations ---
    // White Ceramic Coffee Mug (Total Qty: 8)
    // 5 in Kitchen Cabinet 2 Shelf 1, 3 in Large Blue Storage Box!
    const [whiteMugs] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'White Ceramic Coffee Mug 350ml',
        displayName: 'Daily White Coffee Mug',
        description: 'Classic stoneware cylindrical coffee mug',
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
          locationId: cab2Shelf1?.id, // Kitchen
          quantity: '5',
          notes: 'Daily use in kitchen',
        },
        {
          householdId: hId,
          itemId: whiteMugs.id,
          containerItemId: largeBlueBin.id, // Inside Blue Storage Box!
          quantity: '3',
          notes: 'Extra guest backup mugs stored in box',
        },
      ]);

      // Price History (Integer Minor Units: 20000 paise = ₹200.00 purchase, 25000 = ₹250.00 current)
      await db.insert(priceHistory).values([
        {
          householdId: hId,
          itemId: whiteMugs.id,
          amountMinor: 20000,
          currency: 'INR',
          type: 'purchase',
          source: 'Home Centre',
          date: '2024-03-15',
          notes: 'Set of mugs purchased during sale',
        },
        {
          householdId: hId,
          itemId: whiteMugs.id,
          amountMinor: 25000,
          currency: 'INR',
          type: 'estimated_value',
          source: 'Market Estimate',
          date: '2026-01-10',
        },
      ]);

      // Image placeholder metadata
      await db.insert(itemImages).values([
        {
          householdId: hId,
          itemId: whiteMugs.id,
          cloudinaryPublicId: 'inventory/white_mug_primary_sample',
          url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/coffee.jpg',
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/samples/coffee.jpg',
          width: 800,
          height: 600,
          format: 'jpg',
          bytes: 124500,
          kind: 'primary',
          isPrimary: true,
          altText: 'White ceramic coffee mug on table',
        },
      ]);

      // Tags & Collection
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

    // --- Scenario B: Different Variants of similar item ---
    // Marvel Avengers Mug (Qty: 1)
    const [marvelMug] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Marvel Avengers Ceramic Coffee Mug',
        categoryId: catMap.get('Kitchen & Dining'),
        variant: 'Iron Man Edition',
        color: 'Red/Gold',
        condition: 'like_new',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 85,
      })
      .returning();

    if (marvelMug) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: marvelMug.id,
        locationId: cab2Shelf1?.id,
        quantity: '1',
      });
      await db.insert(priceHistory).values({
        householdId: hId,
        itemId: marvelMug.id,
        amountMinor: 49900,
        currency: 'INR',
        type: 'purchase',
      });
    }

    // Matte Black Travel Mug (Qty: 2)
    const [travelMug] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Matte Black Insulated Travel Tumbler 500ml',
        categoryId: catMap.get('Kitchen & Dining'),
        brand: 'VaccumFlask',
        color: 'Matte Black',
        condition: 'good',
        status: 'active',
        totalQuantity: '2',
        unit: 'pcs',
        completenessScore: 90,
      })
      .returning();

    if (travelMug) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: travelMug.id,
        locationId: bedroomDesk?.id,
        quantity: '2',
      });
      await db.insert(priceHistory).values({
        householdId: hId,
        itemId: travelMug.id,
        amountMinor: 79900,
        currency: 'INR',
        type: 'purchase',
      });
    }

    // --- Scenario C: Water Bottles ---
    const [miltonFlask] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Milton Thermosteel Flip Lid Water Bottle 1L',
        description: '24hr hot and cold vacuum insulated flask',
        categoryId: catMap.get('Kitchen & Dining'),
        brand: 'Milton',
        color: 'Silver',
        material: 'Stainless Steel',
        condition: 'good',
        status: 'active',
        totalQuantity: '2',
        unit: 'bottle',
        completenessScore: 95,
      })
      .returning();

    if (miltonFlask) {
      await db.insert(itemPlacements).values([
        {
          householdId: hId,
          itemId: miltonFlask.id,
          locationId: cab2Shelf2?.id, // Kitchen
          quantity: '1',
        },
        {
          householdId: hId,
          itemId: miltonFlask.id,
          containerItemId: duffelBag.id, // Inside Travel Duffel Bag!
          quantity: '1',
          notes: 'Packed for trips',
        },
      ]);
    }

    // --- Scenario D: Bags of different types ---
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
        completenessScore: 85,
      })
      .returning();

    if (samsoniteTrolley) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: samsoniteTrolley.id,
        locationId: rack2?.id, // Store Room Rack 2
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

    // --- Scenario E: Diaries / Notebooks inside Container ---
    const [moleskineJournal] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Moleskine Classic Ruled Hardcover Notebook - Large',
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
      // Placed inside Large Blue Storage Bin
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: moleskineJournal.id,
        containerItemId: largeBlueBin.id,
        quantity: '3',
      });
    }

    // --- Scenario F: Electronics & Accessories inside NESTED Container ---
    // Logitech MX Master 3S Mouse on Desk
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
        locationId: bedroomDesk?.id,
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

    // Backup Mouse stored inside NESTED CONTAINER (Small Electronics Box inside Medium Box)
    const [backupMouse] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Logitech B100 Optical USB Wired Mouse (Backup)',
        categoryId: catMap.get('Electronics & Gadgets'),
        brand: 'Logitech',
        model: 'B100',
        color: 'Black',
        condition: 'good',
        status: 'stored',
        totalQuantity: '2',
        unit: 'pcs',
        completenessScore: 85,
      })
      .returning();

    if (backupMouse) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: backupMouse.id,
        containerItemId: smallElectronicsBox.id, // Inside nested container!
        quantity: '2',
        notes: 'Backup mice in electronics caddy',
      });
    }

    // USB-C Cables inside NESTED CONTAINER
    const [usbCables] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Anker PowerLine III USB-C to USB-C Fast Charging Cable 2m',
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
        containerItemId: smallElectronicsBox.id, // Inside nested container!
        quantity: '4',
      });
    }

    // --- Scenario G: First-Class "Where is it?" Weight Machine ---
    const [weightMachine] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'HealthSense Ultra-Lite PS 126 Digital Personal Weighing Machine',
        displayName: 'Bathroom Weight Machine',
        description: 'High precision digital bathroom scale with step-on technology',
        categoryId: catMap.get('Health & Fitness'),
        brand: 'HealthSense',
        model: 'PS 126',
        color: 'Grey',
        condition: 'like_new',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 95,
      })
      .returning();

    if (weightMachine) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: weightMachine.id,
        locationId: wardrobeBottomShelf?.id,
        quantity: '1',
        notes: 'Kept flat on bottom wardrobe shelf',
      });
      await db.insert(priceHistory).values({
        householdId: hId,
        itemId: weightMachine.id,
        amountMinor: 149900, // ₹1,499.00
        currency: 'INR',
        type: 'purchase',
      });
    }

    // --- Scenario H: Legitimate Unplaced Items (Quick Capture / Unsorted) ---
    // Philips Emergency Flashlight (Total: 1, Placements: 0)
    await db.insert(items).values({
      householdId: hId,
      name: 'Philips Ojas Rechargeable Emergency LED Lantern',
      categoryId: catMap.get('Home & Living'),
      brand: 'Philips',
      totalQuantity: '1',
      unit: 'pcs',
      condition: 'good',
      status: 'active',
      completenessScore: 40, // Low completeness: no placements!
      // NO PLACEMENTS! Valid unplaced state!
    });

    // Brass Candle Stand (Total: 2, Placements: 0)
    await db.insert(items).values({
      householdId: hId,
      name: 'Vintage Engraved Brass Candle Holders',
      totalQuantity: '2',
      unit: 'pair',
      condition: 'good',
      status: 'active',
      completenessScore: 30, // Missing category, missing photos, unplaced!
    });

    // --- Scenario I: Items missing photos ---
    const [hammer] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Stanley 16oz Steel Curved Claw Hammer',
        categoryId: catMap.get('Tools & Hardware'),
        brand: 'Stanley',
        condition: 'good',
        status: 'stored',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 60,
      })
      .returning();

    if (hammer) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: hammer.id,
        locationId: rack1Shelf2?.id,
        quantity: '1',
      });
    }

    // --- Scenario J: Items missing prices ---
    const [tableRunner] = await db
      .insert(items)
      .values({
        householdId: hId,
        name: 'Handcrafted Cotton Embroidered Dining Table Runner',
        categoryId: catMap.get('Home & Living'),
        condition: 'good',
        status: 'active',
        totalQuantity: '1',
        unit: 'pcs',
        completenessScore: 50, // Missing price & photo
      })
      .returning();

    if (tableRunner) {
      await db.insert(itemPlacements).values({
        householdId: hId,
        itemId: tableRunner.id,
        locationId: livingRoom.id,
        quantity: '1',
      });
    }

    // --- Scenario K: Loaned Item with Overdue/Active Loan ---
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
        notes: 'Lent for photography workshop with 24-70mm lens',
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

    // 10. Log Initial Audit Trail Entries
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
        entityType: 'item',
        entityId: whiteMugs?.id || hId,
        action: 'created',
        metadata: { name: 'White Ceramic Coffee Mug 350ml', totalQuantity: 8 },
      },
    ]);

    logger.info('✅ Seed data insertion completed successfully.');
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
