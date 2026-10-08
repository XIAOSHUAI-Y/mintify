import type { Budget, ReserveEntry, Transaction } from '../types';
import { getNetSpendingByCategory } from './transactionAccounting';

export type BudgetUsageStatus = 'no-budget' | 'on-track' | 'overspent';
export type BudgetChangeKind = 'added' | 'removed' | 'amount_changed';

export interface BudgetChange {
  key: string;
  kind: BudgetChangeKind;
  previousAmount: number;
  currentAmount: number;
  delta: number;
}

export interface SpendingChange {
  categoryId: string;
  previousAmount: number;
  currentAmount: number;
  delta: number;
}

export interface MonthlyBudgetOverview {
  yearMonth: string;
  month: number;
  baseBudgetAmount: number;
  supplementAmount: number;
  budgetAmount: number;
  spentAmount: number;
  savedAmount: number;
  utilization: number | null;
  status: BudgetUsageStatus;
  budgetChanges: BudgetChange[];
  spendingChanges: SpendingChange[];
}

interface BuildMonthlyBudgetOverviewOptions {
  budgets: Budget[];
  transactions: Transaction[];
  ledgerId: string;
  year: number;
  reserveEntries?: ReserveEntry[];
  /** 子级分类 id → 父级 id；传了才能识别嵌套的一级/二级预算，避免重复占额度。 */
  parentIdByCategoryId?: ReadonlyMap<string, string>;
}

interface CalculateBudgetAllocationSummaryOptions {
  budgets: Budget[];
  transactions: Transaction[];
  ledgerId: string;
  yearMonth: string;
  reserveEntries?: ReserveEntry[];
  /**
   * 子级分类 id → 父级 id。传了才启用「一级预算兜底」：
   * 二级支出优先算自己的预算，自己没有预算时归到一级预算上。
   * 不传时退回只看分类自己的旧口径。
   */
  parentIdByCategoryId?: ReadonlyMap<string, string>;
}

export interface BudgetAllocationSummary {
  overallBudgetAmount: number;
  supplementAmount: number;
  effectiveBudgetAmount: number;
  allocatedAmount: number;
  categoryOverspendAmount: number;
  unbudgetedSpendingAmount: number;
  reservedAmount: number;
  balanceAmount: number;
}

/**
 * 一条支出该记到哪条预算下：自己没有预算时，归给父级（一级）预算。
 * 分类严格两级，所以只看一跳；父级没有预算就返回 null，算作未预算支出。
 */
function resolveBudgetOwner(
  parentId: string | undefined,
  categoryBudgetById: Map<string, number>,
): string | null {
  if (!parentId) return null;
  return categoryBudgetById.has(parentId) ? parentId : null;
}

/**
 * 预算的「已用」金额：一级分类含它下面全部二级，二级分类只看自己直挂的支出。
 * 注意 rollUpSpending 的返回值只保留父级 key（子级金额被合并走了），
 * 所以二级必须退回直挂金额，不能直接查归并结果。
 */
export function getBudgetSpentAmount(
  categoryId: string,
  spendingByCategory: ReadonlyMap<string, number>,
  rolledSpendingByCategory: ReadonlyMap<string, number>,
): number {
  return rolledSpendingByCategory.get(categoryId) ?? spendingByCategory.get(categoryId) ?? 0;
}

/**
 * 预算结余代表尚未分配、也尚未被超额消费占用的总预算。
 * 分类预算内的正常支出已经包含在“已分配”中，不能再次扣减。
 */
export function calculateBudgetAllocationSummary({
  budgets,
  transactions,
  ledgerId,
  yearMonth,
  reserveEntries = [],
  parentIdByCategoryId,
}: CalculateBudgetAllocationSummaryOptions): BudgetAllocationSummary {
  const monthBudgets = budgets.filter((budget) =>
    budget.ledgerId === ledgerId && budget.yearMonth === yearMonth && budget.period === 'monthly');
  const overallBudgetAmount = monthBudgets.find((budget) => budget.includeOverall)?.amount ?? 0;
  const categoryBudgetById = new Map<string, number>();

  for (const budget of monthBudgets) {
    if (budget.includeOverall || !budget.categoryId) continue;
    categoryBudgetById.set(
      budget.categoryId,
      (categoryBudgetById.get(budget.categoryId) ?? 0) + budget.amount,
    );
  }

  const allocatedAmount = sumAllocatedCategoryBudgets(categoryBudgetById, parentIdByCategoryId);
  const ledgerTransactions = transactions.filter((transaction) => transaction.ledgerId === ledgerId);
  const spendingByCategory = getNetSpendingByCategory(ledgerTransactions, yearMonth);
  let categoryOverspendAmount = 0;
  let unbudgetedSpendingAmount = 0;
  const spendingByOwnerId = new Map<string, number>();
  const reservedAmount = reserveEntries
    .filter((entry) =>
      entry.ledgerId === ledgerId
      && entry.sourceType === 'budget'
      && entry.sourceYearMonth === yearMonth)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const supplementAmount = reserveEntries
    .filter((entry) =>
      entry.ledgerId === ledgerId
      && entry.targetType === 'budget'
      && entry.targetYearMonth === yearMonth)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const effectiveBudgetAmount = overallBudgetAmount + supplementAmount;

  for (const [categoryId, spentAmount] of spendingByCategory) {
    // 支出归谁管：先看自己有没有预算，再看一级分类有没有（一级预算兜底）。
    const ownerId = categoryBudgetById.has(categoryId)
      ? categoryId
      : resolveBudgetOwner(parentIdByCategoryId?.get(categoryId), categoryBudgetById);
    if (!ownerId) {
      unbudgetedSpendingAmount += spentAmount;
      continue;
    }
    spendingByOwnerId.set(ownerId, (spendingByOwnerId.get(ownerId) ?? 0) + spentAmount);
  }

  for (const [ownerId, spentAmount] of spendingByOwnerId) {
    const ownerBudget = categoryBudgetById.get(ownerId) ?? 0;
    categoryOverspendAmount += Math.max(spentAmount - ownerBudget, 0);
  }

  return {
    overallBudgetAmount,
    supplementAmount,
    effectiveBudgetAmount,
    allocatedAmount,
    categoryOverspendAmount,
    unbudgetedSpendingAmount,
    reservedAmount,
    balanceAmount: effectiveBudgetAmount
      - allocatedAmount
      - categoryOverspendAmount
      - unbudgetedSpendingAmount
      - reservedAmount,
  };
}

export function buildMonthlyBudgetOverview({
  budgets,
  transactions,
  ledgerId,
  year,
  reserveEntries = [],
  parentIdByCategoryId,
}: BuildMonthlyBudgetOverviewOptions): MonthlyBudgetOverview[] {
  const ledgerBudgets = budgets.filter((budget) => budget.ledgerId === ledgerId && budget.period === 'monthly');
  const ledgerTransactions = transactions.filter((transaction) => transaction.ledgerId === ledgerId);

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const yearMonth = formatYearMonth(year, month);
    const previousYearMonth = getPreviousYearMonth(yearMonth);
    const currentBudgets = ledgerBudgets.filter((budget) => budget.yearMonth === yearMonth);
    const previousBudgets = ledgerBudgets.filter((budget) => budget.yearMonth === previousYearMonth);
    const currentSpending = getNetSpendingByCategory(ledgerTransactions, yearMonth);
    const previousSpending = getNetSpendingByCategory(ledgerTransactions, previousYearMonth);
    const baseBudgetAmount = getMonthlyBudgetAmount(currentBudgets, parentIdByCategoryId);
    const supplementAmount = reserveEntries
      .filter((entry) =>
        entry.ledgerId === ledgerId
        && entry.targetType === 'budget'
        && entry.targetYearMonth === yearMonth)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const budgetAmount = baseBudgetAmount + supplementAmount;
    const spentAmount = [...currentSpending.values()].reduce((sum, amount) => sum + amount, 0);
    const savedAmount = reserveEntries
      .filter((entry) =>
        entry.ledgerId === ledgerId
        && entry.sourceType === 'budget'
        && entry.sourceYearMonth === yearMonth)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const occupiedAmount = spentAmount + savedAmount;

    return {
      yearMonth,
      month,
      baseBudgetAmount,
      supplementAmount,
      budgetAmount,
      spentAmount,
      savedAmount,
      utilization: budgetAmount > 0 ? (occupiedAmount / budgetAmount) * 100 : null,
      status: budgetAmount <= 0 ? 'no-budget' : occupiedAmount > budgetAmount ? 'overspent' : 'on-track',
      budgetChanges: compareBudgetConfigurations(previousBudgets, currentBudgets),
      spendingChanges: compareCategorySpending(previousSpending, currentSpending),
    };
  });
}

/**
 * 这条分类预算是不是嵌在另一条预算下面（二级预算包在一级预算里）。
 * 嵌套时额度已经被一级算过一次，不能再重复占用总预算。
 */
function isNestedCategoryBudget(
  categoryId: string,
  categoryBudgetById: ReadonlyMap<string, number>,
  parentIdByCategoryId?: ReadonlyMap<string, string>,
): boolean {
  const parentId = parentIdByCategoryId?.get(categoryId);
  return Boolean(parentId && categoryBudgetById.has(parentId));
}

/** 分类预算中真正额外占用额度的部分（排除嵌套在别的预算下面的二级预算）。 */
function sumAllocatedCategoryBudgets(
  categoryBudgetById: ReadonlyMap<string, number>,
  parentIdByCategoryId?: ReadonlyMap<string, string>,
): number {
  let total = 0;
  for (const [categoryId, amount] of categoryBudgetById) {
    if (!isNestedCategoryBudget(categoryId, categoryBudgetById, parentIdByCategoryId)) total += amount;
  }
  return total;
}

export function getMonthlyBudgetAmount(
  budgets: Budget[],
  parentIdByCategoryId?: ReadonlyMap<string, string>,
): number {
  const overall = budgets.find((budget) => budget.includeOverall);
  if (overall) return overall.amount;
  const categoryBudgetById = new Map<string, number>();
  for (const budget of budgets) {
    if (!budget.categoryId) continue;
    categoryBudgetById.set(budget.categoryId, (categoryBudgetById.get(budget.categoryId) ?? 0) + budget.amount);
  }
  return sumAllocatedCategoryBudgets(categoryBudgetById, parentIdByCategoryId);
}

function getBudgetKey(budget: Budget): string {
  return budget.includeOverall ? 'overall' : budget.categoryId ?? 'uncategorized';
}

function compareBudgetConfigurations(previous: Budget[], current: Budget[]): BudgetChange[] {
  const previousByKey = new Map(previous.map((budget) => [getBudgetKey(budget), budget.amount]));
  const currentByKey = new Map(current.map((budget) => [getBudgetKey(budget), budget.amount]));
  // 当前仍存在的项目优先展示，已删除项目放在末尾，移动端阅读更自然。
  const keys = [...currentByKey.keys(), ...previousByKey.keys()].filter((key, index, all) => all.indexOf(key) === index);

  return keys.flatMap((key) => {
    const previousAmount = previousByKey.get(key) ?? 0;
    const currentAmount = currentByKey.get(key) ?? 0;
    if (previousAmount === currentAmount) return [];
    const kind: BudgetChangeKind = !previousByKey.has(key)
      ? 'added'
      : !currentByKey.has(key)
        ? 'removed'
        : 'amount_changed';
    return [{ key, kind, previousAmount, currentAmount, delta: currentAmount - previousAmount }];
  });
}

function compareCategorySpending(previous: Map<string, number>, current: Map<string, number>): SpendingChange[] {
  const categoryIds = [...current.keys(), ...previous.keys()]
    .filter((categoryId, index, all) => all.indexOf(categoryId) === index);

  return categoryIds.flatMap((categoryId) => {
    const previousAmount = previous.get(categoryId) ?? 0;
    const currentAmount = current.get(categoryId) ?? 0;
    if (previousAmount === currentAmount) return [];
    return [{ categoryId, previousAmount, currentAmount, delta: currentAmount - previousAmount }];
  });
}

function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getPreviousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const previous = new Date(year, month - 2, 1);
  return formatYearMonth(previous.getFullYear(), previous.getMonth() + 1);
}
