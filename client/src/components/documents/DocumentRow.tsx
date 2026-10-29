import { Link } from 'react-router'
import { Download, Eye, FileImage, FileText, Pencil, Tag, Ticket, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { fileTypeLabel, kindLabel } from '@/lib/documents'
import { formatBytes } from '@/lib/download'
import { formatDate } from '@/lib/trips'
import { RowMenu } from './RowMenu'
import type { Doc, DocumentActions } from './useDocumentDialogs'

/** One document: what it is, its details, any reservation it belongs to, and its actions. */
export function DocumentRow({ doc, actions }: { doc: Doc; actions: DocumentActions }) {
  const Icon = doc.content_type.startsWith('image/') ? FileImage : FileText
  return (
    <li className="flex items-start gap-3 px-3 py-3 transition-colors hover:bg-surface-2 sm:px-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => actions.view(doc)}
          aria-label={`View ${doc.filename}`}
          className="block max-w-full text-left text-sm font-medium break-words text-fg hover:text-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {doc.filename}
        </button>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-subtle">
          <span className="font-medium text-fg-muted">{kindLabel(doc.kind)}</span>
          <span aria-hidden>·</span>
          <span>{fileTypeLabel(doc.content_type)}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{formatBytes(doc.size_bytes)}</span>
          <span aria-hidden>·</span>
          <span>Added {formatDate(doc.uploaded_at.slice(0, 10))}</span>
        </p>
        {doc.bookings && doc.bookings.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
            <Ticket className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
            <span className="text-fg-subtle">Linked to</span>
            {doc.bookings.map((b) => (
              <Link key={b.id} to={`/bookings?open=${b.id}`} className="font-medium text-primary-ink hover:underline">
                {b.title}
              </Link>
            ))}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="secondary" onClick={() => actions.view(doc)} icon={<Eye className="size-4" aria-hidden />} aria-label={`Preview ${doc.filename}`}>
          <span className="hidden sm:inline">View</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={actions.downloadingId === doc.id}
          onClick={() => actions.download(doc)}
          icon={<Download className="size-4" aria-hidden />}
          aria-label={`Download ${doc.filename}`}
          className="hidden sm:inline-flex"
        />
        <RowMenu
          label={`More actions for ${doc.filename}`}
          actions={[
            { label: 'Download', icon: <Download className="size-4" />, onSelect: () => actions.download(doc) },
            { label: 'Rename', icon: <Pencil className="size-4" />, onSelect: () => actions.rename(doc) },
            { label: 'Change category', icon: <Tag className="size-4" />, onSelect: () => actions.recategorise(doc) },
            { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => actions.askDelete(doc), danger: true },
          ]}
        />
      </div>
    </li>
  )
}
