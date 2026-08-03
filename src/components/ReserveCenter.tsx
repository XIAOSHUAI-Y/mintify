import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateMonthlyBudgetAvailability, calculateReserveBalances, getSavingsPlanProgress } from '../domain/reserveLedger';
import { formatMoney, formatPercentage, generateId, getYearMonth } from '../utils/helpers';
import type { ReserveEntry, SavingsPlan } from '../types';
import { Icon } from './Icon';

const PLAN_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F43F5E'];

export default function ReserveCenter({
  yearMonth,
  showMonthlyTransfer = true,
  standalone = false,
  onClose,
}: {
  yearMonth: string;
  showMonthlyTransfer?: boolean;
  standalone?: boolean;
  onClose?: () => void;
}) {
  const {
    currentLedger,
    budgets,
    transactions,
    savingsPlans,
    reserveEntries,
    savePlan,
    archivePlan,
    addReserveEntry,
  } = useApp();
  const [managerOpen, setManagerOpen] = useState(standalone);
  const [dialog, setDialog] = useState<'month-all' | 'month-custom' | 'plan' | 'transfer' | 'withdraw' | 'delete-plan' | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [deleteDestinationKey, setDeleteDestinationKey] = useState('general');
  const [amount, setAmount] = useState('');
  const [planName, setPlanName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [planColor, setPlanColor] = useState(PLAN_COLORS[0]);
  const [error, setError] = useState('');

  const activePlans = useMemo(
    () => savingsPlans.filter((plan) => !plan.archivedAt),
    [savingsPlans],
  );
  const balances = useMemo(
    () => calculateReserveBalances(savingsPlans, reserveEntries),
    [reserveEntries, savingsPlans],
  );
  const availability = useMemo(
    () => currentLedger
      ? calculateMonthlyBudgetAvailability({
          budgets,
          transactions,
          reserveEntries,
          ledgerId: currentLedger.id,
          yearMonth,
        })
      : { baseBudgetAmount: 0, supplementAmount: 0, budgetAmount: 0, spentAmount: 0, reservedAmount: 0, availableAmount: 0 },
    [budgets, currentLedger, reserveEntries, transactions, yearMonth],
  );

  if (!currentLedger) return null;

  const resetDialog = () => {
    setDialog(null);
    setAmount('');
    setPlanName('');
    setTargetAmount('');
    setSelectedPlanId('');
    setDeleteDestinationKey('general');
    setPlanColor(PLAN_COLORS[0]);
    setError('');
  };

  const closeManager = () => {
    if (standalone) onClose?.();
    else setManagerOpen(false);
  };

  const openCreatePlan = () => {
    setSelectedPlanId('');
    setPlanName('');
    setTargetAmount('');
    setPlanColor(PLAN_COLORS[0]);
    setError('');
    setDialog('plan');
  };

  const openPlanEditor = (plan: SavingsPlan) => {
    setSelectedPlanId(plan.id);
    setPlanName(plan.name);
    setTargetAmount(plan.targetAmount ? String(plan.targetAmount) : '');
    setPlanColor(plan.color);
    setError('');
    setDialog('plan');
  };

  const openMonthTransfer = (mode: 'all' | 'custom') => {
    setAmount(mode === 'all' ? String(availability.availableAmount) : '');
    setError('');
    setDialog(mode === 'all' ? 'month-all' : 'month-custom');
  };

  const openPlanTransfer = (planId: string) => {
    setSelectedPlanId(planId);
    setAmount('');
    setError('');
    setDialog('transfer');
  };

  const openBudgetWithdrawal = (planId: string) => {
    setSelectedPlanId(planId);
    setAmount('');
    setError('');
    setDialog('withdraw');
  };

  const saveMonthTransfer = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('请输入大于 0 的金额');
    try {
      await addReserveEntry({
        id: generateId(),
        ledgerId: currentLedger.id,
        amount: value,
        sourceType: 'budget',
        targetType: 'general',
        sourceYearMonth: yearMonth,
        note: `${Number(yearMonth.slice(5))} 月预算结余`,
        occurredAt: Date.now(),
        createdAt: Date.now(),
      });
      resetDialog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '转入失败，请重试');
    }
  };

  const savePlanDetails = async () => {
    const target = targetAmount ? Number(targetAmount) : undefined;
    if (!planName.trim()) return setError('给计划起个名字吧');
    if (target !== undefined && (!Number.isFinite(target) || target <= 0)) return setError('目标金额必须大于 0');
    const existingPlan = activePlans.find((plan) => plan.id === selectedPlanId);
    const plan: SavingsPlan = {
      ...existingPlan,
      id: existingPlan?.id ?? generateId(),
      ledgerId: currentLedger.id,
      name: planName.trim(),
      targetAmount: target,
      icon: existingPlan?.icon ?? 'piggy-bank',
      color: planColor,
      createdAt: existingPlan?.createdAt ?? Date.now(),
    };
    try {
      await savePlan(plan);
      resetDialog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '创建失败，请重试');
    }
  };

  const transferToPlan = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('请输入大于 0 的金额');
    try {
      await addReserveEntry({
        id: generateId(),
        ledgerId: currentLedger.id,
        amount: value,
        sourceType: 'general',
        targetType: 'plan',
        targetPlanId: selectedPlanId,
        note: '从通用结余池转入',
        occurredAt: Date.now(),
        createdAt: Date.now(),
      });
      resetDialog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '转入失败，请重试');
    }
  };

  const withdrawPlanToBudget = async () => {
    const value = Number(amount);
    const planBalance = balances.plans.get(selectedPlanId) ?? 0;
    if (!Number.isFinite(value) || value <= 0) return setError('请输入大于 0 的金额');
    if (value > planBalance) return setError(`最多可划出 ${formatMoney(planBalance)}`);
    try {
      const now = Date.now();
      await addReserveEntry({
        id: generateId(),
        ledgerId: currentLedger.id,
        amount: value,
        sourceType: 'plan',
        sourcePlanId: selectedPlanId,
        targetType: 'budget',
        targetYearMonth: currentMonth,
        note: `划入 ${Number(currentMonth.slice(5))} 月预算`,
        occurredAt: now,
        createdAt: now,
      });
      resetDialog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '划出失败，请重试');
    }
  };

  const deleteSelectedPlan = async () => {
    const plan = activePlans.find((item) => item.id === selectedPlanId);
    if (!plan) return setError('攒钱计划不存在');
    const planBalance = balances.plans.get(plan.id) ?? 0;
    const now = Date.now();
    let transferEntry: ReserveEntry | undefined;

    if (planBalance > 0) {
      const common = {
        id: generateId(),
        ledgerId: currentLedger.id,
        amount: planBalance,
        sourceType: 'plan' as const,
        sourcePlanId: plan.id,
        occurredAt: now,
        createdAt: now,
      };
      if (deleteDestinationKey === 'general') {
        transferEntry = { ...common, targetType: 'general', note: '删除计划时转入通用结余池' };
      } else if (deleteDestinationKey === 'budget') {
        transferEntry = {
          ...common,
          targetType: 'budget',
          targetYearMonth: currentMonth,
          note: `删除计划时划入 ${Number(currentMonth.slice(5))} 月预算`,
        };
      } else {
        const targetPlanId = deleteDestinationKey.slice('plan:'.length);
        const targetPlan = activePlans.find((item) => item.id === targetPlanId);
        if (!targetPlan) return setError('目标攒钱计划不存在');
        transferEntry = {
          ...common,
          targetType: 'plan',
          targetPlanId,
          note: `删除计划时转入${targetPlan.name}`,
        };
      }
    }

    try {
      await archivePlan(plan.id, transferEntry);
      resetDialog();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : '删除失败，请重试');
    }
  };

  const currentMonth = getYearMonth(Date.now());
  const hasCurrentOverallBudget = budgets.some((budget) =>
    budget.ledgerId === currentLedger.id
    && budget.period === 'monthly'
    && budget.includeOverall
    && budget.yearMonth === currentMonth);
  const canTransferMonth = yearMonth <= currentMonth && availability.availableAmount > 0;
  const editingPlan = activePlans.find((plan) => plan.id === selectedPlanId);
  const selectedPlanBalance = balances.plans.get(selectedPlanId) ?? 0;

  return (
    <>
      {!standalone && (
      <section className="mb-5 overflow-hidden rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-100 via-amber-50 to-white p-4 shadow-[0_14px_34px_rgba(245,158,11,0.10)]">
        <button onClick={() => setManagerOpen(true)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800/70">
                <Sparkles size={14} /> 我的总结余
              </div>
              <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{formatMoney(balances.total)}</div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-amber-600 shadow-sm">
              <ChevronRight size={19} />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5">
              <div className="text-[11px] text-slate-400">通用结余池</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">{formatMoney(balances.general)}</div>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5">
              <div className="text-[11px] text-slate-400">攒钱计划</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">{activePlans.length} 个</div>
            </div>
          </div>
        </button>
        {showMonthlyTransfer && (
          <div className="mt-3 grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2">
            <button
              onClick={() => openMonthTransfer('all')}
              disabled={!canTransferMonth}
              className="flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-2 text-xs font-semibold text-amber-950 disabled:bg-white/60 disabled:text-slate-400"
            >
              <ArrowDownToLine size={16} className="shrink-0" />
              <span className="truncate">
                {availability.availableAmount <= 0
                  ? '暂无未分配预算'
                  : `全部转入 ${formatMoney(availability.availableAmount)}`}
              </span>
            </button>
            <button
              onClick={() => openMonthTransfer('custom')}
              disabled={!canTransferMonth}
              className="min-h-12 rounded-xl border border-amber-200 bg-white/75 px-2 text-xs font-semibold text-amber-800 active:bg-white disabled:border-white/60 disabled:text-slate-400"
            >
              自定义转入
            </button>
          </div>
        )}
      </section>
      )}

      {managerOpen && (
        <div className="mobile-overlay z-[60] bg-slate-50">
          <div className="mobile-toolbar">
            <button onClick={closeManager} className="icon-button" aria-label="返回">
              <ArrowLeft size={21} />
            </button>
            <div className="font-semibold">攒钱</div>
            <button onClick={openCreatePlan} className="icon-button text-amber-700" aria-label="新建攒钱计划">
              <Plus size={21} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">
            <section className="rounded-[1.5rem] bg-gradient-to-br from-amber-300 via-amber-200 to-yellow-100 p-5 text-amber-950 shadow-[0_18px_40px_rgba(245,158,11,0.20)]">
              <div className="text-xs font-semibold text-amber-900/60">当前已攒</div>
              <div className="mt-1 text-3xl font-bold tracking-tight">{formatMoney(balances.total)}</div>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-white/55 px-3 py-3">
                <span className="flex items-center gap-2 text-sm font-medium"><Landmark size={17} /> 通用结余池</span>
                <span className="font-semibold">{formatMoney(balances.general)}</span>
              </div>
            </section>

            <div className="mb-2 mt-6 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">攒钱计划</div>
              <button onClick={openCreatePlan} className="text-xs font-semibold text-amber-700">+ 新建计划</button>
            </div>
            {activePlans.length === 0 ? (
              <button
                onClick={openCreatePlan}
                className="surface-card flex w-full flex-col items-center border-dashed px-4 py-8 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Target size={22} />
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-700">给结余一个去处</span>
                <span className="mt-1 text-xs text-slate-400">旅行、养猫或任何想慢慢实现的事</span>
              </button>
            ) : (
              <div className="space-y-3">
                {activePlans.map((plan) => {
                  const balance = balances.plans.get(plan.id) ?? 0;
                  const progress = plan.targetAmount ? getSavingsPlanProgress(balance, plan.targetAmount) : null;
                  return (
                    <div
                      key={plan.id}
                      className="relative overflow-hidden rounded-[1.5rem] border p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)]"
                      style={{
                        borderColor: `${plan.color}2E`,
                        background: `linear-gradient(145deg, ${plan.color}18 0%, #FFFFFF 54%, #FFFFFF 100%)`,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl"
                        style={{ backgroundColor: `${plan.color}20` }}
                      />
                      <div className="relative">
                        <div className="flex items-start gap-3">
                          <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                            style={{ backgroundColor: plan.color }}
                          >
                            <Icon name={plan.icon} size={23} />
                          </span>
                          <span className="min-w-0 flex-1 pt-0.5">
                            <span className="block truncate text-base font-bold text-slate-900">{plan.name}</span>
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-[11px] font-semibold shadow-sm" style={{ color: plan.color }}>
                              <Target size={12} />
                              {progress?.completed ? '目标已达成' : '目标进行中'}
                            </span>
                          </span>
                          <button
                            onClick={() => openPlanEditor(plan)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/75 text-slate-500 shadow-sm active:bg-white"
                            aria-label={`编辑${plan.name}`}
                          >
                            <Pencil size={15} />
                          </button>
                        </div>

                        <div className="mt-5">
                          <div className="text-[11px] font-medium text-slate-400">已经攒下</div>
                          <div className="mt-0.5 text-[1.75rem] font-bold tracking-tight text-slate-950">{formatMoney(balance)}</div>
                        </div>

                        {plan.targetAmount && progress ? (
                          <div className="mt-4">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="font-semibold" style={{ color: plan.color }}>
                                已完成 {formatPercentage(progress.percentage)}
                              </span>
                              <span className="text-slate-500">
                                {progress.completed ? '目标达成啦' : `还差 ${formatMoney(progress.remainingAmount)}`}
                              </span>
                            </div>
                            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: `${plan.color}18` }}>
                              <div
                                className="h-full rounded-full shadow-[0_0_12px_rgba(59,130,246,0.24)]"
                                style={{ width: `${progress.percentage}%`, backgroundColor: plan.color }}
                              />
                            </div>
                            <div className="mt-2 text-right text-[11px] text-slate-400">
                              目标 {formatMoney(plan.targetAmount)}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl bg-white/70 px-3 py-2.5 text-xs text-slate-500">
                            自由积累，不设金额上限
                          </div>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => openPlanTransfer(plan.id)}
                            disabled={balances.general <= 0}
                            className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-white shadow-sm active:scale-[0.995] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                            style={balances.general > 0 ? { backgroundColor: plan.color } : undefined}
                          >
                            <ArrowUpRight size={16} />
                            {balances.general > 0 ? '继续攒一笔' : '通用池暂无余额'}
                          </button>
                          <button
                            onClick={() => openBudgetWithdrawal(plan.id)}
                            disabled={balance <= 0 || !hasCurrentOverallBudget}
                            className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border bg-white/80 px-2 text-xs font-semibold shadow-sm active:scale-[0.995] disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                            style={balance > 0 && hasCurrentOverallBudget ? { borderColor: `${plan.color}45`, color: plan.color } : undefined}
                          >
                            <ArrowDownLeft size={16} />
                            {!hasCurrentOverallBudget ? '先设置本月预算' : '划到本月预算'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {reserveEntries.length > 0 && (
              <>
                <div className="mb-2 mt-6 text-sm font-semibold text-slate-800">最近变动</div>
                <div className="surface-card divide-y divide-slate-100 px-4">
                  {reserveEntries.slice(0, 8).map((entry) => (
                    <ReserveHistoryItem key={entry.id} entry={entry} plans={savingsPlans} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {dialog === 'month-all' && (
        <ConfirmAllTransferDialog
          amount={availability.availableAmount}
          month={Number(yearMonth.slice(5))}
          error={error}
          onCancel={resetDialog}
          onConfirm={() => void saveMonthTransfer()}
        />
      )}

      {dialog === 'month-custom' && (
        <AmountDialog
          title={`自定义转入 ${Number(yearMonth.slice(5))} 月结余`}
          hint={`最多可转 ${formatMoney(availability.availableAmount)}，转入后会同步减少本月可用预算。`}
          amount={amount}
          onAmountChange={(value) => {
            setAmount(value);
            setError('');
          }}
          error={error}
          onCancel={resetDialog}
          onConfirm={() => void saveMonthTransfer()}
        />
      )}

      {dialog === 'transfer' && (
        <AmountDialog
          title={`转入 ${activePlans.find((plan) => plan.id === selectedPlanId)?.name ?? '攒钱计划'}`}
          hint={`从通用结余池转入，可用 ${formatMoney(balances.general)}；内部划转不会改变总结余。`}
          amount={amount}
          onAmountChange={(value) => {
            setAmount(value);
            setError('');
          }}
          error={error}
          onCancel={resetDialog}
          onConfirm={() => void transferToPlan()}
        />
      )}

      {dialog === 'withdraw' && (
        <AmountDialog
          title={`划到 ${Number(currentMonth.slice(5))} 月预算`}
          amountLabel="划出金额"
          confirmLabel="确认划到预算"
          hint={`从${activePlans.find((plan) => plan.id === selectedPlanId)?.name ?? '攒钱计划'}划出，可用 ${formatMoney(selectedPlanBalance)}。这是内部划转，不计入收入或支出。`}
          amount={amount}
          onAmountChange={(value) => {
            setAmount(value);
            setError('');
          }}
          error={error}
          onCancel={resetDialog}
          onConfirm={() => void withdrawPlanToBudget()}
        />
      )}

      {dialog === 'plan' && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-sm rounded-[1.5rem] bg-white p-4 shadow-2xl">
            <div className="text-center font-semibold text-slate-900">
              {editingPlan ? '编辑攒钱计划' : '新建攒钱计划'}
            </div>
            <input
              value={planName}
              onChange={(event) => {
                setPlanName(event.target.value);
                setError('');
              }}
              placeholder="例如：带小猫去旅行"
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            />
            <input
              type="number"
              value={targetAmount}
              onChange={(event) => {
                setTargetAmount(event.target.value);
                setError('');
              }}
              placeholder="目标金额（可不填）"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            />
            <div className="mt-4 text-xs font-medium text-slate-500">选一个心情色</div>
            <div className="mt-2 flex gap-3">
              {PLAN_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setPlanColor(color)}
                  className={`h-9 w-9 rounded-full border-4 ${planColor === color ? 'border-slate-200' : 'border-white'}`}
                  style={{ backgroundColor: color }}
                  aria-label={`选择颜色 ${color}`}
                />
              ))}
            </div>
            {error && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={resetDialog} className="min-h-12 rounded-xl bg-slate-100 font-medium text-slate-600">取消</button>
              <button onClick={() => void savePlanDetails()} className="min-h-12 rounded-xl bg-amber-400 font-semibold text-amber-950">
                {editingPlan ? '保存' : '创建'}
              </button>
            </div>
            {editingPlan && (
              <button
                onClick={() => {
                  setDeleteDestinationKey('general');
                  setError('');
                  setDialog('delete-plan');
                }}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-rose-500 active:bg-rose-50"
              >
                <Trash2 size={16} /> 删除计划
              </button>
            )}
          </div>
        </div>
      )}

      {dialog === 'delete-plan' && editingPlan && (
        <DeletePlanDialog
          plan={editingPlan}
          balance={selectedPlanBalance}
          currentMonth={currentMonth}
          hasCurrentOverallBudget={hasCurrentOverallBudget}
          otherPlans={activePlans.filter((plan) => plan.id !== editingPlan.id)}
          destinationKey={deleteDestinationKey}
          error={error}
          onDestinationChange={(key) => {
            setDeleteDestinationKey(key);
            setError('');
          }}
          onCancel={resetDialog}
          onConfirm={() => void deleteSelectedPlan()}
        />
      )}
    </>
  );
}

function ConfirmAllTransferDialog({
  amount,
  month,
  error,
  onCancel,
  onConfirm,
}: {
  amount: number;
  month: number;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-sm rounded-[1.5rem] bg-white p-4 shadow-2xl">
        <div className="text-center font-semibold text-slate-900">全部转入通用结余池</div>
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 p-4 text-center">
          <div className="text-xs font-medium text-amber-800/70">{month} 月当前可转结余</div>
          <div className="mt-1 text-3xl font-bold tracking-tight text-amber-950">{formatMoney(amount)}</div>
        </div>
        <div className="mt-3 text-xs leading-5 text-slate-400">
          确认后，这笔金额会计入本月“结余预算”，并同步减少本月可用预算。
        </div>
        {error && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="min-h-12 rounded-xl bg-slate-100 font-medium text-slate-600">取消</button>
          <button onClick={onConfirm} className="min-h-12 rounded-xl bg-amber-400 font-semibold text-amber-950">全部转入</button>
        </div>
      </div>
    </div>
  );
}

function AmountDialog({
  title,
  amountLabel = '转入金额',
  confirmLabel = '确认转入',
  hint,
  amount,
  error,
  onAmountChange,
  onCancel,
  onConfirm,
}: {
  title: string;
  amountLabel?: string;
  confirmLabel?: string;
  hint: string;
  amount: string;
  error: string;
  onAmountChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-sm rounded-[1.5rem] bg-white p-4 shadow-2xl">
        <div className="text-center font-semibold text-slate-900">{title}</div>
        <div className="mt-4 rounded-2xl bg-amber-50 p-4">
          <div className="text-xs font-medium text-amber-800/70">{amountLabel}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-amber-900">¥</span>
            <input
              autoFocus
              type="number"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-3xl font-bold text-amber-950 outline-none"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="mt-3 text-xs leading-5 text-slate-400">{hint}</div>
        {error && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="min-h-12 rounded-xl bg-slate-100 font-medium text-slate-600">取消</button>
          <button onClick={onConfirm} className="min-h-12 rounded-xl bg-amber-400 font-semibold text-amber-950">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function DeletePlanDialog({
  plan,
  balance,
  currentMonth,
  hasCurrentOverallBudget,
  otherPlans,
  destinationKey,
  error,
  onDestinationChange,
  onCancel,
  onConfirm,
}: {
  plan: SavingsPlan;
  balance: number;
  currentMonth: string;
  hasCurrentOverallBudget: boolean;
  otherPlans: SavingsPlan[];
  destinationKey: string;
  error: string;
  onDestinationChange: (key: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const destinations = [
    { key: 'general', name: '通用结余池', description: '保留在攒钱体系中', icon: <Landmark size={17} /> },
    ...(hasCurrentOverallBudget ? [{
      key: 'budget',
      name: `${Number(currentMonth.slice(5))} 月预算`,
      description: '增加本月有效预算',
      icon: <WalletCards size={17} />,
    }] : []),
    ...otherPlans.map((item) => ({
      key: `plan:${item.id}`,
      name: item.name,
      description: '转入其他攒钱计划',
      icon: <Icon name={item.icon} size={17} />,
    })),
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-sm rounded-[1.5rem] bg-white p-4 shadow-2xl">
        <div className="text-center font-semibold text-slate-900">删除「{plan.name}」？</div>
        {balance > 0 ? (
          <>
            <div className="mt-2 text-center text-xs leading-5 text-slate-400">
              计划中还有 {formatMoney(balance)}，删除前需要完整转移。
            </div>
            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
              {destinations.map((destination) => {
                const selected = destination.key === destinationKey;
                return (
                  <button
                    key={destination.key}
                    onClick={() => onDestinationChange(destination.key)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left ${
                      selected ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      selected ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {destination.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{destination.name}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{destination.description}</span>
                    </span>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      selected ? 'bg-amber-400 text-amber-950' : 'border border-slate-200 text-transparent'
                    }`}>
                      <Check size={14} strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-center text-sm text-slate-500">
            计划余额为零，可以直接删除。历史流水仍会保留计划名称。
          </div>
        )}
        {error && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="min-h-12 rounded-xl bg-slate-100 font-medium text-slate-600">取消</button>
          <button onClick={onConfirm} className="min-h-12 rounded-xl bg-rose-500 font-semibold text-white">
            {balance > 0 ? '转移并删除' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReserveHistoryItem({ entry, plans }: { entry: ReserveEntry; plans: SavingsPlan[] }) {
  const target = entry.targetType === 'general'
    ? '通用结余池'
    : entry.targetType === 'budget'
      ? `${Number(entry.targetYearMonth?.slice(5))} 月预算`
      : plans.find((plan) => plan.id === entry.targetPlanId)?.name ?? '已归档计划';
  const source = entry.sourceType === 'budget'
    ? `${Number(entry.sourceYearMonth?.slice(5))} 月预算`
    : entry.sourceType === 'general'
      ? '通用结余池'
      : plans.find((plan) => plan.id === entry.sourcePlanId)?.name ?? '已归档计划';
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
        {entry.targetType === 'general'
          ? <Landmark size={17} />
          : entry.targetType === 'budget'
            ? <WalletCards size={17} />
            : <PiggyBank size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-700">{source} → {target}</span>
        <span className="mt-0.5 block text-[11px] text-slate-400">
          {new Date(entry.occurredAt).toLocaleDateString('zh-CN')} · {entry.note}
        </span>
      </span>
      <span className="text-sm font-semibold text-slate-700">{formatMoney(entry.amount)}</span>
    </div>
  );
}
