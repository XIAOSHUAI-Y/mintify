import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { getYearMonth } from '../utils/helpers';
import type {
  Budget,
  Category,
  FundCategory,
  FundTransaction,
  Ledger,
  ReserveEntry,
  SavingsPlan,
  Transaction,
} from '../types';
import {
  closeDB,
  DB_NAME,
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  getCategoriesByLedger,
  saveAppSettings,
} from './index';
import {
  archiveSavingsPlan,
  deleteCategory,
  deleteFundCategory,
  exportData,
  ensureFundCategories,
  ensureCategoryHierarchy,
  getFundCategories,
  getFundTransactions,
  getLedgers,
  getTransactions,
  importData,
  inspectBackup,
  saveFundTransaction,
  saveFundCategory,
  getReserveEntries,
  getSavingsPlans,
  saveReserveEntry,
  saveSavingsPlan,
  settlePreviousMonthBudgetReserve,
  saveCategory,
  saveBudget,
  saveBudgetViewPreference,
  saveLedger,
  saveTransaction,
} from './operations';

describe('预算浏览位置', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('按账本把年/月视图与所选月份保存到 IndexedDB', async () => {
    await saveBudgetViewPreference('daily-ledger', { mode: 'year', yearMonth: '2025-08' });
    await saveBudgetViewPreference('travel-ledger', { mode: 'month', yearMonth: '2026-01' });

    expect((await getAppSettings()).budgetViewByLedger).toEqual({
      'daily-ledger': { mode: 'year', yearMonth: '2025-08' },
      'travel-ledger': { mode: 'month', yearMonth: '2026-01' },
    });
  });
});

describe('分类删除', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('删除内置分类后保留历史元数据并标记为停用', async () => {
    const category: Category = {
      id: 'built-in-food',
      ledgerId: 'daily-ledger',
      name: '餐饮',
      icon: 'utensils',
      color: '#F87171',
      type: 'expense',
      sortOrder: 0,
      isBuiltIn: true,
    };
    await saveCategory(category);

    await deleteCategory(category.id);

    expect(await getCategoriesByLedger(category.ledgerId)).toEqual([
      expect.objectContaining({ id: category.id, deletedAt: expect.any(Number) }),
    ]);
  });

  it('拒绝删除仍带子分类的父分类，父级与子级都保持原样', async () => {
    const parent: Category = category({ id: 'food', name: '餐饮' });
    const child: Category = category({ id: 'takeout', name: '外卖', parentId: 'food' });
    await saveCategory(parent);
    await saveCategory(child);

    await expect(deleteCategory('food')).rejects.toThrow('还有 1 个子分类');

    const categories = await getCategoriesByLedger('daily-ledger');
    expect(categories.find((item) => item.id === 'food')?.deletedAt).toBeUndefined();
    expect(categories.find((item) => item.id === 'takeout')?.deletedAt).toBeUndefined();
  });

  it('子分类全部软删后，父分类可以正常删除', async () => {
    await saveCategory(category({ id: 'food', name: '餐饮' }));
    await saveCategory(category({ id: 'takeout', name: '外卖', parentId: 'food' }));
    await deleteCategory('takeout');

    await deleteCategory('food');

    const categories = await getCategoriesByLedger('daily-ledger');
    expect(categories.every((item) => item.deletedAt !== undefined)).toBe(true);
  });
});

describe('分类层级备份', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('层级随备份往返，父级与子级都保留 parentId', async () => {
    await saveCategory(category({ id: 'food', name: '餐饮' }));
    await saveCategory(category({ id: 'takeout', name: '外卖', parentId: 'food' }));

    const backup = await exportData();
    await importData(backup, { mode: 'replace' });

    const categories = await getCategoriesByLedger('daily-ledger');
    expect(categories.find((item) => item.id === 'takeout')?.parentId).toBe('food');
    expect(categories.find((item) => item.id === 'food')?.parentId).toBeUndefined();
  });

  it('导入 schema 8 的老备份时全部视为顶层分类', async () => {
    const legacyBackup = JSON.stringify({
      schemaVersion: 8,
      exportedAt: Date.now(),
      appVersion: '1.7.0',
      data: {
        ledgers: [ledger()],
        categories: [category({ id: 'food', name: '餐饮' }), category({ id: 'traffic', name: '交通', sortOrder: 1 })],
        transactions: [],
        budgets: [],
        recurringRules: [],
        fundCategories: [],
        fundTransactions: [],
        savingsPlans: [],
        reserveEntries: [],
        projects: [],
        settings: [DEFAULT_APP_SETTINGS],
      },
    });

    await importData(legacyBackup, { mode: 'replace' });

    const categories = await getCategoriesByLedger('daily-ledger');
    expect(categories).toHaveLength(2);
    expect(categories.every((item) => item.parentId === undefined)).toBe(true);
  });

  it('拒绝层级不成立的备份，并保留原数据', async () => {
    await saveCategory(category({ id: 'keep', name: '要保留的分类' }));

    const withParent = (categories: unknown[]) => JSON.stringify({
      schemaVersion: 9,
      exportedAt: Date.now(),
      appVersion: '1.8.0',
      data: {
        ledgers: [ledger()],
        categories,
        transactions: [],
        budgets: [],
        recurringRules: [],
        fundCategories: [],
        fundTransactions: [],
        savingsPlans: [],
        reserveEntries: [],
        projects: [],
        settings: [DEFAULT_APP_SETTINGS],
      },
    });

    const cases: { categories: unknown[]; message: string }[] = [
      {
        categories: [category({ id: 'takeout', parentId: 'ghost' })],
        message: '父分类不存在',
      },
      {
        categories: [category({ id: 'food', parentId: 'food' })],
        message: '以自己作为父分类',
      },
      {
        categories: [
          category({ id: 'food', ledgerId: 'other-ledger' }),
          category({ id: 'takeout', parentId: 'food' }),
        ],
        message: '父分类属于其他账本',
      },
      {
        categories: [
          category({ id: 'salary', type: 'income' }),
          category({ id: 'bonus', type: 'expense', parentId: 'salary' }),
        ],
        message: '收支类型不一致',
      },
      {
        categories: [
          category({ id: 'food' }),
          category({ id: 'takeout', parentId: 'food' }),
          category({ id: 'lunch', parentId: 'takeout' }),
        ],
        message: '超出了两级分类',
      },
    ];

    for (const item of cases) {
      await expect(importData(withParent(item.categories), { mode: 'replace' }))
        .rejects.toThrow(item.message);
    }

    expect(await getCategoriesByLedger('daily-ledger')).toEqual([
      expect.objectContaining({ id: 'keep' }),
    ]);
  });
});

describe('默认二级分类', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  const food = (overrides: Partial<Category> = {}): Category =>
    category({ id: 'food', name: '餐饮', isBuiltIn: true, ...overrides });

  const childrenOf = async (parentId: string) =>
    (await getCategoriesByLedger('daily-ledger')).filter((item) => item.parentId === parentId);

  it('给已有账本补齐默认二级分类，全部标为内置且挂在同名一级分类下', async () => {
    await saveCategory(food());

    await ensureCategoryHierarchy('daily-ledger');

    const children = await childrenOf('food');
    expect(children.map((item) => item.name).sort()).toEqual(['午餐', '晚餐', '早餐', '聚餐', '外卖'].sort());
    expect(children.every((item) => item.type === 'expense' && item.isBuiltIn)).toBe(true);
    expect(children.map((item) => item.sortOrder).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('重复执行不会产生重复子分类', async () => {
    await saveCategory(food());

    await ensureCategoryHierarchy('daily-ledger');
    await ensureCategoryHierarchy('daily-ledger');
    await ensureCategoryHierarchy('daily-ledger');

    expect(await childrenOf('food')).toHaveLength(5);
  });

  it('被删掉的默认子分类不会再被重建', async () => {
    await saveCategory(food());
    await ensureCategoryHierarchy('daily-ledger');
    const takeout = (await childrenOf('food')).find((item) => item.name === '外卖')!;
    await deleteCategory(takeout.id);

    await ensureCategoryHierarchy('daily-ledger');

    const children = await childrenOf('food');
    expect(children).toHaveLength(5);
    expect(children.filter((item) => item.name === '外卖' && !item.deletedAt)).toHaveLength(0);
  });

  it('默认子分类被改名后不会被重建，改名保持有效', async () => {
    await saveCategory(food());
    await ensureCategoryHierarchy('daily-ledger');
    const takeout = (await childrenOf('food')).find((item) => item.name === '外卖')!;
    await saveCategory({ ...takeout, name: '外送' });

    await ensureCategoryHierarchy('daily-ledger');

    const children = await childrenOf('food');
    expect(children).toHaveLength(5);
    expect(children.filter((item) => item.name === '外卖')).toHaveLength(0);
    expect(children.filter((item) => item.name === '外送')).toHaveLength(1);
  });

  it('用户已自建同名子分类时不重复创建', async () => {
    await saveCategory(food());
    await saveCategory(category({ id: 'mine', name: '外卖', parentId: 'food' }));

    await ensureCategoryHierarchy('daily-ledger');

    const takeouts = (await childrenOf('food')).filter((item) => item.name === '外卖');
    expect(takeouts).toHaveLength(1);
    expect(takeouts[0].id).toBe('mine');
  });

  it('一级分类不存在、被改名或被软删时都不补子级', async () => {
    await saveCategory(category({ id: 'renamed', name: '吃饭', isBuiltIn: true }));
    await saveCategory(category({ id: 'gone', name: '交通', isBuiltIn: true, deletedAt: 1 }));

    await ensureCategoryHierarchy('daily-ledger');

    const categories = await getCategoriesByLedger('daily-ledger');
    expect(categories).toHaveLength(2);
  });

  it('已经是子分类的分类不会被当作父级再挂一层', async () => {
    await saveCategory(category({ id: 'food', name: '餐饮', isBuiltIn: true }));
    // 用户把「餐饮」移到了别的分类下，此时它不能再当父级，避免出现三级。
    await saveCategory(category({ id: 'food-copy', name: '餐饮', parentId: 'other', sortOrder: 1 }));

    await ensureCategoryHierarchy('daily-ledger');

    const parent = (await getCategoriesByLedger('daily-ledger')).find((item) => item.id === 'food')!;
    expect(parent.parentId).toBeUndefined();
    expect(await childrenOf('food')).toHaveLength(5);
  });

  it('不碰收入分类，退款保持末级', async () => {
    await saveCategory(category({ id: 'refund', name: '退款', type: 'income', isBuiltIn: true }));

    await ensureCategoryHierarchy('daily-ledger');

    const categories = await getCategoriesByLedger('daily-ledger');
    expect(categories).toHaveLength(1);
    expect(categories[0].parentId).toBeUndefined();
  });
});

function ledger(): Ledger {  return {
    id: 'daily-ledger',
    name: '日常账本',
    icon: 'book',
    color: '#FACC15',
    isDefault: true,
    sortOrder: 0,
    createdAt: 1,
  };
}

function category(overrides: Partial<Category>): Category {
  return {
    id: 'category',
    ledgerId: 'daily-ledger',
    name: '分类',
    icon: 'utensils',
    color: '#F87171',
    type: 'expense',
    sortOrder: 0,
    isBuiltIn: false,
    ...overrides,
  };
}

describe('资金分类', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('为升级前的已有账本补齐资金收入和支出分类', async () => {
    const ledger: Ledger = {
      id: 'existing-ledger',
      name: '已有账本',
      icon: 'book',
      color: '#FACC15',
      isDefault: true,
      sortOrder: 0,
      createdAt: 1,
    };
    await saveLedger(ledger);

    await ensureFundCategories(ledger.id);

    const categories = await getFundCategories(ledger.id);
    expect(categories.some((item) => item.type === 'income' && item.name === '工资')).toBe(true);
    expect(categories.some((item) => item.type === 'expense' && item.name === '房租')).toBe(true);
  });

  it('删除资金分类后不再初始化同名内置项', async () => {
    await ensureFundCategories('existing-ledger');
    const salary = (await getFundCategories('existing-ledger'))
      .find((item) => item.name === '工资')!;

    await deleteFundCategory(salary.id);
    await ensureFundCategories('existing-ledger');

    const salaryCategories = (await getFundCategories('existing-ledger'))
      .filter((item) => item.name === '工资');
    expect(salaryCategories).toHaveLength(1);
    expect(salaryCategories[0].deletedAt).toEqual(expect.any(Number));
  });

  it('并发初始化时每个资金默认分类也只创建一次', async () => {
    await Promise.all([
      ensureFundCategories('concurrent-ledger'),
      ensureFundCategories('concurrent-ledger'),
    ]);

    const categories = await getFundCategories('concurrent-ledger');
    const keys = categories.map((item) => `${item.type}:${item.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('升级时自动停用早期并发产生的重复内置分类', async () => {
    const duplicateBase: FundCategory = {
      id: 'duplicate-rent-1',
      ledgerId: 'duplicate-ledger',
      type: 'expense',
      name: '房租',
      icon: 'home',
      color: '#8B5CF6',
      sortOrder: 0,
      isBuiltIn: true,
    };
    await saveFundCategory(duplicateBase);
    await saveFundCategory({ ...duplicateBase, id: 'duplicate-rent-2' });

    await ensureFundCategories(duplicateBase.ledgerId);

    const activeRentCategories = (await getFundCategories(duplicateBase.ledgerId))
      .filter((item) => item.name === '房租' && !item.deletedAt);
    expect(activeRentCategories).toHaveLength(1);
  });
});

describe('Mintify 备份恢复', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('用版本化备份覆盖恢复全部账本数据和设置', async () => {
    const ledger: Ledger = {
      id: 'daily-ledger',
      name: '日常账本',
      icon: 'book',
      color: '#FACC15',
      isDefault: true,
      sortOrder: 0,
      createdAt: 1,
    };
    const transaction: Transaction = {
      id: 'breakfast',
      ledgerId: ledger.id,
      categoryId: 'food',
      amount: 1800,
      type: 'expense',
      note: '早餐',
      tags: ['早餐'],
      occurredAt: 2,
      createdAt: 2,
    };
    await saveLedger(ledger);
    await saveTransaction(transaction);
    await saveAppSettings({
      ...DEFAULT_APP_SETTINGS,
      reminderEnabled: true,
      reminderTime: '08:30',
      legacySettingsMigrated: true,
      budgetViewByLedger: {
        [ledger.id]: { mode: 'year', yearMonth: '2026-08' },
      },
    });

    const backup = await exportData();
    expect(JSON.parse(backup)).toMatchObject({ schemaVersion: 9 });
    expect(inspectBackup(backup)).toMatchObject({
      schemaVersion: 9,
      ledgers: 1,
      transactions: 1,
    });

    await saveLedger({
      ...ledger,
      id: 'stale-ledger',
      name: '不应保留的账本',
      isDefault: false,
    });
    await importData(backup, { mode: 'replace' });

    expect(await getLedgers()).toEqual([ledger]);
    expect(await getTransactions(ledger.id)).toEqual([transaction]);
    expect(await getAppSettings()).toMatchObject({
      reminderEnabled: true,
      reminderTime: '08:30',
      budgetViewByLedger: {
        [ledger.id]: { mode: 'year', yearMonth: '2026-08' },
      },
    });
  });

  it('拒绝损坏的备份并完整保留原数据', async () => {
    const originalLedger: Ledger = {
      id: 'safe-ledger',
      name: '必须保留的账本',
      icon: 'book',
      color: '#FACC15',
      isDefault: true,
      sortOrder: 0,
      createdAt: 1,
    };
    await saveLedger(originalLedger);

    const brokenBackup = JSON.stringify({
      schemaVersion: 2,
      exportedAt: Date.now(),
      appVersion: '1.1.0',
      data: {
        ledgers: [{ ...originalLedger, id: 'new-ledger' }],
        categories: [],
        transactions: [{ note: '缺少主键的损坏记录' }],
        budgets: [],
        recurringRules: [],
        settings: [],
      },
    });

    await expect(importData(brokenBackup, { mode: 'replace' }))
      .rejects.toThrow('备份文件');
    expect(await getLedgers()).toEqual([originalLedger]);
  });

  it('备份恢复包含独立的资金账本记录', async () => {
    const fundCategory: FundCategory = {
      id: 'fund-rent',
      ledgerId: 'daily-ledger',
      type: 'expense',
      name: '房租',
      icon: 'home',
      color: '#8B5CF6',
      sortOrder: 0,
      isBuiltIn: true,
    };
    const fundTransaction: FundTransaction = {
      id: 'rent-august',
      ledgerId: 'daily-ledger',
      type: 'expense',
      category: '房租',
      kind: 'record',
      amount: 12000,
      note: '第三季度房租',
      occurredAt: new Date(2026, 7, 1).getTime(),
      createdAt: 1,
      categoryId: fundCategory.id,
    };
    await saveFundCategory(fundCategory);
    await saveFundTransaction(fundTransaction);

    const backup = await exportData();
    expect(inspectBackup(backup)).toMatchObject({
      schemaVersion: 9,
      fundCategories: 1,
      fundTransactions: 1,
    });

    await importData(backup, { mode: 'replace' });
    expect(await getFundCategories(fundCategory.ledgerId)).toEqual([fundCategory]);
    expect(await getFundTransactions(fundTransaction.ledgerId)).toEqual([fundTransaction]);
  });

  it('备份恢复包含攒钱计划与结余流水', async () => {
    const plan: SavingsPlan = {
      id: 'travel-plan',
      ledgerId: 'daily-ledger',
      name: '一起去旅行',
      targetAmount: 5000,
      icon: 'plane',
      color: '#F59E0B',
      createdAt: 1,
    };
    const budget: Budget = {
      id: 'august-budget',
      ledgerId: plan.ledgerId,
      amount: 6000,
      period: 'monthly',
      yearMonth: '2026-08',
      includeOverall: true,
      createdAt: 1,
    };
    const entry: ReserveEntry = {
      id: 'august-saving',
      ledgerId: plan.ledgerId,
      amount: 500,
      sourceType: 'budget',
      targetType: 'plan',
      targetPlanId: plan.id,
      sourceYearMonth: '2026-08',
      note: '八月存钱',
      occurredAt: new Date(2026, 7, 2).getTime(),
      createdAt: 2,
    };
    await saveBudget(budget);
    await saveSavingsPlan(plan);
    await saveReserveEntry(entry);

    const backup = await exportData();
    expect(inspectBackup(backup)).toMatchObject({ savingsPlans: 1, reserveEntries: 1 });
    await importData(backup, { mode: 'replace' });

    expect(await getSavingsPlans(plan.ledgerId)).toEqual([plan]);
    expect(await getReserveEntries(plan.ledgerId)).toEqual([entry]);
  });
});

describe('结余流水写入校验', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('拒绝转入超过当月可用预算的金额', async () => {
    await saveBudget({
      id: 'overall-aug',
      ledgerId: 'daily-ledger',
      amount: 1000,
      period: 'monthly',
      yearMonth: '2026-08',
      includeOverall: true,
      createdAt: 1,
    });

    await expect(saveReserveEntry({
      id: 'too-much',
      ledgerId: 'daily-ledger',
      amount: 1001,
      sourceType: 'budget',
      targetType: 'general',
      sourceYearMonth: '2026-08',
      note: '',
      occurredAt: 1,
      createdAt: 1,
    })).rejects.toThrow('超过该月可用预算');
    expect(await getReserveEntries('daily-ledger')).toEqual([]);
  });

  it('月初只结算一次上一周期包含分类余款在内的实际剩余', async () => {
    await saveBudget({
      id: 'overall-aug',
      ledgerId: 'daily-ledger',
      amount: 6000,
      period: 'monthly',
      yearMonth: '2026-08',
      includeOverall: true,
      createdAt: 1,
    });
    await saveBudget({
      id: 'food-aug',
      ledgerId: 'daily-ledger',
      categoryId: 'food',
      amount: 1000,
      period: 'monthly',
      yearMonth: '2026-08',
      includeOverall: false,
      createdAt: 1,
    });

    const now = new Date(2026, 8, 1, 0, 5).getTime();
    const first = await settlePreviousMonthBudgetReserve('daily-ledger', now);
    const second = await settlePreviousMonthBudgetReserve('daily-ledger', now);

    expect(first).toMatchObject({
      amount: 6000,
      sourceType: 'budget',
      targetType: 'general',
      sourceYearMonth: '2026-08',
    });
    expect(second).toBeNull();
    expect(await getReserveEntries('daily-ledger')).toEqual([first]);
  });

  it('通用池内部划转后总结余不变且不能透支', async () => {
    const plan: SavingsPlan = {
      id: 'travel',
      ledgerId: 'daily-ledger',
      name: '旅行',
      icon: 'plane',
      color: '#3B82F6',
      createdAt: 1,
    };
    await saveBudget({
      id: 'overall-aug',
      ledgerId: plan.ledgerId,
      amount: 1000,
      period: 'monthly',
      yearMonth: '2026-08',
      includeOverall: true,
      createdAt: 1,
    });
    await saveSavingsPlan(plan);
    await saveReserveEntry({
      id: 'to-general',
      ledgerId: plan.ledgerId,
      amount: 300,
      sourceType: 'budget',
      targetType: 'general',
      sourceYearMonth: '2026-08',
      note: '',
      occurredAt: 1,
      createdAt: 1,
    });

    await expect(saveReserveEntry({
      id: 'overdraft',
      ledgerId: plan.ledgerId,
      amount: 301,
      sourceType: 'general',
      targetType: 'plan',
      targetPlanId: plan.id,
      note: '',
      occurredAt: 2,
      createdAt: 2,
    })).rejects.toThrow('来源结余不足');
  });

  it('计划资金只能划入已经设置的本月总预算', async () => {
    const now = new Date();
    const currentMonth = getYearMonth(now.getTime());
    const previousMonth = getYearMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
    const plan: SavingsPlan = {
      id: 'travel',
      ledgerId: 'daily-ledger',
      name: '旅行',
      icon: 'plane',
      color: '#3B82F6',
      createdAt: 1,
    };
    await saveSavingsPlan(plan);
    await saveBudget({
      id: 'overall-previous',
      ledgerId: plan.ledgerId,
      amount: 500,
      period: 'monthly',
      yearMonth: previousMonth,
      includeOverall: true,
      createdAt: 1,
    });
    await saveReserveEntry({
      id: 'previous-to-travel',
      ledgerId: plan.ledgerId,
      amount: 300,
      sourceType: 'budget',
      sourceYearMonth: previousMonth,
      targetType: 'plan',
      targetPlanId: plan.id,
      note: '',
      occurredAt: 1,
      createdAt: 1,
    });

    await expect(saveReserveEntry({
      id: 'travel-to-current',
      ledgerId: plan.ledgerId,
      amount: 100,
      sourceType: 'plan',
      sourcePlanId: plan.id,
      targetType: 'budget',
      targetYearMonth: currentMonth,
      note: '',
      occurredAt: 2,
      createdAt: 2,
    })).rejects.toThrow('请先设置本月总预算');
  });

  it('保存计划划回本月预算的内部流水', async () => {
    const now = new Date();
    const currentMonth = getYearMonth(now.getTime());
    const previousMonth = getYearMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
    const plan: SavingsPlan = {
      id: 'travel',
      ledgerId: 'daily-ledger',
      name: '旅行',
      icon: 'plane',
      color: '#3B82F6',
      createdAt: 1,
    };
    await saveSavingsPlan(plan);
    for (const [id, yearMonth] of [['overall-previous', previousMonth], ['overall-current', currentMonth]] as const) {
      await saveBudget({
        id,
        ledgerId: plan.ledgerId,
        amount: 500,
        period: 'monthly',
        yearMonth,
        includeOverall: true,
        createdAt: 1,
      });
    }
    await saveReserveEntry({
      id: 'previous-to-travel',
      ledgerId: plan.ledgerId,
      amount: 300,
      sourceType: 'budget',
      sourceYearMonth: previousMonth,
      targetType: 'plan',
      targetPlanId: plan.id,
      note: '',
      occurredAt: 1,
      createdAt: 1,
    });

    const withdrawal: ReserveEntry = {
      id: 'travel-to-current',
      ledgerId: plan.ledgerId,
      amount: 100,
      sourceType: 'plan',
      sourcePlanId: plan.id,
      targetType: 'budget',
      targetYearMonth: currentMonth,
      note: `划入 ${Number(currentMonth.slice(5))} 月预算`,
      occurredAt: 2,
      createdAt: 2,
    };
    await saveReserveEntry(withdrawal);

    expect(await getReserveEntries(plan.ledgerId)).toContainEqual(withdrawal);
  });

  it('删除有余额的计划时原子转移全部余额并归档计划', async () => {
    const plan: SavingsPlan = {
      id: 'travel',
      ledgerId: 'daily-ledger',
      name: '旅行',
      icon: 'plane',
      color: '#3B82F6',
      createdAt: 1,
    };
    await saveSavingsPlan(plan);
    await saveBudget({
      id: 'overall-jul',
      ledgerId: plan.ledgerId,
      amount: 500,
      period: 'monthly',
      yearMonth: '2026-07',
      includeOverall: true,
      createdAt: 1,
    });
    await saveReserveEntry({
      id: 'july-to-travel',
      ledgerId: plan.ledgerId,
      amount: 300,
      sourceType: 'budget',
      sourceYearMonth: '2026-07',
      targetType: 'plan',
      targetPlanId: plan.id,
      note: '',
      occurredAt: 1,
      createdAt: 1,
    });

    const archived = await archiveSavingsPlan({
      planId: plan.id,
      archivedAt: 10,
      transferEntry: {
        id: 'travel-to-general',
        ledgerId: plan.ledgerId,
        amount: 300,
        sourceType: 'plan',
        sourcePlanId: plan.id,
        targetType: 'general',
        note: '删除计划时转入通用结余池',
        occurredAt: 10,
        createdAt: 10,
      },
    });

    expect(archived).toMatchObject({ id: plan.id, archivedAt: 10 });
    expect(await getSavingsPlans(plan.ledgerId)).toEqual([archived]);
    expect(await getReserveEntries(plan.ledgerId)).toHaveLength(2);
  });

  it('不允许直接删除仍有余额的攒钱计划', async () => {
    const plan: SavingsPlan = {
      id: 'emergency',
      ledgerId: 'daily-ledger',
      name: '备用金',
      icon: 'piggy-bank',
      color: '#F59E0B',
      createdAt: 1,
    };
    await saveSavingsPlan(plan);
    await saveBudget({
      id: 'overall-jul',
      ledgerId: plan.ledgerId,
      amount: 100,
      period: 'monthly',
      yearMonth: '2026-07',
      includeOverall: true,
      createdAt: 1,
    });
    await saveReserveEntry({
      id: 'fund-emergency',
      ledgerId: plan.ledgerId,
      amount: 100,
      sourceType: 'budget',
      sourceYearMonth: '2026-07',
      targetType: 'plan',
      targetPlanId: plan.id,
      note: '',
      occurredAt: 1,
      createdAt: 1,
    });

    await expect(archiveSavingsPlan({ planId: plan.id, archivedAt: 2 }))
      .rejects.toThrow('必须完整转移剩余资金');
    expect((await getSavingsPlans(plan.ledgerId))[0].archivedAt).toBeUndefined();
  });
});
