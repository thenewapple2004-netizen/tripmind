import type { DragEvent } from 'react'
import { CalendarPlus, Clock, TriangleAlert } from 'lucide-react'
import type { Activity, Itinerary, ItineraryDay } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { conflictPartners, formatDuration, isTimed } from '@/lib/itinerary'
import { formatCurrency, parseISODate } from '@/lib/trips'
import { ActivityRow, type RowActions } from './ActivityRow'

interface DayCardProps extends RowActions {
  day: ItineraryDay
  days: ItineraryDay[]
  itinerary: Itinerary
  today: string
  highlighted: boolean
  conflictCount: number
  dragId: string | null
  /** Where the dragged card would land in this day, or null when it isn't over this day. */
  dropIndex: number | null
  onAdd: (date: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOverDay: (date: string, index: number) => void
  onDragLeaveDay: () => void
  onDropOnDay: (date: string) => void
}

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

function DropLine() {
  return <div aria-hidden className="-my-1 h-1 rounded-full bg-primary shadow-glow" />
}

export function DayCard({
  day,
  days,
  itinerary,
  today,
  highlighted,
  conflictCount,
  dragId,
  dropIndex,
  onAdd,
  onDragStart,
  onDragEnd,
  onDragOverDay,
  onDragLeaveDay,
  onDropOnDay,
  onEdit,
  onDelete,
  onNudge,
  onMoveToDay,
}: DayCardProps) {
  const isToday = day.date === today
  const label = weekday.format(parseISODate(day.date))
  const dragging = dragId !== null

  const dragOverBody = (event: DragEvent<HTMLElement>) => {
    if (!dragging) return
    event.preventDefault() // required for the element to accept a drop
    event.dataTransfer.dropEffect = 'move'
    onDragOverDay(day.date, day.activities.length) // the gap below the last card
  }

  const rowDragOver = (index: number) => (event: DragEvent<HTMLElement>) => {
    if (!dragging) return
    event.preventDefault()
    event.stopPropagation()
    const box = event.currentTarget.getBoundingClientRect()
    onDragOverDay(day.date, event.clientY > box.top + box.height / 2 ? index + 1 : index)
  }

  const nudgeOk = (a: Activity, index: number, direction: -1 | 1) => {
    const neighbour = day.activities[index + direction]
    return !isTimed(a) && Boolean(neighbour) && !isTimed(neighbour)
  }

  return (
    <section
      id={`day-${day.date}`}
      aria-label={`Day ${day.day_number}, ${label}`}
      className={cn(
        'scroll-mt-24 rounded-3xl border bg-surface p-4 shadow-card transition-shadow duration-500 sm:p-5',
        highlighted ? 'border-primary shadow-glow' : 'border-line',
        dropIndex !== null && 'border-primary/60 bg-primary-soft/20',
      )}
      onDragOver={dragOverBody}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragLeaveDay()
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDropOnDay(day.date)
      }}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl',
              isToday ? 'bg-primary text-primary-fg shadow-glow' : 'bg-surface-3 text-fg',
            )}
          >
            <span className="text-[9px] leading-none font-bold uppercase">Day</span>
            <span className="font-display text-lg leading-tight font-extrabold tabular-nums">{day.day_number}</span>
          </span>
          <div>
            <h3 className="font-display text-base font-bold tracking-tight text-fg">
              {label}
              {isToday && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 align-middle text-[10px] font-semibold text-primary-soft-fg">Today</span>}
            </h3>
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-fg-subtle">
              <span>{day.activities.length === 0 ? 'Nothing planned' : `${day.activities.length} ${day.activities.length === 1 ? 'activity' : 'activities'}`}</span>
              {day.total_cost > 0 && <span className="tabular-nums">{formatCurrency(day.total_cost)}</span>}
              {day.scheduled_minutes > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock className="size-3" aria-hidden />
                  {formatDuration(day.scheduled_minutes)}
                </span>
              )}
              {conflictCount > 0 && (
                <span className="flex items-center gap-1 font-semibold text-warn-soft-fg">
                  <TriangleAlert className="size-3" aria-hidden />
                  {conflictCount} {conflictCount === 1 ? 'clash' : 'clashes'}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => onAdd(day.date)}>
          Add
        </Button>
      </header>

      {day.activities.length === 0 ? (
        <div
          className={cn(
            'rounded-2xl border border-dashed px-4 py-6 text-center text-sm transition',
            dropIndex !== null ? 'border-primary text-primary-ink' : 'border-line-strong text-fg-subtle',
          )}
        >
          {dragging ? 'Drop here to plan this day' : 'Nothing planned yet. Drag an activity here or add one.'}
        </div>
      ) : (
        <div className="space-y-2">
          {day.activities.map((activity, index) => (
            <div key={activity.id} className="space-y-2">
              {dropIndex === index && dragId !== activity.id && <DropLine />}
              <ActivityRow
                activity={activity}
                days={days}
                currentDate={day.date}
                clashesWith={conflictPartners(itinerary, activity.id).map((a) => a.title)}
                canNudgeUp={nudgeOk(activity, index, -1)}
                canNudgeDown={nudgeOk(activity, index, 1)}
                dragging={dragId === activity.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOverRow={rowDragOver(index)}
                onEdit={onEdit}
                onDelete={onDelete}
                onNudge={onNudge}
                onMoveToDay={onMoveToDay}
              />
            </div>
          ))}
          {dropIndex === day.activities.length && <DropLine />}
        </div>
      )}
    </section>
  )
}
