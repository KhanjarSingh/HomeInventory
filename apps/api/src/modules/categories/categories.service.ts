import { db } from '../../config/db';
import { categories } from '../../db/schema';
import { eq, asc } from 'drizzle-orm';
import type { CategoryDto } from '@home-inventory/shared';

export class CategoriesService {
  /**
   * Lists all categories available for a household, sorted by sortOrder and name.
   */
  static async getCategories(householdId: string): Promise<CategoryDto[]> {
    const list = await db
      .select({
        id: categories.id,
        householdId: categories.householdId,
        parentId: categories.parentId,
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
        sortOrder: categories.sortOrder,
        isSystem: categories.isSystem,
      })
      .from(categories)
      .where(eq(categories.householdId, householdId))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return list;
  }
}
