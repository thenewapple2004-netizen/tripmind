import type { DragEvent } from 'react'
import { ArrowDown, ArrowUp, Clock, GripVertical, MapPin, Pencil, TriangleAlert, Trash2 } from 'lucide-react'
import type { Activity, ItineraryDay } from '@/api/types'
import { cn } from '@/components/ui/cn'
import { formatDuration, formatClock, isTimed, toMinutes } from '@/lib/itinerary'
import { formatCurrency, formatDate } from '@/lib/trips'

export interface RowActions {
  onEdit: (activity: Activity) => void
  onDelete: (activity: Activity) => void
  onNudge: (activity: Activity, direction: -1 | 1) => void
  onMoveToDay: (activity: Activity, date: string) => void
}

interface ActivityRowProps extends RowActions {
  activity: Activity
  days: ItineraryDay[]
  currentDate: string
  /** Titles of the activities this one overlaps with (empty when there is no clash). */
  clashesWith: string[]
  canNudgeUp: boolean
  canNudgeDown: boolean
  dragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOverRow: (event: DragEvent<HTMLElement>) => void
}

export function ActivityRow({
  activity,
  days,
  currentDate,
  clashesWith,
  canNudgeUp,
  canNudgeDown,
  dragging,
  onEdit,
  onDelete,
  onNudge,
  onMoveToDay,
  onDragStart,
  onDragEnd,
  onDragOverRow,
}: ActivityRowProps) {
  const timed = isTimed(activity)
  const hasClash = clashesWith.length > 0
  const cost = Number(activity.cost || 0)

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', activity.id)
        onDragStart(activity.id)
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverRow}
      data-activity-id={activity.id}
      className={cn(
        'group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-2xl border bg-surface-2 p-3 transition sm:grid-cols-[auto_4.75rem_minmax(0,1fr)_auto] sm:items-center',
        hasClash ? 'border-warn-soft-fg/40 bg-warn-soft/40' : 'border-line hover:border-line-strong',
        dragging && 'opacity-40',
      )}
    >
      <span
        aria-hidden
        title="Drag to move"
        className="hidden cursor-grab text-fg-subtle active:cursor-grabbing sm:block"
      >
        <GripVertical className="size-4" />
      </span>

      {/* When it happens */}
      <div className="col-span-2 flex items-center gap-2 text-xs sm:col-span-1 sm:block sm:text-center">
        {timed ? (
          <>
            <p className="flex items-center gap-1 font-display text-sm font-bold text-primary-ink tabular-nums sm:justify-center">
              <Clock className="size-3.5 sm:hidden" aria-hidden />
              {formatClock(toMinutes(activity.start_time!))}
            </p>
            {activity.duration_minutes ? (
              <p className="text-fg-subtle tabular-nums">{formatDuration(activity.duration_minutes)}</p>
            ) : null}
          </>
        ) : (
          <p className="text-fg-subtle">Anytime</p>
        )}
      </div>

      {/* What it is */}
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="min-w-0 truncate font-display text-sm font-semibold text-fg">{activity.title}</h4>
          {cost > 0 && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary-soft-fg tabular-nums">
              {formatCurrency(cost)}
            </span>
          )}
        </div>
        {activity.location && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-fg-subtle">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {activity.location}
          </p>
        )}
        {activity.description && <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{activity.description}</p>}
        {hasClash && (
          <p role="status" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-warn-soft-fg">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>Overlaps with {clashesWith.join(', ')}</span>
          </p>
        )}
      </div>

      {/* What you can do with it. Drag and drop has keyboard and touch equivalents here. */}
      <div className="col-span-2 flex flex-wrap items-center gap-1 sm:col-span-1 sm:justify-end">
        <button
          type="button"
          onClick={() => onNudge(activity, -1)}
          disabled={!canNudgeUp}
          aria-label={`Move ${activity.title} up`}
          title={timed ? 'Timed activities are ordered by their start time' : 'Move up'}
          className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onNudge(activity, 1)}
          disabled={!canNudgeDown}
          aria-label={`Move ${activity.title} down`}
          title={timed ? 'Timed activities are ordered by their start time' : 'Move down'}
          className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowDown className="size-4" aria-hidden />
        </button>
        <label className="sr-only" htmlFor={`move-${activity.id}`}>
          Move {activity.title} to another day
        </label>
        <select
          id={`move-${activity.id}`}
          value=""
          onChange={(event) => event.target.value && onMoveToDay(activity, event.target.value)}
          className="h-8 max-w-28 rounded-lg border border-line bg-surface px-1.5 text-xs text-fg-muted transition hover:border-line-strong"
        >
          <option value="">Move to…</option>
          {days
            .filter((d) => d.date !== currentDate)
            .map((d) => (
              <option key={d.date} value={d.date}>
                Day {d.day_number} · {formatDate(d.date)}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={() => onEdit(activity)}
          aria-label={`Edit ${activity.title}`}
          title="Edit"
          className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-3 hover:text-fg"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(activity)}
          aria-label={`Delete ${activity.title}`}
          title="Delete"
          className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </article>
  )
}
