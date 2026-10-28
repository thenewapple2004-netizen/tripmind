import { Link } from 'react-router'
import { AlertTriangle, Wallet } from 'lucide-react'
import type { OwnerDashboardOverview, OwnerTripStatusDistribution } from '@/api/ownerTypes'
import { Card, CardHeader, EmptyNote } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { formatCompactCurrency } from '@/lib/owner'
import { STATUS_LABEL } from '@/lib/trips'

export function BudgetSummaryCard({ overview }: { overview: OwnerDashboardOverview }) {
  const pct = Math.min(overview.budget_utilization_pct, 100)
  const hasBudget = overview.total_budget > 0
  return (
    <Card className="h-full">
      <CardHeader
        title="Budget summary"
        description="All trips combined"
        icon={<Wallet className="size-4" aria-hidden />}
        action={
          <Link to="/expenses" className="text-xs font-medium text-primary-ink hover:underline">
            Details
          </Link>
        }
      />
      {!hasBudget ? (
        <EmptyNote icon={<Wallet className="size-6" aria-hidden />}>No trip budgets yet.</EmptyNote>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-3xl font-extrabold tracking-tight text-fg tabular-nums">
                {formatCompactCurrency(overview.total_spent)}
              </p>
              <p className="text-xs text-fg-subtle">spent of {formatCompactCurrency(overview.total_budget)}</p>
            </div>
            <p className={cn('text-sm font-bold tabular-nums', overview.is_over_budget ? 'text-danger' : 'text-primary-ink')}>
              {Math.round(overview.budget_utilization_pct)}%
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-3"
          >
            <div
              className={cn('h-full rounded-full transition-[width] duration-700', overview.is_over_budget ? 'bg-danger' : 'bg-primary')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-muted">
            {overview.is_over_budget ? (
              <>
                <AlertTriangle className="size-3.5 text-danger" aria-hidden />
                Over budget by {formatCompactCurrency(Math.abs(overview.remaining_budget))}
              </>
            ) : (
              <>{formatCompactCurrency(overview.remaining_budget)} remaining</>
            )}
          </p>
        </>
      )}
    </Card>
  )
}

const STATUS_BAR: Record<string, string> = {
  upcoming: 'bg-[#79c0e8]',
  ongoing: 'bg-primary',
  completed: 'bg-[#9aab9f]',
}

export function TripStatusCard({ distribution }: { distribution: OwnerTripStatusDistribution[] }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0)
  return (
    <Card className="h-full">
      <CardHeader title="Trip status" description={total ? `${total} trips in total` : 'Where your trips stand'} />
      {total === 0 ? (
        <EmptyNote>No trips yet.</EmptyNote>
      ) : (
        <ul className="space-y-3">
          {distribution.map((d) => (
            <li key={d.status}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-fg-muted">{STATUS_LABEL[d.status] ?? d.status}</span>
                <span className="font-semibold text-fg tabular-nums">{d.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-700', STATUS_BAR[d.status] ?? 'bg-primary')}
                  style={{ width: `${d.percentage}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
