import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Budget, Category, Ledger, RecurringRule, Transaction } from '../types';
import {
  bootstrapIfNeeded,
  deleteBudget,
  deleteCategory,
  deleteLedger,
  deleteRecurringRule,
  deleteTransaction,
  generateRecurringTransactions,
  getBudgets,
  getDefaultLedger,
  getLedgers,
  getRecurringRules,
  getTransactions,
  saveBudget,
  saveCategory,
  saveLedger,
  saveRecurringRule,
  saveTransaction,
  setDefaultLedger,
} from '../db/operations';
import { getCategoriesByLedger } from '../db';

interface AppState {
  ledgers: Ledger[];
  currentLedger: Ledger | null;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    ledgers: [],
    currentLedger: null,
    categories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
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

    const [categories, transactions, budgets, recurringRules] = await Promise.all([
      getCategoriesByLedger(currentLedger.id),
      getTransactions(currentLedger.id),
      getBudgets(currentLedger.id),
      getRecurringRules(currentLedger.id),
    ]);

    setState({
      ledgers,
      currentLedger,
      categories,
      transactions,
      budgets,
      recurringRules,
      isLoading: false,
    });
  };

  useEffect(() => {
    refresh();
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
    setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== categoryId) }));
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
