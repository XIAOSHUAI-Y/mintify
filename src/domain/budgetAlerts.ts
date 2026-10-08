import type { Budget, Transaction } from '../types';
import { getYearMonth } from '../utils/helpers';
import { getNetSpendingByCategory } from './transactionAccounting';

export interface BudgetAlert {
  key: string;
  label: string;
  percentage: number;
  severity: 'warning' | 'exceeded';
}

/** 使用率跨过该线时提醒一次；持续超支时不重复打扰。 */
export const BUDGET_WARNING_THRESHOLD = 0.8;

interface BuildBudgetAlertsOptions {
  budgets: Budget[];
  /** 已包含本次保存结果的完整账本流水（调用方负责把保存后的交易合并进来）。 */
  transactions: Transaction[];
  ledgerId: string;
  savedTransaction: Transaction;
  /** 编辑场景下的旧记录，用于还原保存前的使用率；新增时为空。 */
  previousTransaction?: Transaction | null;
  categoryName?: string;
  /**
   * 子级分类 id → 父级 id。传了才启用「一级预算兜底」：
   * 二级分类自己没有预算时，用一级预算来算使用率。
   */
  parentIdByCategoryId?: ReadonlyMap<string, string>;
  /** 分类 id → 名字，用于把提醒文案写成预算归属的那个分类。 */
  categoryNameByCategoryId?: ReadonlyMap<string, string>;
}

/**
 * 只在“这一笔让使用率跨过阈值”时报警：
 * 保存前后各算一次使用率，before < 阈值 <= after 才提示，避免超支后每记一笔都弹窗。
 */
export function buildBudgetAlerts({
  budgets,
  transactions,
  ledgerId,
  savedTransaction,
  previousTransaction,
  categoryName,
  parentIdByCategoryId,
  categoryNameByCategoryId,
}: BuildBudgetAlertsOptions): BudgetAlert[] {
  if (savedTransaction.type !== 'expense') return [];

  const yearMonth = getYearMonth(savedTransaction.occurredAt);
  const monthBudgets = budgets.filter((budget) =>
    budget.ledgerId === ledgerId && budget.yearMonth === yearMonth && budget.period === 'monthly');
  if (monthBudgets.length === 0) return [];

  const spending = getNetSpendingByCategory(
    transactions.filter((transaction) => transaction.ledgerId === ledgerId),
    yearMonth,
  );

  // 还原保存前的支出：新增相当于从 0 开始，编辑则先退回旧金额。
  const previousExpenseAmount = previousTransaction?.type === 'expense' ? previousTransaction.amount : 0;
  const delta = savedTransaction.amount - previousExpenseAmount;

  const targets: { key: string; label: string; budget: Budget; spent: number }[] = [];
  const overall = monthBudgets.find((budget) => budget.includeOverall);
  if (overall) {
    targets.push({
      key: 'overall',
      label: '本月总预算',
      budget: overall,
      spent: [...spending.values()].reduce((sum, amount) => sum + amount, 0),
    });
  }
  // 二级分类自己没有预算时，交由一级预算兜底（一级的使用率要含全部子级）。
  const savedParentId = parentIdByCategoryId?.get(savedTransaction.categoryId);
  const categoryBudget = monthBudgets.find(
    (budget) => !budget.includeOverall && budget.categoryId === savedTransaction.categoryId,
  ) ?? (savedParentId
    ? monthBudgets.find((budget) => !budget.includeOverall && budget.categoryId === savedParentId)
    : undefined);
  if (categoryBudget?.categoryId) {
    const ownerId = categoryBudget.categoryId;
    const ownerSpent = [...spending].reduce(
      (sum, [categoryId, amount]) =>
        sum + (categoryId === ownerId || parentIdByCategoryId?.get(categoryId) === ownerId ? amount : 0),
      0,
    );
    targets.push({
      key: `category:${ownerId}`,
      label: `「${categoryNameByCategoryId?.get(ownerId) ?? categoryName ?? '分类'}」预算`,
      budget: categoryBudget,
      spent: ownerSpent,
    });
  }

  const alerts: BudgetAlert[] = [];
  for (const target of targets) {
    if (target.budget.amount <= 0) continue;
    const after = target.spent / target.budget.amount;
    const before = (target.spent - delta) / target.budget.amount;
    const crossedExceeded = before < 1 && after >= 1;
    const crossedWarning = before < BUDGET_WARNING_THRESHOLD && after >= BUDGET_WARNING_THRESHOLD;
    if (!crossedExceeded && !crossedWarning) continue;
    alerts.push({
      key: target.key,
      label: target.label,
      percentage: after * 100,
      severity: crossedExceeded ? 'exceeded' : 'warning',
    });
  }

  // 超支优先于接近阈值；同级别分类预算比总预算更具体，排在前面。
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'exceeded' ? -1 : 1;
    return a.key.startsWith('category:') ? -1 : 1;
  });
}
