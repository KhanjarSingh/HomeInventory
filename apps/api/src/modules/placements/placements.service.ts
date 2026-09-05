import { db } from '../../config/db';
import { itemPlacements, items, locations, movements, categories } from '../../db/schema';
import { eq, and, sql, desc, asc, isNull, inArray } from 'drizzle-orm';
import { AppError } from '../../utils/errors';
import type {
  CreatePlacementInput,
  UpdatePlacementInput,
  MovePlacementInput,
  PhysicalBreadcrumbSegmentDto,
  ResolvedPlacementDto,
  ItemLocationsSummaryDto,
  ContainerSummaryDto,
  ContainerContentItemDto,
} from '@home-inventory/shared';

export class PlacementsService {
  /**
   * Resolves the full physical breadcrumb trail for an item or container.
   *
   * Example output:
   * [
   *   { type: 'location', id: '...', name: 'Big Bedroom', kind: 'room' },
   *   { type: 'location', id: '...', name: 'Wardrobe', kind: 'wardrobe' },
   *   { type: 'location', id: '...', name: 'Bottom Shelf', kind: 'shelf' },
   *   { type: 'container', id: '...', name: 'Large Blue Storage Box' },
   *   { type: 'container', id: '...', name: 'Small Electronics Box' }
   * ]
   */
  static async resolveBreadcrumbs(
    householdId: string,
    locationId: string | null,
    containerItemId: string | null
  ): Promise<{ breadcrumbs: PhysicalBreadcrumbSegmentDto[]; breadcrumbString: string }> {
    const breadcrumbs: PhysicalBreadcrumbSegmentDto[] = [];

    // Case 1: Placed directly in a Location
    if (locationId) {
      const loc = await this.resolveLocationBreadcrumbs(householdId, locationId);
      breadcrumbs.push(...loc);
    }
    // Case 2: Placed inside a Container (which may be nested inside another container, or in a location)
    else if (containerItemId) {
      const containerChain: PhysicalBreadcrumbSegmentDto[] = [];
      let currentContainerId: string | null = containerItemId;
      const visited = new Set<string>();
      let rootLocationId: string | null = null;

      while (currentContainerId) {
        if (visited.has(currentContainerId)) {
          // Circular reference safeguard
          break;
        }
        visited.add(currentContainerId);

        const [containerItem] = await db
          .select({
            id: items.id,
            name: items.name,
            displayName: items.displayName,
            isContainer: items.isContainer,
          })
          .from(items)
          .where(and(eq(items.householdId, householdId), eq(items.id, currentContainerId)))
          .limit(1);

        if (!containerItem) break;

        containerChain.unshift({
          type: 'container',
          id: containerItem.id,
          name: containerItem.displayName || containerItem.name,
        });

        // Find how this container is placed
        const [placement] = await db
          .select({
            locationId: itemPlacements.locationId,
            containerItemId: itemPlacements.containerItemId,
          })
          .from(itemPlacements)
          .where(
            and(
              eq(itemPlacements.householdId, householdId),
              eq(itemPlacements.itemId, currentContainerId)
            )
          )
          .limit(1);

        if (placement?.locationId) {
          rootLocationId = placement.locationId;
          break;
        } else if (placement?.containerItemId) {
          currentContainerId = placement.containerItemId;
        } else {
          // Container is unplaced
          break;
        }
      }

      if (rootLocationId) {
        const locBreadcrumbs = await this.resolveLocationBreadcrumbs(
          householdId,
          rootLocationId
        );
        breadcrumbs.push(...locBreadcrumbs, ...containerChain);
      } else {
        breadcrumbs.push(...containerChain);
      }
    }

    if (breadcrumbs.length === 0) {
      return {
        breadcrumbs: [{ type: 'unplaced', id: 'unplaced', name: 'Unplaced' }],
        breadcrumbString: 'Unplaced',
      };
    }

    const breadcrumbString = breadcrumbs.map((b) => b.name).join(' → ');
    return { breadcrumbs, breadcrumbString };
  }

  /**
   * Helper: Resolves location breadcrumbs up to the root area.
   * Walks parentId links to ensure an exact, deterministic ancestor chain without duplicate matches.
   */
  private static async resolveLocationBreadcrumbs(
    householdId: string,
    locationId: string
  ): Promise<PhysicalBreadcrumbSegmentDto[]> {
    const [target] = await db
      .select({
        id: locations.id,
        name: locations.name,
        kind: locations.kind,
        color: locations.color,
        path: locations.path,
        depth: locations.depth,
        parentId: locations.parentId,
      })
      .from(locations)
      .where(and(eq(locations.householdId, householdId), eq(locations.id, locationId)))
      .limit(1);

    if (!target) return [];

    const chain: PhysicalBreadcrumbSegmentDto[] = [
      {
        type: 'location',
        id: target.id,
        name: target.name,
        kind: target.kind,
        color: target.color,
      },
    ];

    let currentParentId: string | null = target.parentId;
    const visited = new Set<string>([target.id]);

    while (currentParentId) {
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);

      const [parent] = await db
        .select({
          id: locations.id,
          name: locations.name,
          kind: locations.kind,
          color: locations.color,
          parentId: locations.parentId,
        })
        .from(locations)
        .where(
          and(
            eq(locations.householdId, householdId),
            eq(locations.id, currentParentId)
          )
        )
        .limit(1);

      if (!parent) break;

      chain.unshift({
        type: 'location',
        id: parent.id,
        name: parent.name,
        kind: parent.kind,
        color: parent.color,
      });

      currentParentId = parent.parentId;
    }

    return chain;
  }

  /**
   * Cycle Prevention: Checks if placing sourceContainer into targetContainer would create a circular nesting loop.
   */
  static async wouldCreateContainerCycle(
    householdId: string,
    sourceContainerId: string,
    targetContainerId: string
  ): Promise<boolean> {
    if (sourceContainerId === targetContainerId) {
      return true; // Cannot place inside self
    }

    let current: string | null = targetContainerId;
    let depth = 0;
    const visited = new Set<string>();

    while (current) {
      if (current === sourceContainerId) {
        return true; // Cycle detected: target is already inside source!
      }

      if (visited.has(current)) {
        return true;
      }
      visited.add(current);

      depth++;
      if (depth > 10) {
        // Exceeded maximum allowable nesting depth
        return true;
      }

      // Query parent container of current
      const [placement] = await db
        .select({
          locationId: itemPlacements.locationId,
          containerItemId: itemPlacements.containerItemId,
        })
        .from(itemPlacements)
        .where(
          and(
            eq(itemPlacements.householdId, householdId),
            eq(itemPlacements.itemId, current)
          )
        )
        .limit(1);

      if (!placement || placement.locationId) {
        // Reached fixed physical location or unplaced root
        current = null;
      } else {
        current = placement.containerItemId;
      }
    }

    return false;
  }

  /**
   * Creates a new placement for an item in a location or container with strict quantity reconciliation.
   */
  static async createPlacement(
    householdId: string,
    input: CreatePlacementInput,
    userId?: string
  ): Promise<ResolvedPlacementDto> {
    // 1. Verify Item exists in household
    const [item] = await db
      .select({
        id: items.id,
        name: items.name,
        displayName: items.displayName,
        totalQuantity: items.totalQuantity,
        unit: items.unit,
        isContainer: items.isContainer,
      })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.id, input.itemId),
          isNull(items.deletedAt)
        )
      )
      .limit(1);

    if (!item) {
      throw AppError.notFound('Item not found');
    }

    // 2. Validate Placement Target
    if (input.locationId) {
      const [loc] = await db
        .select({ id: locations.id, isArchived: locations.isArchived })
        .from(locations)
        .where(
          and(
            eq(locations.householdId, householdId),
            eq(locations.id, input.locationId)
          )
        )
        .limit(1);

      if (!loc) {
        throw AppError.notFound('Physical location not found');
      }
      if (loc.isArchived) {
        throw AppError.badRequest('Cannot place items in an archived location');
      }
    } else if (input.containerItemId) {
      if (input.itemId === input.containerItemId) {
        throw AppError.badRequest('An item cannot be placed inside itself');
      }

      const [targetContainer] = await db
        .select({
          id: items.id,
          name: items.name,
          isContainer: items.isContainer,
        })
        .from(items)
        .where(
          and(
            eq(items.householdId, householdId),
            eq(items.id, input.containerItemId),
            isNull(items.deletedAt)
          )
        )
        .limit(1);

      if (!targetContainer) {
        throw AppError.notFound('Target container not found');
      }

      if (!targetContainer.isContainer) {
        throw AppError.badRequest('Target item is not a container');
      }

      // Check for circular container nesting
      if (item.isContainer) {
        const hasCycle = await this.wouldCreateContainerCycle(
          householdId,
          item.id,
          input.containerItemId
        );
        if (hasCycle) {
          throw AppError.badRequest(
            'Circular container nesting detected: cannot place a container inside its own contents or exceed maximum depth'
          );
        }
      }
    } else {
      throw AppError.badRequest('Placement must specify either locationId or containerItemId');
    }

    // 3. Reconcile Placement Quantities
    const [existingPlacedRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${itemPlacements.quantity}), 0)`,
      })
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.itemId, input.itemId)
        )
      );

    const existingPlaced = parseFloat(existingPlacedRow?.total || '0');
    const totalQty = parseFloat(item.totalQuantity);
    const unplacedStock = Math.max(0, totalQty - existingPlaced);

    if (input.quantity > unplacedStock + 0.001) {
      throw AppError.badRequest(
        `Placement quantity (${input.quantity} ${item.unit}) exceeds available unplaced quantity (${unplacedStock.toFixed(2)} ${item.unit})`
      );
    }

    // 4. Atomic Transaction: Insert Placement & Movement Log
    const [created] = await db.transaction(async (tx) => {
      const [placement] = await tx
        .insert(itemPlacements)
        .values({
          householdId,
          itemId: input.itemId,
          locationId: input.locationId || null,
          containerItemId: input.containerItemId || null,
          quantity: input.quantity.toString(),
          notes: input.notes || null,
        })
        .returning();

      if (!placement) throw AppError.internal('Failed to record item placement');

      // Log movement history
      await tx.insert(movements).values({
        householdId,
        itemId: input.itemId,
        quantity: input.quantity.toString(),
        fromLocationId: null,
        fromContainerItemId: null,
        toLocationId: input.locationId || null,
        toContainerItemId: input.containerItemId || null,
        reason: 'placement',
        userId: userId || null,
      });

      return [placement];
    });

    // 5. Resolve full breadcrumb trail
    const { breadcrumbs, breadcrumbString } = await this.resolveBreadcrumbs(
      householdId,
      created.locationId,
      created.containerItemId
    );

    return {
      id: created.id,
      itemId: item.id,
      itemName: item.displayName || item.name,
      quantity: parseFloat(created.quantity),
      unit: item.unit,
      locationId: created.locationId,
      containerItemId: created.containerItemId,
      notes: created.notes,
      breadcrumbs,
      breadcrumbString,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Moves a placement (or split partial quantity) to a new Location or Container.
   */
  static async movePlacement(
    householdId: string,
    placementId: string,
    input: MovePlacementInput,
    userId?: string
  ): Promise<ResolvedPlacementDto> {
    // 1. Fetch existing placement
    const [placement] = await db
      .select()
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.id, placementId)
        )
      )
      .limit(1);

    if (!placement) {
      throw AppError.notFound('Placement not found');
    }

    // 2. Fetch Item
    const [item] = await db
      .select({
        id: items.id,
        name: items.name,
        displayName: items.displayName,
        unit: items.unit,
        isContainer: items.isContainer,
      })
      .from(items)
      .where(and(eq(items.householdId, householdId), eq(items.id, placement.itemId)))
      .limit(1);

    if (!item) throw AppError.notFound('Item not found');

    // 3. Validate Destination Target
    let targetLocationId: string | null = null;
    let targetContainerId: string | null = null;

    if (input.destinationType === 'location') {
      const [loc] = await db
        .select({ id: locations.id, isArchived: locations.isArchived })
        .from(locations)
        .where(
          and(
            eq(locations.householdId, householdId),
            eq(locations.id, input.destinationId)
          )
        )
        .limit(1);

      if (!loc) throw AppError.notFound('Target physical location not found');
      if (loc.isArchived) throw AppError.badRequest('Target location is archived');

      targetLocationId = input.destinationId;
    } else if (input.destinationType === 'container') {
      if (item.id === input.destinationId) {
        throw AppError.badRequest('An item cannot be placed inside itself');
      }

      const [targetContainer] = await db
        .select({
          id: items.id,
          name: items.name,
          isContainer: items.isContainer,
        })
        .from(items)
        .where(
          and(
            eq(items.householdId, householdId),
            eq(items.id, input.destinationId),
            isNull(items.deletedAt)
          )
        )
        .limit(1);

      if (!targetContainer) throw AppError.notFound('Target container not found');
      if (!targetContainer.isContainer) {
        throw AppError.badRequest('Target item is not a storage container');
      }

      if (item.isContainer) {
        const hasCycle = await this.wouldCreateContainerCycle(
          householdId,
          item.id,
          input.destinationId
        );
        if (hasCycle) {
          throw AppError.badRequest(
            'Circular container nesting detected: cannot place a container inside its own contents'
          );
        }
      }

      targetContainerId = input.destinationId;
    } else {
      throw AppError.badRequest('Invalid destinationType: must be location or container');
    }

    const currentQty = parseFloat(placement.quantity);
    const moveQty = input.quantity ? Math.min(input.quantity, currentQty) : currentQty;

    // 4. Transactional update & movement log
    const updated = await db.transaction(async (tx) => {
      let finalPlacementId = placement.id;

      if (moveQty < currentQty) {
        // Partial move: Split quantity
        const remainingQty = currentQty - moveQty;
        await tx
          .update(itemPlacements)
          .set({
            quantity: remainingQty.toString(),
            updatedAt: new Date(),
          })
          .where(eq(itemPlacements.id, placement.id));

        const [newPlacement] = await tx
          .insert(itemPlacements)
          .values({
            householdId,
            itemId: item.id,
            locationId: targetLocationId,
            containerItemId: targetContainerId,
            quantity: moveQty.toString(),
            notes: input.notes !== undefined ? input.notes : placement.notes,
          })
          .returning();

        finalPlacementId = newPlacement!.id;
      } else {
        // Full move: Update in-place
        await tx
          .update(itemPlacements)
          .set({
            locationId: targetLocationId,
            containerItemId: targetContainerId,
            notes: input.notes !== undefined ? input.notes : placement.notes,
            updatedAt: new Date(),
          })
          .where(eq(itemPlacements.id, placement.id));
      }

      // Log movement history
      await tx.insert(movements).values({
        householdId,
        itemId: item.id,
        quantity: moveQty.toString(),
        fromLocationId: placement.locationId,
        fromContainerItemId: placement.containerItemId,
        toLocationId: targetLocationId,
        toContainerItemId: targetContainerId,
        reason: 'move',
        userId: userId || null,
      });

      const [res] = await tx
        .select()
        .from(itemPlacements)
        .where(eq(itemPlacements.id, finalPlacementId));

      return res!;
    });

    // 5. Resolve newly updated breadcrumb trail
    const { breadcrumbs, breadcrumbString } = await this.resolveBreadcrumbs(
      householdId,
      updated.locationId,
      updated.containerItemId
    );

    return {
      id: updated.id,
      itemId: item.id,
      itemName: item.displayName || item.name,
      quantity: parseFloat(updated.quantity),
      unit: item.unit,
      locationId: updated.locationId,
      containerItemId: updated.containerItemId,
      notes: updated.notes,
      breadcrumbs,
      breadcrumbString,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Updates an existing placement's quantity or notes.
   */
  static async updatePlacement(
    householdId: string,
    placementId: string,
    input: UpdatePlacementInput
  ): Promise<ResolvedPlacementDto> {
    const [placement] = await db
      .select()
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.id, placementId)
        )
      )
      .limit(1);

    if (!placement) throw AppError.notFound('Placement not found');

    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.householdId, householdId), eq(items.id, placement.itemId)))
      .limit(1);

    if (!item) throw AppError.notFound('Item not found');

    if (input.quantity !== undefined) {
      // Reconcile quantity against other placements
      const [sumRow] = await db
        .select({
          total: sql<string>`coalesce(sum(${itemPlacements.quantity}), 0)`,
        })
        .from(itemPlacements)
        .where(
          and(
            eq(itemPlacements.householdId, householdId),
            eq(itemPlacements.itemId, item.id),
            sql`${itemPlacements.id} != ${placement.id}`
          )
        );

      const otherPlaced = parseFloat(sumRow?.total || '0');
      const totalQty = parseFloat(item.totalQuantity);
      const maxAllowed = totalQty - otherPlaced;

      if (input.quantity > maxAllowed + 0.001) {
        throw AppError.badRequest(
          `Updated quantity (${input.quantity}) exceeds available stock (${maxAllowed.toFixed(2)})`
        );
      }
    }

    const [updated] = await db
      .update(itemPlacements)
      .set({
        quantity: input.quantity !== undefined ? input.quantity.toString() : placement.quantity,
        notes: input.notes !== undefined ? input.notes : placement.notes,
        updatedAt: new Date(),
      })
      .where(eq(itemPlacements.id, placement.id))
      .returning();

    const { breadcrumbs, breadcrumbString } = await this.resolveBreadcrumbs(
      householdId,
      updated!.locationId,
      updated!.containerItemId
    );

    return {
      id: updated!.id,
      itemId: item.id,
      itemName: item.displayName || item.name,
      quantity: parseFloat(updated!.quantity),
      unit: item.unit,
      locationId: updated!.locationId,
      containerItemId: updated!.containerItemId,
      notes: updated!.notes,
      breadcrumbs,
      breadcrumbString,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  /**
   * Deletes a placement, safely releasing its quantity back to the unplaced stock.
   */
  static async deletePlacement(
    householdId: string,
    placementId: string,
    userId?: string
  ): Promise<{ success: boolean; unplacedQuantity: number }> {
    const [placement] = await db
      .select()
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.id, placementId)
        )
      )
      .limit(1);

    if (!placement) throw AppError.notFound('Placement not found');

    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.householdId, householdId), eq(items.id, placement.itemId)))
      .limit(1);

    if (!item) throw AppError.notFound('Item not found');

    await db.transaction(async (tx) => {
      await tx.delete(itemPlacements).where(eq(itemPlacements.id, placement.id));

      await tx.insert(movements).values({
        householdId,
        itemId: item.id,
        quantity: placement.quantity,
        fromLocationId: placement.locationId,
        fromContainerItemId: placement.containerItemId,
        toLocationId: null,
        toContainerItemId: null,
        reason: 'unplace',
        userId: userId || null,
      });
    });

    // Compute remaining unplaced stock
    const [sumRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${itemPlacements.quantity}), 0)`,
      })
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.itemId, item.id)
        )
      );

    const remainingPlaced = parseFloat(sumRow?.total || '0');
    const totalQty = parseFloat(item.totalQuantity);
    const unplacedQuantity = Math.max(0, totalQty - remainingPlaced);

    return {
      success: true,
      unplacedQuantity,
    };
  }

  /**
   * Gets all placements for an item, complete with resolved breadcrumbs and stock reconciliation.
   */
  static async getItemLocations(
    householdId: string,
    itemId: string
  ): Promise<ItemLocationsSummaryDto> {
    const [item] = await db
      .select({
        id: items.id,
        name: items.name,
        displayName: items.displayName,
        totalQuantity: items.totalQuantity,
        unit: items.unit,
        isContainer: items.isContainer,
      })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.id, itemId),
          isNull(items.deletedAt)
        )
      )
      .limit(1);

    if (!item) throw AppError.notFound('Item not found');

    const placements = await db
      .select()
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.itemId, itemId)
        )
      )
      .orderBy(desc(itemPlacements.createdAt));

    let placedSum = 0;
    const resolvedPlacements: ResolvedPlacementDto[] = [];

    for (const p of placements) {
      const qty = parseFloat(p.quantity);
      placedSum += qty;

      const { breadcrumbs, breadcrumbString } = await this.resolveBreadcrumbs(
        householdId,
        p.locationId,
        p.containerItemId
      );

      resolvedPlacements.push({
        id: p.id,
        itemId: item.id,
        itemName: item.displayName || item.name,
        quantity: qty,
        unit: item.unit,
        locationId: p.locationId,
        containerItemId: p.containerItemId,
        notes: p.notes,
        breadcrumbs,
        breadcrumbString,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      });
    }

    const totalQuantity = parseFloat(item.totalQuantity);
    const unplacedQuantity = Math.max(0, totalQuantity - placedSum);

    return {
      itemId: item.id,
      itemName: item.displayName || item.name,
      totalQuantity,
      placedQuantity: placedSum,
      unplacedQuantity,
      unit: item.unit,
      isContainer: item.isContainer,
      placements: resolvedPlacements,
    };
  }

  /**
   * Lists all movable containers in the household, their current location, and contained item count.
   * Uses batch queries to avoid N+1 queries.
   */
  static async getContainers(householdId: string): Promise<ContainerSummaryDto[]> {
    const containerList = await db
      .select({
        id: items.id,
        name: items.name,
        displayName: items.displayName,
        brand: items.brand,
        totalQuantity: items.totalQuantity,
        unit: items.unit,
      })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.isContainer, true),
          isNull(items.deletedAt)
        )
      )
      .orderBy(asc(items.name));

    if (containerList.length === 0) {
      return [];
    }

    const containerIds = containerList.map((c) => c.id);

    // 1. Batch count items placed inside each container
    const itemCounts = await db
      .select({
        containerItemId: itemPlacements.containerItemId,
        count: sql<string>`count(*)`,
      })
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          inArray(itemPlacements.containerItemId, containerIds)
        )
      )
      .groupBy(itemPlacements.containerItemId);

    const itemCountMap = new Map<string, number>();
    for (const row of itemCounts) {
      if (row.containerItemId) {
        itemCountMap.set(row.containerItemId, parseInt(row.count || '0', 10));
      }
    }

    // 2. Batch count nested containers placed inside each container
    const containerCounts = await db
      .select({
        containerItemId: itemPlacements.containerItemId,
        count: sql<string>`count(*)`,
      })
      .from(itemPlacements)
      .innerJoin(items, eq(items.id, itemPlacements.itemId))
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          inArray(itemPlacements.containerItemId, containerIds),
          eq(items.isContainer, true),
          isNull(items.deletedAt)
        )
      )
      .groupBy(itemPlacements.containerItemId);

    const containerCountMap = new Map<string, number>();
    for (const row of containerCounts) {
      if (row.containerItemId) {
        containerCountMap.set(row.containerItemId, parseInt(row.count || '0', 10));
      }
    }

    // 3. Batch fetch placements for all containers
    const placements = await db
      .select()
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          inArray(itemPlacements.itemId, containerIds)
        )
      );

    const placementMap = new Map<string, (typeof placements)[0]>();
    for (const p of placements) {
      placementMap.set(p.itemId, p);
    }

    // 4. Breadcrumb resolution cache
    const breadcrumbCache = new Map<
      string,
      { breadcrumbs: PhysicalBreadcrumbSegmentDto[]; breadcrumbString: string }
    >();

    const summaries: ContainerSummaryDto[] = [];

    for (const c of containerList) {
      const placement = placementMap.get(c.id);

      let currentPlacement: ResolvedPlacementDto | null = null;
      let breadcrumbs: PhysicalBreadcrumbSegmentDto[] = [];
      let breadcrumbString = 'Unplaced';

      if (placement) {
        const cacheKey = `${placement.locationId || 'null'}:${placement.containerItemId || 'null'}`;
        let resolved = breadcrumbCache.get(cacheKey);
        if (!resolved) {
          resolved = await this.resolveBreadcrumbs(
            householdId,
            placement.locationId,
            placement.containerItemId
          );
          breadcrumbCache.set(cacheKey, resolved);
        }

        breadcrumbs = resolved.breadcrumbs;
        breadcrumbString = resolved.breadcrumbString;

        currentPlacement = {
          id: placement.id,
          itemId: c.id,
          itemName: c.displayName || c.name,
          quantity: parseFloat(placement.quantity),
          unit: c.unit,
          locationId: placement.locationId,
          containerItemId: placement.containerItemId,
          notes: placement.notes,
          breadcrumbs,
          breadcrumbString,
          createdAt: placement.createdAt.toISOString(),
          updatedAt: placement.updatedAt.toISOString(),
        };
      }

      summaries.push({
        id: c.id,
        name: c.name,
        displayName: c.displayName,
        brand: c.brand,
        totalQuantity: parseFloat(c.totalQuantity),
        unit: c.unit,
        containedItemCount: itemCountMap.get(c.id) || 0,
        containedContainerCount: containerCountMap.get(c.id) || 0,
        currentPlacement,
        breadcrumbs,
        breadcrumbString,
      });
    }

    return summaries;
  }

  /**
   * Retrieves all contents placed directly inside a container.
   */
  static async getContainerContents(
    householdId: string,
    containerId: string
  ): Promise<{
    container: {
      id: string;
      name: string;
      displayName: string | null;
      unit: string;
      breadcrumbs: PhysicalBreadcrumbSegmentDto[];
      breadcrumbString: string;
    };
    contents: ContainerContentItemDto[];
  }> {
    const [container] = await db
      .select({
        id: items.id,
        name: items.name,
        displayName: items.displayName,
        unit: items.unit,
        isContainer: items.isContainer,
      })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.id, containerId),
          isNull(items.deletedAt)
        )
      )
      .limit(1);

    if (!container) throw AppError.notFound('Container not found');
    if (!container.isContainer) throw AppError.badRequest('Item is not a storage container');

    // Resolve container's own breadcrumbs
    const [placement] = await db
      .select()
      .from(itemPlacements)
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.itemId, container.id)
        )
      )
      .limit(1);

    const { breadcrumbs, breadcrumbString } = await this.resolveBreadcrumbs(
      householdId,
      placement?.locationId || null,
      placement?.containerItemId || null
    );

    // Fetch direct contents
    const rows = await db
      .select({
        id: items.id,
        placementId: itemPlacements.id,
        name: items.name,
        displayName: items.displayName,
        quantity: itemPlacements.quantity,
        unit: items.unit,
        isContainer: items.isContainer,
        categoryName: categories.name,
        condition: items.condition,
        notes: itemPlacements.notes,
      })
      .from(itemPlacements)
      .innerJoin(items, eq(items.id, itemPlacements.itemId))
      .leftJoin(categories, eq(categories.id, items.categoryId))
      .where(
        and(
          eq(itemPlacements.householdId, householdId),
          eq(itemPlacements.containerItemId, containerId)
        )
      )
      .orderBy(asc(items.name));

    const contents: ContainerContentItemDto[] = [];

    for (const r of rows) {
      let containedItemCount: number | undefined;
      if (r.isContainer) {
        const [cnt] = await db
          .select({ count: sql<string>`count(*)` })
          .from(itemPlacements)
          .where(
            and(
              eq(itemPlacements.householdId, householdId),
              eq(itemPlacements.containerItemId, r.id)
            )
          );
        containedItemCount = parseInt(cnt?.count || '0', 10);
      }

      contents.push({
        id: r.id,
        placementId: r.placementId,
        name: r.name,
        displayName: r.displayName,
        quantity: parseFloat(r.quantity),
        unit: r.unit,
        isContainer: r.isContainer,
        containedItemCount,
        categoryName: r.categoryName,
        condition: r.condition,
        notes: r.notes,
      });
    }

    return {
      container: {
        id: container.id,
        name: container.name,
        displayName: container.displayName,
        unit: container.unit,
        breadcrumbs,
        breadcrumbString,
      },
      contents,
    };
  }
}
