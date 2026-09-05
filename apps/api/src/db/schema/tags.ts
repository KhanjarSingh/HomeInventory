import { pgTable, uuid, varchar, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { households } from './households';

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull(),
    color: varchar('color', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_tags_household_name').on(table.householdId, table.name),
    unique('uq_tags_household_id').on(table.householdId, table.id),
    index('idx_tags_household').on(table.householdId),
  ]
);
