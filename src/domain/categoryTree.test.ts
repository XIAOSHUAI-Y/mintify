import { describe, expect, it } from 'vitest';
import type { Category } from '../types';
import {
  buildCategoryTree,
  getCategoryPath,
  getChildCategories,
  getSelectableCategories,
  isGroupCategory,
  rollUpSpending,
  validateParentAssignment,
} from './categoryTree';

const FOOD = category({ id: 'food', name: '餐饮', sortOrder: 0 });
const TAKEOUT = category({ id: 'takeout', name: '外卖', parentId: 'food', sortOrder: 0 });
const DINE_IN = category({ id: 'dine-in', name: '堂食', parentId: 'food', sortOrder: 1 });
const TRAFFIC = category({ id: 'traffic', name: '交通', sortOrder: 1 });
const CATEGORIES: Category[] = [FOOD, TAKEOUT, DINE_IN, TRAFFIC];

describe('分类层级', () => {
  it('按父级归组，顶层与子级各自按 sortOrder 排序', () => {
    const tree = buildCategoryTree([DINE_IN, TRAFFIC, TAKEOUT, FOOD]);

    expect(tree.roots.map((item) => item.id)).toEqual(['food', 'traffic']);
    expect((tree.childrenByParent.get('food') ?? []).map((item) => item.id)).toEqual(['takeout', 'dine-in']);
    expect(tree.childrenByParent.get('traffic')).toBeUndefined();
  });

  it('父级指向不存在的分类时降级为顶层，避免分类在界面上消失', () => {
    const tree = buildCategoryTree([category({ id: 'orphan', parentId: 'ghost' })]);

    expect(tree.roots.map((item) => item.id)).toEqual(['orphan']);
  });

  it('有未软删子分类的分类是分组，分组不能直接挂账单', () => {
    expect(isGroupCategory(CATEGORIES, 'food')).toBe(true);
    expect(isGroupCategory(CATEGORIES, 'traffic')).toBe(false);
    // 分组自己不可选，末级子分类可选。
    const selectable = getSelectableCategories(CATEGORIES).map((item) => item.id);
    expect(selectable).toEqual(['takeout', 'dine-in', 'traffic']);
    expect(selectable).not.toContain('food');
  });

  it('子分类全部软删后，父级重新变成可选分类', () => {
    const categories = [
      category({ id: 'food' }),
      category({ id: 'takeout', parentId: 'food', deletedAt: 1 }),
    ];

    expect(isGroupCategory(categories, 'food')).toBe(false);
    expect(getChildCategories(categories, 'food')).toEqual([]);
  });

  it('取分类路径，父级与自身都可查到', () => {
    expect(getCategoryPath(CATEGORIES, 'takeout')).toEqual({ parent: FOOD, category: TAKEOUT });
    expect(getCategoryPath(CATEGORIES, 'traffic')).toEqual({ parent: null, category: TRAFFIC });
    expect(getCategoryPath(CATEGORIES, 'ghost')).toEqual({ parent: null, category: null });
  });

  it('归并报表金额：父级总额 = 自己直挂的 + 子级之和', () => {
    const rolled = rollUpSpending(new Map([
      ['food', 100],
      ['takeout', 200],
      ['dine-in', 300],
      ['traffic', 50],
    ]), CATEGORIES);

    expect([...rolled.entries()].sort()).toEqual([['food', 600], ['traffic', 50]]);
  });

  it('归并时保留不在分类表里的 id，不丢金额', () => {
    const rolled = rollUpSpending(new Map([['ghost', 42]]), CATEGORIES);

    expect([...rolled.entries()]).toEqual([['ghost', 42]]);
  });

  it('软删的父级仍归并子级，保证历史报表口径不跳变', () => {
    const categories = [
      category({ id: 'food', deletedAt: 1 }),
      category({ id: 'takeout', parentId: 'food' }),
    ];

    expect([...rollUpSpending(new Map([['takeout', 200]]), categories).entries()])
      .toEqual([['food', 200]]);
  });

  it('合法父级赋值通过校验', () => {
    expect(validateParentAssignment({ categories: CATEGORIES, categoryType: 'expense', ledgerId: 'daily-ledger', parentId: 'food' })).toBeNull();
    expect(validateParentAssignment({ categories: CATEGORIES, categoryType: 'expense', ledgerId: 'daily-ledger' })).toBeNull();
  });

  it('拒绝自引用、不存在的父级与三级嵌套', () => {
    expect(validateParentAssignment({
      categories: CATEGORIES, categoryType: 'expense', ledgerId: 'daily-ledger', categoryId: 'food', parentId: 'food',
    })).toBe('分类不能以自己作为父级');
    expect(validateParentAssignment({
      categories: CATEGORIES, categoryType: 'expense', ledgerId: 'daily-ledger', parentId: 'ghost',
    })).toBe('父分类不存在');
    expect(validateParentAssignment({
      categories: CATEGORIES, categoryType: 'expense', ledgerId: 'daily-ledger', parentId: 'takeout',
    })).toBe('最多只支持两级分类');
  });

  it('拒绝跨类型与跨账本的父级', () => {
    const categories = [
      category({ id: 'food', type: 'expense', ledgerId: 'daily-ledger' }),
      category({ id: 'salary', type: 'income', ledgerId: 'daily-ledger' }),
      category({ id: 'other-food', type: 'expense', ledgerId: 'travel-ledger' }),
    ];

    expect(validateParentAssignment({
      categories, categoryType: 'expense', ledgerId: 'daily-ledger', parentId: 'salary',
    })).toBe('父分类与子分类的收支类型必须一致');
    expect(validateParentAssignment({
      categories, categoryType: 'expense', ledgerId: 'daily-ledger', parentId: 'other-food',
    })).toBe('不能跨账本设置父分类');
  });

  it('已经带子分类的分类不能再被挂到别的分类下', () => {
    expect(validateParentAssignment({
      categories: CATEGORIES, categoryType: 'expense', ledgerId: 'daily-ledger', categoryId: 'food', parentId: 'traffic',
    })).toBe('该分类下已有子分类，不能再作为子分类');
  });
});

function category(overrides: Partial<Category>): Category {
  return {
    id: 'category',
    ledgerId: 'daily-ledger',
    name: '分类',
    icon: 'utensils',
    color: '#F59E0B',
    type: 'expense',
    sortOrder: 0,
    isBuiltIn: false,
    ...overrides,
  };
}
