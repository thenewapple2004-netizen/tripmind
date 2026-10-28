import { Paperclip, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import type { Booking, OwnerBooking } from '@/api/types'
import { cn } from '@/components/ui/cn'
import { TYPE_LABEL, bookingDuration, bookingHeadline, countdown, timingTone } from '@/lib/bookings'
import { formatMoneyIn } from '@/lib/money'
import { parseISODate } from '@/lib/trips'
import { CopyButton } from './CopyButton'
import { StatusText, TYPE_META, Timing } from './meta'
import { WhenText } from './WhenText'

type AnyBooking = Booking | OwnerBooking

const month = new Intl.DateTimeFormat('en-US', { month: 'short' })

interface BookingItemProps {
  booking: AnyBooking
  today: string
  onOpen: (booking: AnyBooking) => void
  onEdit: (booking: AnyBooking) => void
  onDelete: (booking: AnyBooking) => void
}

/**
 * A reservation as one compact line inside its trip: the date, what it is, when, and its status and
 * cost. The whole item opens the travel pass; copy, edit and delete stay within reach.
 */
export function BookingItem({ booking, today, onOpen, onEdit, onDelete }: BookingItemProps) {
  const Icon = TYPE_META[booking.type].icon
  const headline = bookingHeadline(booking)
  const duration = bookingDuration(booking)
  const start = parseISODate(booking.start_date)
  const cancelled = booking.status === 'cancelled'

  return (
    <li className="min-w-0">
      <div className={cn('group relative flex items-start gap-3 px-3 py-3 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-4', cancelled && 'opacity-70')}>
        {/* The whole item is one button. Copy, edit and delete sit above it. */}
        <button
          type="button"
          onClick={() => onOpen(booking)}
          aria-label={`Open travel pass: ${booking.title}`}
          className="absolute inset-0 z-0 focus-visible:outline-2 focus-visible:-outline-offset-2"
        />

        <span aria-hidden className="pointer-events-none relative z-10 flex w-10 shrink-0 flex-col items-center rounded-md border border-line py-1 leading-none">
          <span className="text-[10px] font-medium text-fg-subtle uppercase">{month.format(start)}</span>
          <span className="mt-0.5 text-base font-semibold text-fg tabular-nums">{start.getDate()}</span>
        </span>

        <div className="pointer-events-none relative z-10 min-w-0 flex-1">
          <p className="flex items-start gap-2 text-sm font-medium text-fg">
            <Icon className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
            <span className={cn('line-clamp-2 break-words', cancelled && 'line-through decoration-fg-subtle/60')} title={booking.title}>
              <span className="sr-only">{TYPE_LABEL[booking.type]}: </span>
              {booking.title}
            </span>
          </p>
          {headline && (
            <p className="mt-0.5 truncate pl-6 text-xs text-fg-muted" title={headline}>
              {headline}
            </p>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 pl-6 text-xs text-fg-subtle">
            <WhenText booking={booking} className="tabular-nums" />
            <span aria-hidden>·</span>
            <Timing label={countdown(booking, today)} tone={timingTone(booking, today)} />
            {duration && (
              <>
                <span aria-hidden>·</span>
                <span>{duration}</span>
              </>
            )}
            {booking.outside_trip_dates && (
              <span className="inline-flex items-center gap-1 text-warn-soft-fg" title="Starts or ends outside the trip's dates">
                <TriangleAlert className="size-3" aria-hidden />
                <span className="sr-only">Outside the trip dates</span>
              </span>
            )}
          </p>
          {(booking.confirmation_number || booking.documents.length > 0) && (
            <p className="mt-1 flex min-w-0 items-center gap-2 pl-6 text-xs text-fg-subtle">
              {booking.confirmation_number && (
                <span className="pointer-events-auto inline-flex shrink-0 items-center gap-0.5">
                  <span className="text-fg-subtle">Ref</span>
                  <span className="font-mono text-fg-muted tabular-nums">{booking.confirmation_number}</span>
                  <CopyButton value={booking.confirmation_number} label={`Copy reservation reference ${booking.confirmation_number}`} />
                </span>
              )}
              {booking.documents.length > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5" title={`${booking.documents.length} linked ${booking.documents.length === 1 ? 'document' : 'documents'}`}>
                  <Paperclip className="size-3" aria-hidden />
                  {booking.documents.length}
                  <span className="sr-only">linked documents</span>
                </span>
              )}
            </p>
          )}
        </div>

        <div className="pointer-events-none relative z-10 flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-medium text-fg tabular-nums">{formatMoneyIn(booking.total_cost, booking.currency)}</span>
          <StatusText status={booking.status} />
          <span className="pointer-events-auto -mr-1.5 mt-0.5 flex gap-0.5 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 pointer-coarse:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(booking)}
              aria-label={`Edit ${booking.title}`}
              title="Edit"
              className="flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onDelete(booking)}
              aria-label={`Delete ${booking.title}`}
              title="Delete"
              className="flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </span>
        </div>
      </div>
    </li>
  )
}
