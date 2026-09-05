import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { users } from './users';

export const itemImages = pgTable(
  'item_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id').notNull(),
    itemId: uuid('item_id').notNull(),
    cloudinaryPublicId: varchar('cloudinary_public_id', { length: 255 }).notNull(),
    url: text('url').notNull(),
    secureUrl: text('secure_url').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    format: varchar('format', { length: 32 }).notNull(),
    bytes: integer('bytes').notNull(),
    kind: varchar('kind', { length: 32 }).notNull().default('primary'),
    altText: text('alt_text'),
    sortOrder: integer('sort_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    uploadedBy: uuid('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId, table.itemId],
      foreignColumns: [items.householdId, items.id],
      name: 'fk_item_images_household_item',
    }).onDelete('cascade'),
    index('idx_item_images_item').on(table.itemId),
    index('idx_item_images_primary').on(table.itemId, table.isPrimary),
  ]
);
