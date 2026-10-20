import type { ReactNode } from 'react'
import { CalendarClock, Luggage, MapPinned, Wallet, type LucideIcon } from 'lucide-react'
import type { Trip } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { cityOf, formatCurrency, getTimingLabel, getTripStatus, pluralize, sortTrips } from '@/lib/trips'

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  helper: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-fg-muted">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </div>
      <p className="mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</p>
      <p className="mt-0.5 truncate text-sm text-fg-subtle">{helper}</p>
    </div>
  )
}

export function StatsRow({ trips }: { trips: Trip[] }) {
  const today = new Date()
  const active = trips.filter((trip) => getTripStatus(trip, today) !== 'completed')
  const inProgress = active.filter((trip) => getTripStatus(trip, today) === 'ongoing').length
  const budgetAhead = active.reduce((sum, trip) => sum + trip.budget, 0)
  const next = sortTrips(active, 'upcoming', today)[0]

  return (
    <section aria-label="Trip summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StatCard icon={Luggage} label="Total trips" value={trips.length} helper="Across all dates" />
      <StatCard
        icon={CalendarClock}
        label="Upcoming"
        value={active.length}
        helper={inProgress > 0 ? `${inProgress} in progress now` : 'Planned and ready'}
      />
      <StatCard
        icon={Wallet}
        label="Budget ahead"
        value={formatCurrency(budgetAhead)}
        helper={`For ${pluralize(active.length, 'trip')}`}
      />
      <StatCard
        icon={MapPinned}
        label={next && getTripStatus(next, today) === 'ongoing' ? 'Happening now' : 'Next up'}
        value={next ? cityOf(next.destination) : '—'}
        helper={next ? getTimingLabel(next, today) : 'Nothing planned yet'}
      />
    </section>
  )
}

export function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" role="presentation">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-4 h-8 w-24" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
      ))}
    </div>
  )
}
