import { Link } from 'react-router'
import { ArrowUpRight, ChevronRight, MapPin } from 'lucide-react'
import type { Booking, OwnerBooking } from '@/api/types'
import { TripCover } from '@/components/TripCover'
import { cn } from '@/components/ui/cn'
import { reservationCount, type SummaryTone, type TripGroupData } from '@/lib/bookingGroups'
import { daysBetween } from '@/lib/bookings'
import { formatDateRange } from '@/lib/trips'
import { BookingItem } from './BookingItem'

type AnyBooking = Booking | OwnerBooking

const SUMMARY_TONE: Record<SummaryTone, string> = {
  ok: 'text-success-soft-fg',
  warn: 'text-warn-soft-fg',
  danger: 'text-danger-soft-fg',
  muted: 'text-fg-subtle',
}

/** "In progress", "Starts in 12 days", "Ended 3 weeks ago": where the trip is in time. */
function tripTiming(group: TripGroupData, today: string): string {
  const { trip, phase } = group
  if (phase === 'ongoing') return 'In progress'
  if (phase === 'upcoming') {
    const days = daysBetween(today, trip.start_date)
    return days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`
  }
  const days = -daysBetween(today, trip.end_date)
  if (days === 1) return 'Ended yesterday'
  return days < 60 ? `Ended ${days} days ago` : `Ended ${Math.round(days / 30)} months ago`
}

interface TripGroupProps {
  group: TripGroupData
  today: string
  open: boolean
  onToggle: () => void
  onOpenBooking: (b: AnyBooking) => void
  onEdit: (b: AnyBooking) => void
  onDelete: (b: AnyBooking) => void
}

export function TripGroup({ group, today, open, onToggle, onOpenBooking, onEdit, onDelete }: TripGroupProps) {
  const { trip, summary, bookings } = group
  const headingId = `trip-${trip.id}-heading`
  const panelId = `trip-${trip.id}-panel`

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:gap-4 sm:p-4"
        >
          <ChevronRight className={cn('size-4 shrink-0 text-fg-subtle transition-transform', open && 'rotate-90')} aria-hidden />
          <TripCover destination={trip.destination} className="h-14 w-16 shrink-0 rounded-lg sm:h-16 sm:w-24" />
          <span className="min-w-0 flex-1">
            <span id={headingId} className="block truncate text-base font-semibold text-fg" title={trip.title}>
              {trip.title}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-muted">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate" title={trip.destination}>{trip.destination}</span>
            </span>
            <span className="mt-0.5 block text-xs text-fg-subtle tabular-nums">
              {formatDateRange(trip.start_date, trip.end_date)}
              <span aria-hidden> · </span>
              <span className={cn(group.phase === 'ongoing' && 'font-medium text-primary-ink')}>{tripTiming(group, today)}</span>
            </span>
          </span>
          <span className="hidden shrink-0 text-right sm:block">
            <span className="block text-sm font-medium text-fg">{reservationCount(bookings.length)}</span>
            <span className={cn('mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium', SUMMARY_TONE[summary.tone])}>
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {summary.label}
            </span>
          </span>
        </button>

        <Link
          to={`/trips/${trip.id}?tab=bookings`}
          aria-label={`Open trip: ${trip.title}`}
          title="Open trip"
          className="flex shrink-0 items-center gap-1 border-l border-line px-3 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:px-4"
        >
          <span className="hidden md:inline">Open trip</span>
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>

      {/* Phones: the count and overall status move below the title instead of squeezing beside it. */}
      <p className={cn('border-t border-line px-4 py-1.5 text-xs sm:hidden', SUMMARY_TONE[summary.tone])}>
        <span className="font-medium text-fg">{reservationCount(bookings.length)}</span>
        <span aria-hidden className="text-fg-subtle"> · </span>
        {summary.label}
      </p>

      <div id={panelId} role="region" aria-labelledby={headingId} hidden={!open} className="border-t border-line">
        {open && (
          <ul className="divide-y divide-line">
            {bookings.map((b) => (
              <BookingItem key={b.id} booking={b} today={today} onOpen={onOpenBooking} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
