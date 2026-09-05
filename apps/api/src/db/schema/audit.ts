import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { households } from './households';
import { users } from './users';

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    changes: jsonb('changes'), // { before, after }
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_log_household').on(table.householdId),
    index('idx_audit_log_entity').on(table.entityType, table.entityId),
    index('idx_audit_log_created_at').on(table.createdAt),
  ]
);

export const qrLabels = pgTable(
  'qr_labels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 128 }).notNull().unique(),
    entityType: varchar('entity_type', { length: 32 }).notNull(), // 'item','container','location'
    entityId: uuid('entity_id').notNull(),
    labelTitle: varchar('label_title', { length: 255 }),
    printedAt: timestamp('printed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qr_labels_code').on(table.code),
    index('idx_qr_labels_entity').on(table.householdId, table.entityType, table.entityId),
  ]
);

export const importJobs = pgTable(
  'import_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    filename: varchar('filename', { length: 255 }).notNull(),
    totalRows: integer('total_rows').notNull().default(0),
    validRows: integer('valid_rows').notNull().default(0),
    invalidRows: integer('invalid_rows').notNull().default(0),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    errors: jsonb('errors'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_import_jobs_household').on(table.householdId),
  ]
);
