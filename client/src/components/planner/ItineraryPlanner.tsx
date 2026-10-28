import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarPlus, CircleAlert, Clock, Compass, GripVertical, ListChecks, TriangleAlert, Wallet } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { Activity, Trip } from '@/api/types'
import { ActivityDialog } from '@/components/activities/ActivityDialog'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { useToast } from '@/components/ui/Toast'
import { useDeleteActivity } from '@/hooks/useActivities'
import { useArrangeActivities, useItinerary } from '@/hooks/useItinerary'
import { computeMoveToDay, computeMoves, computeNudge, formatClock, formatDuration, isTimed, toMinutes } from '@/lib/itinerary'
import { formatCurrency, toISODate } from '@/lib/trips'
import { DayCard } from './DayCard'
import { TripCalendar } from './TripCalendar'

function Stat({ icon, label, value, helper, tone = 'default' }: { icon: React.ReactNode; label: string; value: string; helper: string; tone?: 'default' | 'warn' }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'warn' ? 'border-warn-soft-fg/40 bg-warn-soft/40' : 'border-line bg-surface'}`}>
      <div className="flex items-center justify-between text-xs font-medium text-fg-subtle">
        {label}
        <span className={tone === 'warn' ? 'text-warn-soft-fg' : 'text-primary-ink'}>{icon}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-fg tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-fg-muted">{helper}</p>
    </div>
  )
}

/**
 * Day-by-day planner for one trip: a calendar to jump around, a timeline of days, drag and drop
 * (or buttons) to rearrange, and clash detection from the server.
 */
export function ItineraryPlanner({ trip }: { trip: Trip }) {
  const toast = useToast()
  const { data: itinerary, isPending, isError, refetch, isFetching } = useItinerary(trip.id)
  const arrange = useArrangeActivities(trip.id)
  const deleteActivity = useDeleteActivity(trip.id)

  const [dialog, setDialog] = useState<{ activity: Activity | null; date?: string } | null>(null)
  const [deleting, setDeleting] = useState<Activity | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<{ date: string; index: number } | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  const today = toISODate(new Date())
  const days = useMemo(() => itinerary?.days ?? [], [itinerary])

  const conflictsByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of itinerary?.conflicts ?? []) map.set(c.activity_date, (map.get(c.activity_date) ?? 0) + 1)
    return map
  }, [itinerary])
  const conflictDates = useMemo(() => new Set(conflictsByDate.keys()), [conflictsByDate])

  const allActivities = useMemo(() => days.flatMap((d) => d.activities), [days])
  const byId = useMemo(() => new Map(allActivities.map((a) => [a.id, a])), [allActivities])

  const send = useCallback(
    (moves: ReturnType<typeof computeMoves>) => {
      if (!moves) return
      arrange.mutate(moves, {
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : 'We couldn’t move that activity. Your itinerary was left as it was.'),
      })
    },
    [arrange, toast],
  )

  const focusDay = (date: string) => {
    document.getElementById(`day-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlight(date)
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlight(null), 1800)
  }

  const endDrag = () => {
    setDragId(null)
    setOver(null)
  }

  /** The drop is resolved from the activity's *current* position, so a stale drag can't misplace it. */
  const dropOn = (date: string, index?: number) => {
    const id = dragId
    const slot = index ?? (over?.date === date ? over.index : days.find((d) => d.date === date)?.activities.length ?? 0)
    endDrag()
    if (!id) return
    const moves = computeMoves(days, id, date, slot)
    if (moves) send(moves)
    else if (isTimed(byId.get(id) ?? {})) toast.info('Timed activities are ordered by their start time. Edit the time to move it within the day.')
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteActivity.mutateAsync(deleting.id)
      toast.success(`“${deleting.title}” was deleted.`)
      setDeleting(null)
    } catch {
      // Shown inside the dialog via deleteActivity.error.
    }
  }

  if (isPending) {
    return (
      <div role="status" aria-label="Loading itinerary" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    )
  }

  if (isError || !itinerary) {
    return (
      <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load the itinerary" description="Something went wrong while fetching this trip’s plan.">
        <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
          Try again
        </Button>
      </StateCard>
    )
  }

  const totalCost = days.reduce((sum, d) => sum + d.total_cost, 0)
  const scheduledMinutes = days.reduce((sum, d) => sum + d.scheduled_minutes, 0)
  const budget = Number(trip.budget)
  const conflictCount = itinerary.conflicts.length

  return (
    <section aria-label="Itinerary planner" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-fg">Itinerary</h2>
          <p className="mt-1 text-sm text-fg-muted">Plan each day, set times, and drag activities between days.</p>
        </div>
        <Button variant="primary" icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => setDialog({ activity: null })}>
          Add activity
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<ListChecks className="size-4" aria-hidden />} label="Activities" value={String(itinerary.total_activities)} helper={itinerary.unscheduled_count > 0 ? `${itinerary.unscheduled_count} without a set time` : 'All have a time'} />
        <Stat icon={<Wallet className="size-4" aria-hidden />} label="Planned cost" value={formatCurrency(totalCost)} helper={budget > 0 ? `${Math.round((totalCost / budget) * 100)}% of ${formatCurrency(budget)} budget` : 'No budget set'} />
        <Stat icon={<Clock className="size-4" aria-hidden />} label="Time scheduled" value={scheduledMinutes > 0 ? formatDuration(scheduledMinutes) : '—'} helper={`Across ${days.length} ${days.length === 1 ? 'day' : 'days'}`} />
        <Stat
          icon={<TriangleAlert className="size-4" aria-hidden />}
          label="Scheduling clashes"
          value={conflictCount === 0 ? 'None' : String(conflictCount)}
          helper={conflictCount === 0 ? 'Nothing overlaps' : 'Overlapping activities'}
          tone={conflictCount > 0 ? 'warn' : 'default'}
        />
      </div>

      {conflictCount > 0 && (
        <div role="alert" className="rounded-2xl border border-warn-soft-fg/40 bg-warn-soft/50 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-warn-soft-fg">
            <TriangleAlert className="size-4" aria-hidden />
            {conflictCount === 1 ? '1 scheduling clash' : `${conflictCount} scheduling clashes`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {itinerary.conflicts.map((c) => {
              const [first, second] = c.activity_ids.map((id) => byId.get(id))
              if (!first || !second) return null
              return (
                <li key={c.activity_ids.join('-')} className="flex flex-wrap items-center gap-x-2 text-fg-muted">
                  <button type="button" onClick={() => focusDay(c.activity_date)} className="font-medium text-primary-ink hover:underline">
                    Day {days.find((d) => d.date === c.activity_date)?.day_number}
                  </button>
                  <span>
                    “{first.title}” ({formatClock(toMinutes(first.start_time!))}) overlaps “{second.title}” ({formatClock(toMinutes(second.start_time!))}) by {formatDuration(c.overlap_minutes)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-24">
          <TripCalendar
            days={days}
            conflictDates={conflictDates}
            today={today}
            dragging={dragId !== null}
            onSelectDay={focusDay}
            onDropOnDay={(date) => {
              const id = dragId
              endDrag()
              if (id) send(computeMoveToDay(days, id, date))
            }}
          />
          <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-xs text-fg-subtle">
            <GripVertical className="mt-px size-3.5 shrink-0" aria-hidden />
            Drag an activity onto a day, here or in the list. On touch screens, use “Move to…”.
          </p>
        </Card>

        <div className="min-w-0 space-y-4">
          {itinerary.total_activities === 0 && (
            <div className="flex items-center gap-4 rounded-3xl border border-dashed border-line-strong bg-surface p-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink">
                <Compass className="size-6" aria-hidden />
              </span>
              <p className="text-sm text-fg-muted">
                <span className="font-semibold text-fg">No activities yet.</span> Add tours, meals and reservations to a day below, then drag them into the order you like.
              </p>
            </div>
          )}

          {days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              days={days}
              itinerary={itinerary}
              today={today}
              highlighted={highlight === day.date}
              conflictCount={conflictsByDate.get(day.date) ?? 0}
              dragId={dragId}
              dropIndex={over?.date === day.date ? over.index : null}
              onAdd={(date) => setDialog({ activity: null, date })}
              onDragStart={setDragId}
              onDragEnd={endDrag}
              onDragOverDay={(date, index) => setOver((cur) => (cur?.date === date && cur.index === index ? cur : { date, index }))}
              onDragLeaveDay={() => setOver(null)}
              onDropOnDay={(date) => dropOn(date)}
              onEdit={(a) => setDialog({ activity: a })}
              onDelete={setDeleting}
              onNudge={(a, direction) => send(computeNudge(days, a.id, direction))}
              onMoveToDay={(a, date) => send(computeMoveToDay(days, a.id, date))}
            />
          ))}
        </div>
      </div>

      <ActivityDialog
        open={dialog !== null}
        trip={trip}
        activity={dialog?.activity ?? null}
        defaultDate={dialog?.date}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this activity?"
        description={deleting ? `“${deleting.title}” will be removed from this trip's itinerary.` : ''}
        confirmLabel="Delete activity"
        pending={deleteActivity.isPending}
        error={deleteActivity.error instanceof ApiError ? deleteActivity.error.message : deleteActivity.error ? 'Failed to delete activity. Please try again.' : null}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleting(null)
          deleteActivity.reset()
        }}
      />
    </section>
  )
}
