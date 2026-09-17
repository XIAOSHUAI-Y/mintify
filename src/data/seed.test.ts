import { describe, expect, it } from 'vitest';
import { APP_COLORS, APP_ICONS, EXPENSE_CATEGORIES, EXPENSE_SUB_CATEGORIES, INCOME_CATEGORIES } from './seed';

describe('默认二级分类清单', () => {
  const parentNames = new Set(EXPENSE_CATEGORIES.map((category) => category.name));

  it('每个二级分类都挂在一个存在的支出分类下', () => {
    expect(EXPENSE_SUB_CATEGORIES.length).toBeGreaterThan(0);
    for (const sub of EXPENSE_SUB_CATEGORIES) {
      expect(parentNames.has(sub.parent)).toBe(true);
    }
  });

  it('同一个一级分类下没有重名子分类', () => {
    const keys = EXPENSE_SUB_CATEGORIES.map((sub) => `${sub.parent}/${sub.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('图标与颜色都能在编辑器的候选里找到，名字不超过 12 字', () => {
    for (const sub of EXPENSE_SUB_CATEGORIES) {
      expect(APP_ICONS).toContain(sub.icon);
      expect(APP_COLORS).toContain(sub.color);
      expect(sub.name.length).toBeLessThanOrEqual(12);
      expect(sub.name.trim()).toBe(sub.name);
    }
  });

  it('退款是退款冲减的挂载点，必须保持末级', () => {
    const refund = INCOME_CATEGORIES.find((category) => category.name === '退款');
    expect(refund).toBeDefined();
    expect(EXPENSE_SUB_CATEGORIES.some((sub) => sub.parent === '退款')).toBe(false);
  });

  it('保留一部分一级分类没有子分类，保证"无子级也能直接记账"的路径存在', () => {
    const usedParents = new Set(EXPENSE_SUB_CATEGORIES.map((sub) => sub.parent));
    expect(usedParents.size).toBeLessThan(EXPENSE_CATEGORIES.length);
  });
});
