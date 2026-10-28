import { useState } from 'react'
import { Link } from 'react-router'
import { CircleAlert, FileText, Luggage, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ReportDownloadButton } from '@/components/portal/ReportDownloadButton'
import { TripReportSection } from '@/components/trips/TripReportSection'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader, EmptyNote } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { inputStyles } from '@/components/ui/TextField'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOwnerReports } from '@/hooks/useOwnerDashboard'
import { useTrips } from '@/hooks/useTrips'
import { formatDate } from '@/lib/trips'

export function ReportsPage() {
  useDocumentTitle('Reports')
  const trips = useTrips()
  const reports = useOwnerReports()
  const [tripId, setTripId] = useState('')

  const list = trips.data ?? []
  const selected = list.find((t) => t.id === tripId) ?? list[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate a CSV report for any trip and download everything you've created before."
      />

      {trips.isPending ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : trips.isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn't load your trips" description="We need your trips to generate reports.">
          <Button variant="secondary" onClick={() => trips.refetch()} loading={trips.isFetching}>
            Try again
          </Button>
        </StateCard>
      ) : !selected ? (
        <StateCard icon={Luggage} title="No trips to report on" description="Create a trip first; reports summarise a trip's activities, expenses and budget.">
          <ButtonLink to="/trips/new" variant="primary">
            Plan a trip
          </ButtonLink>
        </StateCard>
      ) : (
        <section aria-label="Generate a report" className="space-y-3">
          <label className="block max-w-md">
            <span className="mb-1.5 block text-sm font-medium text-fg">Trip</span>
            <select value={selected.id} onChange={(e) => setTripId(e.target.value)} className={inputStyles}>
              {list.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} — {t.destination}
                </option>
              ))}
            </select>
          </label>
          <TripReportSection key={selected.id} tripId={selected.id} tripTitle={selected.title} />
        </section>
      )}

      <Card>
        <CardHeader
          title="Report history"
          description="Reports generated from any of your trips"
          icon={<FileText className="size-4" aria-hidden />}
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => reports.refetch()}
              loading={reports.isFetching}
              icon={<RefreshCw className="size-3.5" aria-hidden />}
            >
              Refresh
            </Button>
          }
        />
        {reports.isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : reports.isError ? (
          <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger-soft-fg">
            We couldn't load your report history.
          </p>
        ) : reports.data.length === 0 ? (
          <EmptyNote icon={<FileText className="size-6" aria-hidden />}>No reports yet. Generate your first one above.</EmptyNote>
        ) : (
          <ul className="divide-y divide-line">
            {reports.data.map((r) => (
              <li key={r.task_id} className="flex items-center gap-3 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info-soft-fg">
                  <FileText className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <Link to={`/trips/${r.trip_id}`} className="block truncate text-sm font-semibold text-fg hover:text-primary-ink">
                    {r.trip_title}
                  </Link>
                  <span className="block truncate font-mono text-xs text-fg-subtle">{r.filename}</span>
                  <span className="block text-xs text-fg-subtle">
                    {formatDate(r.generated_at.slice(0, 10))} · {(r.file_size / 1024).toFixed(1)} KB
                  </span>
                </span>
                <ReportDownloadButton tripId={r.trip_id} taskId={r.task_id} filename={r.filename} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
