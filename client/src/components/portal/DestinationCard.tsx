import { Link } from 'react-router'
import { MapPin } from 'lucide-react'
import type { Trip } from '@/api/types'
import { TripCover } from '@/components/TripCover'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cityOf, formatCurrency, getTimingLabel, getTripDays, getTripStatus } from '@/lib/trips'

/** Photo-led trip card. Every figure comes from the trip itself. */
export function DestinationCard({ trip }: { trip: Trip }) {
  const perDay = trip.budget / getTripDays(trip)
  const region = trip.destination.split(',').slice(1).join(',').trim()
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group block overflow-hidden rounded-xl border border-line bg-surface shadow-card transition duration-300 hover:border-primary/40 hover:shadow-lift"
    >
      <TripCover destination={trip.destination} zoomOnHover className="flex h-40 flex-col justify-between p-3">
        <StatusBadge status={getTripStatus(trip)} className="self-start shadow-sm backdrop-blur" />
        <p className="font-display text-lg leading-tight font-bold tracking-tight drop-shadow">
          {cityOf(trip.destination)}
          {region && <span className="block text-xs font-medium text-white/80">{region}</span>}
        </p>
      </TripCover>
      <div className="space-y-1.5 p-4">
        <p className="truncate text-sm font-semibold text-fg">{trip.title}</p>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-primary-ink tabular-nums">
            <MapPin className="size-3.5" aria-hidden />
            {formatCurrency(Math.round(perDay))} / day
          </span>
          <span className="truncate text-fg-subtle">{getTimingLabel(trip)}</span>
        </div>
      </div>
    </Link>
  )
}

export function DestinationCardSkeleton() {
  return (
    <div role="presentation" className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <Skeleton className="h-40 rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}
