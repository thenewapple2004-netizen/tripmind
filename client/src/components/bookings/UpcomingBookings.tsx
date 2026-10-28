import type { OwnerBooking } from '@/api/types'
import { bookingDuration, countdown, timingTone } from '@/lib/bookings'
import { formatMoneyIn } from '@/lib/money'
import { parseISODate } from '@/lib/trips'
import { BookingStatusBadge, TYPE_META, Timing } from './meta'
import { WhenText } from './WhenText'

const month = new Intl.DateTimeFormat('en-US', { month: 'short' })

/**
 * The next few reservations, compact: a date, what and where, when and for how long, its status and
 * its cost. Timing ("Today", "In 5 days") is text; only the reservation status is a badge.
 */
export function UpcomingBookings({
  items,
  today,
  onOpen,
  onShowAll,
}: {
  items: OwnerBooking[]
  today: string
  onOpen: (b: OwnerBooking) => void
  onShowAll: () => void
}) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="upcoming-heading" className="rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 id="upcoming-heading" className="text-sm font-semibold text-fg">Upcoming reservations</h2>
          <p className="text-xs text-fg-subtle">Pending and confirmed, soonest first</p>
        </div>
        <button type="button" onClick={onShowAll} className="shrink-0 text-xs font-medium text-primary-ink hover:underline">
          View all
        </button>
      </header>
      <ul className="divide-y divide-line">
        {items.map((b) => {
          const start = parseISODate(b.start_date)
          const duration = bookingDuration(b)
          const Icon = TYPE_META[b.type].icon
          const timing = <Timing label={countdown(b, today)} tone={timingTone(b, today)} />
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onOpen(b)}
                className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 @2xl:grid-cols-[2.75rem_minmax(0,1.5fr)_minmax(0,1.4fr)_6.5rem_6rem] @2xl:gap-x-4"
              >
                <span className="flex flex-col items-center rounded-md border border-line py-1 leading-none" aria-hidden>
                  <span className="text-[10px] font-medium text-fg-subtle uppercase">{month.format(start)}</span>
                  <span className="mt-0.5 text-base font-semibold text-fg tabular-nums">{start.getDate()}</span>
                </span>

                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                    <Icon className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                    <span className="truncate" title={b.title}>{b.title}</span>
                  </span>
                  <span className="block truncate text-xs text-fg-subtle" title={b.trip_title}>{b.trip_title}</span>
                  {/* Narrow screens: the schedule folds under the name */}
                  <span className="mt-0.5 block text-xs text-fg-muted tabular-nums @2xl:hidden">
                    <WhenText booking={b} />
                  </span>
                  <span className="block text-xs text-fg-subtle @2xl:hidden">
                    {timing}
                    {duration && ` · ${duration}`}
                  </span>
                </span>

                <span className="hidden min-w-0 @2xl:block">
                  <span className="block text-sm text-fg tabular-nums"><WhenText booking={b} /></span>
                  <span className="block text-xs text-fg-subtle">
                    {timing}
                    {duration && ` · ${duration}`}
                  </span>
                </span>

                <span className="hidden @2xl:block">
                  <BookingStatusBadge status={b.status} />
                </span>

                <span className="flex flex-col items-end gap-1 @2xl:block @2xl:text-right">
                  <span className="text-sm font-medium text-fg tabular-nums">{formatMoneyIn(b.total_cost, b.currency)}</span>
                  <span className="@2xl:hidden">
                    <BookingStatusBadge status={b.status} />
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
