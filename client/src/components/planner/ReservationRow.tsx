import { Link } from 'react-router'
import { Ticket } from 'lucide-react'
import type { ItineraryReservation } from '@/api/types'
import { TYPE_META } from '@/components/bookings/meta'
import { cn } from '@/components/ui/cn'
import { formatClock, toMinutes } from '@/lib/itinerary'
import { shortDate } from '@/lib/bookings'

/**
 * A confirmed booking on the itinerary. It is read-only and deliberately not draggable or editable
 * here: bookings are managed in the Bookings tab, and they never alter the activities beside them.
 */
export function ReservationRow({ reservation, showDate = false }: { reservation: ItineraryReservation; showDate?: boolean }) {
  const { icon: Icon, tile } = TYPE_META[reservation.type]
  const detail = [reservation.provider, reservation.location].filter(Boolean).join(' · ')
  return (
    <li>
      <Link
        to={{ search: '?tab=bookings' }}
        title="Open in Bookings"
        className="group flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-3 py-2 transition hover:border-primary/60 hover:bg-surface-2"
      >
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', tile)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs font-bold tracking-wide text-primary-ink uppercase">{reservation.label}</span>
            <span className="text-xs text-fg-subtle tabular-nums">
              {showDate && `${shortDate(reservation.date)} `}
              {reservation.time ? formatClock(toMinutes(reservation.time)) : 'Time not set'}
            </span>
          </span>
          <span className="block truncate text-sm font-medium text-fg">{reservation.title}</span>
          {detail && <span className="block truncate text-xs text-fg-subtle">{detail}</span>}
        </span>
        <Ticket className="size-4 shrink-0 text-fg-subtle opacity-0 transition group-hover:opacity-100" aria-hidden />
      </Link>
    </li>
  )
}
