import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { formatMoney, formatShortDate } from '../utils/helpers';
import TransactionForm from './TransactionForm';
import type { Transaction } from '../types';

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function TransactionDetail({ transaction, onClose }: TransactionDetailProps) {
  const { categories, removeTransaction } = useApp();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const category = categories.find((c) => c.id === transaction.categoryId);

  const handleDelete = () => {
    removeTransaction(transaction.id);
    onClose();
  };

  if (showEdit) {
    return (
      <TransactionForm
        editingTransaction={transaction}
        onClose={() => {
          setShowEdit(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-medium">账单详情</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="p-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white mx-auto mb-3"
            style={{ backgroundColor: category?.color || '#9CA3AF' }}
          >
            <Icon name={category?.icon || 'more-horizontal'} size={28} />
          </div>
          <div className="text-lg font-medium mb-1">{category?.name || '未分类'}</div>
          <div
            className={`text-3xl font-bold ${
              transaction.type === 'income'
                ? 'text-green-600'
                : transaction.type === 'expense'
                ? 'text-red-500'
                : 'text-blue-500'
            }`}
          >
            {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
            {formatMoney(transaction.amount)}
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">类型</span>
            <span>
              {transaction.type === 'income' ? '收入' : transaction.type === 'expense' ? '支出' : '转账'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">日期</span>
            <span>{formatShortDate(transaction.occurredAt)}</span>
          </div>
          {transaction.note && (
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">备注</span>
              <span>{transaction.note}</span>
            </div>
          )}
          {transaction.tags.length > 0 && (
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">标签</span>
              <span>{transaction.tags.join(', ')}</span>
            </div>
          )}
          {transaction.photo && (
            <div className="py-2">
              <div className="text-gray-500 mb-2">图片</div>
              <img src={transaction.photo} alt="receipt" className="w-full rounded-lg" />
            </div>
          )}
        </div>

        <div className="p-4 flex gap-3">
          <button
            onClick={() => setShowEdit(true)}
            className="flex-1 py-3 bg-primary rounded-xl font-medium"
          >
            编辑
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="px-4 py-3 bg-red-50 text-red-500 rounded-xl"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="text-lg font-medium mb-2">删除账单</div>
            <div className="text-gray-500 mb-6">确定删除这条记录吗？删除后无法恢复。</div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-3 bg-gray-100 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
