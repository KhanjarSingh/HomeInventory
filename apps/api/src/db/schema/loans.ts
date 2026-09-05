import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  date,
  boolean,
  timestamp,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { households } from './households';
import { users } from './users';

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull(),
    borrowerName: varchar('borrower_name', { length: 128 }).notNull(),
    borrowerContact: varchar('borrower_contact', { length: 128 }),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull().default('1'),
    lentAt: date('lent_at').notNull().default('now()'),
    dueAt: date('due_at'),
    returnedAt: date('returned_at'),
    status: varchar('status', { length: 32 }).notNull().default('active'), // 'active','returned','overdue'
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId, table.itemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_loans_household_item',
    }).onDelete('cascade'),
    index('idx_loans_household_status').on(table.householdId, table.status),
    index('idx_loans_item').on(table.itemId),
  ]
);

export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, {
      onDelete: 'cascade',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    dueDate: date('due_date').notNull(),
    type: varchar('type', { length: 32 }).notNull().default('custom'), // 'warranty','loan','expiry','maintenance','custom'
    isDismissed: boolean('is_dismissed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_reminders_household_due').on(table.householdId, table.dueDate, table.isDismissed),
  ]
);
