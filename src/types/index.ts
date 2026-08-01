export type TransactionType = 'income' | 'expense' | 'transfer';
export type BudgetPeriod = 'monthly' | 'yearly';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Ledger {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface Category {
  id: string;
  ledgerId: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  sortOrder: number;
  isBuiltIn: boolean;
}

export interface Transaction {
  id: string;
  ledgerId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  note: string;
  tags: string[];
  photo?: string; // base64
  occurredAt: number;
  createdAt: number;
  recurringRuleId?: string;
}

export interface Budget {
  id: string;
  ledgerId: string;
  categoryId?: string;
  amount: number;
  period: BudgetPeriod;
  yearMonth: string;
  includeOverall: boolean;
  createdAt: number;
}

export interface RecurringRule {
  id: string;
  ledgerId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  note: string;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: number;
  endDate?: number;
  lastGeneratedDate?: number;
  createdAt: number;
}

/**
 * 单例应用设置。统一放入 IndexedDB，确保设置能随账本一起备份和恢复。
 */
export interface AppSettings {
  id: 'app-settings';
  reminderEnabled: boolean;
  reminderTime: string;
  presetTags: string[];
  legacySettingsMigrated: boolean;
  lastBackupAt?: number;
}
