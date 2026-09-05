import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  unique,
  index,
  check,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { households } from './households';
import { categories } from './categories';
import { locations } from './locations';
import { tags } from './tags';
import { collections } from './collections';

export const items = pgTable(
  'items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    description: text('description'),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    subcategory: varchar('subcategory', { length: 128 }),
    brand: varchar('brand', { length: 128 }),
    model: varchar('model', { length: 128 }),
    variant: varchar('variant', { length: 128 }),
    serialNumber: varchar('serial_number', { length: 128 }),
    sku: varchar('sku', { length: 128 }),
    barcode: varchar('barcode', { length: 128 }),
    qrIdentifier: varchar('qr_identifier', { length: 128 }).unique(),
    color: varchar('color', { length: 64 }),
    size: varchar('size', { length: 64 }),
    material: varchar('material', { length: 128 }),
    dimensions: jsonb('dimensions'), // { length, width, height, unit }
    weight: jsonb('weight'),         // { value, unit }
    condition: varchar('condition', { length: 32 }).notNull().default('good'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    totalQuantity: numeric('total_quantity', { precision: 12, scale: 2 })
      .notNull()
      .default('1'),
    unit: varchar('unit', { length: 32 }).notNull().default('pcs'),
    lowStockThreshold: numeric('low_stock_threshold', { precision: 12, scale: 2 }),
    isConsumable: boolean('is_consumable').notNull().default(false),
    isContainer: boolean('is_container').notNull().default(false),
    version: integer('version').notNull().default(1),
    completenessScore: integer('completeness_score').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_items_household_id').on(table.householdId, table.id),
    unique('uq_items_id_is_container').on(table.id, table.isContainer),
    check('chk_items_total_quantity_non_negative', sql`${table.totalQuantity} >= 0`),
    index('idx_items_household_active').on(table.householdId, table.deletedAt),
    index('idx_items_household_category').on(table.householdId, table.categoryId),
    index('idx_items_household_status').on(table.householdId, table.status),
    index('idx_items_name').on(table.name),
  ]
);

export const itemPlacements = pgTable(
  'item_placements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id').notNull(),
    itemId: uuid('item_id').notNull(),
    locationId: uuid('location_id'),
    containerItemId: uuid('container_item_id'),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Multi-tenant composite foreign keys
    foreignKey({
      columns: [table.householdId, table.itemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_placements_household_item',
    }).onDelete('cascade'),

    foreignKey({
      columns: [table.householdId, table.locationId],
      foreignColumns: [locations.householdId, locations.id],
      name: 'fk_placements_household_location',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.householdId, table.containerItemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_placements_household_container',
    }).onDelete('restrict'),

    // Check: quantity must be strictly positive
    check('chk_placement_quantity_positive', sql`${table.quantity} > 0`),

    // Check: Item cannot be placed inside itself!
    check(
      'chk_placement_not_self',
      sql`${table.containerItemId} IS NULL OR ${table.itemId} != ${table.containerItemId}`
    ),

    // Check: Destination must be either location OR container, never both, never neither
    check(
      'chk_placement_target_xor',
      sql`(${table.locationId} IS NOT NULL AND ${table.containerItemId} IS NULL) OR (${table.locationId} IS NULL AND ${table.containerItemId} IS NOT NULL)`
    ),

    index('idx_placements_item').on(table.householdId, table.itemId),
    index('idx_placements_location').on(table.householdId, table.locationId),
    index('idx_placements_container').on(table.householdId, table.containerItemId),
  ]
);

export const itemTags = pgTable(
  'item_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id').notNull(),
    itemId: uuid('item_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId, table.itemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_item_tags_household_item',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.householdId, table.tagId],
      foreignColumns: [tags.householdId, tags.id],
      name: 'fk_item_tags_household_tag',
    }).onDelete('cascade'),
    unique('uq_item_tags').on(table.itemId, table.tagId),
    index('idx_item_tags_item').on(table.itemId),
    index('idx_item_tags_tag').on(table.tagId),
  ]
);

export const collectionItems = pgTable(
  'collection_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id').notNull(),
    collectionId: uuid('collection_id').notNull(),
    itemId: uuid('item_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId, table.collectionId],
      foreignColumns: [collections.householdId, collections.id],
      name: 'fk_collection_items_household_collection',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.householdId, table.itemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_collection_items_household_item',
    }).onDelete('cascade'),
    unique('uq_collection_items').on(table.collectionId, table.itemId),
    index('idx_collection_items_collection').on(table.collectionId),
    index('idx_collection_items_item').on(table.itemId),
  ]
);
