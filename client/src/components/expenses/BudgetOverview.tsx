import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import type { BudgetSummary } from '@/api/types'
import { formatCurrency } from '@/lib/trips'

interface BudgetOverviewProps {
  summary: BudgetSummary
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: 'bg-amber-400',
  Transportation: 'bg-sky-400',
  Accommodation: 'bg-primary',
  Activities: 'bg-teal-400',
  Shopping: 'bg-rose-400',
  Other: 'bg-slate-400',
}

export function BudgetOverview({ summary }: BudgetOverviewProps) {
  const percentCapped = Math.min(100, Math.max(0, summary.percent_spent))

  return (
    <div className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
      {/* Header Stat row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
            <Wallet className="size-3.5 text-primary-ink" aria-hidden />
            Total Budget
          </dt>
          <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-fg">
            {formatCurrency(summary.budget)}
          </dd>
        </div>

        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
            <TrendingUp className="size-3.5 text-sky-500" aria-hidden />
            Total Spent
          </dt>
          <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-fg">
            {formatCurrency(summary.total_spent)}
          </dd>
        </div>

        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
            {summary.is_over_budget ? (
              <AlertTriangle className="size-3.5 text-danger" aria-hidden />
            ) : (
              <TrendingDown className="size-3.5 text-primary-ink" aria-hidden />
            )}
            Remaining
          </dt>
          <dd
            className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${
              summary.is_over_budget ? 'text-danger' : 'text-primary-ink'
            }`}
          >
            {formatCurrency(summary.remaining_budget)}
          </dd>
        </div>

        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
            {summary.is_over_budget ? (
              <AlertTriangle className="size-3.5 text-danger" aria-hidden />
            ) : (
              <CheckCircle2 className="size-3.5 text-primary-ink" aria-hidden />
            )}
            Budget Status
          </dt>
          <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-fg">
            {summary.percent_spent}%
          </dd>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-fg-muted font-medium">
          <span>Overall spending</span>
          <span className={summary.is_over_budget ? 'text-danger font-semibold' : ''}>
            {summary.is_over_budget
              ? `${Math.round(summary.percent_spent - 100)}% over budget`
              : `${Math.round(100 - summary.percent_spent)}% remaining`}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2 p-0.5 border border-line/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              summary.is_over_budget
                ? 'bg-danger'
                : summary.percent_spent > 85
                ? 'bg-amber-500'
                : 'bg-primary'
            }`}
            style={{ width: `${percentCapped}%` }}
          />
        </div>
      </div>

      {/* Category Breakdown */}
      {summary.by_category.length > 0 && (
        <div className="border-t border-line pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle mb-3">
            Spending by Category
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.by_category.map((cat) => {
              const dotColor = CATEGORY_COLORS[cat.category] ?? 'bg-slate-400'
              return (
                <div
                  key={cat.category}
                  className="rounded-xl border border-line/70 bg-surface-2/40 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-fg">
                      <span className={`size-2 rounded-full ${dotColor}`} aria-hidden />
                      {cat.category}
                    </span>
                    <span className="font-semibold tabular-nums text-fg">
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-fg-subtle">
                    <span>{cat.count} {cat.count === 1 ? 'expense' : 'expenses'}</span>
                    <span className="font-medium">{cat.percentage}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${dotColor}`}
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
