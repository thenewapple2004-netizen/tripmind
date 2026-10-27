import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTripReport } from '@/hooks/useTripReport'

interface TripReportSectionProps {
  tripId: string
  tripTitle?: string
}

export function TripReportSection({ tripId, tripTitle }: TripReportSectionProps) {
  const {
    requestReport,
    isRequesting,
    requestError,
    status,
    statusData,
    statusError,
    isProcessing,
    isSuccess,
    isFailure,
    isDownloading,
    downloadError,
    downloadReport,
    resetReport,
  } = useTripReport(tripId)

  const result = statusData?.result
  const errorMsg =
    downloadError ||
    (statusError instanceof Error ? statusError.message : null) ||
    (requestError instanceof Error ? requestError.message : null) ||
    statusData?.error

  return (
    <section
      aria-labelledby="report-section-heading"
      className="overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
            <FileSpreadsheet className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="report-section-heading" className="text-base font-semibold text-fg">
              Trip Report & Export
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted sm:text-sm">
              Generate an asynchronous CSV report containing details, budget analysis, activities, and itemized expenses.
            </p>
          </div>
        </div>

        {/* Action Button: Trigger generation when idle */}
        {!isProcessing && !isSuccess && (
          <Button
            variant="primary"
            icon={<FileSpreadsheet className="size-4" aria-hidden />}
            loading={isRequesting}
            onClick={() => requestReport()}
            className="w-full sm:w-auto"
          >
            Generate Report
          </Button>
        )}
      </div>

      {/* Processing State: Polling worker status */}
      {isProcessing && (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 flex flex-col items-center justify-center rounded-xl border border-primary-line/30 bg-primary-soft/40 p-6 text-center"
        >
          <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden />
          <h3 className="mt-3 text-sm font-semibold text-fg">
            {status === 'STARTED'
              ? 'Worker Generating CSV Report...'
              : status === 'RETRY'
              ? 'Retrying Generation...'
              : 'Job Queued in Message Broker...'}
          </h3>
          <p className="mt-1 max-w-md text-xs text-fg-muted">
            {statusData?.message ||
              'Your request was accepted by FastAPI and is executing asynchronously in a Celery worker.'}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-fg-subtle">
            <span className="size-2 animate-ping rounded-full bg-primary" />
            <span>Polling job status every 1.5s</span>
          </div>
        </div>
      )}

      {/* Success State: Report ready for download */}
      {isSuccess && result && (
        <div className="mt-5 rounded-xl border border-line bg-surface-2/60 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-fg">
                  CSV Report Ready
                </h3>
                <p className="mt-0.5 text-xs text-fg-muted">
                  Generated on{' '}
                  <span className="font-medium text-fg">
                    {new Date(result.generated_at).toLocaleString()}
                  </span>
                  {result.file_size ? ` • ${(result.file_size / 1024).toFixed(1)} KB` : ''}
                </p>
                {result.row_counts && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-fg-subtle">
                    <span className="rounded-md bg-surface px-2 py-0.5 border border-line">
                      {result.row_counts.activities} activities
                    </span>
                    <span className="rounded-md bg-surface px-2 py-0.5 border border-line">
                      {result.row_counts.expenses} expenses
                    </span>
                    <span className="rounded-md bg-surface px-2 py-0.5 border border-line">
                      {result.row_counts.categories} categories
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="primary"
                icon={<Download className="size-4" aria-hidden />}
                loading={isDownloading}
                onClick={() => {
                  const suggestedFilename = tripTitle
                    ? `${tripTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_report.csv`
                    : undefined
                  downloadReport(suggestedFilename)
                }}
                className="w-full sm:w-auto"
              >
                Download CSV
              </Button>
              <Button
                variant="secondary"
                icon={<RefreshCw className="size-4" aria-hidden />}
                onClick={resetReport}
                className="w-full sm:w-auto"
                title="Generate a new report"
              >
                New Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Failure / Error State */}
      {(isFailure || errorMsg) && !isProcessing && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-danger-line/40 bg-danger-soft/30 p-4 text-xs text-danger"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-semibold">Report Generation Issue</p>
                <p className="mt-0.5 text-fg-muted">{errorMsg || 'Failed to complete report generation.'}</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="size-3.5" aria-hidden />}
              onClick={() => {
                resetReport()
                requestReport()
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
