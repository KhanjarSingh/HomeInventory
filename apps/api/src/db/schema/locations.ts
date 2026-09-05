import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { households } from './households';

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => locations.id, {
      onDelete: 'restrict',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 64 }).notNull().default('room'),
    description: text('description'),
    notes: text('notes'),
    icon: varchar('icon', { length: 64 }),
    color: varchar('color', { length: 32 }),
    sortOrder: integer('sort_order').notNull().default(0),
    path: text('path').notNull(), // Materialized path, e.g. "/root-uuid/child-uuid/"
    depth: integer('depth').notNull().default(0),
    isArchived: boolean('is_archived').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_locations_household_id').on(table.householdId, table.id),
    index('idx_locations_household_path').on(table.householdId, table.path),
    index('idx_locations_household_parent').on(table.householdId, table.parentId),
    index('idx_locations_household_active').on(table.householdId, table.deletedAt, table.isArchived),
  ]
);
