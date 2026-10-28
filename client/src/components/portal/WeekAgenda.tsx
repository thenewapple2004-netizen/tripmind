import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarX2, CalendarDays, MapPin } from 'lucide-react'
import type { OwnerRecentActivity } from '@/api/ownerTypes'
import { Card, CardHeader, EmptyNote } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { formatCurrency, toISODate } from '@/lib/trips'

const isoDay = (value: string) => value.slice(0, 10)

/** Seven-day strip with the activities scheduled on the chosen day. */
export function WeekAgenda({
  activities,
  loading,
  error,
}: {
  activities: OwnerRecentActivity[]
  loading: boolean
  error: boolean
}) {
  const days = useMemo(() => {
    const start = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      return { iso: toISODate(d), date: d }
    })
  }, [])

  const byDay = useMemo(() => {
    const map = new Map<string, OwnerRecentActivity[]>()
    for (const a of activities) {
      const key = isoDay(a.activity_date)
      map.set(key, [...(map.get(key) ?? []), a])
    }
    return map
  }, [activities])

  const [picked, setPicked] = useState<string | null>(null)
  const selected = picked ?? days.find((d) => byDay.has(d.iso))?.iso ?? days[0].iso
  const items = byDay.get(selected) ?? []

  return (
    <Card className="h-full">
      <CardHeader
        title="Upcoming activities"
        description="The next 7 days across all your trips"
        icon={<CalendarDays className="size-4" aria-hidden />}
        action={
          <Link to="/itinerary" className="text-xs font-medium text-primary-ink hover:underline">
            View itinerary
          </Link>
        }
      />

      <div role="tablist" aria-label="Next seven days" className="grid grid-cols-7 gap-1 rounded-lg bg-surface-2 p-1.5">
        {days.map(({ iso, date }) => {
          const active = iso === selected
          return (
            <button
              key={iso}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(iso)}
              aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${
                byDay.has(iso) ? `, ${byDay.get(iso)!.length} activities` : ''
              }`}
              className={cn(
                'relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition',
                active ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
              )}
            >
              <span className="text-[9px] font-semibold uppercase">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="text-sm font-bold tabular-nums">{date.getDate()}</span>
              <span
                aria-hidden
                className={cn('size-1 rounded-full', byDay.has(iso) ? (active ? 'bg-primary-fg' : 'bg-primary') : 'bg-transparent')}
              />
            </button>
          )
        })}
      </div>

      <div className="mt-4 min-h-32">
        {loading ? (
          <div role="status" aria-label="Loading activities" className="grid gap-2 @lg:grid-cols-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : error ? (
          <EmptyNote icon={<CalendarX2 className="size-6" aria-hidden />}>We couldn't load your activities.</EmptyNote>
        ) : items.length === 0 ? (
          <EmptyNote icon={<CalendarX2 className="size-6" aria-hidden />}>Nothing planned for this day.</EmptyNote>
        ) : (
          <ul className="grid gap-2 @lg:grid-cols-2">
            {items.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link
                  to={`/trips/${a.trip_id}?tab=itinerary`}
                  className="flex h-full items-center gap-3 rounded-lg border border-line bg-surface-2 p-3 transition hover:border-primary/40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{a.title}</span>
                    <span className="block truncate text-xs text-fg-subtle">{a.location || a.trip_title}</span>
                  </span>
                  {a.cost > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-fg-muted tabular-nums">{formatCurrency(a.cost)}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {items.length > 4 && (
          <p className="mt-2 text-xs text-fg-subtle">
            +{items.length - 4} more on this day —{' '}
            <Link to="/itinerary" className="text-primary-ink hover:underline">
              see all
            </Link>
          </p>
        )}
      </div>
    </Card>
  )
}
