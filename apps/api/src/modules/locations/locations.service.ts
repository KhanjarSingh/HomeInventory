import crypto from 'node:crypto';
import { db } from '../../config/db';
import { locations, itemPlacements, items, categories } from '../../db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { AppError } from '../../utils/errors';
import type {
  CreateLocationInput,
  UpdateLocationInput,
  LocationDto,
  LocationTreeItemDto,
  LocationDetailDto,
  LocationBreadcrumbDto,
  LocationDirectItemDto,
  LocationDirectContainerDto,
  LocationKind,
  ItemUnit,
} from '@home-inventory/shared';

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'location'
  );
}

export class LocationsService {
  /**
   * Returns the full hierarchical location tree with direct and subtree item/container counts.
   */
  static async getTree(householdId: string): Promise<LocationTreeItemDto[]> {
    // 1. Fetch all active locations for this household
    const activeLocations = await db
      .select({
        id: locations.id,
        householdId: locations.householdId,
        parentId: locations.parentId,
        name: locations.name,
        kind: locations.kind,
        description: locations.description,
        notes: locations.notes,
        icon: locations.icon,
        color: locations.color,
        sortOrder: locations.sortOrder,
        path: locations.path,
        depth: locations.depth,
        isArchived: locations.isArchived,
        createdAt: locations.createdAt,
        updatedAt: locations.updatedAt,
      })
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          isNull(locations.deletedAt),
          eq(locations.isArchived, false)
        )
      )
      .orderBy(locations.sortOrder, locations.name);

    if (activeLocations.length === 0) {
      return [];
    }

    // 2. Fetch direct placement counts per location
    const placementCounts = await db
      .select({
        locationId: itemPlacements.locationId,
        directItemCount: sql<number>`COUNT(DISTINCT ${itemPlacements.itemId}) FILTER (WHERE ${items.isContainer} = false)::int`,
        directContainerCount: sql<number>`COUNT(DISTINCT ${itemPlacements.itemId}) FILTER (WHERE ${items.isContainer} = true)::int`,
      })
      .from(itemPlacements)
      .innerJoin(items, eq(items.id, itemPlacements.itemId))
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          sql`${itemPlacements.locationId} IS NOT NULL`
        )
      )
      .groupBy(itemPlacements.locationId);

    const countsMap = new Map<
      string,
      { directItemCount: number; directContainerCount: number }
    >();

    for (const row of placementCounts) {
      if (row.locationId) {
        countsMap.set(row.locationId, {
          directItemCount: Number(row.directItemCount) || 0,
          directContainerCount: Number(row.directContainerCount) || 0,
        });
      }
    }

    // 3. Compute subtree counts using path prefixes
    const itemsWithCounts: Array<LocationTreeItemDto> = activeLocations.map((loc) => {
      const direct = countsMap.get(loc.id) || { directItemCount: 0, directContainerCount: 0 };

      // Subtree count is sum of direct counts for all locations where path starts with loc.path
      let subtreeItemCount = 0;
      let subtreeContainerCount = 0;

      for (const otherLoc of activeLocations) {
        if (otherLoc.path.startsWith(loc.path)) {
          const otherDirect = countsMap.get(otherLoc.id);
          if (otherDirect) {
            subtreeItemCount += otherDirect.directItemCount;
            subtreeContainerCount += otherDirect.directContainerCount;
          }
        }
      }

      return {
        id: loc.id,
        householdId: loc.householdId,
        parentId: loc.parentId,
        name: loc.name,
        kind: loc.kind as LocationKind,
        description: loc.description,
        notes: loc.notes,
        icon: loc.icon,
        color: loc.color,
        sortOrder: loc.sortOrder,
        path: loc.path,
        depth: loc.depth,
        isArchived: loc.isArchived,
        createdAt: loc.createdAt.toISOString(),
        updatedAt: loc.updatedAt.toISOString(),
        directItemCount: direct.directItemCount,
        subtreeItemCount,
        directContainerCount: direct.directContainerCount,
        subtreeContainerCount,
        children: [],
      };
    });

    // 4. Build hierarchical tree structure
    const nodeMap = new Map<string, LocationTreeItemDto>();
    for (const item of itemsWithCounts) {
      nodeMap.set(item.id, item);
    }

    const rootNodes: LocationTreeItemDto[] = [];

    for (const item of itemsWithCounts) {
      if (item.parentId && nodeMap.has(item.parentId)) {
        const parent = nodeMap.get(item.parentId)!;
        parent.children.push(item);
      } else {
        rootNodes.push(item);
      }
    }

    return rootNodes;
  }

  /**
   * Retrieves single location details, breadcrumb path, children, placed items & containers, and subtree summary.
   */
  static async getById(householdId: string, locationId: string): Promise<LocationDetailDto> {
    const [location] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          eq(locations.id, locationId),
          isNull(locations.deletedAt)
        )
      )
      .limit(1);

    if (!location) {
      throw AppError.notFound('Location not found in this household');
    }

    // 1. Resolve breadcrumbs from root down to this location
    const allAncestors = await db
      .select({
        id: locations.id,
        name: locations.name,
        kind: locations.kind,
        path: locations.path,
        depth: locations.depth,
      })
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          isNull(locations.deletedAt)
        )
      )
      .orderBy(locations.depth);

    const breadcrumbs: LocationBreadcrumbDto[] = allAncestors
      .filter((loc) => location.path.startsWith(loc.path))
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        kind: loc.kind as LocationKind,
        path: loc.path,
      }));

    // 2. Immediate children
    const childLocations = await db
      .select({
        id: locations.id,
        householdId: locations.householdId,
        parentId: locations.parentId,
        name: locations.name,
        kind: locations.kind,
        description: locations.description,
        notes: locations.notes,
        icon: locations.icon,
        color: locations.color,
        sortOrder: locations.sortOrder,
        path: locations.path,
        depth: locations.depth,
        isArchived: locations.isArchived,
        createdAt: locations.createdAt,
        updatedAt: locations.updatedAt,
      })
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          eq(locations.parentId, locationId),
          isNull(locations.deletedAt),
          eq(locations.isArchived, false)
        )
      )
      .orderBy(locations.sortOrder, locations.name);

    // 3. Direct placements at this location
    const placements = await db
      .select({
        placementId: itemPlacements.id,
        quantity: itemPlacements.quantity,
        placementNotes: itemPlacements.notes,
        itemId: items.id,
        name: items.name,
        displayName: items.displayName,
        unit: items.unit,
        isContainer: items.isContainer,
        condition: items.condition,
        categoryName: categories.name,
      })
      .from(itemPlacements)
      .innerJoin(items, eq(items.id, itemPlacements.itemId))
      .leftJoin(categories, eq(categories.id, items.categoryId))
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.locationId, locationId)
        )
      );

    const directItems: LocationDirectItemDto[] = [];
    const directContainers: LocationDirectContainerDto[] = [];

    // For containers, calculate how many items are placed inside each container
    const containerItemCounts = await db
      .select({
        containerItemId: itemPlacements.containerItemId,
        count: sql<number>`COUNT(DISTINCT ${itemPlacements.itemId})::int`,
      })
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          sql`${itemPlacements.containerItemId} IS NOT NULL`
        )
      )
      .groupBy(itemPlacements.containerItemId);

    const containerCountsMap = new Map<string, number>();
    for (const c of containerItemCounts) {
      if (c.containerItemId) {
        containerCountsMap.set(c.containerItemId, Number(c.count) || 0);
      }
    }

    for (const p of placements) {
      if (p.isContainer) {
        directContainers.push({
          id: p.itemId,
          placementId: p.placementId,
          name: p.name,
          displayName: p.displayName,
          quantity: Number(p.quantity) || 1,
          unit: p.unit as ItemUnit,
          containedItemCount: containerCountsMap.get(p.itemId) || 0,
          notes: p.placementNotes,
        });
      } else {
        directItems.push({
          id: p.itemId,
          placementId: p.placementId,
          name: p.name,
          displayName: p.displayName,
          quantity: Number(p.quantity) || 1,
          unit: p.unit as ItemUnit,
          isContainer: false,
          categoryName: p.categoryName,
          condition: p.condition,
          notes: p.placementNotes,
        });
      }
    }

    // 4. Subtree Summary Counts
    const [subtreeSummary] = await db
      .select({
        subtreeItemCount: sql<number>`COUNT(DISTINCT ${itemPlacements.itemId}) FILTER (WHERE ${items.isContainer} = false)::int`,
        subtreeContainerCount: sql<number>`COUNT(DISTINCT ${itemPlacements.itemId}) FILTER (WHERE ${items.isContainer} = true)::int`,
      })
      .from(itemPlacements)
      .innerJoin(items, eq(items.id, itemPlacements.itemId))
      .innerJoin(locations, eq(locations.id, itemPlacements.locationId))
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          sql`${locations.path} LIKE ${location.path + '%'}`,
          isNull(locations.deletedAt)
        )
      );

    const locationDto: LocationDto = {
      id: location.id,
      householdId: location.householdId,
      parentId: location.parentId,
      name: location.name,
      kind: location.kind as LocationKind,
      description: location.description,
      notes: location.notes,
      icon: location.icon,
      color: location.color,
      sortOrder: location.sortOrder,
      path: location.path,
      depth: location.depth,
      isArchived: location.isArchived,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    };

    const childrenDtos: LocationTreeItemDto[] = childLocations.map((c) => ({
      id: c.id,
      householdId: c.householdId,
      parentId: c.parentId,
      name: c.name,
      kind: c.kind as LocationKind,
      description: c.description,
      notes: c.notes,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
      path: c.path,
      depth: c.depth,
      isArchived: c.isArchived,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      directItemCount: 0,
      subtreeItemCount: 0,
      directContainerCount: 0,
      subtreeContainerCount: 0,
      children: [],
    }));

    return {
      location: locationDto,
      breadcrumbs,
      children: childrenDtos,
      directItems,
      directContainers,
      summary: {
        directItemCount: directItems.length,
        subtreeItemCount: Number(subtreeSummary?.subtreeItemCount) || 0,
        directContainerCount: directContainers.length,
        subtreeContainerCount: Number(subtreeSummary?.subtreeContainerCount) || 0,
      },
    };
  }

  /**
   * Creates a new location in the household hierarchy.
   */
  static async create(householdId: string, input: CreateLocationInput): Promise<LocationDto> {
    const id = crypto.randomUUID();
    const slug = slugify(input.name);

    let parentPath = '/';
    let parentDepth = 0;

    if (input.parentId) {
      const [parent] = await db
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.householdId, householdId),
            eq(locations.id, input.parentId),
            isNull(locations.deletedAt)
          )
        )
        .limit(1);

      if (!parent) {
        throw AppError.badRequest('Parent location does not exist in this household');
      }

      parentPath = parent.path;
      parentDepth = parent.depth + 1;
    }

    const path = input.parentId
      ? `${parentPath}${slug}-${id.slice(0, 8)}/`
      : `/${slug}-${id.slice(0, 8)}/`;

    const [created] = await db
      .insert(locations)
      .values({
        id,
        householdId,
        parentId: input.parentId || null,
        name: input.name,
        kind: input.kind,
        description: input.description,
        notes: input.notes,
        icon: input.icon,
        color: input.color,
        sortOrder: input.sortOrder ?? 0,
        path,
        depth: parentDepth,
      })
      .returning();

    if (!created) {
      throw AppError.internal('Failed to create location record');
    }

    return {
      id: created.id,
      householdId: created.householdId,
      parentId: created.parentId,
      name: created.name,
      kind: created.kind as LocationKind,
      description: created.description,
      notes: created.notes,
      icon: created.icon,
      color: created.color,
      sortOrder: created.sortOrder,
      path: created.path,
      depth: created.depth,
      isArchived: created.isArchived,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Updates an existing location's metadata.
   */
  static async update(
    householdId: string,
    locationId: string,
    input: UpdateLocationInput
  ): Promise<LocationDto> {
    const [existing] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          eq(locations.id, locationId),
          isNull(locations.deletedAt)
        )
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound('Location not found in this household');
    }

    const updateData: Partial<typeof locations.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.kind !== undefined) updateData.kind = input.kind;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

    const [updated] = await db
      .update(locations)
      .set(updateData)
      .where(
        and(
          eq(locations.householdId, householdId),
          eq(locations.id, locationId)
        )
      )
      .returning();

    if (!updated) {
      throw AppError.internal('Failed to update location');
    }

    return {
      id: updated.id,
      householdId: updated.householdId,
      parentId: updated.parentId,
      name: updated.name,
      kind: updated.kind as LocationKind,
      description: updated.description,
      notes: updated.notes,
      icon: updated.icon,
      color: updated.color,
      sortOrder: updated.sortOrder,
      path: updated.path,
      depth: updated.depth,
      isArchived: updated.isArchived,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Moves a location under a new parent or to the top-level root.
   * Strictly enforces:
   * 1. Self-parenting prevention: newParentId !== locationId
   * 2. Circular hierarchy prevention: newParent's path must NOT start with target's path
   * 3. Atomically updates path and depth for the target and all its recursive descendants
   */
  static async reparent(
    householdId: string,
    locationId: string,
    newParentId: string | null
  ): Promise<LocationDto> {
    // 1. Prevent self-parenting
    if (newParentId === locationId) {
      throw AppError.badRequest('A location cannot be its own parent');
    }

    // 2. Fetch target location
    const [target] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          eq(locations.id, locationId),
          isNull(locations.deletedAt)
        )
      )
      .limit(1);

    if (!target) {
      throw AppError.notFound('Location not found in this household');
    }

    // If newParentId matches current parentId, it is a no-op
    if (target.parentId === newParentId) {
      return {
        id: target.id,
        householdId: target.householdId,
        parentId: target.parentId,
        name: target.name,
        kind: target.kind as LocationKind,
        description: target.description,
        notes: target.notes,
        icon: target.icon,
        color: target.color,
        sortOrder: target.sortOrder,
        path: target.path,
        depth: target.depth,
        isArchived: target.isArchived,
        createdAt: target.createdAt.toISOString(),
        updatedAt: target.updatedAt.toISOString(),
      };
    }

    let newParentPath = '/';
    let newTargetDepth = 0;

    if (newParentId !== null) {
      const [newParent] = await db
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.householdId, householdId),
            eq(locations.id, newParentId),
            isNull(locations.deletedAt)
          )
        )
        .limit(1);

      if (!newParent) {
        throw AppError.badRequest('Destination parent location not found in this household');
      }

      // 3. Cycle prevention: Destination path MUST NOT start with target path!
      if (newParent.path.startsWith(target.path)) {
        throw AppError.badRequest(
          'Cannot move a location into itself or one of its descendants (circular hierarchy detected)'
        );
      }

      newParentPath = newParent.path;
      newTargetDepth = newParent.depth + 1;
    }

    // Extract target segment from existing path, or build one
    const slug = slugify(target.name);
    const targetSegment = `${slug}-${target.id.slice(0, 8)}/`;

    const oldTargetPath = target.path;
    const newTargetPath = newParentId !== null
      ? `${newParentPath}${targetSegment}`
      : `/${targetSegment}`;

    const depthDelta = newTargetDepth - target.depth;

    // 4. Atomic transaction updating target and all descendants
    return await db.transaction(async (tx) => {
      // Find all descendants of target (all locations whose path starts with oldTargetPath)
      const descendants = await tx
        .select({
          id: locations.id,
          path: locations.path,
          depth: locations.depth,
        })
        .from(locations)
        .where(
          and(
            eq(locations.householdId, householdId),
            sql`${locations.path} LIKE ${oldTargetPath + '%'}`,
            sql`${locations.id} != ${target.id}`
          )
        );

      // Update descendants
      for (const desc of descendants) {
        const subSuffix = desc.path.slice(oldTargetPath.length);
        const newDescPath = `${newTargetPath}${subSuffix}`;
        const newDescDepth = desc.depth + depthDelta;

        await tx
          .update(locations)
          .set({
            path: newDescPath,
            depth: newDescDepth,
            updatedAt: new Date(),
          })
          .where(eq(locations.id, desc.id));
      }

      // Update target location
      const [updatedTarget] = await tx
        .update(locations)
        .set({
          parentId: newParentId,
          path: newTargetPath,
          depth: newTargetDepth,
          updatedAt: new Date(),
        })
        .where(eq(locations.id, target.id))
        .returning();

      if (!updatedTarget) {
        throw AppError.internal('Failed to reparent location');
      }

      return {
        id: updatedTarget.id,
        householdId: updatedTarget.householdId,
        parentId: updatedTarget.parentId,
        name: updatedTarget.name,
        kind: updatedTarget.kind as LocationKind,
        description: updatedTarget.description,
        notes: updatedTarget.notes,
        icon: updatedTarget.icon,
        color: updatedTarget.color,
        sortOrder: updatedTarget.sortOrder,
        path: updatedTarget.path,
        depth: updatedTarget.depth,
        isArchived: updatedTarget.isArchived,
        createdAt: updatedTarget.createdAt.toISOString(),
        updatedAt: updatedTarget.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Safely deletes or archives a location.
   * If items/containers are stationed here or in descendants, prevents hard deletion and archives safely.
   */
  static async archiveOrDelete(
    householdId: string,
    locationId: string
  ): Promise<{ success: boolean; action: 'deleted' | 'archived' }> {
    const [target] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          eq(locations.id, locationId),
          isNull(locations.deletedAt)
        )
      )
      .limit(1);

    if (!target) {
      throw AppError.notFound('Location not found in this household');
    }

    // Check if any items are placed in this location or any descendant location
    const [placedCheck] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(itemPlacements)
      .innerJoin(locations, eq(locations.id, itemPlacements.locationId))
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          sql`${locations.path} LIKE ${target.path + '%'}`
        )
      );

    const hasPlacedItems = Number(placedCheck?.count) > 0;

    if (hasPlacedItems) {
      // Archive instead of deleting to preserve placement history & foreign key integrity
      await db
        .update(locations)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(
          and(
            eq(locations.householdId, householdId),
            sql`${locations.path} LIKE ${target.path + '%'}`
          )
        );

      return { success: true, action: 'archived' };
    }

    // If completely empty, mark as soft deleted
    await db
      .update(locations)
      .set({
        deletedAt: new Date(),
        isArchived: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(locations.householdId, householdId),
          sql`${locations.path} LIKE ${target.path + '%'}`
        )
      );

    return { success: true, action: 'deleted' };
  }
}
