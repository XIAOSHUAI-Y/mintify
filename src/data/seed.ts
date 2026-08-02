import type { TransactionType } from '../types';

export const DEFAULT_LEDGER_NAME = '日常账本';

export const EXPENSE_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: '餐饮', icon: 'utensils', color: '#F87171' },
  { name: '交通', icon: 'car', color: '#60A5FA' },
  { name: '购物', icon: 'shopping-bag', color: '#FBBF24' },
  { name: '娱乐', icon: 'gamepad-2', color: '#A78BFA' },
  { name: '医疗', icon: 'briefcase-medical', color: '#34D399' },
  { name: '教育', icon: 'book-open', color: '#818CF8' },
  { name: '住房', icon: 'home', color: '#F472B6' },
  { name: '通讯', icon: 'phone', color: '#22D3EE' },
  { name: '宠物', icon: 'paw-print', color: '#FB923C' },
  { name: '其他', icon: 'more-horizontal', color: '#9CA3AF' },
];

export const INCOME_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: '退款', icon: 'rotate-ccw', color: '#F59E0B' },
  { name: '工资', icon: 'banknote', color: '#10B981' },
  { name: '奖金', icon: 'gift', color: '#F59E0B' },
  { name: '投资', icon: 'trending-up', color: '#3B82F6' },
  { name: '兼职', icon: 'briefcase', color: '#8B5CF6' },
  { name: '红包', icon: 'mail', color: '#EF4444' },
  { name: '其他收入', icon: 'plus-circle', color: '#6B7280' },
];

export const FUND_INCOME_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: '工资', icon: 'banknote', color: '#10B981' },
  { name: '奖金', icon: 'gift', color: '#14B8A6' },
  { name: '红包', icon: 'mail', color: '#EF4444' },
  { name: '投资收入', icon: 'trending-up', color: '#3B82F6' },
  { name: '其他收入', icon: 'receipt-text', color: '#64748B' },
];

export const FUND_EXPENSE_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: '车贷', icon: 'car', color: '#3B82F6' },
  { name: '房租', icon: 'home', color: '#8B5CF6' },
  { name: '京东白条', icon: 'shopping-bag', color: '#F43F5E' },
  { name: '花呗', icon: 'credit-card', color: '#06B6D4' },
  { name: '其他支出', icon: 'receipt-text', color: '#64748B' },
];

export const PRESET_TAGS: string[] = [
  '必需品', '外卖', '聚餐', '通勤', '打车', '网购', '超市', '水果',
  '奶茶', '咖啡', '早餐', '午餐', '晚餐', '零食', '话费', '水电煤',
  '房租', '房贷', '医疗', '健身', '娱乐', '旅行', '礼物', '报销'
];

export const APP_ICONS: string[] = [
  'book', 'wallet', 'wallet-cards', 'credit-card', 'banknote',
  'circle-dollar-sign', 'hand-coins', 'piggy-bank', 'landmark', 'receipt-text',
  'arrow-left-right', 'repeat-2', 'gift', 'mail', 'battery-charging',
  'zap', 'paw-print', 'car', 'bus', 'train',
  'plane-takeoff', 'fuel', 'home', 'lightbulb', 'wifi',
  'droplets', 'smartphone', 'shopping-bag', 'shopping-cart', 'package',
  'utensils', 'coffee', 'dumbbell', 'heart-pulse', 'briefcase-medical',
  'graduation-cap', 'book-open', 'gamepad-2', 'baby', 'shirt',
  'phone', 'calendar', 'more-horizontal',
];

export const APP_COLORS: string[] = [
  '#FACC15', '#F87171', '#60A5FA', '#34D399', '#A78BFA',
  '#F472B6', '#22D3EE', '#FB923C', '#10B981', '#818CF8'
];

export const TYPE_LABELS: Record<TransactionType, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
};

export const TYPE_COLORS: Record<TransactionType, string> = {
  income: '#22C55E',
  expense: '#EF4444',
  transfer: '#3B82F6',
};
