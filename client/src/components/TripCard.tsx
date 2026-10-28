import { Link } from 'react-router'
import { CalendarDays, Clock } from 'lucide-react'
import type { Trip } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  cityOf,
  formatCurrency,
  formatDateRange,
  getTimingLabel,
  getTripDays,
  getTripStatus,
  pluralize,
} from '@/lib/trips'
import { TripCover } from './TripCover'

export function TripCard({ trip }: { trip: Trip }) {
  const status = getTripStatus(trip)
  const region = trip.destination.split(',').slice(1).join(',').trim()

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition duration-300 hover:border-primary/40 hover:shadow-lift"
    >
      <TripCover destination={trip.destination} zoomOnHover className="flex h-40 flex-col justify-between p-4">
        <StatusBadge status={status} className="self-start shadow-sm" />
        <div>
          <p className="text-xl leading-tight font-semibold tracking-tight">{cityOf(trip.destination)}</p>
          {region && <p className="mt-0.5 text-sm text-white/85">{region}</p>}
        </div>
      </TripCover>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-fg group-hover:text-primary-ink">
          {trip.title}
        </h3>

        <ul className="space-y-1.5 text-sm text-fg-muted">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            {formatDateRange(trip.start_date, trip.end_date)}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            {pluralize(getTripDays(trip), 'day')}
          </li>
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
          <div>
            <p className="text-xs font-medium text-fg-subtle">Budget</p>
            <p className="text-lg font-semibold tabular-nums text-fg">{formatCurrency(trip.budget)}</p>
          </div>
          <p className="pb-0.5 text-sm text-fg-muted">{getTimingLabel(trip)}</p>
        </div>
      </div>
    </Link>
  )
}

export function TripCardSkeleton() {
  return (
    <div
      role="presentation"
      className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card"
    >
      <Skeleton className="h-40 rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-5 w-4/5" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </div>
  )
}
