import { useState } from 'react'
import { Link } from 'react-router'
import { Activity, FileText, Receipt } from 'lucide-react'
import type { OwnerRecentActivity, OwnerRecentExpense, OwnerReportHistoryItem } from '@/api/ownerTypes'
import { Card, CardHeader, EmptyNote } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { categoryColor } from '@/lib/owner'
import { formatCurrency, formatDate } from '@/lib/trips'
import { ReportDownloadButton } from './ReportDownloadButton'

type Tab = 'activities' | 'expenses' | 'reports'
const isoDay = (value: string) => value.slice(0, 10)

const rowClass = 'flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-surface-2'

export function RecentTabs({
  activities,
  expenses,
  reports,
}: {
  activities: OwnerRecentActivity[]
  expenses: OwnerRecentExpense[]
  reports: OwnerReportHistoryItem[]
}) {
  const [tab, setTab] = useState<Tab>('activities')
  const tabs: Array<[Tab, string, number]> = [
    ['activities', 'Activities', activities.length],
    ['expenses', 'Expenses', expenses.length],
    ['reports', 'Reports', reports.length],
  ]
  return (
    <Card>
      <CardHeader
        title="Recent"
        description="Latest changes across your trips"
        action={
          <div role="tablist" aria-label="Recent items" className="flex rounded-full border border-line bg-surface-2 p-1">
            {tabs.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  'h-8 rounded-full px-3 text-xs font-semibold transition',
                  tab === key ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                {label}
                <span className="ml-1.5 opacity-70 tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        }
      />

      <div role="tabpanel">
        {tab === 'activities' &&
          (activities.length === 0 ? (
            <EmptyNote icon={<Activity className="size-6" aria-hidden />}>
              No activities yet. Add some from a trip's page.
            </EmptyNote>
          ) : (
            <ul className="grid gap-x-4 @2xl:grid-cols-2">
              {activities.map((a) => (
                <li key={a.id}>
                  <Link to={`/trips/${a.trip_id}?tab=itinerary`} className={rowClass}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                      <Activity className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{a.title}</span>
                      <span className="block truncate text-xs text-fg-subtle">
                        {a.trip_title} · {formatDate(isoDay(a.activity_date))}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(a.cost)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'expenses' &&
          (expenses.length === 0 ? (
            <EmptyNote icon={<Receipt className="size-6" aria-hidden />}>No expenses yet. Log one from a trip's page.</EmptyNote>
          ) : (
            <ul className="grid gap-x-4 @2xl:grid-cols-2">
              {expenses.map((e) => (
                <li key={e.id}>
                  <Link to={`/trips/${e.trip_id}`} className={rowClass}>
                    <span
                      aria-hidden
                      className="size-9 shrink-0 rounded-xl"
                      style={{ background: `${categoryColor(e.category)}26`, boxShadow: `inset 0 0 0 1.5px ${categoryColor(e.category)}66` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{e.title}</span>
                      <span className="block truncate text-xs text-fg-subtle">
                        {e.category} · {e.trip_title} · {formatDate(isoDay(e.expense_date))}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(e.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'reports' &&
          (reports.length === 0 ? (
            <EmptyNote icon={<FileText className="size-6" aria-hidden />}>
              No reports yet. Generate a CSV report from the{' '}
              <Link to="/reports" className="text-primary-ink hover:underline">
                Reports page
              </Link>
              .
            </EmptyNote>
          ) : (
            <ul className="grid gap-x-4 @2xl:grid-cols-2">
              {reports.map((r) => (
                <li key={r.task_id} className={rowClass}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info-soft-fg">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{r.trip_title}</span>
                    <span className="block truncate text-xs text-fg-subtle">
                      {r.filename} · {formatDate(isoDay(r.generated_at))}
                    </span>
                  </span>
                  <ReportDownloadButton tripId={r.trip_id} taskId={r.task_id} filename={r.filename} />
                </li>
              ))}
            </ul>
          ))}
      </div>
    </Card>
  )
}
