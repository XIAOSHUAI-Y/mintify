import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { formatMoney } from '../../utils/helpers';
import type { Transaction, Category } from '../../types';
import { getNetSpendingByCategory } from '../../domain/transactionAccounting';
import { getChildCategories, rollUpSpending } from '../../domain/categoryTree';

interface MonthlyPieChartProps {
  transactions: Transaction[];
  categories: Category[];
  title?: string;
  yearMonth: string;
}

interface SliceItem {
  id: string;
  name: string;
  value: number;
  color: string;
  /** 有子分类时可以下钻看组成部分。 */
  drillable: boolean;
}

const FALLBACK_COLOR = '#9CA3AF';

export default function MonthlyPieChart({ transactions, categories, yearMonth, title = '本月支出构成' }: MonthlyPieChartProps) {
  const [drillParentId, setDrillParentId] = useState('');

  const spending = useMemo(
    () => getNetSpendingByCategory(transactions, yearMonth),
    [transactions, yearMonth],
  );

  /** 顶层：子分类金额归并到父分类，父级总额 = 自己直挂的 + 子级之和。 */
  const parentSlices = useMemo<SliceItem[]>(() => {
    const rolled = rollUpSpending(spending, categories);
    return [...rolled.entries()]
      .map(([categoryId, value]) => {
        const category = categories.find((item) => item.id === categoryId);
        return {
          id: categoryId,
          name: category?.name || '未分类',
          value,
          color: category?.color || FALLBACK_COLOR,
          drillable: getChildCategories(categories, categoryId).length > 0,
        };
      })
      .filter(({ value }) => value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categories, spending]);

  const drillParent = drillParentId
    ? categories.find((category) => category.id === drillParentId)
    : undefined;

  /** 下钻：只列该父级下的子分类；父级自己直挂的金额单列成「未细分」。 */
  const childSlices = useMemo<SliceItem[]>(() => {
    if (!drillParent) return [];
    const items: SliceItem[] = getChildCategories(categories, drillParent.id)
      .map((child) => ({
        id: child.id,
        name: child.name,
        value: spending.get(child.id) ?? 0,
        color: child.color,
        drillable: false,
      }))
      .filter(({ value }) => value > 0);

    const direct = spending.get(drillParent.id) ?? 0;
    if (direct > 0) {
      items.push({
        id: `${drillParent.id}::direct`,
        name: '未细分',
        value: direct,
        color: drillParent.color || FALLBACK_COLOR,
        drillable: false,
      });
    }
    return items.sort((a, b) => b.value - a.value);
  }, [categories, drillParent, spending]);

  const data = drillParent ? childSlices : parentSlices;
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  const heading = drillParent ? `${drillParent.name} · 分类构成` : title;

  const headingNode = (
    <div className="mb-2 flex items-center gap-2 font-semibold">
      {drillParent && (
        <button aria-label="返回上层分类" onClick={() => setDrillParentId('')}>
          <ChevronLeft size={18} className="text-slate-400" />
        </button>
      )}
      {heading}
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="surface-card mb-4 p-4">
        {headingNode}
        <div className="flex h-40 flex-col items-center justify-center text-slate-400">
          <div className="text-sm font-medium">暂无支出数据</div>
          <div className="mt-1 text-xs">记录支出后会自动生成占比</div>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card mb-4 p-4">
      {headingNode}

      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={57}
              outerRadius={78}
              paddingAngle={2}
              dataKey="value"
              onClick={(entry: { payload?: SliceItem }) => {
                // recharts 会把原始数据项透传到 payload，用它判断该切片能否下钻。
                const slice = entry?.payload;
                if (slice?.drillable) setDrillParentId(slice.id);
              }}
            >
              {data.map((entry) => (
                <Cell key={entry.id} fill={entry.color} cursor={entry.drillable ? 'pointer' : undefined} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xs text-gray-500 dark:text-slate-400">{drillParent ? '该分类支出' : '总支出'}</div>
          <div className="text-lg font-bold">{formatMoney(total)}</div>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        {data.slice(0, 6).map((item) => (
          <button
            key={item.id}
            disabled={!item.drillable}
            onClick={() => setDrillParentId(item.id)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm">{item.name}</span>
              {item.drillable && <span className="text-[10px] text-slate-400">看子分类</span>}
            </div>
            <span className="text-sm text-gray-500 dark:text-slate-400">{formatMoney(item.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
