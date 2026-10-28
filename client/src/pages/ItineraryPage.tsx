import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarX2, CircleAlert, MapPin } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QuickAddButton } from '@/components/portal/QuickAdd'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { cn } from '@/components/ui/cn'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOwnerActivities } from '@/hooks/useOwnerDashboard'
import type { OwnerRecentActivity } from '@/api/ownerTypes'
import { formatClock, formatDuration, toMinutes } from '@/lib/itinerary'
import { formatCurrency, formatLongDate, parseISODate, toISODate } from '@/lib/trips'

const PAGE_SIZE = 12
const isoDay = (value: string) => value.slice(0, 10)

function DayGroup({ iso, items }: { iso: string; items: OwnerRecentActivity[] }) {
  const today = toISODate(new Date())
  const date = parseISODate(iso)
  const total = items.reduce((sum, a) => sum + a.cost, 0)
  const tag = iso === today ? 'Today' : iso > today ? 'Upcoming' : 'Past'
  return (
    <li className="grid gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
      <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
        <span
          className={cn(
            'flex size-14 flex-col items-center justify-center rounded-lg',
            iso >= today ? 'bg-primary text-primary-fg' : 'bg-surface-3 text-fg-muted',
          )}
        >
          <span className="text-[10px] leading-none font-bold uppercase">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
          <span className="font-display text-xl leading-tight font-semibold tabular-nums">{date.getDate()}</span>
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{tag}</span>
      </div>

      <Card className="p-2">
        <p className="px-3 pt-2 pb-1 text-xs text-fg-subtle">
          {formatLongDate(iso)}
          {total > 0 && <span className="ml-2 font-semibold text-fg-muted tabular-nums">· {formatCurrency(total)} planned</span>}
        </p>
        <ul>
          {items.map((a) => (
            <li key={a.id}>
              <Link to={`/trips/${a.trip_id}?tab=itinerary`} className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-surface-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{a.title}</span>
                  <span className="block truncate text-xs text-fg-subtle">
                    {a.start_time ? `${formatClock(toMinutes(a.start_time))}${a.duration_minutes ? ` (${formatDuration(a.duration_minutes)})` : ''} · ` : ''}
                    {a.location ? `${a.location} · ` : ''}
                    {a.trip_title}
                  </span>
                </span>
                {a.cost > 0 && <span className="shrink-0 text-sm font-semibold text-fg tabular-nums">{formatCurrency(a.cost)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </li>
  )
}

export function ItineraryPage() {
  useDocumentTitle('Itinerary')
  const [page, setPage] = useState(1)
  const { data, isPending, isError, refetch, isFetching } = useOwnerActivities(page, PAGE_SIZE)

  const groups = useMemo(() => {
    const map = new Map<string, OwnerRecentActivity[]>()
    for (const a of data?.items ?? []) {
      const key = isoDay(a.activity_date)
      map.set(key, [...(map.get(key) ?? []), a])
    }
    return [...map.entries()]
  }, [data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Itinerary"
        description="Every activity across all your trips, newest dates first. Open a trip to edit or remove activities."
        actions={<QuickAddButton kind="activity" variant="primary" />}
      />

      {isPending ? (
        <div role="status" aria-label="Loading itinerary" className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn't load your itinerary" description="Something went wrong while fetching your activities.">
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            Try again
          </Button>
        </StateCard>
      ) : groups.length === 0 ? (
        <StateCard
          icon={CalendarX2}
          title="No activities yet"
          description="Activities you add to a trip show up here, grouped by day."
        >
          <QuickAddButton kind="activity" variant="primary" />
        </StateCard>
      ) : (
        <>
          <ol className="space-y-5">
            {groups.map(([iso, items]) => (
              <DayGroup key={iso} iso={iso} items={items} />
            ))}
          </ol>
          <Pagination
            label="Itinerary pages"
            page={page}
            totalPages={data?.total_pages ?? 1}
            busy={isFetching}
            onChange={(p) => {
              setPage(p)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </>
      )}
    </div>
  )
}
