import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { parseISODate, toISODate } from '@/lib/trips'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MAX_SPAN_DAYS = 400

export interface CalendarTrip {
  start_date: string
  end_date: string
}

/** Every ISO day covered by the given trips (capped per trip so bad data can't hang the page). */
function coveredDays(trips: CalendarTrip[]): { all: Set<string>; edges: Set<string> } {
  const all = new Set<string>()
  const edges = new Set<string>()
  for (const trip of trips) {
    const start = parseISODate(trip.start_date)
    const end = parseISODate(trip.end_date)
    edges.add(trip.start_date)
    edges.add(trip.end_date)
    const cursor = new Date(start)
    for (let i = 0; i < MAX_SPAN_DAYS && cursor <= end; i++) {
      all.add(toISODate(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return { all, edges }
}

/**
 * Month calendar driven by real data: trip spans are tinted, trip start/end days are
 * emphasised and days with scheduled activities get a dot.
 */
export function MiniCalendar({
  trips,
  activityDates,
  selected,
  onSelect,
}: {
  trips: CalendarTrip[]
  /** ISO dates (YYYY-MM-DD) that have at least one activity. */
  activityDates: Set<string>
  selected: string
  onSelect: (iso: string) => void
}) {
  const todayIso = toISODate(new Date())
  const [cursor, setCursor] = useState(() => {
    const d = parseISODate(selected)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const { all: tripDays, edges } = useMemo(() => coveredDays(trips), [trips])

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const gridStart = new Date(first)
    gridStart.setDate(1 - first.getDay())
    const rows = Math.ceil((first.getDay() + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7)
    return Array.from({ length: rows * 7 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [cursor])

  const shift = (months: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + months, 1))
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-ink transition hover:bg-primary hover:text-primary-fg"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p aria-live="polite" className="font-display text-sm font-semibold text-fg">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-ink transition hover:bg-primary hover:text-primary-fg"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} aria-hidden className="pb-1 text-[11px] font-semibold text-primary-ink">
            {w}
          </span>
        ))}
        {days.map((d) => {
          const iso = toISODate(d)
          const inMonth = d.getMonth() === cursor.getMonth()
          const inTrip = tripDays.has(iso)
          const isEdge = edges.has(iso)
          const isSelected = iso === selected
          const isToday = iso === todayIso
          const hasActivity = activityDates.has(iso)
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${
                inTrip ? ', trip' : ''
              }${hasActivity ? ', has activities' : ''}`}
              onClick={() => {
                onSelect(iso)
                if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
              }}
              className={cn(
                'relative mx-auto flex h-8 w-full items-center justify-center text-xs tabular-nums transition',
                inTrip && 'bg-primary-soft text-primary-soft-fg',
                !inTrip && 'rounded-full',
                inTrip && 'first:rounded-l-full last:rounded-r-full',
                isEdge && 'rounded-full',
                !inMonth && !isSelected && 'text-fg-subtle/60',
                inMonth && !inTrip && 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                isToday && !isSelected && 'font-bold text-primary-ink ring-1 ring-primary/60 ring-inset',
                isSelected && 'rounded-full bg-primary font-bold text-primary-fg shadow-glow',
              )}
            >
              {d.getDate()}
              {hasActivity && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute bottom-0.5 size-1 rounded-full',
                    isSelected ? 'bg-primary-fg' : 'bg-primary',
                  )}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-subtle">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-full bg-primary-soft ring-1 ring-primary/40" /> Trip days
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" /> Activity
        </span>
      </div>
    </div>
  )
}
