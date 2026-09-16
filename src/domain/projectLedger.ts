import type { Transaction } from '../types';
import { isRefund, summarizeTransactions } from './transactionAccounting';

export interface ProjectTotals {
  count: number;
  income: number;
  grossExpense: number;
  refunds: number;
  netExpense: number;
  balance: number;
}

export interface ProjectCategoryItem {
  categoryId: string;
  amount: number;
}

/**
 * 项目总账沿用交易账务口径：退款是原支出的冲销，不与普通收入重复计入。
 * 只有显式带上 projectId 的流水才算归集，避免标签式的模糊匹配。
 */
export function getProjectTransactions(
  transactions: Transaction[],
  projectId: string,
): Transaction[] {
  return transactions
    .filter((transaction) => transaction.projectId === projectId)
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

export function summarizeProject(
  transactions: Transaction[],
  projectId: string,
): ProjectTotals {
  const scoped = getProjectTransactions(transactions, projectId);
  return { count: scoped.length, ...summarizeTransactions(scoped) };
}

/**
 * 分类构成按净支出统计：退款冲减它所绑定的原支出分类。
 * 原支出不在项目内时直接忽略该退款，不让它凭空生成一个分类。
 */
export function buildProjectCategoryBreakdown(
  transactions: Transaction[],
  projectId: string,
): ProjectCategoryItem[] {
  const scoped = getProjectTransactions(transactions, projectId);
  const scopedById = new Map(scoped.map((transaction) => [transaction.id, transaction]));
  const spending = new Map<string, number>();

  for (const transaction of scoped) {
    if (transaction.type === 'expense') {
      spending.set(
        transaction.categoryId,
        (spending.get(transaction.categoryId) ?? 0) + transaction.amount,
      );
      continue;
    }
    if (!isRefund(transaction) || !transaction.linkedExpenseTransactionId) continue;
    const linkedExpense = scopedById.get(transaction.linkedExpenseTransactionId);
    if (!linkedExpense || linkedExpense.type !== 'expense') continue;
    spending.set(
      linkedExpense.categoryId,
      (spending.get(linkedExpense.categoryId) ?? 0) - transaction.amount,
    );
  }

  return [...spending.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId, 'zh-CN'));
}
