import { Link } from 'react-router'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import type { DocumentGroup as Group } from '@/lib/documents'
import { formatBytes } from '@/lib/download'
import { DocumentRow } from './DocumentRow'
import type { DocumentActions } from './useDocumentDialogs'

/** A trip's documents as a collapsible section. */
export function DocumentGroup({ group, open, onToggle, actions }: { group: Group; open: boolean; onToggle: () => void; actions: DocumentActions }) {
  const headingId = `docs-${group.tripId}-heading`
  const panelId = `docs-${group.tripId}-panel`
  const n = group.documents.length
  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-4"
        >
          <ChevronRight className={cn('size-4 shrink-0 text-fg-subtle transition-transform', open && 'rotate-90')} aria-hidden />
          <span className="min-w-0 flex-1">
            <span id={headingId} className="line-clamp-2 block text-sm font-semibold break-words text-fg">{group.tripTitle}</span>
            <span className="text-xs text-fg-subtle tabular-nums">
              {n} {n === 1 ? 'document' : 'documents'} · {formatBytes(group.totalBytes)}
            </span>
          </span>
        </button>
        <Link
          to={`/trips/${group.tripId}?tab=documents`}
          aria-label={`Open trip: ${group.tripTitle}`}
          className="flex shrink-0 items-center gap-1 border-l border-line px-3 text-xs font-medium text-primary-ink hover:bg-surface-2 sm:px-4"
        >
          <span className="hidden sm:inline">Open trip</span>
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div id={panelId} role="region" aria-labelledby={headingId} hidden={!open} className="border-t border-line">
        {open && (
          <ul className="divide-y divide-line">
            {group.documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} actions={actions} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
