import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import ProjectEditor, { type ProjectEditorValue } from '../components/ProjectEditor';
import TransactionDetail from '../components/TransactionDetail';
import { useConfirmDeletion } from '../context/ConfirmDialogContext';
import { formatDateHeader, formatMoney, formatShortDate, generateId } from '../utils/helpers';
import { isRefund, summarizeTransactions } from '../domain/transactionAccounting';
import {
  buildProjectCategoryBreakdown,
  getProjectTransactions,
  summarizeProject,
} from '../domain/projectLedger';
import { rollUpSpending } from '../domain/categoryTree';
import type { Project, Transaction } from '../types';

interface ProjectPageProps {
  onClose: () => void;
}

export default function ProjectPage({ onClose }: ProjectPageProps) {
  const {
    currentLedger,
    projects,
    transactions,
    addProject,
    updateProject,
    removeProject,
  } = useApp();
  const confirmDeletion = useConfirmDeletion();

  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const ledgerTransactions = useMemo(
    () => (currentLedger
      ? transactions.filter((transaction) => transaction.ledgerId === currentLedger.id)
      : []),
    [currentLedger, transactions],
  );

  // 新建的项目排在前面，刚建完就能看到。
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.createdAt - a.createdAt),
    [projects],
  );
  const activeProjects = sortedProjects.filter((project) => !project.archivedAt);
  const archivedProjects = sortedProjects.filter((project) => project.archivedAt);
  const detailProject = detailProjectId
    ? projects.find((project) => project.id === detailProjectId) ?? null
    : null;

  const closeEditor = () => {
    setShowEditor(false);
    setEditingProject(null);
  };

  const save = async (value: ProjectEditorValue) => {
    if (!currentLedger) return;
    if (editingProject) {
      await updateProject({ ...editingProject, ...value });
    } else {
      await addProject({
        id: generateId(),
        ledgerId: currentLedger.id,
        ...value,
        createdAt: Date.now(),
      });
    }
    closeEditor();
  };

  const remove = async () => {
    if (!editingProject) return;
    const taggedCount = ledgerTransactions
      .filter((transaction) => transaction.projectId === editingProject.id).length;
    const confirmed = await confirmDeletion({
      title: '删除项目',
      message: taggedCount > 0
        ? `删除“${editingProject.name}”后，这 ${taggedCount} 笔账单会解除归集，但账单本身不会被删除。`
        : `确认删除“${editingProject.name}”？`,
    });
    if (!confirmed) return;
    await removeProject(editingProject.id);
    setDetailProjectId(null);
    closeEditor();
  };

  const toggleArchive = async () => {
    if (!editingProject) return;
    await updateProject({
      ...editingProject,
      archivedAt: editingProject.archivedAt ? undefined : Date.now(),
    });
    closeEditor();
  };

  const selectedTransaction = selectedTransactionId
    ? ledgerTransactions.find((transaction) => transaction.id === selectedTransactionId) ?? null
    : null;

  const editor = (showEditor || editingProject) && (
    <ProjectEditor
      title={editingProject ? '编辑项目' : '新建项目'}
      initialValue={editingProject
        ? {
          name: editingProject.name,
          icon: editingProject.icon,
          color: editingProject.color,
          note: editingProject.note ?? '',
        }
        : undefined}
      archived={Boolean(editingProject?.archivedAt)}
      onSave={save}
      onCancel={closeEditor}
      onDelete={editingProject ? remove : undefined}
      onToggleArchive={editingProject ? toggleArchive : undefined}
    />
  );

  if (detailProject) {
    return (
      <ProjectDetail
        project={detailProject}
        transactions={ledgerTransactions}
        onBack={() => setDetailProjectId(null)}
        onEdit={() => setEditingProject(detailProject)}
        onSelectTransaction={setSelectedTransactionId}
        onClose={onClose}
      >
        {editor}
        {selectedTransaction && (
          <TransactionDetail
            transaction={selectedTransaction}
            onClose={() => setSelectedTransactionId(null)}
          />
        )}
      </ProjectDetail>
    );
  }

  return (
    <div className="mobile-overlay">
      <div className="mobile-toolbar">
        <button aria-label="返回" onClick={onClose} className="icon-button text-slate-600 dark:text-slate-300">
          <X size={20} />
        </button>
        <div className="font-semibold">项目归集</div>
        <button
          aria-label="新建项目"
          onClick={() => setShowEditor(true)}
          className="icon-button"
        >
          <Plus size={22} className="text-amber-700 dark:text-amber-300" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <p className="mb-4 mt-4 text-xs leading-5 text-slate-400">
          把旅行、装修、婚礼这类跨月开销归到一个项目里，随时看总账。记账时在「项目」里选择即可。
        </p>

        {sortedProjects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-300">还没有项目</div>
            <div className="mt-1 text-xs text-slate-400">点右上角 + 建一个，比如「日本旅行」</div>
          </div>
        )}

        {activeProjects.length > 0 && (
          <ProjectGroup
            title="进行中"
            projects={activeProjects}
            transactions={ledgerTransactions}
            onSelect={setDetailProjectId}
          />
        )}

        {archivedProjects.length > 0 && (
          <div className="mt-5">
            <ProjectGroup
              title="已归档"
              projects={archivedProjects}
              transactions={ledgerTransactions}
              onSelect={setDetailProjectId}
              dimmed
            />
          </div>
        )}
      </div>

      {editor}
    </div>
  );
}

function ProjectGroup({
  title,
  projects,
  transactions,
  onSelect,
  dimmed = false,
}: {
  title: string;
  projects: Project[];
  transactions: Transaction[];
  onSelect: (projectId: string) => void;
  dimmed?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title} · {projects.length}
      </div>
      <div className="space-y-2">
        {projects.map((project) => {
          const totals = summarizeProject(transactions, project.id);
          return (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              className={`surface-card flex min-h-16 w-full items-center gap-3 p-3 text-left active:bg-slate-50 dark:active:bg-slate-800 ${
                dimmed ? 'opacity-60' : ''
              }`}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: project.color }}
              >
                <Icon name={project.icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{project.name}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">
                  {totals.count > 0 ? `${totals.count} 笔` : '还没有账单'}
                  {project.note ? ` · ${project.note}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[11px] text-slate-400">净支出</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {formatMoney(totals.netExpense)}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-slate-300" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProjectDetail({
  project,
  transactions,
  onBack,
  onEdit,
  onSelectTransaction,
  onClose,
  children,
}: {
  project: Project;
  transactions: Transaction[];
  onBack: () => void;
  onEdit: () => void;
  onSelectTransaction: (transactionId: string) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { categories } = useApp();
  const scoped = useMemo(
    () => getProjectTransactions(transactions, project.id),
    [project.id, transactions],
  );
  const totals = useMemo(() => summarizeProject(transactions, project.id), [project.id, transactions]);
  const leafBreakdown = useMemo(
    () => buildProjectCategoryBreakdown(transactions, project.id),
    [project.id, transactions],
  );
  /** 分类构成与报表口径一致：子分类金额归并到父分类。 */
  const breakdown = useMemo(() => {
    const rolled = rollUpSpending(
      new Map(leafBreakdown.map((item) => [item.categoryId, item.amount])),
      categories,
    );
    return [...rolled.entries()]
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId, 'zh-CN'));
  }, [categories, leafBreakdown]);
  const maxAmount = breakdown.reduce((max, item) => Math.max(max, item.amount), 0);
  const groupedByDay = useMemo(() => {
    const groups: Record<string, typeof scoped> = {};
    for (const transaction of scoped) {
      const date = new Date(transaction.occurredAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(transaction);
    }
    return Object.values(groups);
  }, [scoped]);

  const span = scoped.length > 0
    ? `${formatShortDate(scoped[scoped.length - 1].occurredAt)} ~ ${formatShortDate(scoped[0].occurredAt)}`
    : '';

  return (
    <div className="mobile-overlay">
      <div className="mobile-toolbar">
        <button aria-label="返回项目列表" onClick={onBack} className="icon-button text-slate-600 dark:text-slate-300">
          <ChevronLeft size={21} />
        </button>
        <div className="min-w-0 truncate font-semibold">{project.name}</div>
        <button aria-label="编辑项目" onClick={onEdit} className="icon-button">
          <Pencil size={18} className="text-amber-700 dark:text-amber-300" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
        <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-100 via-amber-50 to-white p-5 shadow-[0_14px_34px_rgba(245,158,11,0.10)] dark:border-amber-400/20 dark:from-amber-400/15 dark:via-amber-400/5 dark:to-slate-800">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-800/70 dark:text-amber-300/80">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: project.color }}
            >
              <Icon name={project.icon} size={13} />
            </span>
            净支出
            {project.archivedAt && <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] dark:bg-slate-800/70">已归档</span>}
          </div>
          <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {formatMoney(totals.netExpense)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {totals.count > 0 ? `${totals.count} 笔 · ${span}` : '还没有归集账单'}
            {project.note ? ` · ${project.note}` : ''}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatCard label="总支出" value={formatMoney(totals.grossExpense)} tone="rose" />
            <StatCard label="退款" value={formatMoney(totals.refunds)} tone="amber" />
            <StatCard label="收入" value={formatMoney(totals.income)} tone="emerald" />
          </div>
        </section>

        {scoped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-300">这个项目还没有账单</div>
            <div className="mt-1 text-xs text-slate-400">记账时在「项目」里选中它，账单就会归集过来</div>
          </div>
        ) : (
          <>
            {breakdown.length > 0 && (
              <section className="surface-card mb-4 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">分类构成</div>
                <div className="space-y-3">
                  {breakdown.map((item) => {
                    const category = categories.find((entry) => entry.id === item.categoryId);
                    return (
                      <div key={item.categoryId} className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: category?.color || '#94A3B8' }}
                        >
                          <Icon name={category?.icon || 'more-horizontal'} size={15} />
                        </span>
                        <span className="w-16 shrink-0 truncate text-xs text-slate-500 dark:text-slate-400">
                          {category?.name || '未分类'}
                        </span>
                        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${maxAmount > 0 ? Math.max((item.amount / maxAmount) * 100, 3) : 0}%`,
                              backgroundColor: category?.color || '#94A3B8',
                            }}
                          />
                        </span>
                        <span className="w-20 shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {formatMoney(item.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="space-y-4">
              {groupedByDay.map((group) => {
                const daySummary = summarizeTransactions(group);
                return (
                  <div key={group[0].id}>
                    <div className="mb-2 flex justify-between text-sm text-slate-500 dark:text-slate-400">
                      <span>{formatDateHeader(group[0].occurredAt)}</span>
                      <span>
                        {daySummary.grossExpense > 0 && <span>支出 {formatMoney(daySummary.grossExpense)}</span>}
                      </span>
                    </div>
                    <div className="surface-card overflow-hidden">
                      {group.map((transaction) => {
                        const category = categories.find((entry) => entry.id === transaction.categoryId);
                        return (
                          <button
                            key={transaction.id}
                            onClick={() => onSelectTransaction(transaction.id)}
                            className="flex min-h-16 w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 active:bg-slate-50 dark:border-slate-700/50 dark:active:bg-slate-800"
                          >
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                              style={{ backgroundColor: category?.color || '#9CA3AF' }}
                            >
                              <Icon name={category?.icon || 'more-horizontal'} size={18} />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="font-medium dark:text-slate-100">
                                {isRefund(transaction) ? '退款' : category?.name || '未分类'}
                              </div>
                              {transaction.note && (
                                <div className="truncate text-xs text-slate-400">{transaction.note}</div>
                              )}
                            </div>
                            <div
                              className={`shrink-0 font-semibold ${
                                isRefund(transaction)
                                  ? 'text-amber-700 dark:text-amber-300'
                                  : transaction.type === 'income'
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-500 dark:text-red-400'
                              }`}
                            >
                              {transaction.type === 'income' ? '+' : '-'}
                              {formatMoney(transaction.amount).replace('¥', '')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-6 min-h-12 w-full rounded-xl bg-white text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          完成
        </button>
      </div>

      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'rose' | 'amber' | 'emerald';
}) {
  const toneClass = {
    rose: 'text-rose-500 dark:text-rose-400',
    amber: 'text-amber-700 dark:text-amber-300',
    emerald: 'text-emerald-600 dark:text-emerald-400',
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 px-3 py-2.5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/80">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
