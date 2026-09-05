import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { locations } from './locations';
import { users } from './users';

export const movements = pgTable(
  'movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id').notNull(),
    itemId: uuid('item_id').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
    fromLocationId: uuid('from_location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    fromContainerItemId: uuid('from_container_item_id').references(() => items.id, {
      onDelete: 'set null',
    }),
    toLocationId: uuid('to_location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    toContainerItemId: uuid('to_container_item_id').references(() => items.id, {
      onDelete: 'set null',
    }),
    reason: varchar('reason', { length: 64 }).notNull().default('reorganize'),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId, table.itemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_movements_household_item',
    }).onDelete('cascade'),
    index('idx_movements_household').on(table.householdId),
    index('idx_movements_item').on(table.itemId),
  ]
);

export const inventoryAdjustments = pgTable(
  'inventory_adjustments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id').notNull(),
    itemId: uuid('item_id').notNull(),
    previousQuantity: numeric('previous_quantity', { precision: 12, scale: 2 }).notNull(),
    newQuantity: numeric('new_quantity', { precision: 12, scale: 2 }).notNull(),
    delta: numeric('delta', { precision: 12, scale: 2 }).notNull(),
    reason: varchar('reason', { length: 64 }).notNull(),
    notes: text('notes'),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId, table.itemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_adjustments_household_item',
    }).onDelete('cascade'),
    index('idx_adjustments_household').on(table.householdId),
    index('idx_adjustments_item').on(table.itemId),
  ]
);
