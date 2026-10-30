import { CalendarCheck, CalendarClock, CircleAlert, Plus } from 'lucide-react'
import type { FollowUp, FollowUpView } from '@/api/crmTypes'
import { FollowUpRow } from '@/components/crm/FollowUpRow'
import { oneOf, useFilterParams } from '@/components/crm/useFilterParams'
import { useWorkspace } from '@/components/crm/Workspace'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { cn } from '@/components/ui/cn'
import { useFollowUps, useFollowUpSummary } from '@/hooks/useCrm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToday } from '@/hooks/useToday'
import { dueLabel } from '@/lib/crm'
import { formatLongDate } from '@/lib/trips'

type View = Extract<FollowUpView, 'today' | 'upcoming' | 'overdue' | 'completed'>
const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
]

/** Follow-ups under a heading per day, in the order the server sent them. */
function byDay(items: FollowUp[]): Array<{ date: string; items: FollowUp[] }> {
  const groups: Array<{ date: string; items: FollowUp[] }> = []
  for (const item of items) {
    const last = groups.at(-1)
    if (last && last.date === item.due_date) last.items.push(item)
    else groups.push({ date: item.due_date, items: [item] })
  }
  return groups
}

export function FollowUpsTab() {
  useDocumentTitle('Follow-ups · Customers')
  const workspace = useWorkspace()
  const today = useToday()
  const { params, set } = useFilterParams()
  const view = (oneOf(params.get('view'), VIEWS.map((v) => v.id)) ?? 'today') as View
  const page = Math.max(1, Number(params.get('page')) || 1)

  const summary = useFollowUpSummary()
  const list = useFollowUps({ view, today, page, page_size: 50 })
  const counts: Partial<Record<View, number>> = summary.data
    ? { today: summary.data.today, upcoming: summary.data.upcoming, overdue: summary.data.overdue }
    : {}

  const items = list.data?.items ?? []
  const groups = view === 'completed' ? [{ date: '', items }] : byDay(items)

  const empty: Record<View, { title: string; description: string }> = {
    today: {
      title: 'Nothing due today',
      description:
        (summary.data?.overdue ?? 0) > 0
          ? `You have ${summary.data?.overdue} overdue. Everything else is scheduled for later.`
          : 'No follow-ups are due today. Schedule one from a customer or an inquiry so nobody is forgotten.',
    },
    upcoming: { title: 'Nothing scheduled ahead', description: 'Follow-ups you schedule for later days appear here, soonest first.' },
    overdue: { title: 'Nothing overdue', description: 'Every follow-up that was due has been done. Well kept.' },
    completed: { title: 'Nothing completed yet', description: 'Follow-ups you tick off are kept here as a record.' },
  }

  return (
    <section aria-label="Follow-ups" className="space-y-4">
      <div role="group" aria-label="Follow-up view" className="flex gap-1 overflow-x-auto">
        {VIEWS.map((v) => {
          const selected = v.id === view
          const count = counts[v.id]
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={selected}
              onClick={() => set('view', v.id, 'today')}
              className={cn(
                'flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors',
                selected ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {v.label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    'rounded px-1.5 py-px text-xs font-semibold tabular-nums',
                    v.id === 'overdue' ? 'bg-danger-soft text-danger-soft-fg' : 'bg-surface-3 text-fg-muted',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {list.isPending ? (
        <div role="status" aria-label="Loading follow-ups" className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : list.isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your follow-ups" description="Something went wrong while fetching them. Your records are safe.">
          <Button onClick={() => list.refetch()} loading={list.isFetching}>Try again</Button>
        </StateCard>
      ) : items.length === 0 ? (
        <StateCard icon={view === 'completed' ? CalendarCheck : CalendarClock} title={empty[view].title} description={empty[view].description}>
          {view === 'today' && (summary.data?.overdue ?? 0) > 0 && (
            <Button onClick={() => set('view', 'overdue', 'today')}>See overdue</Button>
          )}
          {view !== 'completed' && (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => workspace.newFollowUp()}>New follow-up</Button>
          )}
        </StateCard>
      ) : (
        <div className={cn('space-y-5', list.isFetching && 'opacity-70 transition-opacity')}>
          {groups.map((group) => (
            <div key={group.date || 'all'}>
              {group.date && (
                <h2 className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-fg">
                  {formatLongDate(group.date)}
                  <span className={cn('text-xs font-normal', view === 'overdue' ? 'text-danger' : 'text-fg-subtle')}>{dueLabel(group.date, today)}</span>
                </h2>
              )}
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-3.5">
                {group.items.map((f) => (
                  <FollowUpRow key={f.id} followUp={f} today={today} />
                ))}
              </ul>
            </div>
          ))}
          <Pagination label="Follow-up pages" page={list.data?.page ?? 1} totalPages={list.data?.total_pages ?? 1} busy={list.isFetching} onChange={(p) => set('page', String(p), '1')} />
        </div>
      )}
    </section>
  )
}
