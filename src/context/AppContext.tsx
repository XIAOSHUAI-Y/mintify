import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  Budget,
  Category,
  FundCategory,
  FundTransaction,
  Ledger,
  RecurringRule,
  ReserveEntry,
  SavingsPlan,
  Transaction,
} from '../types';
import {
  archiveSavingsPlan,
  allocateLivingExpense,
  bootstrapIfNeeded,
  deleteBudget,
  deleteCategory,
  deleteFundTransaction,
  deleteFundCategory,
  deleteLedger,
  deleteRecurringRule,
  deleteTransaction,
  ensureMonthlyBudgets,
  ensureRefundCategory,
  ensureFundCategories,
  generateRecurringTransactions,
  getBudgets,
  getDefaultLedger,
  getFundTransactions,
  getFundCategories,
  getLedgers,
  linkExistingLivingExpenseIncome,
  getRecurringRules,
  getReserveEntries,
  getSavingsPlans,
  getTransactions,
  saveBudget,
  saveCategory,
  saveFundTransaction,
  saveFundCategory,
  saveLedger,
  saveRecurringRule,
  saveReserveEntry,
  saveSavingsPlan,
  settlePreviousMonthBudgetReserve,
  saveTransaction,
  setDefaultLedger,
} from '../db/operations';
import { shouldRemoveLinkedMainIncome } from '../domain/fundLedger';
import { isRefund } from '../domain/transactionAccounting';
import { getCategoriesByLedger } from '../db';
import { generateId } from '../utils/helpers';

interface AppState {
  ledgers: Ledger[];
  currentLedger: Ledger | null;
  categories: Category[];
  fundCategories: FundCategory[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
  fundTransactions: FundTransaction[];
  savingsPlans: SavingsPlan[];
  reserveEntries: ReserveEntry[];
  isLoading: boolean;
}

interface AppContextType extends AppState {
  refresh: () => Promise<void>;
  setCurrentLedger: (ledgerId: string) => Promise<void>;
  addLedger: (ledger: Ledger) => Promise<void>;
  removeLedger: (ledgerId: string) => Promise<void>;
  updateLedger: (ledger: Ledger) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  removeCategory: (categoryId: string) => Promise<void>;
  addFundCategory: (category: FundCategory) => Promise<void>;
  updateFundCategory: (category: FundCategory) => Promise<void>;
  removeFundCategory: (categoryId: string) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  removeTransaction: (transactionId: string) => Promise<void>;
  addBudget: (budget: Budget) => Promise<void>;
  updateBudget: (budget: Budget) => Promise<void>;
  removeBudget: (budgetId: string) => Promise<void>;
  addRecurringRule: (rule: RecurringRule) => Promise<void>;
  updateRecurringRule: (rule: RecurringRule) => Promise<void>;
  removeRecurringRule: (ruleId: string) => Promise<void>;
  runRecurringGenerator: () => Promise<number>;
  saveFundRecord: (transaction: FundTransaction) => Promise<void>;
  removeFundRecord: (transactionId: string) => Promise<void>;
  saveLivingExpenseAllocation: (allocation: FundTransaction) => Promise<void>;
  linkExistingLivingExpenseAllocation: (transaction: Transaction) => Promise<void>;
  savePlan: (plan: SavingsPlan) => Promise<void>;
  archivePlan: (planId: string, transferEntry?: ReserveEntry) => Promise<void>;
  addReserveEntry: (entry: ReserveEntry) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    ledgers: [],
    currentLedger: null,
    categories: [],
    fundCategories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
    fundTransactions: [],
    savingsPlans: [],
    reserveEntries: [],
    isLoading: true,
  });

  const refresh = async () => {
    await bootstrapIfNeeded();
    const ledgers = await getLedgers();
    const currentLedger = await getDefaultLedger();
    if (!currentLedger) {
      setState((s) => ({ ...s, ledgers, isLoading: false }));
      return;
    }

    // PWA 不能保证在每月 1 日凌晨被系统唤醒，启动时补齐可确保跨月后首次打开就完成继承。
    await ensureMonthlyBudgets(currentLedger.id);
    await ensureRefundCategory(currentLedger.id);
    await ensureFundCategories(currentLedger.id);
    await settlePreviousMonthBudgetReserve(currentLedger.id);

    const [
      categories,
      fundCategories,
      transactions,
      budgets,
      recurringRules,
      fundTransactions,
      savingsPlans,
      reserveEntries,
    ] = await Promise.all([
      getCategoriesByLedger(currentLedger.id),
      getFundCategories(currentLedger.id),
      getTransactions(currentLedger.id),
      getBudgets(currentLedger.id),
      getRecurringRules(currentLedger.id),
      getFundTransactions(currentLedger.id),
      getSavingsPlans(currentLedger.id),
      getReserveEntries(currentLedger.id),
    ]);

    setState({
      ledgers,
      currentLedger,
      categories,
      fundCategories,
      transactions,
      budgets,
      recurringRules,
      fundTransactions,
      savingsPlans,
      reserveEntries,
      isLoading: false,
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    let timerId: number | undefined;

    const scheduleMonthBoundaryRefresh = () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      // 浏览器超长定时器存在上限，每天重新校准一次可避免月底任务提前触发。
      const delay = Math.min(nextMonth - now.getTime() + 500, 24 * 60 * 60 * 1000);
      timerId = window.setTimeout(async () => {
        if (Date.now() >= nextMonth) await refresh();
        scheduleMonthBoundaryRefresh();
      }, delay);
    };

    const handleVisibilityChange = () => {
      // iOS 会暂停后台 PWA，恢复到前台时立即补做跨月继承。
      if (document.visibilityState === 'visible') void refresh();
    };

    scheduleMonthBoundaryRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const updateStateItem = <T extends { id: string }>(
    list: T[],
    item: T,
    mode: 'add' | 'update'
  ): T[] => {
    if (mode === 'add') return [...list, item];
    return list.map((i) => (i.id === item.id ? item : i));
  };

  const setCurrentLedger = async (ledgerId: string) => {
    await setDefaultLedger(ledgerId);
    await refresh();
  };

  const addLedger = async (ledger: Ledger) => {
    await saveLedger(ledger);
    await refresh();
  };

  const updateLedger = async (ledger: Ledger) => {
    await saveLedger(ledger);
    setState((s) => ({ ...s, ledgers: updateStateItem(s.ledgers, ledger, 'update') }));
  };

  const removeLedger = async (ledgerId: string) => {
    await deleteLedger(ledgerId);
    await refresh();
  };

  const addCategory = async (category: Category) => {
    await saveCategory(category);
    setState((s) => ({ ...s, categories: updateStateItem(s.categories, category, 'add') }));
  };

  const updateCategory = async (category: Category) => {
    await saveCategory(category);
    setState((s) => ({ ...s, categories: updateStateItem(s.categories, category, 'update') }));
  };

  const removeCategory = async (categoryId: string) => {
    await deleteCategory(categoryId);
    // 状态层同样保留软删除分类，历史记录无需等待刷新就能继续显示原图标和名称。
    setState((s) => ({
      ...s,
      categories: s.categories.map((category) =>
        category.id === categoryId ? { ...category, deletedAt: Date.now() } : category),
    }));
  };

  const addFundCategory = async (category: FundCategory) => {
    await saveFundCategory(category);
    setState((s) => ({ ...s, fundCategories: updateStateItem(s.fundCategories, category, 'add') }));
  };

  const updateFundCategory = async (category: FundCategory) => {
    await saveFundCategory(category);
    setState((s) => ({ ...s, fundCategories: updateStateItem(s.fundCategories, category, 'update') }));
  };

  const removeFundCategory = async (categoryId: string) => {
    await deleteFundCategory(categoryId);
    setState((s) => ({
      ...s,
      fundCategories: s.fundCategories.map((category) =>
        category.id === categoryId ? { ...category, deletedAt: Date.now() } : category),
    }));
  };

  const addTransaction = async (transaction: Transaction) => {
    await saveTransaction(transaction);
    setState((s) => ({ ...s, transactions: updateStateItem(s.transactions, transaction, 'add') }));
  };

  const updateTransaction = async (transaction: Transaction) => {
    await saveTransaction(transaction);
    setState((s) => ({ ...s, transactions: updateStateItem(s.transactions, transaction, 'update') }));
  };

  const removeTransaction = async (transactionId: string) => {
    await deleteTransaction(transactionId);
    setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== transactionId) }));
  };

  const addBudget = async (budget: Budget) => {
    await saveBudget(budget);
    setState((s) => ({ ...s, budgets: updateStateItem(s.budgets, budget, 'add') }));
  };

  const updateBudget = async (budget: Budget) => {
    await saveBudget(budget);
    setState((s) => ({ ...s, budgets: updateStateItem(s.budgets, budget, 'update') }));
  };

  const removeBudget = async (budgetId: string) => {
    await deleteBudget(budgetId);
    setState((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== budgetId) }));
  };

  const addRecurringRule = async (rule: RecurringRule) => {
    await saveRecurringRule(rule);
    setState((s) => ({ ...s, recurringRules: updateStateItem(s.recurringRules, rule, 'add') }));
  };

  const updateRecurringRule = async (rule: RecurringRule) => {
    await saveRecurringRule(rule);
    setState((s) => ({ ...s, recurringRules: updateStateItem(s.recurringRules, rule, 'update') }));
  };

  const removeRecurringRule = async (ruleId: string) => {
    await deleteRecurringRule(ruleId);
    setState((s) => ({ ...s, recurringRules: s.recurringRules.filter((r) => r.id !== ruleId) }));
  };

  const runRecurringGenerator = async () => {
    if (!state.currentLedger) return 0;
    const count = await generateRecurringTransactions(state.currentLedger.id);
    if (count > 0) await refresh();
    return count;
  };

  const saveFundRecord = async (transaction: FundTransaction) => {
    await saveFundTransaction(transaction);
    setState((s) => {
      const exists = s.fundTransactions.some((item) => item.id === transaction.id);
      return {
        ...s,
        fundTransactions: updateStateItem(s.fundTransactions, transaction, exists ? 'update' : 'add'),
      };
    });
  };

  const removeFundRecord = async (transactionId: string) => {
    const removed = state.fundTransactions.find((item) => item.id === transactionId);
    await deleteFundTransaction(transactionId);
    setState((s) => ({
      ...s,
      fundTransactions: s.fundTransactions.filter((item) => item.id !== transactionId),
      transactions: removed && shouldRemoveLinkedMainIncome(removed)
        ? s.transactions.filter((item) => item.id !== removed.linkedTransactionId)
        : s.transactions,
    }));
  };

  const saveLivingExpenseAllocation = async (allocation: FundTransaction) => {
    if (!state.currentLedger) throw new Error('当前账本不存在');
    const existingCategory = state.categories.find(
      (category) => !category.deletedAt && category.type === 'income' && category.name === '生活费',
    );
    const incomeCategory: Category = existingCategory ?? {
      id: generateId(),
      ledgerId: state.currentLedger.id,
      name: '生活费',
      icon: 'wallet-cards',
      color: '#F59E0B',
      type: 'income',
      sortOrder: state.categories.length,
      isBuiltIn: true,
    };
    const linkedTransactionId = allocation.linkedTransactionId || generateId();
    const normalizedAllocation: FundTransaction = {
      ...allocation,
      ledgerId: state.currentLedger.id,
      type: 'expense',
      category: '生活费',
      kind: 'living-expense-allocation',
      linkedTransactionId,
      mainIncomeOrigin: 'auto-created',
    };
    const mainIncome: Transaction = {
      id: linkedTransactionId,
      ledgerId: state.currentLedger.id,
      categoryId: incomeCategory.id,
      amount: allocation.amount,
      type: 'income',
      note: allocation.note || '生活费划拨',
      tags: ['资金划拨'],
      occurredAt: allocation.occurredAt,
      createdAt: allocation.createdAt,
    };

    await allocateLivingExpense(normalizedAllocation, mainIncome, incomeCategory);
    setState((s) => {
      const categoryExists = s.categories.some((item) => item.id === incomeCategory.id);
      const transactionExists = s.transactions.some((item) => item.id === mainIncome.id);
      const allocationExists = s.fundTransactions.some((item) => item.id === normalizedAllocation.id);
      return {
        ...s,
        categories: updateStateItem(s.categories, incomeCategory, categoryExists ? 'update' : 'add'),
        transactions: updateStateItem(s.transactions, mainIncome, transactionExists ? 'update' : 'add'),
        fundTransactions: updateStateItem(
          s.fundTransactions,
          normalizedAllocation,
          allocationExists ? 'update' : 'add',
        ),
      };
    });
  };

  const linkExistingLivingExpenseAllocation = async (transaction: Transaction) => {
    if (
      !state.currentLedger
      || transaction.ledgerId !== state.currentLedger.id
      || transaction.type !== 'income'
      || isRefund(transaction)
    ) {
      throw new Error('只能关联当前账本中的收入');
    }
    const allocation: FundTransaction = {
      id: generateId(),
      ledgerId: transaction.ledgerId,
      type: 'expense',
      category: '生活费',
      kind: 'living-expense-allocation',
      amount: transaction.amount,
      note: transaction.note,
      occurredAt: transaction.occurredAt,
      createdAt: Date.now(),
      linkedTransactionId: transaction.id,
      mainIncomeOrigin: 'existing',
    };
    await linkExistingLivingExpenseIncome(allocation, transaction);
    setState((s) => ({
      ...s,
      fundTransactions: updateStateItem(s.fundTransactions, allocation, 'add'),
    }));
  };

  const savePlan = async (plan: SavingsPlan) => {
    await saveSavingsPlan(plan);
    setState((s) => {
      const exists = s.savingsPlans.some((item) => item.id === plan.id);
      return {
        ...s,
        savingsPlans: updateStateItem(s.savingsPlans, plan, exists ? 'update' : 'add'),
      };
    });
  };

  const archivePlan = async (planId: string, transferEntry?: ReserveEntry) => {
    const archivedPlan = await archiveSavingsPlan({
      planId,
      transferEntry,
      archivedAt: Date.now(),
    });
    setState((s) => ({
      ...s,
      savingsPlans: updateStateItem(s.savingsPlans, archivedPlan, 'update'),
      reserveEntries: transferEntry ? [transferEntry, ...s.reserveEntries] : s.reserveEntries,
    }));
  };

  const addReserveEntry = async (entry: ReserveEntry) => {
    await saveReserveEntry(entry);
    setState((s) => ({ ...s, reserveEntries: [entry, ...s.reserveEntries] }));
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        refresh,
        setCurrentLedger,
        addLedger,
        updateLedger,
        removeLedger,
        addCategory,
        updateCategory,
        removeCategory,
        addFundCategory,
        updateFundCategory,
        removeFundCategory,
        addTransaction,
        updateTransaction,
        removeTransaction,
        addBudget,
        updateBudget,
        removeBudget,
        addRecurringRule,
        updateRecurringRule,
        removeRecurringRule,
        runRecurringGenerator,
        saveFundRecord,
        removeFundRecord,
        saveLivingExpenseAllocation,
        linkExistingLivingExpenseAllocation,
        savePlan,
        archivePlan,
        addReserveEntry,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
