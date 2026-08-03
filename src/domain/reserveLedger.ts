import type { Budget, ReserveEntry, SavingsPlan, Transaction } from '../types';
import { getNetSpendingByCategory } from './transactionAccounting';

export interface ReserveBalances {
  general: number;
  plans: Map<string, number>;
  total: number;
}

export interface MonthlyBudgetAvailability {
  budgetAmount: number;
  spentAmount: number;
  reservedAmount: number;
  availableAmount: number;
}

/**
 * 余额全部由流水归集：通用池和计划之间的内部划转只改变分布，不改变总结余。
 */
export function calculateReserveBalances(
  plans: SavingsPlan[],
  entries: ReserveEntry[],
): ReserveBalances {
  let general = 0;
  const planBalances = new Map(plans.map((plan) => [plan.id, 0]));

  for (const entry of entries) {
    if (entry.sourceType === 'general') general -= entry.amount;
    if (entry.sourceType === 'plan' && entry.sourcePlanId) {
      planBalances.set(entry.sourcePlanId, (planBalances.get(entry.sourcePlanId) ?? 0) - entry.amount);
    }
    if (entry.targetType === 'general') general += entry.amount;
    if (entry.targetType === 'plan' && entry.targetPlanId) {
      planBalances.set(entry.targetPlanId, (planBalances.get(entry.targetPlanId) ?? 0) + entry.amount);
    }
  }

  const plansTotal = [...planBalances.values()].reduce((sum, amount) => sum + amount, 0);
  return { general, plans: planBalances, total: general + plansTotal };
}

/** 预算转入结余后会占用当月可用额度，但不会伪装成消费进入分类支出统计。 */
export function calculateMonthlyBudgetAvailability({
  budgets,
  transactions,
  reserveEntries,
  ledgerId,
  yearMonth,
}: {
  budgets: Budget[];
  transactions: Transaction[];
  reserveEntries: ReserveEntry[];
  ledgerId: string;
  yearMonth: string;
}): MonthlyBudgetAvailability {
  const monthBudgets = budgets.filter((budget) =>
    budget.ledgerId === ledgerId && budget.yearMonth === yearMonth && budget.period === 'monthly');
  const overall = monthBudgets.find((budget) => budget.includeOverall);
  const budgetAmount = overall?.amount
    ?? monthBudgets.filter((budget) => !budget.includeOverall).reduce((sum, budget) => sum + budget.amount, 0);
  const spending = getNetSpendingByCategory(
    transactions.filter((transaction) => transaction.ledgerId === ledgerId),
    yearMonth,
  );
  const spentAmount = [...spending.values()].reduce((sum, amount) => sum + amount, 0);
  const reservedAmount = reserveEntries
    .filter((entry) =>
      entry.ledgerId === ledgerId
      && entry.sourceType === 'budget'
      && entry.sourceYearMonth === yearMonth)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    budgetAmount,
    spentAmount,
    reservedAmount,
    availableAmount: Math.max(budgetAmount - spentAmount - reservedAmount, 0),
  };
}
