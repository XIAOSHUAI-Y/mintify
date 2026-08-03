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
}

interface CalculateBudgetAllocationSummaryOptions {
  budgets: Budget[];
  transactions: Transaction[];
  ledgerId: string;
  yearMonth: string;
  reserveEntries?: ReserveEntry[];
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
 * 预算结余代表尚未分配、也尚未被超额消费占用的总预算。
 * 分类预算内的正常支出已经包含在“已分配”中，不能再次扣减。
 */
export function calculateBudgetAllocationSummary({
  budgets,
  transactions,
  ledgerId,
  yearMonth,
  reserveEntries = [],
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

  const allocatedAmount = [...categoryBudgetById.values()].reduce((sum, amount) => sum + amount, 0);
  const ledgerTransactions = transactions.filter((transaction) => transaction.ledgerId === ledgerId);
  const spendingByCategory = getNetSpendingByCategory(ledgerTransactions, yearMonth);
  let categoryOverspendAmount = 0;
  let unbudgetedSpendingAmount = 0;
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
    const categoryBudget = categoryBudgetById.get(categoryId);
    if (categoryBudget === undefined) {
      unbudgetedSpendingAmount += spentAmount;
    } else {
      categoryOverspendAmount += Math.max(spentAmount - categoryBudget, 0);
    }
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
    const baseBudgetAmount = getMonthlyBudgetAmount(currentBudgets);
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

function getMonthlyBudgetAmount(budgets: Budget[]): number {
  const overall = budgets.find((budget) => budget.includeOverall);
  if (overall) return overall.amount;
  return budgets.reduce((sum, budget) => sum + budget.amount, 0);
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
