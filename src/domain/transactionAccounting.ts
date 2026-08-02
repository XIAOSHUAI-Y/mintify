import type { Transaction } from '../types';

export interface TransactionSummary {
  income: number;
  grossExpense: number;
  refunds: number;
  netExpense: number;
  balance: number;
}

export function isRefund(transaction: Transaction): boolean {
  return transaction.kind === 'refund';
}

/**
 * 退款是支出冲销，不是新的经营收入；余额只增加一次。
 */
export function summarizeTransactions(transactions: Transaction[]): TransactionSummary {
  const income = transactions
    .filter((transaction) => transaction.type === 'income' && !isRefund(transaction))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const grossExpense = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const refunds = transactions
    .filter(isRefund)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    income,
    grossExpense,
    refunds,
    netExpense: Math.max(grossExpense - refunds, 0),
    balance: income + refunds - grossExpense,
  };
}

export function getNetSpendingByCategory(
  transactions: Transaction[],
  yearMonth: string,
): Map<string, number> {
  const byId = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const spending = new Map<string, number>();

  for (const transaction of transactions) {
    if (toYearMonth(transaction.occurredAt) !== yearMonth) continue;
    if (transaction.type === 'expense') {
      spending.set(transaction.categoryId, (spending.get(transaction.categoryId) ?? 0) + transaction.amount);
      continue;
    }
    if (!isRefund(transaction) || !transaction.linkedExpenseTransactionId) continue;
    const linkedExpense = byId.get(transaction.linkedExpenseTransactionId);
    if (!linkedExpense || linkedExpense.type !== 'expense') continue;
    spending.set(
      linkedExpense.categoryId,
      (spending.get(linkedExpense.categoryId) ?? 0) - transaction.amount,
    );
  }

  for (const [categoryId, amount] of spending) spending.set(categoryId, Math.max(amount, 0));
  return spending;
}

export function getRemainingRefundableAmount(
  transactions: Transaction[],
  expenseId: string,
  excludedRefundId?: string,
): number {
  const expense = transactions.find((transaction) => transaction.id === expenseId);
  if (!expense || expense.type !== 'expense') return 0;
  const refunded = transactions
    .filter((transaction) =>
      transaction.id !== excludedRefundId
      && isRefund(transaction)
      && transaction.linkedExpenseTransactionId === expenseId)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return Math.max(expense.amount - refunded, 0);
}

function toYearMonth(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
