import type { Budget, ReserveEntry, SavingsPlan, Transaction } from '../types';
import { calculateBudgetAllocationSummary } from './budgetAnalytics';
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

export interface MonthlyReserveDestination {
  targetType: 'general' | 'plan';
  targetPlanId?: string;
  amount: number;
}

interface ReserveOriginLot {
  yearMonth: string;
  amount: number;
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

/**
 * 追踪某个月从预算转出的资金当前所在位置。
 * 内部划转按先进先出搬运来源批次，避免把后续月份存入的钱错误归到更早的计划划转中。
 */
export function calculateMonthlyReserveDestinations(
  entries: ReserveEntry[],
  ledgerId: string,
  yearMonth: string,
): MonthlyReserveDestination[] {
  const buckets = new Map<string, ReserveOriginLot[]>();
  const sortedEntries = entries
    .filter((entry) => entry.ledgerId === ledgerId)
    .toSorted((a, b) => a.occurredAt - b.occurredAt || a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  const targetKey = (entry: ReserveEntry) => {
    if (entry.targetType === 'general') return 'general';
    return entry.targetPlanId ? `plan:${entry.targetPlanId}` : null;
  };
  const sourceKey = (entry: ReserveEntry) => {
    if (entry.sourceType === 'general') return 'general';
    if (entry.sourceType === 'plan' && entry.sourcePlanId) return `plan:${entry.sourcePlanId}`;
    return null;
  };
  const appendLot = (key: string, lot: ReserveOriginLot) => {
    const lots = buckets.get(key) ?? [];
    lots.push(lot);
    buckets.set(key, lots);
  };

  for (const entry of sortedEntries) {
    const destination = targetKey(entry);
    if (!destination || entry.amount <= 0) continue;

    if (entry.sourceType === 'budget') {
      if (entry.sourceYearMonth) {
        appendLot(destination, { yearMonth: entry.sourceYearMonth, amount: entry.amount });
      }
      continue;
    }

    const source = sourceKey(entry);
    if (!source || source === destination) continue;
    const sourceLots = buckets.get(source) ?? [];
    let remaining = entry.amount;
    while (remaining > 0 && sourceLots.length > 0) {
      const lot = sourceLots[0];
      const movedAmount = Math.min(lot.amount, remaining);
      appendLot(destination, { yearMonth: lot.yearMonth, amount: movedAmount });
      lot.amount -= movedAmount;
      remaining -= movedAmount;
      if (lot.amount <= 0) sourceLots.shift();
    }
    buckets.set(source, sourceLots);
  }

  return [...buckets.entries()]
    .map(([key, lots]) => {
      const amount = lots
        .filter((lot) => lot.yearMonth === yearMonth)
        .reduce((sum, lot) => sum + lot.amount, 0);
      if (key === 'general') return { targetType: 'general' as const, amount };
      return { targetType: 'plan' as const, targetPlanId: key.slice('plan:'.length), amount };
    })
    .filter((destination) => destination.amount > 0)
    .sort((a, b) => {
      if (a.targetType !== b.targetType) return a.targetType === 'general' ? -1 : 1;
      return (a.targetPlanId ?? '').localeCompare(b.targetPlanId ?? '');
    });
}

/**
 * 可转结余来自尚未分配的总预算，而不是“总预算减去当前消费”。
 * 分类预算即使尚未花完也已经有明确用途，不能被提前转入结余池。
 */
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
  const allocation = calculateBudgetAllocationSummary({
    budgets,
    transactions,
    reserveEntries,
    ledgerId,
    yearMonth,
  });

  return {
    budgetAmount,
    spentAmount,
    reservedAmount: allocation.reservedAmount,
    availableAmount: Math.max(allocation.balanceAmount, 0),
  };
}

/**
 * 周期结束后分类预算不再需要保留，因此结算金额按总预算减实际净支出和已存金额计算。
 * 这条规则只用于跨月结算，不能替代月中的未分配预算校验。
 */
export function calculateMonthlyPeriodSettlement(
  options: Parameters<typeof calculateMonthlyBudgetAvailability>[0],
): MonthlyBudgetAvailability {
  const availability = calculateMonthlyBudgetAvailability(options);
  return {
    ...availability,
    availableAmount: Math.max(
      availability.budgetAmount - availability.spentAmount - availability.reservedAmount,
      0,
    ),
  };
}
