import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ItineraryDay } from '@/api/types'
import { cn } from '@/components/ui/cn'
import { parseISODate, toISODate } from '@/lib/trips'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface TripCalendarProps {
  days: ItineraryDay[]
  /** Dates that contain at least one scheduling conflict. */
  conflictDates: Set<string>
  today: string
  dragging: boolean
  onSelectDay: (date: string) => void
  onDropOnDay: (date: string) => void
}

/**
 * A month grid for the trip's dates. Days inside the trip show how many activities they hold
 * (and a warning marker for clashes), jump to that day on click, and accept a dragged activity.
 */
export function TripCalendar({ days, conflictDates, today, dragging, onSelectDay, onDropOnDay }: TripCalendarProps) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])

  // Every month the trip touches, so long trips can be paged through.
  const months = useMemo(() => {
    if (days.length === 0) return []
    const first = parseISODate(days[0].date)
    const last = parseISODate(days[days.length - 1].date)
    const list: Date[] = []
    for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      list.push(d)
    }
    return list
  }, [days])

  const [page, setPage] = useState(0)
  const month = months[Math.min(page, months.length - 1)]
  const [dragOver, setDragOver] = useState<string | null>(null)
  if (!month) return null

  const lead = month.getDay()
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: Array<string | null> = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: total }, (_, i) => toISODate(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ]
  const label = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label="Previous month"
          className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-ink transition hover:bg-primary hover:text-primary-fg disabled:opacity-30"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p aria-live="polite" className="font-display text-sm font-semibold text-fg">
          {label}
        </p>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(months.length - 1, p + 1))}
          disabled={page >= months.length - 1}
          aria-label="Next month"
          className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-ink transition hover:bg-primary hover:text-primary-fg disabled:opacity-30"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div role="grid" aria-label={`Trip calendar, ${label}`} className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} aria-hidden className="pb-1 text-[11px] font-semibold text-primary-ink">
            {w}
          </span>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`blank-${i}`} />
          const day = byDate.get(iso)
          const dayNumber = parseISODate(iso).getDate()
          if (!day) {
            return (
              <span key={iso} className="flex h-10 items-center justify-center text-xs text-fg-subtle/50 tabular-nums">
                {dayNumber}
              </span>
            )
          }
          const count = day.activities.length
          const clash = conflictDates.has(iso)
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              onClick={() => onSelectDay(iso)}
              onDragOver={(e) => {
                if (!dragging) return
                e.preventDefault()
                setDragOver(iso)
              }}
              onDragLeave={() => setDragOver((current) => (current === iso ? null : current))}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(null)
                onDropOnDay(iso)
              }}
              aria-label={`Day ${day.day_number}, ${parseISODate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${
                count === 0 ? 'no activities' : `${count} ${count === 1 ? 'activity' : 'activities'}`
              }${clash ? ', has a scheduling clash' : ''}`}
              className={cn(
                'relative flex h-10 flex-col items-center justify-center rounded-xl border text-xs tabular-nums transition',
                count > 0 ? 'border-primary/30 bg-primary-soft text-primary-soft-fg' : 'border-line bg-surface-2 text-fg-muted',
                'hover:border-primary hover:text-fg',
                iso === today && 'ring-1 ring-primary ring-inset',
                dragOver === iso && 'scale-105 border-primary bg-primary text-primary-fg',
                clash && 'border-warn-soft-fg/60',
              )}
            >
              <span className="font-semibold">{dayNumber}</span>
              {count > 0 && (
                <span aria-hidden className="flex gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }, (_, k) => (
                    <span key={k} className={cn('size-1 rounded-full', dragOver === iso ? 'bg-primary-fg' : 'bg-primary')} />
                  ))}
                </span>
              )}
              {clash && <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warn-soft-fg ring-2 ring-surface" />}
            </button>
          )
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-subtle">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-primary" /> Has activities
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-warn-soft-fg" /> Clash
        </li>
      </ul>
    </div>
  )
}
