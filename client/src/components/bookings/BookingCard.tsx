import { Link } from 'react-router'
import { CalendarClock, Hash, MapPin, Paperclip, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import type { Booking, OwnerBooking } from '@/api/types'
import { cn } from '@/components/ui/cn'
import { bookingHeadline, countdown, formatBookingWhen, freeCancellationNote, isUpcoming } from '@/lib/bookings'
import { formatMoneyIn } from '@/lib/money'
import { CopyButton } from './CopyButton'
import { BookingStatusBadge, TYPE_META, TypeTile } from './meta'

type AnyBooking = Booking | OwnerBooking

interface BookingCardProps {
  booking: AnyBooking
  today: string
  onOpen: (booking: AnyBooking) => void
  onEdit: (booking: AnyBooking) => void
  onDelete: (booking: AnyBooking) => void
}

const NOTE_TONE = { open: 'text-primary-ink', closing: 'text-warn-soft-fg', closed: 'text-fg-subtle' } as const

export function BookingCard({ booking, today, onOpen, onEdit, onDelete }: BookingCardProps) {
  const headline = bookingHeadline(booking)
  const note = freeCancellationNote(booking, today)
  const dim = booking.status === 'cancelled'
  const trip = 'trip_title' in booking ? booking : null
  const soon = isUpcoming(booking, today)

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift',
        dim && 'opacity-75',
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', TYPE_META[booking.type].bar)} />

      {/* The whole card opens the details; the controls below sit above this layer. */}
      <button
        type="button"
        onClick={() => onOpen(booking)}
        aria-label={`View details: ${booking.title}`}
        className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-2"
      />

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-3 p-4 pl-5">
        <div className="flex items-start gap-3">
          <TypeTile type={booking.type} />
          <div className="min-w-0 flex-1">
            <h3 className={cn('truncate font-display text-base font-bold tracking-tight text-fg', dim && 'line-through decoration-fg-subtle/60')}>
              {booking.title}
            </h3>
            <p className="truncate text-xs text-fg-subtle">{booking.provider ?? 'No provider added'}</p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>

        {headline && <p className="truncate text-sm font-medium text-fg">{headline}</p>}

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5 tabular-nums">
            <CalendarClock className="size-3.5 shrink-0 text-primary-ink" aria-hidden />
            {formatBookingWhen(booking)}
          </span>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', soon ? 'bg-primary-soft text-primary-soft-fg' : 'bg-surface-3 text-fg-subtle')}>
            {countdown(booking, today)}
          </span>
        </p>

        {booking.location && booking.location !== headline && (
          <p className="flex items-center gap-1.5 truncate text-xs text-fg-subtle">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {booking.location}
          </p>
        )}

        {note && <p className={cn('text-xs font-medium', NOTE_TONE[note.tone])}>{note.text}</p>}
        {booking.outside_trip_dates && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-warn-soft-fg">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            Outside the trip dates
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-line pt-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold tracking-tight text-fg tabular-nums">
              {formatMoneyIn(booking.total_cost, booking.currency)}
            </p>
            {trip && (
              <Link
                to={`/trips/${booking.trip_id}?tab=bookings`}
                className="pointer-events-auto block max-w-44 truncate text-xs text-fg-subtle hover:text-primary-ink hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {trip.trip_title}
              </Link>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-1">
            {booking.confirmation_number && (
              <span className="flex items-center gap-0.5 rounded-lg bg-surface-2 py-0.5 pr-0.5 pl-2 text-xs text-fg-muted">
                <Hash className="size-3" aria-hidden />
                <span className="font-mono tabular-nums">{booking.confirmation_number}</span>
                <CopyButton value={booking.confirmation_number} label={`Copy confirmation number ${booking.confirmation_number}`} />
              </span>
            )}
            {booking.documents.length > 0 && (
              <span
                className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-fg-muted"
                title={`${booking.documents.length} linked ${booking.documents.length === 1 ? 'document' : 'documents'}`}
              >
                <Paperclip className="size-3" aria-hidden />
                {booking.documents.length}
                <span className="sr-only">linked documents</span>
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(booking)
              }}
              aria-label={`Edit ${booking.title}`}
              className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-3 hover:text-fg"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(booking)
              }}
              aria-label={`Delete ${booking.title}`}
              className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
