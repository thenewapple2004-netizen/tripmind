import {
  Bed,
  Car,
  Compass,
  Pencil,
  Receipt,
  ShoppingBag,
  Trash2,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import type { Expense, ExpenseCategory } from '@/api/types'
import { formatCurrency, formatLongDate } from '@/lib/trips'

const CATEGORY_META: Record<
  ExpenseCategory,
  { icon: LucideIcon; color: string; badgeBg: string }
> = {
  Food: {
    icon: Utensils,
    color: 'text-amber-500',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  Transportation: {
    icon: Car,
    color: 'text-blue-500',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  Accommodation: {
    icon: Bed,
    color: 'text-indigo-500',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  Activities: {
    icon: Compass,
    color: 'text-emerald-500',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  Shopping: {
    icon: ShoppingBag,
    color: 'text-pink-500',
    badgeBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  },
  Other: {
    icon: Receipt,
    color: 'text-slate-500',
    badgeBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  },
}

interface ExpenseCardProps {
  expense: Expense
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
}

export function ExpenseCard({ expense, onEdit, onDelete }: ExpenseCardProps) {
  const meta = CATEGORY_META[expense.category] ?? CATEGORY_META.Other
  const IconComponent = meta.icon

  return (
    <article className="group relative rounded-xl border border-line bg-surface p-4 shadow-sm transition-all hover:border-line-strong hover:shadow-card sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${meta.badgeBg}`}>
            <IconComponent className="size-5" aria-hidden />
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${meta.badgeBg}`}>
                {expense.category}
              </span>
              <span className="text-xs text-fg-subtle">
                {formatLongDate(expense.expense_date)}
              </span>
            </div>

            <h3 className="text-base font-semibold text-fg tracking-tight break-words">
              {expense.title}
            </h3>

            {expense.description && (
              <p className="mt-1 text-xs text-fg-muted whitespace-pre-line break-words">
                {expense.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0">
          <span className="text-lg font-bold tracking-tight tabular-nums text-fg">
            {formatCurrency(expense.amount)}
          </span>

          <div className="flex items-center gap-1 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onEdit(expense)}
              aria-label={`Edit ${expense.title}`}
              title="Edit expense"
              className="rounded-lg p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors focus:outline-none"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onDelete(expense)}
              aria-label={`Delete ${expense.title}`}
              title="Delete expense"
              className="rounded-lg p-1.5 text-fg-subtle hover:bg-danger-soft hover:text-danger transition-colors focus:outline-none"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
