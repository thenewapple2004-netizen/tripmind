import type { Booking } from '@/api/types'
import { bookingWhenParts } from '@/lib/bookings'

/**
 * "Mar 12 2:00 PM → Mar 20 11:00 AM". If the column is too narrow it wraps at the arrow, giving two
 * whole times on two lines, never a time split in the middle.
 */
export function WhenText({ booking, className }: { booking: Pick<Booking, 'start_date' | 'start_time' | 'end_date' | 'end_time'>; className?: string }) {
  const [start, end] = bookingWhenParts(booking)
  return (
    <span className={className}>
      <span className="whitespace-nowrap">{start}</span>
      {end && (
        <>
          {' '}
          <span aria-hidden className="text-fg-subtle">→</span>
          <span className="sr-only">to</span>{' '}
          <span className="whitespace-nowrap">{end}</span>
        </>
      )}
    </span>
  )
}
