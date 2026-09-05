import { z } from 'zod';
import {
  HOUSEHOLD_ROLES,
  ITEM_UNITS,
  ITEM_STATUSES,
  ITEM_CONDITIONS,
  LOCATION_KINDS,
  IMAGE_KINDS,
  ADJUSTMENT_REASONS,
  PRICE_TYPES,
} from '../constants/index.js';

export const householdRoleSchema = z.enum(HOUSEHOLD_ROLES);
export const priceTypeSchema = z.enum(PRICE_TYPES);

export const createPriceHistorySchema = z.object({
  amountMinor: z.number().int().positive('Amount must be a positive integer in minor units'),
  currency: z.string().length(3).default('INR'),
  type: priceTypeSchema.default('purchase'),
  source: z.string().max(128).optional(),
  date: z.string().optional(),
  orderReference: z.string().max(128).optional(),
  notes: z.string().max(500).optional(),
});

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  fullName: z.string().min(1, 'Name is required').max(100),
  householdName: z.string().min(1).max(100).optional().default('My Home'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Location Schemas
export const createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(255),
  parentId: z.string().uuid().nullable().optional(),
  kind: z.enum(LOCATION_KINDS).default('room'),
  description: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  icon: z.string().max(64).optional(),
  color: z.string().max(32).optional(),
  sortOrder: z.number().int().default(0),
});

export const updateLocationSchema = createLocationSchema.partial();

export const reparentLocationSchema = z.object({
  newParentId: z.string().uuid().nullable(),
});

// Item Schemas
export const dimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(['cm', 'in', 'mm', 'm']).default('cm'),
});

export const weightSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['g', 'kg', 'oz', 'lb']).default('g'),
});

// Image Metadata
export const confirmImageUploadSchema = z.object({
  cloudinaryPublicId: z.string().min(1),
  url: z.string().url(),
  secureUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string().min(1),
  bytes: z.number().int().positive(),
  kind: z.enum(IMAGE_KINDS).default('primary'),
  altText: z.string().max(255).optional(),
  isPrimary: z.boolean().default(false),
});

export const signedUploadParamsSchema = z.object({
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const createItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(255),
  displayName: z.string().max(255).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  subcategory: z.string().max(128).optional(),
  brand: z.string().max(128).optional(),
  model: z.string().max(128).optional(),
  variant: z.string().max(128).optional(),
  serialNumber: z.string().max(128).optional(),
  sku: z.string().max(128).optional(),
  barcode: z.string().max(128).optional(),
  color: z.string().max(64).optional(),
  size: z.string().max(64).optional(),
  material: z.string().max(128).optional(),
  dimensions: dimensionsSchema.optional(),
  weight: weightSchema.optional(),
  condition: z.enum(ITEM_CONDITIONS).default('good'),
  status: z.enum(ITEM_STATUSES).default('active'),
  totalQuantity: z.number().positive('Quantity must be greater than 0').default(1),
  unit: z.enum(ITEM_UNITS).default('pcs'),
  lowStockThreshold: z.number().positive().optional(),
  isConsumable: z.boolean().default(false),
  isContainer: z.boolean().default(false),
  initialLocationId: z.string().uuid().optional(),
  initialContainerItemId: z.string().uuid().optional(),
  placementNotes: z.string().max(500).optional(),
  initialImage: confirmImageUploadSchema.optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const updateItemSchema = createItemSchema.partial().extend({
  version: z.number().int().positive('Expected version number for optimistic locking'),
});

// Movement & Placements
export const createPlacementSchema = z
  .object({
    itemId: z.string().uuid('Invalid item ID'),
    locationId: z.string().uuid('Invalid location ID').nullable().optional(),
    containerItemId: z.string().uuid('Invalid container item ID').nullable().optional(),
    quantity: z.number().positive('Placement quantity must be greater than 0'),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (data) => (data.locationId && !data.containerItemId) || (!data.locationId && data.containerItemId),
    { message: 'Placement destination must be either a Location OR a Container Item, not both.' }
  );

export const updatePlacementSchema = z.object({
  quantity: z.number().positive('Quantity must be greater than 0').optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const movePlacementSchema = z.object({
  destinationType: z.enum(['location', 'container']),
  destinationId: z.string().uuid('Invalid destination ID'),
  quantity: z.number().positive('Move quantity must be greater than 0').optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const moveStockSchema = z.object({
  fromLocationId: z.string().uuid().nullable().optional(),
  fromContainerItemId: z.string().uuid().nullable().optional(),
  toLocationId: z.string().uuid().nullable().optional(),
  toContainerItemId: z.string().uuid().nullable().optional(),
  quantity: z.number().positive('Move quantity must be greater than 0'),
  reason: z.string().max(100).default('reorganize'),
}).refine(
  (data) => (data.toLocationId && !data.toContainerItemId) || (!data.toLocationId && data.toContainerItemId),
  { message: 'Destination must be either a Location OR a Container Item, not both.' }
);

export const adjustQuantitySchema = z.object({
  newQuantity: z.number().nonnegative('Quantity cannot be negative'),
  reason: z.enum(ADJUSTMENT_REASONS),
  notes: z.string().max(500).optional(),
  locationId: z.string().uuid().nullable().optional(),
  containerItemId: z.string().uuid().nullable().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type ReparentLocationInput = z.infer<typeof reparentLocationSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type CreatePlacementInput = z.infer<typeof createPlacementSchema>;
export type UpdatePlacementInput = z.infer<typeof updatePlacementSchema>;
export type MovePlacementInput = z.infer<typeof movePlacementSchema>;
export type MoveStockInput = z.infer<typeof moveStockSchema>;
export type AdjustQuantityInput = z.infer<typeof adjustQuantitySchema>;
export type ConfirmImageUploadInput = z.infer<typeof confirmImageUploadSchema>;
export type SignedUploadParamsInput = z.infer<typeof signedUploadParamsSchema>;
