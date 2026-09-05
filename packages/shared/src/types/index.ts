import type {
  HouseholdRole,
  ItemUnit,
  ItemStatus,
  ItemCondition,
  LocationKind,
  ImageKind,
  PriceType,
} from '../constants/index.js';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdDto {
  id: string;
  name: string;
  role: HouseholdRole;
  createdAt: string;
}

export interface LocationDto {
  id: string;
  householdId: string;
  parentId: string | null;
  name: string;
  kind: LocationKind;
  description?: string | null;
  notes?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  path: string;
  depth: number;
  isArchived: boolean;
  itemCount?: number;
  totalValue?: number;
  createdAt: string;
  updatedAt: string;
  children?: LocationDto[];
}

export interface LocationTreeItemDto extends LocationDto {
  directItemCount: number;
  subtreeItemCount: number;
  directContainerCount: number;
  subtreeContainerCount: number;
  children: LocationTreeItemDto[];
}

export interface LocationBreadcrumbDto {
  id: string;
  name: string;
  kind: LocationKind;
  path: string;
}

export interface LocationDirectItemDto {
  id: string;
  placementId: string;
  name: string;
  displayName?: string | null;
  quantity: number;
  unit: ItemUnit;
  isContainer: boolean;
  categoryName?: string | null;
  condition?: string | null;
  notes?: string | null;
  primaryImageUrl?: string | null;
}

export interface LocationDirectContainerDto {
  id: string;
  placementId: string;
  name: string;
  displayName?: string | null;
  quantity: number;
  unit: ItemUnit;
  containedItemCount: number;
  notes?: string | null;
}

export interface LocationDetailDto {
  location: LocationDto;
  breadcrumbs: LocationBreadcrumbDto[];
  children: LocationTreeItemDto[];
  directItems: LocationDirectItemDto[];
  directContainers: LocationDirectContainerDto[];
  summary: {
    directItemCount: number;
    subtreeItemCount: number;
    directContainerCount: number;
    subtreeContainerCount: number;
  };
}

export interface ItemPlacementDto {
  id: string;
  itemId: string;
  locationId: string | null;
  containerItemId: string | null;
  locationName?: string | null;
  locationPath?: string | null;
  containerName?: string | null;
  quantity: number;
  notes?: string | null;
  createdAt: string;
}

export interface ItemImageDto {
  id: string;
  itemId: string;
  cloudinaryPublicId: string;
  url: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  kind: ImageKind;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface PriceHistoryDto {
  id: string;
  itemId: string;
  amountMinor: number;
  currency: string;
  type: PriceType;
  source?: string | null;
  date: string;
  notes?: string | null;
  createdAt: string;
}

export interface ItemDto {
  id: string;
  householdId: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  serialNumber?: string | null;
  sku?: string | null;
  barcode?: string | null;
  qrIdentifier?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  condition: ItemCondition;
  status: ItemStatus;
  totalQuantity: number;
  unit: ItemUnit;
  lowStockThreshold?: number | null;
  isConsumable: boolean;
  isContainer: boolean;
  version: number;
  completenessScore: number;
  primaryImage?: ItemImageDto | null;
  images?: ItemImageDto[];
  placements?: ItemPlacementDto[];
  latestPrice?: PriceHistoryDto | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface HealthCheckDto {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptimeSeconds: number;
  services: {
    database: 'connected' | 'disconnected' | 'unknown';
    cloudinary: 'configured' | 'unconfigured';
  };
}
