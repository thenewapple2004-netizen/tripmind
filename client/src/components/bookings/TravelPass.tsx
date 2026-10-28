import type { ReactNode } from 'react'
import { MapPin, Plane } from 'lucide-react'
import type { Booking, OwnerBooking } from '@/api/types'
import { CABIN_CLASSES, TRANSPORT_MODES, bookingDuration, nights } from '@/lib/bookings'
import { formatClock, toMinutes } from '@/lib/itinerary'
import { formatMoneyIn } from '@/lib/money'
import { parseISODate } from '@/lib/trips'
import { CopyButton } from './CopyButton'
import { BookingStatusBadge, TYPE_META } from './meta'

type AnyBooking = Booking | OwnerBooking

const PASS_LABEL = {
  flight: 'Flight reservation',
  hotel: 'Hotel reservation',
  transportation: 'Transport reservation',
  activity: 'Activity reservation',
} as const

const weekdayDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const dayMonth = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

const detail = (b: AnyBooking, key: string): string => {
  const v = b.details?.[key]
  return v === undefined || v === null ? '' : String(v)
}
const clock = (t: string | null | undefined) => (t ? formatClock(toMinutes(t)) : null)

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-fg" title={typeof children === 'string' ? children : undefined}>{children}</dd>
    </div>
  )
}

function Facts({ items }: { items: Array<[string, ReactNode | null | undefined | false]> }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== false && v !== '')
  if (shown.length === 0) return null
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
      {shown.map(([label, value]) => (
        <Fact key={label} label={label}>{value}</Fact>
      ))}
    </dl>
  )
}

// ── Flight ───────────────────────────────────────────────────────────────

function Endpoint({ label, code, date, time, terminal, align }: { label: string; code: string; date: string | null; time: string | null; terminal?: string; align: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <p className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">{label}</p>
      <p className="mt-1 text-3xl leading-none font-semibold tracking-tight text-fg tabular-nums sm:text-4xl">{code || '—'}</p>
      <p className="mt-2 text-sm font-medium text-fg tabular-nums">{time ?? <span className="font-normal text-fg-subtle">Time not added</span>}</p>
      <p className="text-xs text-fg-muted">{date ?? 'Date not added'}</p>
      {terminal && <p className="mt-0.5 text-xs text-fg-subtle">Terminal {terminal}</p>}
    </div>
  )
}

function FlightBody({ b }: { b: AnyBooking }) {
  const hasArrival = Boolean(b.end_date || b.end_time)
  const arrivalDay = b.end_date ?? b.start_date
  const airline = detail(b, 'airline') || b.provider || ''
  const cabin = CABIN_CLASSES.find((c) => c.value === detail(b, 'cabin_class'))?.label
  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <Endpoint align="left" label="Departure" code={detail(b, 'departure_airport')} date={weekdayDate.format(parseISODate(b.start_date))} time={clock(b.start_time)} terminal={detail(b, 'departure_terminal')} />
        <div className="mt-9 flex w-14 items-center gap-1 text-fg-subtle sm:w-24" aria-hidden>
          <span className="h-px flex-1 bg-line-strong" />
          <Plane className="size-4 shrink-0 rotate-45" />
          <span className="h-px flex-1 bg-line-strong" />
        </div>
        <Endpoint align="right" label="Arrival" code={detail(b, 'arrival_airport')} date={hasArrival ? weekdayDate.format(parseISODate(arrivalDay)) : null} time={clock(b.end_time)} terminal={detail(b, 'arrival_terminal')} />
      </div>
      <Facts items={[['Airline', airline], ['Flight', detail(b, 'flight_number')], ['Cabin', cabin], ['Seat', detail(b, 'seat')]]} />
      {b.end_time && <p className="mt-3 text-xs text-fg-subtle">Times are local to each airport.</p>}
    </>
  )
}

// ── Hotel ────────────────────────────────────────────────────────────────

function Stay({ label, iso, time }: { label: string; iso: string | null; time: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">{label}</p>
      <p className="mt-1 text-2xl leading-none font-semibold tracking-tight text-fg">{iso ? dayMonth.format(parseISODate(iso)) : '—'}</p>
      <p className="mt-1.5 text-xs text-fg-muted">{iso ? weekdayDate.format(parseISODate(iso)).split(',')[0] : 'Date not added'}{time ? ` · ${time}` : ''}</p>
    </div>
  )
}

function HotelBody({ b }: { b: AnyBooking }) {
  const n = nights(b)
  const address = detail(b, 'address')
  const place = address || b.location
  return (
    <>
      <h3 className="text-xl font-semibold tracking-tight break-words text-fg">{b.title}</h3>
      {b.provider && <p className="mt-0.5 text-sm text-fg-muted">{b.provider}</p>}
      {place && (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-fg-muted">
          <MapPin className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
          <span className="break-words">{place}</span>
        </p>
      )}
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-t border-line pt-4">
        <Stay label="Check-in" iso={b.start_date} time={clock(b.start_time)} />
        <div className="mt-3 flex w-16 flex-col items-center gap-1 text-fg-subtle sm:w-24" aria-hidden>
          <span className="h-px w-full bg-line-strong" />
          <span className="text-xs font-medium text-fg-muted">{n > 0 ? `${n} ${n === 1 ? 'night' : 'nights'}` : ''}</span>
        </div>
        <div className="text-right">
          <Stay label="Check-out" iso={b.end_date} time={clock(b.end_time)} />
        </div>
      </div>
      <Facts items={[['Room', detail(b, 'room_type')], ['Guests', detail(b, 'guests')]]} />
    </>
  )
}

// ── Transportation ───────────────────────────────────────────────────────

function RouteStop({ kind, place, time, last }: { kind: string; place: string; time: string | null; last?: boolean }) {
  return (
    <li className="relative pb-5 pl-6 last:pb-0">
      <span aria-hidden className="absolute top-1 left-0 size-2.5 rounded-full border-2 border-primary bg-surface-2" />
      {!last && <span aria-hidden className="absolute top-4 bottom-0 left-[4px] w-px bg-line-strong" />}
      <p className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">{kind}</p>
      <p className="mt-0.5 text-base font-semibold break-words text-fg">{place || 'Not added'}</p>
      <p className="text-xs text-fg-muted tabular-nums">{time ?? 'Time not added'}</p>
    </li>
  )
}

function TransportBody({ b }: { b: AnyBooking }) {
  const mode = TRANSPORT_MODES.find((m) => m.value === detail(b, 'mode'))?.label
  const duration = bookingDuration(b)
  const dropTime = clock(b.end_time)
  return (
    <>
      <h3 className="text-xl font-semibold tracking-tight break-words text-fg">{b.title}</h3>
      <p className="mt-0.5 text-sm text-fg-muted">{weekdayDate.format(parseISODate(b.start_date))}{duration ? ` · ${duration}` : ''}</p>
      <ol className="mt-5 border-t border-line pt-4">
        <RouteStop kind="Pickup" place={detail(b, 'pickup_location')} time={clock(b.start_time)} />
        <RouteStop kind="Drop-off" place={detail(b, 'dropoff_location')} time={dropTime} last />
      </ol>
      <Facts items={[['Mode', mode], ['Provider', b.provider], ['Vehicle', detail(b, 'vehicle')]]} />
    </>
  )
}

// ── Activity ─────────────────────────────────────────────────────────────

function ActivityBody({ b }: { b: AnyBooking }) {
  const duration = bookingDuration(b)
  return (
    <>
      <h3 className="text-xl font-semibold tracking-tight break-words text-fg">{b.title}</h3>
      {b.provider && <p className="mt-0.5 text-sm text-fg-muted">{b.provider}</p>}
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">When</p>
        <p className="mt-1 text-2xl leading-none font-semibold tracking-tight text-fg">{dayMonth.format(parseISODate(b.start_date))}</p>
        <p className="mt-1.5 text-sm text-fg-muted tabular-nums">
          {weekdayDate.format(parseISODate(b.start_date)).split(',')[0]}
          {clock(b.start_time) && ` · ${clock(b.start_time)}`}
          {clock(b.end_time) && ` → ${clock(b.end_time)}`}
          {duration && ` · ${duration}`}
        </p>
      </div>
      <Facts items={[['Location', b.location], ['Meeting point', detail(b, 'meeting_point')], ['Participants', detail(b, 'participants')]]} />
    </>
  )
}

// ── The pass ─────────────────────────────────────────────────────────────

/**
 * A reservation summary laid out like a ticket. It only ever shows what the owner recorded: a field that
 * wasn't filled in is omitted or marked "not added", never made up. It is not an official ticket, and
 * it carries no QR code or barcode because there is nothing real to encode.
 */
export function TravelPass({ booking }: { booking: AnyBooking }) {
  const Icon = TYPE_META[booking.type].icon
  return (
    <article aria-label={`${PASS_LABEL[booking.type]}: ${booking.title}`} className="relative overflow-hidden rounded-xl border border-line-strong bg-surface-2">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-5">
        <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-fg-muted uppercase">
          <Icon className="size-4" aria-hidden />
          {PASS_LABEL[booking.type]}
        </span>
        <BookingStatusBadge status={booking.status} />
      </header>

      <div className="px-4 py-5 sm:px-5">
        {booking.type === 'flight' && <FlightBody b={booking} />}
        {booking.type === 'hotel' && <HotelBody b={booking} />}
        {booking.type === 'transportation' && <TransportBody b={booking} />}
        {booking.type === 'activity' && <ActivityBody b={booking} />}
      </div>

      {/* The tear-off line: a dashed rule with a notch on each edge. */}
      <div aria-hidden className="relative h-0">
        <div className="border-t border-dashed border-line-strong" />
        <span className="absolute -top-2 -left-2 size-4 rounded-full border border-line-strong bg-surface" />
        <span className="absolute -top-2 -right-2 size-4 rounded-full border border-line-strong bg-surface" />
      </div>

      <footer className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">Booking reference</p>
          {booking.confirmation_number ? (
            <p className="mt-0.5 flex items-center gap-1">
              <span className="truncate font-mono text-lg font-semibold tracking-wide text-fg">{booking.confirmation_number}</span>
              <CopyButton value={booking.confirmation_number} label="Copy booking reference" className="shrink-0" />
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-fg-subtle">No reference added</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">Total</p>
          <p className="mt-0.5 text-lg font-semibold text-fg tabular-nums">{formatMoneyIn(booking.total_cost, booking.currency)}</p>
        </div>
      </footer>

      <p className="border-t border-line px-4 py-2 text-[11px] text-fg-subtle sm:px-5">
        Reservation summary from your own records. It is not an official ticket or boarding pass.
      </p>
    </article>
  )
}
