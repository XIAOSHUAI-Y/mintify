import { useMemo, useState } from 'react';
import { ArrowLeft, Search, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import TransactionDetail from './TransactionDetail';
import HorizontalScrollArea from './HorizontalScrollArea';
import { formatDateHeader, formatMoney } from '../utils/helpers';
import { isRefund } from '../domain/transactionAccounting';
import {
  DATE_PRESET_OPTIONS,
  EMPTY_FILTER,
  countActiveFilters,
  filterTransactions,
  type MoodFilterValue,
  type PhotoFilter,
  type TransactionFilter,
} from '../domain/transactionFilter';
import { MOOD_OPTIONS } from '../domain/mood';
import type { Transaction, TransactionType } from '../types';

const TYPE_FILTERS: { value: TransactionType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
  { value: 'transfer', label: '转账' },
];

const PHOTO_FILTERS: { value: PhotoFilter; label: string }[] = [
  { value: 'any', label: '不限' },
  { value: 'with', label: '有照片' },
  { value: 'without', label: '无照片' },
];

/** 结果过多时只渲染前若干条，避免长账本在低端机上一次性渲染上千行。 */
const RESULT_LIMIT = 100;

export default function TransactionSearch({ onClose }: { onClose: () => void }) {
  const { currentLedger, transactions, categories } = useApp();
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [categoryId, setCategoryId] = useState('');
  const [advanced, setAdvanced] = useState<TransactionFilter>(EMPTY_FILTER);
  const [amountMinInput, setAmountMinInput] = useState('');
  const [amountMaxInput, setAmountMaxInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const ledgerTransactions = useMemo(
    () => (currentLedger
      ? transactions.filter((transaction) => transaction.ledgerId === currentLedger.id)
      : []),
    [currentLedger, transactions],
  );

  // 金额用输入框原文承载，"100." 这类中间态不该被立刻解析成数字。
  const activeFilter = useMemo<TransactionFilter>(() => ({
    ...advanced,
    keyword,
    type: typeFilter,
    categoryId,
    amountMin: parseAmount(amountMinInput),
    amountMax: parseAmount(amountMaxInput),
  }), [advanced, amountMaxInput, amountMinInput, categoryId, keyword, typeFilter]);

  const results = useMemo(
    () => filterTransactions(ledgerTransactions, activeFilter, categories, Date.now()),
    [activeFilter, categories, ledgerTransactions],
  );

  /** 标签候选来自当前账本真实用过的标签，按使用次数排序，避免出现筛了必然为空的条件。 */
  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transaction of ledgerTransactions) {
      for (const tag of transaction.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      .map(([tag]) => tag);
  }, [ledgerTransactions]);

  const visibleResults = results.slice(0, RESULT_LIMIT);
  const activeCount = countActiveFilters(activeFilter);
  // 徽标只反映弹层内的条件，否则顶部关键词/类型/分类也会点亮这个按钮，容易误导。
  const panelFilter = useMemo<TransactionFilter>(() => ({
    ...EMPTY_FILTER,
    datePreset: advanced.datePreset,
    tags: advanced.tags,
    photo: advanced.photo,
    moods: advanced.moods,
    amountMin: activeFilter.amountMin,
    amountMax: activeFilter.amountMax,
  }), [activeFilter.amountMax, activeFilter.amountMin, advanced.datePreset, advanced.moods, advanced.photo, advanced.tags]);
  const panelFilterCount = countActiveFilters(panelFilter);

  const resetPanelFilters = () => {
    setAdvanced(EMPTY_FILTER);
    setAmountMinInput('');
    setAmountMaxInput('');
  };

  const toggleTag = (tag: string) => {
    setAdvanced((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag],
    }));
  };

  const toggleMood = (mood: MoodFilterValue) => {
    setAdvanced((current) => ({
      ...current,
      moods: current.moods.includes(mood)
        ? current.moods.filter((item) => item !== mood)
        : [...current.moods, mood],
    }));
  };

  return (
    <div className="mobile-overlay z-[60]">
      <div className="mobile-toolbar gap-2">
        <button onClick={onClose} className="icon-button !h-9 !w-9" aria-label="返回">
          <ArrowLeft size={21} />
        </button>
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索备注、分类、标签、金额"
            className="min-h-10 w-full rounded-full bg-slate-100 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-amber-300 dark:bg-slate-800 dark:text-slate-100"
          />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              aria-label="清空搜索"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(true)}
          aria-label="更多筛选"
          className="icon-button relative !h-9 !w-9"
        >
          <SlidersHorizontal size={19} />
          {panelFilterCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-black">
              {panelFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="border-b border-slate-100 px-4 pb-3 pt-2 dark:border-slate-700/50">
        <div className="flex gap-2">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              aria-pressed={typeFilter === filter.value}
              className={`min-h-9 flex-1 rounded-full text-sm font-medium ${
                typeFilter === filter.value ? 'bg-primary text-black' : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <HorizontalScrollArea className="mt-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setCategoryId('')}
            className={`min-h-9 shrink-0 rounded-full px-3 text-sm ${
              categoryId === '' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300'
            }`}
          >
            全部分类
          </button>
          {categories
            .filter((category) => !category.deletedAt && (typeFilter === 'all' || category.type === typeFilter))
            .map((category) => (
              <button
                key={category.id}
                onClick={() => setCategoryId(categoryId === category.id ? '' : category.id)}
                aria-pressed={categoryId === category.id}
                className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm ${
                  categoryId === category.id ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300'
                }`}
              >
                <Icon name={category.icon} size={14} />
                {category.name}
              </button>
            ))}
        </HorizontalScrollArea>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-3">
        <div className="mb-2 text-xs text-slate-400">
          {activeCount > 0 ? `找到 ${results.length} 笔` : `全部账单共 ${results.length} 笔`}
          {results.length > RESULT_LIMIT && `，仅显示最近 ${RESULT_LIMIT} 条`}
        </div>
        {visibleResults.length === 0 ? (
          <div className="surface-card py-12 text-center">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-300">没有匹配的账单</div>
            <div className="mt-1 text-xs text-slate-400">换个关键词或筛选条件试试</div>
          </div>
        ) : (
          <div className="surface-card overflow-hidden">
            {visibleResults.map((transaction) => {
              const category = categories.find((item) => item.id === transaction.categoryId);
              return (
                <button
                  key={transaction.id}
                  onClick={() => setSelectedTransaction(transaction)}
                  className="flex min-h-16 w-full items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-0 active:bg-slate-50 dark:border-slate-700/50 dark:active:bg-slate-800"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: category?.color || '#9CA3AF' }}
                  >
                    <Icon name={category?.icon || 'more-horizontal'} size={18} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="font-medium dark:text-slate-100">{isRefund(transaction) ? '退款' : category?.name || '未分类'}</div>
                    <div className="truncate text-xs text-gray-400">
                      {formatDateHeader(transaction.occurredAt)}
                      {transaction.note && ` · ${transaction.note}`}
                      {transaction.tags.length > 0 && ` · ${transaction.tags.join(' ')}`}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 font-semibold ${
                      isRefund(transaction)
                        ? 'text-amber-700 dark:text-amber-300'
                        : transaction.type === 'income'
                          ? 'text-green-600 dark:text-green-400'
                          : transaction.type === 'expense'
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-blue-500 dark:text-blue-400'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                    {formatMoney(transaction.amount).replace('¥', '')}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700/50">
              <span className="font-medium dark:text-slate-100">更多筛选</span>
              <button aria-label="关闭筛选" onClick={() => setShowFilters(false)}>
                <X size={20} className="dark:text-slate-300" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <section>
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">日期</div>
                <div className="flex flex-wrap gap-2">
                  {DATE_PRESET_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAdvanced((current) => ({ ...current, datePreset: option.value }))}
                      aria-pressed={advanced.datePreset === option.value}
                      className={chipClass(advanced.datePreset === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">金额区间</div>
                <div className="flex items-center gap-2">
                  <input
                    value={amountMinInput}
                    onChange={(event) => setAmountMinInput(event.target.value)}
                    inputMode="decimal"
                    aria-label="最低金额"
                    placeholder="最低"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-amber-400/20"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    value={amountMaxInput}
                    onChange={(event) => setAmountMaxInput(event.target.value)}
                    inputMode="decimal"
                    aria-label="最高金额"
                    placeholder="最高"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-amber-400/20"
                  />
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">标签</span>
                  {advanced.tags.length > 1 && (
                    <span className="text-[11px] text-slate-400">需同时包含全部标签</span>
                  )}
                </div>
                {availableTags.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400 dark:bg-slate-700/50">
                    这个账本还没有用过标签
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        aria-pressed={advanced.tags.includes(tag)}
                        className={chipClass(advanced.tags.includes(tag))}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">照片</div>
                <div className="flex flex-wrap gap-2">
                  {PHOTO_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAdvanced((current) => ({ ...current, photo: option.value }))}
                      aria-pressed={advanced.photo === option.value}
                      className={chipClass(advanced.photo === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">消费心情</div>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => toggleMood(option.value)}
                      aria-pressed={advanced.moods.includes(option.value)}
                      className={chipClass(advanced.moods.includes(option.value))}
                    >
                      {option.emoji} {option.label}
                    </button>
                  ))}
                  <button
                    onClick={() => toggleMood('none')}
                    aria-pressed={advanced.moods.includes('none')}
                    className={chipClass(advanced.moods.includes('none'))}
                  >
                    未标记
                  </button>
                </div>
              </section>
            </div>

            <div className="flex gap-2 border-t border-slate-100 p-4 dark:border-slate-700/50">
              <button
                onClick={resetPanelFilters}
                disabled={panelFilterCount === 0}
                className="min-h-11 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 disabled:text-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:disabled:text-slate-500"
              >
                重置
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-black"
              >
                查看 {results.length} 笔
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}

/** 用输入框原文解析金额：空串和中间态（如 "100."）都视为不过滤。 */
function parseAmount(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function chipClass(active: boolean): string {
  return `min-h-9 shrink-0 rounded-full px-3 text-sm ${
    active
      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300'
  }`;
}
