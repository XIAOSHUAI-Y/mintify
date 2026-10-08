import { describe, expect, it } from 'vitest';
import type { Budget, Category, ReserveEntry, Transaction } from '../types';
import { buildMonthlyBudgetOverview, calculateBudgetAllocationSummary, getBudgetSpentAmount } from './budgetAnalytics';
import { rollUpSpending } from './categoryTree';

describe('月度预算图表数据', () => {
  it('识别超支，并同时给出预算配置与分类支出的环比变化', () => {
    const budgets: Budget[] = [
      budget('overall-jan', '2026-01', 1000, true),
      budget('food-jan', '2026-01', 400, false, 'food'),
      budget('overall-feb', '2026-02', 1200, true),
      budget('food-feb', '2026-02', 500, false, 'food'),
      budget('travel-feb', '2026-02', 200, false, 'travel'),
    ];
    const transactions: Transaction[] = [
      expense('food-jan', 'food', 300, new Date(2026, 0, 10).getTime()),
      expense('transport-jan', 'transport', 100, new Date(2026, 0, 12).getTime()),
      expense('food-feb', 'food', 700, new Date(2026, 1, 10).getTime()),
      expense('travel-feb', 'travel', 600, new Date(2026, 1, 12).getTime()),
    ];

    const february = buildMonthlyBudgetOverview({
      budgets,
      transactions,
      ledgerId: 'daily-ledger',
      year: 2026,
    })[1];

    expect(february).toMatchObject({
      yearMonth: '2026-02',
      budgetAmount: 1200,
      spentAmount: 1300,
      status: 'overspent',
    });
    expect(february.budgetChanges).toEqual([
      { key: 'overall', kind: 'amount_changed', previousAmount: 1000, currentAmount: 1200, delta: 200 },
      { key: 'food', kind: 'amount_changed', previousAmount: 400, currentAmount: 500, delta: 100 },
      { key: 'travel', kind: 'added', previousAmount: 0, currentAmount: 200, delta: 200 },
    ]);
    expect(february.spendingChanges).toEqual([
      { categoryId: 'food', previousAmount: 300, currentAmount: 700, delta: 400 },
      { categoryId: 'travel', previousAmount: 0, currentAmount: 600, delta: 600 },
      { categoryId: 'transport', previousAmount: 100, currentAmount: 0, delta: -100 },
    ]);
  });

  it('把预算转入结余计入占用率，但与实际支出分开展示', () => {
    const budgets = [budget('overall-aug', '2026-08', 1000, true)];
    const transactions = [expense('food-aug', 'food', 800, new Date(2026, 7, 2).getTime())];
    const reserveEntries: ReserveEntry[] = [{
      id: 'saving-aug',
      ledgerId: 'daily-ledger',
      amount: 300,
      sourceType: 'budget',
      targetType: 'general',
      sourceYearMonth: '2026-08',
      note: '',
      occurredAt: new Date(2026, 7, 3).getTime(),
      createdAt: 1,
    }];

    const august = buildMonthlyBudgetOverview({
      budgets,
      transactions,
      reserveEntries,
      ledgerId: 'daily-ledger',
      year: 2026,
    })[7];
    expect(august).toMatchObject({
      spentAmount: 800,
      savedAmount: 300,
      status: 'overspent',
    });
    expect(august.utilization).toBeCloseTo(110);
  });

  it('年度预算图表把攒钱划入作为单独补充计入有效预算', () => {
    const overview = buildMonthlyBudgetOverview({
      budgets: [budget('overall-aug', '2026-08', 1000, true)],
      transactions: [],
      ledgerId: 'daily-ledger',
      year: 2026,
      reserveEntries: [{
        id: 'travel-to-budget',
        ledgerId: 'daily-ledger',
        amount: 300,
        sourceType: 'plan',
        sourcePlanId: 'travel',
        targetType: 'budget',
        targetYearMonth: '2026-08',
        note: '',
        occurredAt: 1,
        createdAt: 1,
      }],
    });

    expect(overview[7]).toMatchObject({
      baseBudgetAmount: 1000,
      supplementAmount: 300,
      budgetAmount: 1300,
    });
  });
});

describe('预算分配结余', () => {
  it('从总预算中扣除分类预算、分类超支和未分配分类支出', () => {
    const budgets: Budget[] = [
      budget('overall-aug', '2026-08', 6000, true),
      budget('food-aug', '2026-08', 500, false, 'food'),
      budget('travel-aug', '2026-08', 500, false, 'travel'),
    ];
    const transactions: Transaction[] = [
      expense('food-aug', 'food', 650, new Date(2026, 7, 10).getTime()),
      expense('travel-aug', 'travel', 400, new Date(2026, 7, 11).getTime()),
      expense('shopping-aug', 'shopping', 200, new Date(2026, 7, 12).getTime()),
    ];

    expect(calculateBudgetAllocationSummary({
      budgets,
      transactions,
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toEqual({
      overallBudgetAmount: 6000,
      supplementAmount: 0,
      effectiveBudgetAmount: 6000,
      allocatedAmount: 1000,
      categoryOverspendAmount: 150,
      unbudgetedSpendingAmount: 200,
      reservedAmount: 0,
      balanceAmount: 4650,
    });
  });

  it('退款按原支出分类释放超支占用', () => {
    const budgets: Budget[] = [
      budget('overall-aug', '2026-08', 1000, true),
      budget('software-aug', '2026-08', 250, false, 'software'),
    ];
    const originalExpense = expense('ai-expense', 'software', 500, new Date(2026, 7, 2).getTime());
    const refund: Transaction = {
      ...expense('ai-refund', 'refund-category', 500, new Date(2026, 7, 5).getTime()),
      type: 'income',
      kind: 'refund',
      linkedExpenseTransactionId: originalExpense.id,
    };

    expect(calculateBudgetAllocationSummary({
      budgets,
      transactions: [refund, originalExpense],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toMatchObject({
      allocatedAmount: 250,
      categoryOverspendAmount: 0,
      balanceAmount: 750,
    });
  });

  it('分类预算结余会扣除当月已存金额', () => {
    const budgets = [
      budget('overall-aug', '2026-08', 1000, true),
      budget('food-aug', '2026-08', 300, false, 'food'),
    ];
    const reserveEntries: ReserveEntry[] = [{
      id: 'saving-aug',
      ledgerId: 'daily-ledger',
      amount: 200,
      sourceType: 'budget',
      targetType: 'general',
      sourceYearMonth: '2026-08',
      note: '',
      occurredAt: 1,
      createdAt: 1,
    }];

    expect(calculateBudgetAllocationSummary({
      budgets,
      transactions: [],
      reserveEntries,
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toMatchObject({ reservedAmount: 200, balanceAmount: 500 });
  });

  it('从攒钱计划划回本月时补充有效预算但不改原始总预算', () => {
    const budgets = [budget('overall-aug', '2026-08', 1000, true)];
    const reserveEntries = [
      {
        id: 'saving-aug',
        ledgerId: 'daily-ledger',
        amount: 800,
        sourceType: 'budget',
        targetType: 'plan',
        targetPlanId: 'travel',
        sourceYearMonth: '2026-08',
        note: '',
        occurredAt: 1,
        createdAt: 1,
      },
      {
        id: 'travel-to-budget',
        ledgerId: 'daily-ledger',
        amount: 300,
        sourceType: 'plan',
        sourcePlanId: 'travel',
        targetType: 'budget',
        targetYearMonth: '2026-08',
        note: '',
        occurredAt: 2,
        createdAt: 2,
      },
    ] as ReserveEntry[];

    expect(calculateBudgetAllocationSummary({
      budgets,
      transactions: [],
      reserveEntries,
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toMatchObject({
      overallBudgetAmount: 1000,
      supplementAmount: 300,
      effectiveBudgetAmount: 1300,
      reservedAmount: 800,
      balanceAmount: 500,
    });
  });
});

describe('预算已用金额', () => {
  const spending = new Map([['food', 100], ['takeout', 200], ['traffic', 50]]);
  // 真实调用方传的就是 rollUpSpending 的结果：子级 key 被合并到父级，遂不在表里。
  const rolled = rollUpSpending(spending, [
    category({ id: 'food' }),
    category({ id: 'takeout', parentId: 'food' }),
  ]);

  it('一级预算取归并后的金额，含它下面的二级', () => {
    expect(getBudgetSpentAmount('food', spending, rolled)).toBe(300);
  });

  it('二级预算取自己的直挂金额，不受归并结果缺 key 影响', () => {
    expect(getBudgetSpentAmount('takeout', spending, rolled)).toBe(200);
  });

  it('没有支出的分类算 0', () => {
    expect(getBudgetSpentAmount('dine-in', spending, rolled)).toBe(0);
  });
});

describe('一级分类预算归属', () => {
  const parentMap = new Map([
    ['takeout', 'food'],
    ['dine-in', 'food'],
    ['taxi', 'traffic'],
  ]);

  const budgetOn = (id: string, categoryId: string, amount: number) =>
    budget(id, '2026-08', amount, false, categoryId);

  it('一级预算覆盖没有单独预算的二级支出', () => {
    const summary = calculateBudgetAllocationSummary({
      budgets: [budget('overall-aug', '2026-08', 1000, true), budgetOn('food-aug', 'food', 500)],
      transactions: [expense('takeout', 'takeout', 400, new Date(2026, 7, 10).getTime())],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
      parentIdByCategoryId: parentMap,
    });

    expect(summary.unbudgetedSpendingAmount).toBe(0);
    expect(summary.categoryOverspendAmount).toBe(0);
    expect(summary.allocatedAmount).toBe(500);
    expect(summary.balanceAmount).toBe(500);
  });

  it('二级有自己的预算时优先算它，一级不再吸收', () => {
    const summary = calculateBudgetAllocationSummary({
      budgets: [
        budget('overall-aug', '2026-08', 1000, true),
        budgetOn('food-aug', 'food', 500),
        budgetOn('takeout-aug', 'takeout', 100),
      ],
      transactions: [expense('takeout', 'takeout', 400, new Date(2026, 7, 10).getTime())],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
      parentIdByCategoryId: parentMap,
    });

    expect(summary.categoryOverspendAmount).toBe(300);
    expect(summary.unbudgetedSpendingAmount).toBe(0);
    // 外卖 100 的额度本来就包在餐饮 500 里，不再重复计入分配。
    expect(summary.allocatedAmount).toBe(500);
    expect(summary.balanceAmount).toBe(200);
  });

  it('嵌套在一级预算里的二级预算不重复占用分配额', () => {
    const summary = calculateBudgetAllocationSummary({
      budgets: [
        budget('overall-aug', '2026-08', 100, true),
        budgetOn('food-aug', 'food', 50),
        budgetOn('breakfast-aug', 'takeout', 20),
      ],
      transactions: [expense('breakfast', 'takeout', 20, new Date(2026, 7, 10).getTime())],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
      parentIdByCategoryId: parentMap,
    });

    expect(summary.allocatedAmount).toBe(50);
    expect(summary.balanceAmount).toBe(50);
  });

  it('没有一级预算时，二级预算照常全额计入分配', () => {
    const summary = calculateBudgetAllocationSummary({
      budgets: [
        budget('overall-aug', '2026-08', 100, true),
        budgetOn('takeout-aug', 'takeout', 20),
        budgetOn('shopping-aug', 'shopping', 30),
      ],
      transactions: [],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
      parentIdByCategoryId: parentMap,
    });

    expect(summary.allocatedAmount).toBe(50);
    expect(summary.balanceAmount).toBe(50);
  });

  it('没有总预算时，嵌套的二级预算也不重复算进本月预算', () => {
    const august = buildMonthlyBudgetOverview({
      budgets: [budgetOn('food-aug', 'food', 50), budgetOn('takeout-aug', 'takeout', 20)],
      transactions: [expense('takeout', 'takeout', 10, new Date(2026, 7, 10).getTime())],
      ledgerId: 'daily-ledger',
      year: 2026,
      parentIdByCategoryId: parentMap,
    })[7];

    expect(august.budgetAmount).toBe(50);
  });

  it('一级预算同时吃下自己直挂的和没有独立预算的二级', () => {
    const summary = calculateBudgetAllocationSummary({
      budgets: [budgetOn('food-aug', 'food', 500), budgetOn('takeout-aug', 'takeout', 100)],
      transactions: [
        expense('dine-in', 'dine-in', 200, new Date(2026, 7, 10).getTime()),
        expense('food-direct', 'food', 50, new Date(2026, 7, 11).getTime()),
        expense('takeout', 'takeout', 150, new Date(2026, 7, 12).getTime()),
      ],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
      parentIdByCategoryId: parentMap,
    });

    // 餐饮 250 / 500 没超；外卖 150 / 100 超 50。
    expect(summary.categoryOverspendAmount).toBe(50);
    expect(summary.unbudgetedSpendingAmount).toBe(0);
  });

  it('父级没有预算时二级支出仍算未预算', () => {
    const summary = calculateBudgetAllocationSummary({
      budgets: [budgetOn('shopping-aug', 'shopping', 500)],
      transactions: [expense('takeout', 'takeout', 400, new Date(2026, 7, 10).getTime())],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
      parentIdByCategoryId: parentMap,
    });

    expect(summary.unbudgetedSpendingAmount).toBe(400);
    expect(summary.categoryOverspendAmount).toBe(0);
  });

  it('不传父级映射时保持原有口径（二级支出算未预算）', () => {
    const summary = calculateBudgetAllocationSummary({
      budgets: [budgetOn('food-aug', 'food', 500)],
      transactions: [expense('takeout', 'takeout', 400, new Date(2026, 7, 10).getTime())],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    });

    expect(summary.unbudgetedSpendingAmount).toBe(400);
    expect(summary.balanceAmount).toBe(-900);
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

function budget(
  id: string,
  yearMonth: string,
  amount: number,
  includeOverall: boolean,
  categoryId?: string,
): Budget {
  return {
    id,
    ledgerId: 'daily-ledger',
    categoryId,
    amount,
    period: 'monthly',
    yearMonth,
    includeOverall,
    createdAt: 1,
  };
}

function expense(id: string, categoryId: string, amount: number, occurredAt: number): Transaction {
  return {
    id,
    ledgerId: 'daily-ledger',
    categoryId,
    amount,
    type: 'expense',
    note: '',
    tags: [],
    occurredAt,
    createdAt: occurredAt,
  };
}
