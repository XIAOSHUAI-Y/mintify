import type { FundTransaction } from '../types';

export interface FundMonthSummary {
  income: number;
  expense: number;
  balance: number;
  livingExpenseAllocation: number;
}

export interface FundMonthlyTrendItem {
  month: string;
  income: number;
  expense: number;
}

export interface FundExpenseBreakdownItem {
  category: string;
  amount: number;
}

/**
 * 统一资金页与数据库的级联删除规则，避免解除“已有收入”关联时误删主账本原记录。
 */
export function shouldRemoveLinkedMainIncome(transaction: FundTransaction): boolean {
  return transaction.kind === 'living-expense-allocation'
    && transaction.mainIncomeOrigin === 'auto-created'
    && !!transaction.linkedTransactionId;
}

export function summarizeFundMonth(
  transactions: FundTransaction[],
  yearMonth: string,
): FundMonthSummary {
  const monthTransactions = transactions.filter(
    (transaction) => toYearMonth(transaction.occurredAt) === yearMonth,
  );
  const income = sumByType(monthTransactions, 'income');
  const expense = sumByType(monthTransactions, 'expense');
  const livingExpenseAllocation = monthTransactions
    .filter((transaction) => transaction.kind === 'living-expense-allocation')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return { income, expense, balance: income - expense, livingExpenseAllocation };
}

export function buildFundMonthlyTrend(
  transactions: FundTransaction[],
  year: number,
): FundMonthlyTrendItem[] {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthTransactions = transactions.filter((transaction) => {
      const date = new Date(transaction.occurredAt);
      return date.getFullYear() === year && date.getMonth() === monthIndex;
    });
    return {
      month: `${monthIndex + 1}月`,
      income: sumByType(monthTransactions, 'income'),
      expense: sumByType(monthTransactions, 'expense'),
    };
  });
}

export function buildFundExpenseBreakdown(
  transactions: FundTransaction[],
  yearMonth: string,
): FundExpenseBreakdownItem[] {
  const grouped = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || toYearMonth(transaction.occurredAt) !== yearMonth) continue;
    grouped.set(transaction.category, (grouped.get(transaction.category) ?? 0) + transaction.amount);
  }
  return [...grouped.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'zh-CN'));
}

function sumByType(
  transactions: FundTransaction[],
  type: FundTransaction['type'],
): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function toYearMonth(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
