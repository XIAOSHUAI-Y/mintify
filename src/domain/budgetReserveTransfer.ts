import type { ReserveEntry } from '../types';

export type BudgetReserveDestination =
  | { type: 'general'; name: string }
  | { type: 'plan'; planId: string; name: string };

interface BuildBudgetReserveTransferOptions {
  id: string;
  ledgerId: string;
  yearMonth: string;
  amount: number;
  destination: BudgetReserveDestination;
  now: number;
}

/**
 * 预算转入直接记录最终去向，避免必须先经过通用结余池再做一次内部划转。
 * 可转金额仍由持久层统一校验，所有入口都不能突破当月未分配预算。
 */
export function buildBudgetReserveTransfer({
  id,
  ledgerId,
  yearMonth,
  amount,
  destination,
  now,
}: BuildBudgetReserveTransferOptions): ReserveEntry {
  return {
    id,
    ledgerId,
    amount,
    sourceType: 'budget',
    sourceYearMonth: yearMonth,
    targetType: destination.type,
    ...(destination.type === 'plan' ? { targetPlanId: destination.planId } : {}),
    note: `${Number(yearMonth.slice(5))} 月预算转入${destination.name}`,
    occurredAt: now,
    createdAt: now,
  };
}
