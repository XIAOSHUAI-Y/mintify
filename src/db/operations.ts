import type { Budget, Category, Ledger, RecurringRule, Transaction } from '../types';
import {
  deleteItem,
  getAll,
  getBudgetsByLedger,
  getCategoriesByLedger,
  getRecurringRulesByLedger,
  getTransactionsByLedger,
  putItem,
} from './index';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../data/seed';
import { generateId, getDayEnd, getDayStart, getMonthEnd, getMonthStart } from '../utils/helpers';

// Bootstrap
export async function bootstrapIfNeeded(): Promise<void> {
  const ledgers = await getAll<Ledger>('ledgers');
  if (ledgers.length === 0) {
    const ledger: Ledger = {
      id: generateId(),
      name: '日常账本',
      icon: 'book',
      color: '#FACC15',
      isDefault: true,
      sortOrder: 0,
      createdAt: Date.now(),
    };
    await putItem('ledgers', ledger);

    for (let i = 0; i < EXPENSE_CATEGORIES.length; i++) {
      const item = EXPENSE_CATEGORIES[i];
      await putItem('categories', {
        id: generateId(),
        ledgerId: ledger.id,
        name: item.name,
        icon: item.icon,
        color: item.color,
        type: 'expense',
        sortOrder: i,
        isBuiltIn: true,
      });
    }

    for (let i = 0; i < INCOME_CATEGORIES.length; i++) {
      const item = INCOME_CATEGORIES[i];
      await putItem('categories', {
        id: generateId(),
        ledgerId: ledger.id,
        name: item.name,
        icon: item.icon,
        color: item.color,
        type: 'income',
        sortOrder: EXPENSE_CATEGORIES.length + i,
        isBuiltIn: true,
      });
    }
  }
}

// Ledgers
export async function getLedgers(): Promise<Ledger[]> {
  const ledgers = await getAll<Ledger>('ledgers');
  return ledgers.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getDefaultLedger(): Promise<Ledger | undefined> {
  const ledgers = await getLedgers();
  return ledgers.find((l) => l.isDefault) || ledgers[0];
}

export async function saveLedger(ledger: Ledger): Promise<void> {
  await putItem('ledgers', ledger);
}

export async function deleteLedger(ledgerId: string): Promise<void> {
  await deleteItem('ledgers', ledgerId);
  const categories = await getCategoriesByLedger(ledgerId);
  for (const c of categories) await deleteItem('categories', c.id);
  const transactions = await getTransactionsByLedger(ledgerId);
  for (const t of transactions) await deleteItem('transactions', t.id);
  const budgets = await getBudgetsByLedger(ledgerId);
  for (const b of budgets) await deleteItem('budgets', b.id);
  const rules = await getRecurringRulesByLedger(ledgerId);
  for (const r of rules) await deleteItem('recurringRules', r.id);
}

export async function setDefaultLedger(ledgerId: string): Promise<void> {
  const ledgers = await getLedgers();
  for (const ledger of ledgers) {
    ledger.isDefault = ledger.id === ledgerId;
    await putItem('ledgers', ledger);
  }
}

// Categories
export async function saveCategory(category: Category): Promise<void> {
  await putItem('categories', category);
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await deleteItem('categories', categoryId);
}

// Transactions
export async function saveTransaction(transaction: Transaction): Promise<void> {
  await putItem('transactions', transaction);
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  await deleteItem('transactions', transactionId);
}

export async function getTransactions(ledgerId: string): Promise<Transaction[]> {
  const transactions = await getTransactionsByLedger(ledgerId);
  return transactions.sort((a, b) => b.occurredAt - a.occurredAt);
}

export async function getTransactionsForMonth(ledgerId: string, timestamp: number): Promise<Transaction[]> {
  const start = getMonthStart(timestamp);
  const end = getMonthEnd(timestamp);
  const transactions = await getTransactionsByLedger(ledgerId);
  return transactions
    .filter((t) => t.occurredAt >= start && t.occurredAt <= end)
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

// Budgets
export async function saveBudget(budget: Budget): Promise<void> {
  await putItem('budgets', budget);
}

export async function deleteBudget(budgetId: string): Promise<void> {
  await deleteItem('budgets', budgetId);
}

export async function getBudgets(ledgerId: string): Promise<Budget[]> {
  return getBudgetsByLedger(ledgerId);
}

// Recurring rules
export async function saveRecurringRule(rule: RecurringRule): Promise<void> {
  await putItem('recurringRules', rule);
}

export async function deleteRecurringRule(ruleId: string): Promise<void> {
  await deleteItem('recurringRules', ruleId);
}

export async function getRecurringRules(ledgerId: string): Promise<RecurringRule[]> {
  return getRecurringRulesByLedger(ledgerId);
}

export async function generateRecurringTransactions(ledgerId: string): Promise<number> {
  const rules = await getRecurringRulesByLedger(ledgerId);
  const transactions = await getTransactionsByLedger(ledgerId);
  let count = 0;
  const now = Date.now();

  for (const rule of rules) {
    const occurrences = generateOccurrences(rule, now);
    for (const date of occurrences) {
      const start = getDayStart(date);
      const end = getDayEnd(date);
      const exists = transactions.some(
        (t) =>
          t.recurringRuleId === rule.id &&
          t.occurredAt >= start &&
          t.occurredAt <= end
      );
      if (exists) continue;

      const transaction: Transaction = {
        id: generateId(),
        ledgerId: rule.ledgerId,
        categoryId: rule.categoryId,
        amount: rule.amount,
        type: rule.type,
        note: rule.note,
        tags: [],
        occurredAt: date,
        createdAt: now,
        recurringRuleId: rule.id,
      };
      await putItem('transactions', transaction);
      count++;
    }

    if (occurrences.length > 0) {
      rule.lastGeneratedDate = occurrences[occurrences.length - 1];
      await putItem('recurringRules', rule);
    }
  }

  return count;
}

function generateOccurrences(rule: RecurringRule, upTo: number): number[] {
  if (rule.startDate > upTo) return [];
  const end = rule.endDate ? Math.min(rule.endDate, upTo) : upTo;
  const last = rule.lastGeneratedDate || rule.startDate - 1;
  const result: number[] = [];
  let current = rule.startDate;
  const interval = Math.max(rule.interval, 1);

  while (current <= end) {
    if (current > last) {
      result.push(current);
    }

    const date = new Date(current);
    switch (rule.frequency) {
      case 'daily':
        date.setDate(date.getDate() + interval);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7 * interval);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + interval);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + interval);
        break;
    }
    current = date.getTime();
  }

  return result;
}

export function calculateBudgetSpent(
  transactions: Transaction[],
  budget: Budget,
  monthTimestamp: number
): number {
  const start = getMonthStart(monthTimestamp);
  const end = getMonthEnd(monthTimestamp);
  return transactions
    .filter((t) => {
      if (t.type !== 'expense') return false;
      if (t.occurredAt < start || t.occurredAt > end) return false;
      if (budget.includeOverall) return true;
      return t.categoryId === budget.categoryId;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

export async function exportData(): Promise<string> {
  const data = {
    ledgers: await getAll<Ledger>('ledgers'),
    categories: await getAll<Category>('categories'),
    transactions: await getAll<Transaction>('transactions'),
    budgets: await getAll<Budget>('budgets'),
    recurringRules: await getAll<RecurringRule>('recurringRules'),
  };
  return JSON.stringify(data, null, 2);
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  for (const item of data.ledgers || []) await putItem('ledgers', item);
  for (const item of data.categories || []) await putItem('categories', item);
  for (const item of data.transactions || []) await putItem('transactions', item);
  for (const item of data.budgets || []) await putItem('budgets', item);
  for (const item of data.recurringRules || []) await putItem('recurringRules', item);
}
