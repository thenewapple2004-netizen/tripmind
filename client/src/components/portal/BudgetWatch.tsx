import { Link } from 'react-router'
import { Gauge, Luggage } from 'lucide-react'
import type { OwnerUpcomingTrip } from '@/api/ownerTypes'
import { TripCover } from '@/components/TripCover'
import { Card, CardHeader, EmptyNote } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { formatCompactCurrency } from '@/lib/owner'

/** Upcoming trips ranked by how much of their budget is already spoken for. */
export function BudgetWatch({ trips }: { trips: OwnerUpcomingTrip[] }) {
  const ranked = [...trips].sort((a, b) => b.percent_spent - a.percent_spent).slice(0, 3)
  return (
    <Card className="h-full">
      <CardHeader
        title="Budget watch"
        description="Upcoming trips by budget used"
        icon={<Gauge className="size-4" aria-hidden />}
        action={
          <Link to="/expenses" className="text-xs font-medium text-primary-ink hover:underline">
            Expenses
          </Link>
        }
      />
      {ranked.length === 0 ? (
        <EmptyNote icon={<Luggage className="size-6" aria-hidden />}>Plan an upcoming trip to see its budget here.</EmptyNote>
      ) : (
        <ol className="space-y-3">
          {ranked.map((trip, i) => {
            const pct = Math.round(trip.percent_spent)
            const over = trip.total_spent > trip.budget
            return (
              <li key={trip.id}>
                <Link
                  to={`/trips/${trip.id}`}
                  className="group flex items-center gap-3 rounded-2xl p-1.5 transition hover:bg-surface-2"
                >
                  <span aria-hidden className="w-5 text-center text-xs font-bold text-fg-subtle tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <TripCover destination={trip.destination} className="size-12 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-fg group-hover:text-primary-ink">{trip.title}</span>
                      <span className={cn('shrink-0 text-xs font-bold tabular-nums', over ? 'text-danger' : 'text-primary-ink')}>
                        {pct}%
                      </span>
                    </span>
                    <span
                      role="progressbar"
                      aria-label={`${trip.title} budget used`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(pct, 100)}
                      className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-3"
                    >
                      <span
                        className={cn('block h-full rounded-full', over ? 'bg-danger' : 'bg-primary')}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </span>
                    <span className="mt-1 block text-[11px] text-fg-subtle tabular-nums">
                      {formatCompactCurrency(trip.total_spent)} of {formatCompactCurrency(trip.budget)}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
