export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionKind = 'refund';
export type BudgetPeriod = 'monthly' | 'yearly';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type FundTransactionType = 'income' | 'expense';
export type FundTransactionKind = 'record' | 'living-expense-allocation';

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
  /** 软删除后不再用于新增记录，但保留元数据供历史账单和统计展示。 */
  deletedAt?: number;
}

/** 资金页拥有独立分类，避免工资、房租等项目混入生活费记账链路。 */
export interface FundCategory {
  id: string;
  ledgerId: string;
  name: string;
  icon: string;
  color: string;
  type: FundTransactionType;
  sortOrder: number;
  isBuiltIn: boolean;
  /** 停用后历史资金记录仍可通过分类快照正常展示。 */
  deletedAt?: number;
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
  /** 退款在界面上归入收入入口，但账务上冲减所绑定的原支出。 */
  kind?: TransactionKind;
  linkedExpenseTransactionId?: string;
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

/**
 * “攒钱计划”只保存目标本身，实际余额始终由 ReserveEntry 流水计算得出。
 * 这样修改目标金额、归档计划都不会破坏历史结余。
 */
export interface SavingsPlan {
  id: string;
  ledgerId: string;
  name: string;
  targetAmount?: number;
  icon: string;
  color: string;
  createdAt: number;
  archivedAt?: number;
}

export type ReserveEntrySourceType = 'budget' | 'general' | 'plan';
export type ReserveEntryTargetType = 'general' | 'plan' | 'budget';

/** 通用结余池与攒钱计划共用一套不可变流水，内部划转不会重复增加总结余。 */
export interface ReserveEntry {
  id: string;
  ledgerId: string;
  amount: number;
  sourceType: ReserveEntrySourceType;
  sourcePlanId?: string;
  targetType: ReserveEntryTargetType;
  targetPlanId?: string;
  /** 划回预算时记录接收月份；它补充当月有效预算，但不修改用户设置的原始总预算。 */
  targetYearMonth?: string;
  /** 周期结算会释放已结束月份的分类预算；普通转入仍只能使用尚未分配预算。 */
  kind?: 'period-settlement';
  /** 从预算转入时记录来源月份，确保对应月份的可用预算会同步扣减。 */
  sourceYearMonth?: string;
  note: string;
  occurredAt: number;
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
 * 资金账本记录与生活费主账本隔离；仅生活费划拨通过 linkedTransactionId 关联主账本收入。
 */
export interface FundTransaction {
  id: string;
  ledgerId: string;
  type: FundTransactionType;
  category: string;
  /** 新版记录绑定可管理的资金分类；category 继续作为历史兼容与名称快照。 */
  categoryId?: string;
  kind: FundTransactionKind;
  amount: number;
  note: string;
  occurredAt: number;
  createdAt: number;
  linkedTransactionId?: string;
  /** 标记关联收入是自动创建还是用户原有记录，决定解除关联时是否级联删除。 */
  mainIncomeOrigin?: 'auto-created' | 'existing';
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
  /** 每个账本最后一次完成预算跨月处理的月份，避免用户删除后被自动恢复。 */
  budgetRolloverMonthByLedger: Record<string, string>;
  /** 预算页按账本记住上次浏览位置，重新打开 PWA 后仍回到原来的年/月视图。 */
  budgetViewByLedger: Record<string, {
    mode: 'month' | 'year';
    yearMonth: string;
  }>;
  lastBackupAt?: number;
}
