import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  date,
  timestamp,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { users } from './users';

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id').notNull(),
    itemId: uuid('item_id').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(), // e.g. 25000 = ₹250.00
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    type: varchar('type', { length: 32 }).notNull().default('purchase'),
    source: varchar('source', { length: 128 }),
    date: date('date').notNull().default('now()'),
    orderReference: varchar('order_reference', { length: 128 }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId, table.itemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_price_history_household_item',
    }).onDelete('cascade'),
    index('idx_price_history_item').on(table.itemId),
    index('idx_price_history_date').on(table.itemId, table.date),
  ]
);
