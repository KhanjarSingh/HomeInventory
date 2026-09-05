export const HOUSEHOLD_ROLES = ['owner', 'editor', 'viewer'] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

export const ITEM_UNITS = [
  'pcs',
  'pair',
  'set',
  'box',
  'pack',
  'bottle',
  'ml',
  'l',
  'g',
  'kg',
  'm',
  'custom',
] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

export const ITEM_STATUSES = [
  'active',
  'in_use',
  'stored',
  'loaned',
  'lost',
  'needs_repair',
  'sold',
  'donated',
  'discarded',
  'archived',
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_CONDITIONS = [
  'new',
  'like_new',
  'good',
  'fair',
  'poor',
  'broken',
] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const LOCATION_KINDS = [
  'room',
  'furniture',
  'shelf',
  'bin',
  'storage_area',
  'other',
] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const IMAGE_KINDS = [
  'primary',
  'context',
  'label',
  'contents',
  'packaging',
  'damage',
  'receipt',
  'other',
] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const ADJUSTMENT_REASONS = [
  'initial_count',
  'add',
  'remove',
  'correction',
  'damaged',
  'lost',
  'found',
  'used',
  'donated',
  'disposed',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const PRICE_TYPES = [
  'purchase',
  'estimated_value',
  'replacement_value',
] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_CURRENCY_SYMBOL = '₹';
