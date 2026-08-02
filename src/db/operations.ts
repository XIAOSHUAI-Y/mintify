import type {
  AppSettings,
  Budget,
  Category,
  FundTransaction,
  FundCategory,
  Ledger,
  RecurringRule,
  Transaction,
} from '../types';
import { shouldRemoveLinkedMainIncome } from '../domain/fundLedger';
import {
  getNetSpendingByCategory,
  getRemainingRefundableAmount,
  isRefund,
} from '../domain/transactionAccounting';
import {
  DEFAULT_APP_SETTINGS,
  deleteItem,
  getAll,
  getAppSettings,
  getBudgetsByLedger,
  getCategoriesByLedger,
  getDB,
  getFundTransactionsByLedger,
  getFundCategoriesByLedger,
  getById,
  getRecurringRulesByLedger,
  getTransactionsByLedger,
  putItem,
  migrateLegacySettings,
  saveAppSettings,
} from './index';
import {
  EXPENSE_CATEGORIES,
  FUND_EXPENSE_CATEGORIES,
  FUND_INCOME_CATEGORIES,
  INCOME_CATEGORIES,
} from '../data/seed';
import { generateId, getDayEnd, getDayStart, getMonthEnd, getMonthStart, getYearMonth } from '../utils/helpers';
import { APP_VERSION } from '../pwa/app-version';

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

/** 为升级前的已有账本补齐退款分类，不依赖数据库结构迁移。 */
export async function ensureRefundCategory(ledgerId: string): Promise<Category> {
  const categories = await getCategoriesByLedger(ledgerId);
  const existing = categories.find((category) => category.type === 'income' && category.name === '退款');
  if (existing) return existing;
  const preset = INCOME_CATEGORIES.find((category) => category.name === '退款')!;
  const refundCategory: Category = {
    id: generateId(),
    ledgerId,
    name: preset.name,
    icon: preset.icon,
    color: preset.color,
    type: 'income',
    sortOrder: categories.length,
    isBuiltIn: true,
  };
  await saveCategory(refundCategory);
  return refundCategory;
}

/** 已删除的内置项也算“已初始化”，否则应用刷新后会把用户删掉的分类重新创建。 */
export async function ensureFundCategories(ledgerId: string): Promise<void> {
  const existing = await getFundCategoriesByLedger(ledgerId);
  const presets = [
    ...FUND_INCOME_CATEGORIES.map((item) => ({ ...item, type: 'income' as const })),
    ...FUND_EXPENSE_CATEGORIES.map((item) => ({ ...item, type: 'expense' as const })),
  ];

  for (const [index, preset] of presets.entries()) {
    const matching = existing.filter((item) => item.type === preset.type && item.name === preset.name);
    if (matching.length > 0) {
      // 早期开发版本可能因并发初始化产生重复项；只停用多余项，历史记录仍能按旧 ID 找到元数据。
      const active = matching.filter((item) => !item.deletedAt);
      for (const duplicate of active.slice(1)) await deleteFundCategory(duplicate.id);
      continue;
    }
    await saveFundCategory({
      // 稳定主键让 React StrictMode 或多窗口并发初始化最终落到同一条记录。
      id: `fund-category:${ledgerId}:${preset.type}:${encodeURIComponent(preset.name)}`,
      ledgerId,
      ...preset,
      sortOrder: index,
      isBuiltIn: true,
    });
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
  const fundTransactions = await getFundTransactionsByLedger(ledgerId);
  for (const transaction of fundTransactions) await deleteFundTransaction(transaction.id);
  const fundCategories = await getFundCategoriesByLedger(ledgerId);
  for (const category of fundCategories) await deleteItem('fundCategories', category.id);
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
  const category = await getById<Category>('categories', categoryId);
  if (!category) return;
  await putItem('categories', { ...category, deletedAt: Date.now() });
}

// Fund categories
export async function saveFundCategory(category: FundCategory): Promise<void> {
  await putItem('fundCategories', category);
}

export async function getFundCategories(ledgerId: string): Promise<FundCategory[]> {
  const categories = await getFundCategoriesByLedger(ledgerId);
  return categories.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function deleteFundCategory(categoryId: string): Promise<void> {
  const category = await getById<FundCategory>('fundCategories', categoryId);
  if (!category) return;
  await putItem('fundCategories', { ...category, deletedAt: Date.now() });
}

// Transactions
export async function saveTransaction(transaction: Transaction): Promise<void> {
  const transactions = await getTransactionsByLedger(transaction.ledgerId);
  if (isRefund(transaction)) {
    const linkedExpenseId = transaction.linkedExpenseTransactionId;
    const linkedExpense = transactions.find((item) => item.id === linkedExpenseId);
    if (!linkedExpense || linkedExpense.type !== 'expense' || linkedExpense.ledgerId !== transaction.ledgerId) {
      throw new Error('退款必须绑定当前账本中的支出');
    }
    if (transaction.type !== 'income' || !Number.isFinite(transaction.amount) || transaction.amount <= 0) {
      throw new Error('退款金额必须大于 0');
    }
    const remaining = getRemainingRefundableAmount(transactions, linkedExpense.id, transaction.id);
    if (transaction.amount > remaining) throw new Error('退款金额超过原支出可退金额');
  }

  const linkedRefunds = transactions.filter((item) =>
    isRefund(item) && item.linkedExpenseTransactionId === transaction.id);
  if (linkedRefunds.length > 0) {
    const refundedAmount = linkedRefunds.reduce((sum, item) => sum + item.amount, 0);
    if (transaction.type !== 'expense' || transaction.amount < refundedAmount) {
      throw new Error('原支出已有退款，不能改为非支出或小于累计退款金额');
    }
  }
  await putItem('transactions', transaction);
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const transaction = await getById<Transaction>('transactions', transactionId);
  if (transaction) {
    const transactions = await getTransactionsByLedger(transaction.ledgerId);
    if (transactions.some((item) => isRefund(item) && item.linkedExpenseTransactionId === transactionId)) {
      throw new Error('该支出已有退款，请先删除关联退款');
    }
  }
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

// Fund transactions
export async function saveFundTransaction(transaction: FundTransaction): Promise<void> {
  await putItem('fundTransactions', transaction);
}

export async function getFundTransactions(ledgerId: string): Promise<FundTransaction[]> {
  const transactions = await getFundTransactionsByLedger(ledgerId);
  return transactions.sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt);
}

export async function allocateLivingExpense(
  allocation: FundTransaction,
  mainIncome: Transaction,
  incomeCategory: Category,
): Promise<void> {
  const isConsistent = allocation.kind === 'living-expense-allocation'
    && allocation.type === 'expense'
    && allocation.category === '生活费'
    && allocation.ledgerId === mainIncome.ledgerId
    && allocation.ledgerId === incomeCategory.ledgerId
    && allocation.linkedTransactionId === mainIncome.id
    && allocation.mainIncomeOrigin === 'auto-created'
    && allocation.amount === mainIncome.amount
    && allocation.occurredAt === mainIncome.occurredAt
    && mainIncome.type === 'income'
    && mainIncome.categoryId === incomeCategory.id
    && incomeCategory.type === 'income'
    && incomeCategory.name === '生活费'
    && Number.isFinite(allocation.amount)
    && allocation.amount > 0;

  if (!isConsistent) throw new Error('生活费划拨记录不一致');

  const monthStart = getMonthStart(allocation.occurredAt);
  const monthEnd = getMonthEnd(allocation.occurredAt);
  const existingAllocations = await getFundTransactionsByLedger(allocation.ledgerId);
  const hasAnotherAllocation = existingAllocations.some((transaction) =>
    transaction.id !== allocation.id
    && transaction.kind === 'living-expense-allocation'
    && transaction.occurredAt >= monthStart
    && transaction.occurredAt <= monthEnd);
  if (hasAnotherAllocation) throw new Error('每月只能划拨一次生活费');

  const db = await getDB();
  const write = db.transaction(['categories', 'transactions', 'fundTransactions'], 'readwrite');
  // 三条数据必须原子写入，避免资金侧已扣款但生活费主账本没有到账。
  await write.objectStore('categories').put(incomeCategory);
  await write.objectStore('transactions').put(mainIncome);
  await write.objectStore('fundTransactions').put(allocation);
  await write.done;
}

export async function linkExistingLivingExpenseIncome(
  allocation: FundTransaction,
  existingIncome: Transaction,
): Promise<void> {
  const storedIncome = await getById<Transaction>('transactions', existingIncome.id);
  const isConsistent = storedIncome !== undefined
    && allocation.kind === 'living-expense-allocation'
    && allocation.type === 'expense'
    && allocation.category === '生活费'
    && allocation.ledgerId === existingIncome.ledgerId
    && allocation.linkedTransactionId === existingIncome.id
    && allocation.mainIncomeOrigin === 'existing'
    && allocation.amount === existingIncome.amount
    && allocation.occurredAt === existingIncome.occurredAt
    && existingIncome.type === 'income'
    && !isRefund(existingIncome)
    && storedIncome.ledgerId === existingIncome.ledgerId
    && storedIncome.amount === existingIncome.amount
    && storedIncome.occurredAt === existingIncome.occurredAt
    && Number.isFinite(allocation.amount)
    && allocation.amount > 0;
  if (!isConsistent) throw new Error('已有生活费收入与资金划拨不一致');

  const monthStart = getMonthStart(allocation.occurredAt);
  const monthEnd = getMonthEnd(allocation.occurredAt);
  const existingAllocations = await getFundTransactionsByLedger(allocation.ledgerId);
  const hasAnotherAllocation = existingAllocations.some((transaction) =>
    transaction.id !== allocation.id
    && transaction.kind === 'living-expense-allocation'
    && transaction.occurredAt >= monthStart
    && transaction.occurredAt <= monthEnd);
  if (hasAnotherAllocation) throw new Error('每月只能划拨一次生活费');

  // 这里只写资金侧关联，已有主账本收入保持原样，避免重复记一笔收入。
  await putItem('fundTransactions', allocation);
}

export async function deleteFundTransaction(transactionId: string): Promise<void> {
  const fundTransaction = await getById<FundTransaction>('fundTransactions', transactionId);
  if (!fundTransaction) return;

  const db = await getDB();
  const write = db.transaction(['transactions', 'fundTransactions'], 'readwrite');
  await write.objectStore('fundTransactions').delete(transactionId);
  // 生活费收入由划拨自动生成，撤销划拨时也要同步撤销，避免主账本凭空多一笔收入。
  const linkedTransactionId = fundTransaction.linkedTransactionId;
  if (linkedTransactionId && shouldRemoveLinkedMainIncome(fundTransaction)) {
    await write.objectStore('transactions').delete(linkedTransactionId);
  }
  await write.done;
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
  const spending = getNetSpendingByCategory(transactions, getYearMonth(monthTimestamp));
  if (budget.includeOverall) return [...spending.values()].reduce((sum, amount) => sum + amount, 0);
  return budget.categoryId ? spending.get(budget.categoryId) ?? 0 : 0;
}

const BACKUP_SCHEMA_VERSION = 6;

interface BackupData {
  ledgers: Ledger[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
  fundCategories: FundCategory[];
  fundTransactions: FundTransaction[];
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
    if (![2, 3, 4, 5, BACKUP_SCHEMA_VERSION].includes(parsed.schemaVersion as number)) {
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
    && hasNumber(item, 'createdAt')
    && (item.kind === undefined || item.kind === 'refund')
    && (item.kind !== 'refund' || hasString(item, 'linkedExpenseTransactionId')));
  validateRefundRelations(transactions);
  const budgets = validateRecords<Budget>(rawData.budgets, '预算', (item) =>
    hasString(item, 'id') && hasString(item, 'ledgerId') && hasNumber(item, 'amount'));
  const recurringRules = validateRecords<RecurringRule>(rawData.recurringRules, '周期规则', (item) =>
    hasString(item, 'id')
    && hasString(item, 'ledgerId')
    && hasString(item, 'categoryId')
    && hasNumber(item, 'amount'));
  const fundCategories = rawData.fundCategories === undefined
    ? []
    : validateRecords<FundCategory>(rawData.fundCategories, '资金分类', (item) =>
      hasString(item, 'id')
      && hasString(item, 'ledgerId')
      && hasString(item, 'name')
      && hasString(item, 'icon')
      && hasString(item, 'color')
      && (item.type === 'income' || item.type === 'expense'));
  const fundTransactions = rawData.fundTransactions === undefined
    ? []
    : validateRecords<FundTransaction>(rawData.fundTransactions, '资金记录', (item) =>
      hasString(item, 'id')
      && hasString(item, 'ledgerId')
      && hasString(item, 'category')
      && hasNumber(item, 'amount')
      && hasNumber(item, 'occurredAt')
      && hasNumber(item, 'createdAt')
      && (item.type === 'income' || item.type === 'expense')
      && (item.kind === 'record' || item.kind === 'living-expense-allocation'));
  const settings = rawData.settings === undefined
    ? [{ ...DEFAULT_APP_SETTINGS }]
    : validateRecords<AppSettings>(rawData.settings, '设置', (item) =>
      item.id === DEFAULT_APP_SETTINGS.id
      && typeof item.reminderEnabled === 'boolean'
      && hasString(item, 'reminderTime')
      && Array.isArray(item.presetTags)
      && item.presetTags.every((tag) => typeof tag === 'string'));

  return {
    ledgers,
    categories,
    transactions,
    budgets,
    recurringRules,
    fundCategories,
    fundTransactions,
    settings,
  };
}

function validateRefundRelations(transactions: Transaction[]): void {
  const byId = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const refundedByExpense = new Map<string, number>();
  for (const transaction of transactions) {
    if (!isRefund(transaction)) continue;
    const expenseId = transaction.linkedExpenseTransactionId!;
    const expense = byId.get(expenseId);
    if (!expense || expense.type !== 'expense' || expense.ledgerId !== transaction.ledgerId || transaction.type !== 'income') {
      throw new Error('备份文件中的退款关联不正确');
    }
    const refunded = (refundedByExpense.get(expenseId) ?? 0) + transaction.amount;
    if (refunded > expense.amount) throw new Error('备份文件中的退款金额超过原支出');
    refundedByExpense.set(expenseId, refunded);
  }
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
  fundCategories: number;
  fundTransactions: number;
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
    fundCategories: data.fundCategories.length,
    fundTransactions: data.fundTransactions.length,
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
    appVersion: APP_VERSION,
    data: {
      ledgers: await getAll<Ledger>('ledgers'),
      categories: await getAll<Category>('categories'),
      transactions: await getAll<Transaction>('transactions'),
      budgets: await getAll<Budget>('budgets'),
      recurringRules: await getAll<RecurringRule>('recurringRules'),
      fundCategories: await getAll<FundCategory>('fundCategories'),
      fundTransactions: await getAll<FundTransaction>('fundTransactions'),
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
    'fundCategories',
    'fundTransactions',
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
  for (const item of data.fundCategories) await transaction.objectStore('fundCategories').put(item);
  for (const item of data.fundTransactions) await transaction.objectStore('fundTransactions').put(item);
  for (const item of data.settings) await transaction.objectStore('settings').put(item);
  await transaction.done;

  return {
    ledgers: data.ledgers.length,
    categories: data.categories.length,
    transactions: data.transactions.length,
    budgets: data.budgets.length,
    recurringRules: data.recurringRules.length,
    fundCategories: data.fundCategories.length,
    fundTransactions: data.fundTransactions.length,
  };
}
