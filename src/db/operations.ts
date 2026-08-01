import type { AppSettings, Budget, Category, Ledger, RecurringRule, Transaction } from '../types';
import {
  DEFAULT_APP_SETTINGS,
  deleteItem,
  getAll,
  getAppSettings,
  getBudgetsByLedger,
  getCategoriesByLedger,
  getDB,
  getRecurringRulesByLedger,
  getTransactionsByLedger,
  putItem,
  migrateLegacySettings,
  saveAppSettings,
} from './index';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../data/seed';
import { generateId, getDayEnd, getDayStart, getMonthEnd, getMonthStart, getYearMonth } from '../utils/helpers';

// Bootstrap
export async function bootstrapIfNeeded(): Promise<void> {
  await migrateLegacySettings();
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

function getNextYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return getYearMonth(new Date(year, month, 1).getTime());
}

/**
 * 将最近一个月的预算逐月复制到目标月份。
 * iOS PWA 无法保证在后台 0 点唤醒，因此应用启动时补齐遗漏月份更可靠。
 */
export async function ensureMonthlyBudgets(ledgerId: string, targetTimestamp = Date.now()): Promise<number> {
  const targetYearMonth = getYearMonth(targetTimestamp);
  const settings = await getAppSettings();
  const lastProcessedMonth = settings.budgetRolloverMonthByLedger[ledgerId];
  if (lastProcessedMonth && lastProcessedMonth >= targetYearMonth) return 0;

  const budgets = await getBudgetsByLedger(ledgerId);
  if (budgets.some((budget) => budget.yearMonth === targetYearMonth)) {
    await saveAppSettings({
      ...settings,
      budgetRolloverMonthByLedger: {
        ...settings.budgetRolloverMonthByLedger,
        [ledgerId]: targetYearMonth,
      },
    });
    return 0;
  }

  const previousMonths = [...new Set(
    budgets
      .map((budget) => budget.yearMonth)
      .filter((yearMonth) => yearMonth < targetYearMonth),
  )].sort();
  let sourceYearMonth = previousMonths.at(-1);
  if (!sourceYearMonth) {
    await saveAppSettings({
      ...settings,
      budgetRolloverMonthByLedger: {
        ...settings.budgetRolloverMonthByLedger,
        [ledgerId]: targetYearMonth,
      },
    });
    return 0;
  }

  let sourceBudgets = budgets.filter((budget) => budget.yearMonth === sourceYearMonth);
  let createdCount = 0;

  while (sourceYearMonth < targetYearMonth) {
    const nextYearMonth = getNextYearMonth(sourceYearMonth);
    const existingBudgets = budgets.filter((budget) => budget.yearMonth === nextYearMonth);

    if (existingBudgets.length > 0) {
      sourceBudgets = existingBudgets;
    } else {
      const createdAt = Date.now();
      sourceBudgets = sourceBudgets.map((budget) => ({
        ...budget,
        id: generateId(),
        yearMonth: nextYearMonth,
        createdAt,
      }));
      for (const budget of sourceBudgets) await putItem('budgets', budget);
      budgets.push(...sourceBudgets);
      createdCount += sourceBudgets.length;
    }

    sourceYearMonth = nextYearMonth;
  }

  await saveAppSettings({
    ...settings,
    budgetRolloverMonthByLedger: {
      ...settings.budgetRolloverMonthByLedger,
      [ledgerId]: targetYearMonth,
    },
  });
  return createdCount;
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

const BACKUP_SCHEMA_VERSION = 2;

interface BackupData {
  ledgers: Ledger[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
  settings: AppSettings[];
}

interface MintifyBackup {
  schemaVersion: number;
  exportedAt: number;
  appVersion: string;
  data: BackupData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'string' && record[key] !== '';
}

function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'number' && Number.isFinite(record[key]);
}

function validateRecords<T>(
  value: unknown,
  label: string,
  validator: (record: Record<string, unknown>) => boolean,
): T[] {
  if (!Array.isArray(value) || !value.every((item) => isRecord(item) && validator(item))) {
    throw new Error(`备份文件中的${label}格式不正确`);
  }
  return value as T[];
}

function parseBackup(json: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('备份文件不是有效的 JSON');
  }
  if (!isRecord(parsed)) throw new Error('备份文件缺少数据对象');

  let rawData: Record<string, unknown>;
  if ('schemaVersion' in parsed) {
    if (parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error(`备份文件版本不受支持：${String(parsed.schemaVersion)}`);
    }
    if (!isRecord(parsed.data)) throw new Error('备份文件缺少 data 字段');
    rawData = parsed.data;
  } else {
    // 兼容旧版直接以各数据数组作为根节点的备份格式。
    rawData = parsed;
  }

  const ledgers = validateRecords<Ledger>(rawData.ledgers, '账本', (item) =>
    hasString(item, 'id') && hasString(item, 'name') && hasNumber(item, 'createdAt'));
  const categories = validateRecords<Category>(rawData.categories, '分类', (item) =>
    hasString(item, 'id') && hasString(item, 'ledgerId') && hasString(item, 'name'));
  const transactions = validateRecords<Transaction>(rawData.transactions, '交易', (item) =>
    hasString(item, 'id')
    && hasString(item, 'ledgerId')
    && hasString(item, 'categoryId')
    && hasNumber(item, 'amount')
    && hasNumber(item, 'occurredAt')
    && hasNumber(item, 'createdAt'));
  const budgets = validateRecords<Budget>(rawData.budgets, '预算', (item) =>
    hasString(item, 'id') && hasString(item, 'ledgerId') && hasNumber(item, 'amount'));
  const recurringRules = validateRecords<RecurringRule>(rawData.recurringRules, '周期规则', (item) =>
    hasString(item, 'id')
    && hasString(item, 'ledgerId')
    && hasString(item, 'categoryId')
    && hasNumber(item, 'amount'));
  const settings = rawData.settings === undefined
    ? [{ ...DEFAULT_APP_SETTINGS }]
    : validateRecords<AppSettings>(rawData.settings, '设置', (item) =>
      item.id === DEFAULT_APP_SETTINGS.id
      && typeof item.reminderEnabled === 'boolean'
      && hasString(item, 'reminderTime')
      && Array.isArray(item.presetTags)
      && item.presetTags.every((tag) => typeof tag === 'string'));

  return { ledgers, categories, transactions, budgets, recurringRules, settings };
}

export interface ImportOptions {
  mode: 'merge' | 'replace';
}

export interface ImportResult {
  ledgers: number;
  categories: number;
  transactions: number;
  budgets: number;
  recurringRules: number;
}

export interface BackupPreview extends ImportResult {
  schemaVersion: number;
  exportedAt?: number;
}

export function inspectBackup(json: string): BackupPreview {
  const data = parseBackup(json);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const preview: BackupPreview = {
    schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1,
    ledgers: data.ledgers.length,
    categories: data.categories.length,
    transactions: data.transactions.length,
    budgets: data.budgets.length,
    recurringRules: data.recurringRules.length,
  };
  if (typeof parsed.exportedAt === 'number') preview.exportedAt = parsed.exportedAt;
  return preview;
}

export async function exportData(): Promise<string> {
  const exportedAt = Date.now();
  const settings = { ...(await getAppSettings()), lastBackupAt: exportedAt };
  await saveAppSettings(settings);

  const backup: MintifyBackup = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    appVersion: '1.1.0',
    data: {
      ledgers: await getAll<Ledger>('ledgers'),
      categories: await getAll<Category>('categories'),
      transactions: await getAll<Transaction>('transactions'),
      budgets: await getAll<Budget>('budgets'),
      recurringRules: await getAll<RecurringRule>('recurringRules'),
      settings: [settings],
    },
  };
  return JSON.stringify(backup, null, 2);
}

export async function importData(
  json: string,
  options: ImportOptions = { mode: 'merge' },
): Promise<ImportResult> {
  const data = parseBackup(json);

  const db = await getDB();
  const storeNames = [
    'ledgers',
    'categories',
    'transactions',
    'budgets',
    'recurringRules',
    'settings',
  ] as const;
  const transaction = db.transaction(storeNames, 'readwrite');

  // 清理和写入必须放在同一个事务中，任何写入失败都会自动回滚覆盖操作。
  if (options.mode === 'replace') {
    for (const storeName of storeNames) {
      await transaction.objectStore(storeName).clear();
    }
  }

  for (const item of data.ledgers) await transaction.objectStore('ledgers').put(item);
  for (const item of data.categories) await transaction.objectStore('categories').put(item);
  for (const item of data.transactions) await transaction.objectStore('transactions').put(item);
  for (const item of data.budgets) await transaction.objectStore('budgets').put(item);
  for (const item of data.recurringRules) await transaction.objectStore('recurringRules').put(item);
  for (const item of data.settings) await transaction.objectStore('settings').put(item);
  await transaction.done;

  return {
    ledgers: data.ledgers.length,
    categories: data.categories.length,
    transactions: data.transactions.length,
    budgets: data.budgets.length,
    recurringRules: data.recurringRules.length,
  };
}
