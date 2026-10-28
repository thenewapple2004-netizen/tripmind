import { useState } from 'react'
import { Link } from 'react-router'
import { CircleAlert, Receipt, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QuickAddButton } from '@/components/portal/QuickAdd'
import { BudgetSummaryCard } from '@/components/portal/BudgetSummary'
import { CategoryCard, SpendingTrendCard } from '@/components/portal/SpendingCharts'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { cn } from '@/components/ui/cn'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOwnerDashboard, useOwnerExpenses } from '@/hooks/useOwnerDashboard'
import { EXPENSE_CATEGORIES, categoryColor, formatCompactCurrency } from '@/lib/owner'
import { formatCurrency, formatDate } from '@/lib/trips'

const PAGE_SIZE = 10

function Kpi({ label, value, helper, danger }: { label: string; value: string; helper: string; danger?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-fg-subtle">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-semibold tracking-tight tabular-nums', danger ? 'text-danger' : 'text-fg')}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-fg-subtle">{helper}</p>
    </Card>
  )
}

export function ExpensesPage() {
  useDocumentTitle('Expenses')
  const dashboard = useOwnerDashboard()
  const [category, setCategory] = useState<string>('all')
  const [page, setPage] = useState(1)
  const expenses = useOwnerExpenses(page, PAGE_SIZE, category === 'all' ? undefined : category)
  const data = dashboard.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Budget analytics and every expense across your trips. Open a trip to edit or remove expenses."
        actions={<QuickAddButton kind="expense" variant="primary" />}
      />

      {dashboard.isPending ? (
        <div role="status" aria-label="Loading budget figures" className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <>
          <section aria-label="Budget figures" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Total budget" value={formatCompactCurrency(data.overview.total_budget)} helper={`${data.overview.total_trips} trips`} />
            <Kpi
              label="Total spent"
              value={formatCompactCurrency(data.overview.total_spent)}
              helper={`${data.overview.total_expenses_count} expenses`}
            />
            <Kpi
              label={data.overview.is_over_budget ? 'Over budget' : 'Remaining'}
              value={formatCompactCurrency(Math.abs(data.overview.remaining_budget))}
              helper={`${Math.round(data.overview.budget_utilization_pct)}% of budget used`}
              danger={data.overview.is_over_budget}
            />
            <Kpi label="Activities" value={String(data.overview.total_activities)} helper="Planned across trips" />
          </section>

          <section aria-label="Spending analytics" className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <SpendingTrendCard trends={data.spending_trends} />
            </div>
            <div className="lg:col-span-2">
              <CategoryCard categories={data.category_expenses} />
            </div>
          </section>
          <BudgetSummaryCard overview={data.overview} />
        </>
      ) : (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn't load budget analytics" description="Something went wrong while fetching your figures.">
          <Button variant="secondary" onClick={() => dashboard.refetch()} loading={dashboard.isFetching}>
            Try again
          </Button>
        </StateCard>
      )}

      <Card>
        <CardHeader title="All expenses" description="Newest first" icon={<Receipt className="size-4" aria-hidden />} />

        <div role="group" aria-label="Filter by category" className="mb-4 flex flex-wrap gap-2">
          {['all', ...EXPENSE_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => {
                setCategory(c)
                setPage(1)
              }}
              className={cn(
                'flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition',
                category === c
                  ? 'border-primary bg-primary text-primary-fg'
                  : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {c !== 'all' && <span className="size-2 rounded-full" style={{ background: categoryColor(c) }} />}
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>

        {expenses.isPending ? (
          <div role="status" aria-label="Loading expenses" className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : expenses.isError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-danger-soft p-4 text-sm text-danger-soft-fg">
            We couldn't load your expenses.
            <Button size="sm" variant="secondary" onClick={() => expenses.refetch()} loading={expenses.isFetching}>
              Retry
            </Button>
          </div>
        ) : expenses.data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong py-10 text-center text-sm text-fg-subtle">
            <Wallet className="size-7" aria-hidden />
            {category === 'all' ? 'No expenses logged yet.' : `No ${category} expenses yet.`}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {expenses.data.items.map((e) => (
              <li key={e.id}>
                <Link to={`/trips/${e.trip_id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-surface-2">
                  <span
                    aria-hidden
                    className="size-10 shrink-0 rounded-xl"
                    style={{ background: `${categoryColor(e.category)}26`, boxShadow: `inset 0 0 0 1.5px ${categoryColor(e.category)}66` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{e.title}</span>
                    <span className="block truncate text-xs text-fg-subtle">
                      {e.category} · {e.trip_title} · {formatDate(e.expense_date.slice(0, 10))}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-fg tabular-nums">{formatCurrency(e.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Pagination
          label="Expense pages"
          page={page}
          totalPages={expenses.data?.total_pages ?? 1}
          busy={expenses.isFetching}
          onChange={setPage}
        />
      </Card>
    </div>
  )
}
