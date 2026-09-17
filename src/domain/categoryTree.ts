import type { Category, TransactionType } from '../types';

export interface CategoryTree {
  /** 顶层分类（含已软删的，统计与历史展示仍需要）。 */
  roots: Category[];
  childrenByParent: Map<string, Category[]>;
}

export interface ParentAssignmentInput {
  categories: Category[];
  categoryType: TransactionType;
  ledgerId: string;
  /** 编辑已有分类时传自身 id，用于自引用与「已有子级」检查。 */
  categoryId?: string;
  parentId?: string;
}

const bySortOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder;

const isLive = (category: Category) => !category.deletedAt;

/**
 * 按 parentId 归组。父级不存在（或自引用）时降级为顶层，
 * 保证任何分类都不会因为脏数据从界面上消失。
 */
export function buildCategoryTree(categories: Category[]): CategoryTree {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const childrenByParent = new Map<string, Category[]>();
  const roots: Category[] = [];

  for (const category of categories) {
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    if (parent && parent.id !== category.id) {
      const siblings = childrenByParent.get(parent.id);
      if (siblings) siblings.push(category);
      else childrenByParent.set(parent.id, [category]);
      continue;
    }
    roots.push(category);
  }

  roots.sort(bySortOrder);
  for (const children of childrenByParent.values()) children.sort(bySortOrder);
  return { roots, childrenByParent };
}

/** 只返回未软删的子分类；子级全部删除后父级会重新变成可直接记账的分类。 */
export function getChildCategories(categories: Category[], parentId: string): Category[] {
  return categories
    .filter((category) => category.parentId === parentId && isLive(category) && category.id !== parentId)
    .sort(bySortOrder);
}

export function isGroupCategory(categories: Category[], categoryId: string): boolean {
  return getChildCategories(categories, categoryId).length > 0;
}

/** 可以直接挂账单的分类：未软删，且自己不分组（分组只能通过下钻选到子级）。 */
export function getSelectableCategories(categories: Category[]): Category[] {
  const groupIds = new Set<string>();
  for (const category of categories) {
    if (isLive(category) && category.parentId) groupIds.add(category.parentId);
  }
  return categories
    .filter((category) => isLive(category) && !groupIds.has(category.id))
    .sort(bySortOrder);
}

export function getCategoryPath(
  categories: Category[],
  categoryId: string,
): { parent: Category | null; category: Category | null } {
  const category = categories.find((item) => item.id === categoryId) ?? null;
  if (!category) return { parent: null, category: null };
  const parent = category.parentId
    ? categories.find((item) => item.id === category.parentId) ?? null
    : null;
  return { parent, category };
}

/**
 * 报表归并：父级总额 = 自己直挂的 + 子级之和。
 * 软删的父级仍参与归并（否则历史报表口径会跳变）；不在分类表里的 id 原样保留，不丢金额。
 */
export function rollUpSpending(
  spendingByCategory: Map<string, number>,
  categories: Category[],
): Map<string, number> {
  const parentById = new Map(categories.map((category) => [category.id, category.parentId]));
  const rolled = new Map<string, number>();

  for (const [categoryId, amount] of spendingByCategory) {
    const parentId = parentById.get(categoryId);
    const targetId = parentId && parentId !== categoryId && parentById.has(parentId)
      ? parentId
      : categoryId;
    rolled.set(targetId, (rolled.get(targetId) ?? 0) + amount);
  }

  return rolled;
}

/** 返回拦截原因；null 表示可以赋值。 */
export function validateParentAssignment(options: ParentAssignmentInput): string | null {
  const { categories, categoryType, ledgerId, categoryId, parentId } = options;
  if (!parentId) return null;
  if (categoryId && parentId === categoryId) return '分类不能以自己作为父级';

  const parent = categories.find((category) => category.id === parentId);
  if (!parent) return '父分类不存在';
  if (parent.parentId) return '最多只支持两级分类';
  if (parent.ledgerId !== ledgerId) return '不能跨账本设置父分类';
  if (parent.type !== categoryType) return '父分类与子分类的收支类型必须一致';
  if (categoryId && getChildCategories(categories, categoryId).length > 0) {
    return '该分类下已有子分类，不能再作为子分类';
  }
  return null;
}
