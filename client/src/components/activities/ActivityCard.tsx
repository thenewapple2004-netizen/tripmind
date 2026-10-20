import { Calendar, MapPin, Pencil, Trash2 } from 'lucide-react'
import type { Activity } from '@/api/types'
import { formatCurrency, formatLongDate } from '@/lib/trips'

interface ActivityCardProps {
  activity: Activity
  onEdit: (activity: Activity) => void
  onDelete: (activity: Activity) => void
}

export function ActivityCard({ activity, onEdit, onDelete }: ActivityCardProps) {
  const isFree = Number(activity.cost) === 0

  return (
    <article className="group relative rounded-xl border border-line bg-surface p-4 shadow-sm transition-all hover:border-line-strong hover:shadow-card sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">
              <Calendar className="size-3" aria-hidden />
              {formatLongDate(activity.activity_date)}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-semibold ${
                isFree
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-primary-soft text-primary-soft-fg'
              }`}
            >
              {isFree ? 'Free' : formatCurrency(activity.cost)}
            </span>
          </div>

          <h3 className="text-base font-semibold text-fg tracking-tight break-words">
            {activity.title}
          </h3>

          {activity.location && (
            <p className="flex items-center gap-1.5 text-xs text-fg-muted">
              <MapPin className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
              <span className="truncate">{activity.location}</span>
            </p>
          )}

          {activity.description && (
            <p className="mt-2 text-sm text-fg-muted whitespace-pre-line break-words bg-surface-2/40 p-2.5 rounded-lg border border-line/60">
              {activity.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 self-end sm:self-start sm:opacity-80 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(activity)}
            aria-label={`Edit ${activity.title}`}
            title="Edit activity"
            className="rounded-lg p-2 text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors focus:outline-none"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDelete(activity)}
            aria-label={`Delete ${activity.title}`}
            title="Delete activity"
            className="rounded-lg p-2 text-fg-subtle hover:bg-danger-soft hover:text-danger transition-colors focus:outline-none"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  )
}
