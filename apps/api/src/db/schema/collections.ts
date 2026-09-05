import { pgTable, uuid, varchar, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { households } from './households';

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 32 }),
    icon: varchar('icon', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_collections_household_name').on(table.householdId, table.name),
    unique('uq_collections_household_id').on(table.householdId, table.id),
    index('idx_collections_household').on(table.householdId),
  ]
);
