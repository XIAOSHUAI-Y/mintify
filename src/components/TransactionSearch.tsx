import { useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import TransactionDetail from './TransactionDetail';
import HorizontalScrollArea from './HorizontalScrollArea';
import { formatDateHeader, formatMoney } from '../utils/helpers';
import { isRefund } from '../domain/transactionAccounting';
import type { Transaction, TransactionType } from '../types';

const TYPE_FILTERS: { value: TransactionType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
  { value: 'transfer', label: '转账' },
];

/** 结果过多时只渲染前若干条，避免长账本在低端机上一次性渲染上千行。 */
const RESULT_LIMIT = 100;

export default function TransactionSearch({ onClose }: { onClose: () => void }) {
  const { currentLedger, transactions, categories } = useApp();
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const results = useMemo(() => {
    if (!currentLedger) return [];
    const query = keyword.trim().toLowerCase();
    return transactions
      .filter((transaction) => {
        if (transaction.ledgerId !== currentLedger.id) return false;
        if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
        if (categoryId && transaction.categoryId !== categoryId) return false;
        if (!query) return true;
        const category = categories.find((item) => item.id === transaction.categoryId);
        return (
          transaction.note.toLowerCase().includes(query)
          || (category?.name.toLowerCase().includes(query) ?? false)
          || transaction.tags.some((tag) => tag.toLowerCase().includes(query))
          || String(transaction.amount).includes(query)
        );
      })
      .sort((a, b) => b.occurredAt - a.occurredAt);
  }, [categories, categoryId, currentLedger, keyword, transactions, typeFilter]);

  const visibleResults = results.slice(0, RESULT_LIMIT);
  const hasFilter = keyword.trim() !== '' || typeFilter !== 'all' || categoryId !== '';

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
          {hasFilter ? `找到 ${results.length} 笔` : `全部账单共 ${results.length} 笔`}
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

      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}
