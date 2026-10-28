import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { parseISODate, toISODate } from '@/lib/trips'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export interface CalendarTrip {
  start_date: string
  end_date: string
}

/** Days on which a trip starts or ends. Whole trip spans are deliberately not shaded: with many
 * overlapping trips almost every day would light up and the calendar would say nothing. */
function tripEdges(trips: CalendarTrip[]): Set<string> {
  const edges = new Set<string>()
  for (const trip of trips) {
    edges.add(trip.start_date)
    edges.add(trip.end_date)
  }
  return edges
}

/**
 * Month calendar driven by real data. A small dot marks a day where something is planned: a trip
 * starts or ends, or there is an activity. Pick a day to see exactly what it is.
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

  const edges = useMemo(() => tripEdges(trips), [trips])

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
          const isSelected = iso === selected
          const isToday = iso === todayIso
          const hasActivity = activityDates.has(iso)
          const hasTripEdge = edges.has(iso)
          const planned = hasActivity || hasTripEdge
          const parts = [hasTripEdge && 'a trip starts or ends', hasActivity && 'has activities'].filter(Boolean)
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${
                parts.length ? `, ${parts.join(' and ')}` : ''
              }`}
              onClick={() => {
                onSelect(iso)
                if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
              }}
              className={cn(
                'relative mx-auto flex size-9 flex-col items-center justify-center rounded-full text-xs tabular-nums transition',
                !inMonth && !isSelected && 'text-fg-subtle/50',
                inMonth && !isSelected && 'text-fg hover:bg-surface-3',
                isToday && !isSelected && 'font-bold text-primary-ink ring-1 ring-primary/70 ring-inset',
                isSelected && 'bg-primary font-bold text-primary-fg',
              )}
            >
              {d.getDate()}
              {planned && (
                <span
                  aria-hidden
                  className={cn('absolute bottom-1 size-1 rounded-full', isSelected ? 'bg-primary-fg' : 'bg-primary')}
                />
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-3 flex items-center gap-2 text-[11px] text-fg-subtle">
        <span aria-hidden className="size-1.5 rounded-full bg-primary" />A dot means something is planned that day. Tap a day to see it.
      </p>
    </div>
  )
}
