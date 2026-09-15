import { useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { buildInsights } from '../../domain/insights';
import type { Category, Transaction } from '../../types';

/**
 * 洞察描述的是“当下”的数据（本月、近 90 天），浏览历史年份时不出示，避免口径错位。
 */
export default function InsightsCarousel({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const insights = useMemo(
    () => buildInsights({ transactions, categories, now: Date.now() }),
    [categories, transactions],
  );

  if (insights.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Sparkles size={15} className="text-amber-600 dark:text-amber-400" />
          消费洞察
        </div>
        <span className="text-xs text-slate-400">{activeIndex + 1} / {insights.length}</span>
      </div>
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          setActiveIndex(Math.round(element.scrollLeft / element.clientWidth));
        }}
        className="horizontal-scroll-hint flex snap-x snap-mandatory gap-3 overflow-x-auto"
      >
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="surface-card flex w-full shrink-0 snap-start items-center gap-3 p-4"
          >
            <span className="text-2xl">{insight.emoji}</span>
            <span className="text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
              {insight.text}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
