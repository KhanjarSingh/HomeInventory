import { db } from '../../config/db';
import { items, itemImages, categories, itemPlacements } from '../../db/schema';
import { eq, and, isNull, desc, asc, sql, inArray, ilike } from 'drizzle-orm';
import { AppError } from '../../utils/errors';
import { PlacementsService } from '../placements/placements.service';
import type {
  CreateItemInput,
  UpdateItemInput,
  ConfirmImageUploadInput,
  ItemSummaryDto,
  ItemDetailDto,
  ItemImageDto,
  ItemUnit,
  ItemCondition,
  ItemStatus,
} from '@home-inventory/shared';

export class ItemsService {
  /**
   * Creates a new inventory item, optionally with an initial image and placement in one transaction.
   */
  static async createItem(
    householdId: string,
    input: CreateItemInput,
    userId?: string
  ): Promise<ItemDetailDto> {
    // 1. Verify category exists if provided
    if (input.categoryId) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.householdId, householdId),
            eq(categories.id, input.categoryId)
          )
        )
        .limit(1);

      if (!category) {
        throw AppError.badRequest('Selected category does not exist in this household');
      }
    }

    // 2. Insert item
    const [newItem] = await db
      .insert(items)
      .values({
        householdId,
        name: input.name.trim(),
        displayName: input.displayName?.trim() || null,
        description: input.description?.trim() || null,
        categoryId: input.categoryId || null,
        subcategory: input.subcategory?.trim() || null,
        brand: input.brand?.trim() || null,
        model: input.model?.trim() || null,
        variant: input.variant?.trim() || null,
        serialNumber: input.serialNumber?.trim() || null,
        sku: input.sku?.trim() || null,
        barcode: input.barcode?.trim() || null,
        color: input.color?.trim() || null,
        size: input.size?.trim() || null,
        material: input.material?.trim() || null,
        dimensions: input.dimensions || null,
        weight: input.weight || null,
        condition: input.condition || 'good',
        status: input.status || 'active',
        totalQuantity: input.totalQuantity.toString(),
        unit: input.unit || 'pcs',
        lowStockThreshold: input.lowStockThreshold?.toString() || null,
        isConsumable: input.isConsumable ?? false,
        isContainer: input.isContainer ?? false,
      })
      .returning();

    if (!newItem) {
      throw AppError.internal('Failed to create item');
    }

    // 3. Attach initial image if provided
    if (input.initialImage) {
      await db.insert(itemImages).values({
        householdId,
        itemId: newItem.id,
        cloudinaryPublicId: input.initialImage.cloudinaryPublicId,
        url: input.initialImage.url,
        secureUrl: input.initialImage.secureUrl,
        width: input.initialImage.width,
        height: input.initialImage.height,
        format: input.initialImage.format,
        bytes: input.initialImage.bytes,
        kind: input.initialImage.kind || 'primary',
        altText: input.initialImage.altText || null,
        isPrimary: true,
        sortOrder: 0,
        uploadedBy: userId || null,
      });
    }

    // 4. Create initial placement if destination provided
    if (input.initialLocationId || input.initialContainerItemId) {
      await PlacementsService.createPlacement(
        householdId,
        {
          itemId: newItem.id,
          locationId: input.initialLocationId || null,
          containerItemId: input.initialContainerItemId || null,
          quantity: input.totalQuantity,
          notes: input.placementNotes || null,
        },
        userId
      );
    }

    return this.getItemById(householdId, newItem.id);
  }

  /**
   * Retrieves a list of items for the household with primary image and physical breadcrumbs.
   */
  static async getItems(
    householdId: string,
    query?: { categoryId?: string; search?: string; isContainer?: boolean }
  ): Promise<ItemSummaryDto[]> {
    // 1. Fetch active items
    const conditions = [eq(items.householdId, householdId), isNull(items.deletedAt)];

    if (query?.categoryId) {
      conditions.push(eq(items.categoryId, query.categoryId));
    }
    if (query?.isContainer !== undefined) {
      conditions.push(eq(items.isContainer, query.isContainer));
    }
    if (query?.search && query.search.trim()) {
      const searchTerm = `%${query.search.trim()}%`;
      conditions.push(ilike(items.name, searchTerm));
    }

    const itemList = await db
      .select({
        id: items.id,
        householdId: items.householdId,
        name: items.name,
        displayName: items.displayName,
        description: items.description,
        categoryId: items.categoryId,
        categoryName: categories.name,
        totalQuantity: items.totalQuantity,
        unit: items.unit,
        isContainer: items.isContainer,
        condition: items.condition,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
      })
      .from(items)
      .leftJoin(categories, eq(categories.id, items.categoryId))
      .where(and(...conditions))
      .orderBy(desc(items.createdAt));

    if (itemList.length === 0) {
      return [];
    }

    const itemIds = itemList.map((i) => i.id);

    // 2. Batch fetch primary images
    const primaryImages = await db
      .select()
      .from(itemImages)
      .where(
        and(
          eq(itemImages.householdId, householdId),
          inArray(itemImages.itemId, itemIds),
          eq(itemImages.isPrimary, true)
        )
      );

    const imageMap = new Map<string, ItemImageDto>();
    for (const img of primaryImages) {
      imageMap.set(img.itemId, {
        id: img.id,
        itemId: img.itemId,
        cloudinaryPublicId: img.cloudinaryPublicId,
        url: img.url,
        secureUrl: img.secureUrl,
        width: img.width,
        height: img.height,
        format: img.format,
        bytes: img.bytes,
        kind: img.kind as any,
        altText: img.altText,
        sortOrder: img.sortOrder,
        isPrimary: img.isPrimary,
        createdAt: img.createdAt.toISOString(),
      });
    }

    // 3. Batch fetch placements to compute placed quantity and primary breadcrumb
    const placements = await db
      .select()
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          inArray(itemPlacements.itemId, itemIds)
        )
      );

    const placementMap = new Map<string, (typeof placements)[0][]>();
    for (const p of placements) {
      const arr = placementMap.get(p.itemId) || [];
      arr.push(p);
      placementMap.set(p.itemId, arr);
    }

    // 4. Batch resolve breadcrumbs for first placements across items
    const distinctTargets = new Map<string, { locationId: string | null; containerItemId: string | null }>();
    for (const item of itemList) {
      const itemPlacementsList = placementMap.get(item.id) || [];
      if (itemPlacementsList.length > 0 && itemPlacementsList[0]) {
        const first = itemPlacementsList[0];
        const key = `${first.locationId || 'null'}:${first.containerItemId || 'null'}`;
        if (!distinctTargets.has(key)) {
          distinctTargets.set(key, {
            locationId: first.locationId,
            containerItemId: first.containerItemId,
          });
        }
      }
    }

    const breadcrumbCache = new Map<string, { breadcrumbs: any[]; breadcrumbString: string }>();
    await Promise.all(
      Array.from(distinctTargets.entries()).map(async ([key, target]) => {
        const resolved = await PlacementsService.resolveBreadcrumbs(
          householdId,
          target.locationId,
          target.containerItemId
        );
        breadcrumbCache.set(key, resolved);
      })
    );

    const summaries: ItemSummaryDto[] = [];

    for (const item of itemList) {
      const itemPlacementsList = placementMap.get(item.id) || [];
      let placedQty = 0;
      for (const p of itemPlacementsList) {
        placedQty += parseFloat(p.quantity);
      }

      const totalQty = parseFloat(item.totalQuantity);
      const unplacedQty = Math.max(0, totalQty - placedQty);

      let breadcrumbs: any[] = [{ type: 'unplaced', id: 'unplaced', name: 'Unplaced' }];
      let breadcrumbString = 'Unplaced';

      // Use the first placement's location as primary breadcrumb
      if (itemPlacementsList.length > 0 && itemPlacementsList[0]) {
        const firstPlacement = itemPlacementsList[0];
        const cacheKey = `${firstPlacement.locationId || 'null'}:${firstPlacement.containerItemId || 'null'}`;
        const resolved = breadcrumbCache.get(cacheKey);
        if (resolved) {
          breadcrumbs = resolved.breadcrumbs;
          breadcrumbString = resolved.breadcrumbString;
        }
        if (itemPlacementsList.length > 1) {
          breadcrumbString += ` (+${itemPlacementsList.length - 1} other places)`;
        }
      }

      summaries.push({
        id: item.id,
        householdId: item.householdId,
        name: item.name,
        displayName: item.displayName,
        description: item.description,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        totalQuantity: totalQty,
        placedQuantity: placedQty,
        unplacedQuantity: unplacedQty,
        unit: item.unit as ItemUnit,
        isContainer: item.isContainer,
        condition: item.condition as ItemCondition,
        primaryImage: imageMap.get(item.id) || null,
        breadcrumbs,
        breadcrumbString,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      });
    }

    return summaries;
  }

  /**
   * Retrieves single item detail with full image gallery, category, and resolved placements.
   */
  static async getItemById(householdId: string, itemId: string): Promise<ItemDetailDto> {
    const [item] = await db
      .select({
        id: items.id,
        householdId: items.householdId,
        name: items.name,
        displayName: items.displayName,
        description: items.description,
        categoryId: items.categoryId,
        categoryName: categories.name,
        subcategory: items.subcategory,
        brand: items.brand,
        model: items.model,
        variant: items.variant,
        serialNumber: items.serialNumber,
        sku: items.sku,
        barcode: items.barcode,
        qrIdentifier: items.qrIdentifier,
        color: items.color,
        size: items.size,
        material: items.material,
        dimensions: items.dimensions,
        weight: items.weight,
        condition: items.condition,
        status: items.status,
        totalQuantity: items.totalQuantity,
        unit: items.unit,
        lowStockThreshold: items.lowStockThreshold,
        isConsumable: items.isConsumable,
        isContainer: items.isContainer,
        version: items.version,
        completenessScore: items.completenessScore,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
        deletedAt: items.deletedAt,
      })
      .from(items)
      .leftJoin(categories, eq(categories.id, items.categoryId))
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.id, itemId),
          isNull(items.deletedAt)
        )
      )
      .limit(1);

    if (!item) {
      throw AppError.notFound('Item not found in this household');
    }

    // Fetch images ordered with primary first
    const imageRows = await db
      .select()
      .from(itemImages)
      .where(
        and(
          eq(itemImages.householdId, householdId),
          eq(itemImages.itemId, itemId)
        )
      )
      .orderBy(desc(itemImages.isPrimary), asc(itemImages.sortOrder), asc(itemImages.createdAt));

    const images: ItemImageDto[] = imageRows.map((img) => ({
      id: img.id,
      itemId: img.itemId,
      cloudinaryPublicId: img.cloudinaryPublicId,
      url: img.url,
      secureUrl: img.secureUrl,
      width: img.width,
      height: img.height,
      format: img.format,
      bytes: img.bytes,
      kind: img.kind as any,
      altText: img.altText,
      sortOrder: img.sortOrder,
      isPrimary: img.isPrimary,
      createdAt: img.createdAt.toISOString(),
    }));

    const primaryImage = images.find((img) => img.isPrimary) || images[0] || null;

    // Fetch resolved placements & stock breakdown
    const locationsSummary = await PlacementsService.getItemLocations(householdId, itemId);

    return {
      id: item.id,
      householdId: item.householdId,
      name: item.name,
      displayName: item.displayName,
      description: item.description,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      subcategory: item.subcategory,
      brand: item.brand,
      model: item.model,
      variant: item.variant,
      serialNumber: item.serialNumber,
      sku: item.sku,
      barcode: item.barcode,
      qrIdentifier: item.qrIdentifier,
      color: item.color,
      size: item.size,
      material: item.material,
      condition: item.condition as ItemCondition,
      status: item.status as ItemStatus,
      totalQuantity: parseFloat(item.totalQuantity),
      placedQuantity: locationsSummary.placedQuantity,
      unplacedQuantity: locationsSummary.unplacedQuantity,
      unit: item.unit as ItemUnit,
      lowStockThreshold: item.lowStockThreshold ? parseFloat(item.lowStockThreshold) : null,
      isConsumable: item.isConsumable,
      isContainer: item.isContainer,
      version: item.version,
      completenessScore: item.completenessScore,
      primaryImage,
      images,
      resolvedPlacements: locationsSummary.placements,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
    };
  }

  /**
   * Updates item metadata with optimistic locking.
   */
  static async updateItem(
    householdId: string,
    itemId: string,
    input: UpdateItemInput,
    _userId?: string
  ): Promise<ItemDetailDto> {
    const [existing] = await db
      .select({ id: items.id, version: items.version })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.id, itemId),
          isNull(items.deletedAt)
        )
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound('Item not found');
    }

    if (input.version !== undefined && input.version !== existing.version) {
      throw AppError.conflict('Item was updated by another user. Please refresh.');
    }

    // Verify category if changed
    if (input.categoryId) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.householdId, householdId),
            eq(categories.id, input.categoryId)
          )
        )
        .limit(1);

      if (!category) {
        throw AppError.badRequest('Selected category does not exist in this household');
      }
    }

    await db
      .update(items)
      .set({
        name: input.name !== undefined ? input.name.trim() : undefined,
        displayName: input.displayName !== undefined ? input.displayName?.trim() || null : undefined,
        description: input.description !== undefined ? input.description?.trim() || null : undefined,
        categoryId: input.categoryId !== undefined ? input.categoryId || null : undefined,
        brand: input.brand !== undefined ? input.brand?.trim() || null : undefined,
        model: input.model !== undefined ? input.model?.trim() || null : undefined,
        condition: input.condition || undefined,
        totalQuantity: input.totalQuantity !== undefined ? input.totalQuantity.toString() : undefined,
        unit: input.unit || undefined,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(items.id, itemId));

    return this.getItemById(householdId, itemId);
  }

  /**
   * Soft deletes an item.
   */
  static async deleteItem(householdId: string, itemId: string, _userId?: string): Promise<void> {
    const [existing] = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.id, itemId),
          isNull(items.deletedAt)
        )
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound('Item not found');
    }

    await db
      .update(items)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(items.id, itemId));
  }

  /**
   * Adds an image to an item's gallery.
   */
  static async addImageToItem(
    householdId: string,
    itemId: string,
    input: ConfirmImageUploadInput,
    userId?: string
  ): Promise<ItemImageDto> {
    const [item] = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.id, itemId),
          isNull(items.deletedAt)
        )
      )
      .limit(1);

    if (!item) {
      throw AppError.notFound('Item not found');
    }

    // Check if item currently has any images
    const [countRow] = await db
      .select({ count: sql<string>`count(*)` })
      .from(itemImages)
      .where(and(eq(itemImages.householdId, householdId), eq(itemImages.itemId, itemId)));

    const imageCount = parseInt(countRow?.count || '0', 10);
    const shouldBePrimary = input.isPrimary || imageCount === 0;

    if (shouldBePrimary) {
      // Unset previous primary
      await db
        .update(itemImages)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(itemImages.householdId, householdId),
            eq(itemImages.itemId, itemId),
            eq(itemImages.isPrimary, true)
          )
        );
    }

    const [newImage] = await db
      .insert(itemImages)
      .values({
        householdId,
        itemId,
        cloudinaryPublicId: input.cloudinaryPublicId,
        url: input.url,
        secureUrl: input.secureUrl,
        width: input.width,
        height: input.height,
        format: input.format,
        bytes: input.bytes,
        kind: input.kind || (shouldBePrimary ? 'primary' : 'other'),
        altText: input.altText || null,
        isPrimary: shouldBePrimary,
        sortOrder: imageCount,
        uploadedBy: userId || null,
      })
      .returning();

    return {
      id: newImage!.id,
      itemId: newImage!.itemId,
      cloudinaryPublicId: newImage!.cloudinaryPublicId,
      url: newImage!.url,
      secureUrl: newImage!.secureUrl,
      width: newImage!.width,
      height: newImage!.height,
      format: newImage!.format,
      bytes: newImage!.bytes,
      kind: newImage!.kind as any,
      altText: newImage!.altText,
      sortOrder: newImage!.sortOrder,
      isPrimary: newImage!.isPrimary,
      createdAt: newImage!.createdAt.toISOString(),
    };
  }

  /**
   * Sets a specific image as primary cover image.
   */
  static async setPrimaryImage(
    householdId: string,
    itemId: string,
    imageId: string,
    _userId?: string
  ): Promise<void> {
    const [targetImage] = await db
      .select({ id: itemImages.id })
      .from(itemImages)
      .where(
        and(
          eq(itemImages.householdId, householdId),
          eq(itemImages.itemId, itemId),
          eq(itemImages.id, imageId)
        )
      )
      .limit(1);

    if (!targetImage) {
      throw AppError.notFound('Image not found for this item');
    }

    await db.transaction(async (tx) => {
      // Reset all to false
      await tx
        .update(itemImages)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(itemImages.householdId, householdId),
            eq(itemImages.itemId, itemId)
          )
        );

      // Set target to true
      await tx
        .update(itemImages)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(itemImages.id, imageId));
    });
  }

  /**
   * Deletes an image and automatically promotes another image to primary if needed.
   */
  static async deleteImage(
    householdId: string,
    itemId: string,
    imageId: string,
    _userId?: string
  ): Promise<void> {
    const [targetImage] = await db
      .select()
      .from(itemImages)
      .where(
        and(
          eq(itemImages.householdId, householdId),
          eq(itemImages.itemId, itemId),
          eq(itemImages.id, imageId)
        )
      )
      .limit(1);

    if (!targetImage) {
      throw AppError.notFound('Image not found');
    }

    await db.transaction(async (tx) => {
      await tx.delete(itemImages).where(eq(itemImages.id, imageId));

      // If the deleted image was primary, promote next remaining image
      if (targetImage.isPrimary) {
        const [nextImage] = await tx
          .select({ id: itemImages.id })
          .from(itemImages)
          .where(
            and(
              eq(itemImages.householdId, householdId),
              eq(itemImages.itemId, itemId)
            )
          )
          .orderBy(asc(itemImages.sortOrder), asc(itemImages.createdAt))
          .limit(1);

        if (nextImage) {
          await tx
            .update(itemImages)
            .set({ isPrimary: true, updatedAt: new Date() })
            .where(eq(itemImages.id, nextImage.id));
        }
      }
    });
  }
}
