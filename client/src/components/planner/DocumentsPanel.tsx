import { useState } from 'react'
import { CircleAlert, Download, FileImage, FileText, ShieldCheck, Trash2 } from 'lucide-react'
import { documentsApi } from '@/api/documents'
import { ApiError } from '@/api/errors'
import type { DocumentKind, Trip, TripDocument } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { useToast } from '@/components/ui/Toast'
import { useDeleteDocument, useDocuments } from '@/hooks/useDocuments'
import { formatBytes, saveBlob } from '@/lib/download'
import { formatDate } from '@/lib/trips'
import { DOCUMENT_KINDS, DocumentUploader } from './DocumentUploader'

const kindLabel = (kind: DocumentKind) => DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? kind

/** One document line: type icon, name, details and download. Shared with the owner-wide vault. */
export function DocumentItem({
  doc,
  onDelete,
  subtitle,
}: {
  doc: TripDocument
  onDelete?: (doc: TripDocument) => void
  subtitle?: string
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const Icon = doc.content_type.startsWith('image/') ? FileImage : FileText

  const download = async () => {
    setBusy(true)
    try {
      saveBlob(await documentsApi.download(doc.trip_id, doc.id), doc.filename)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The download failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-surface-2">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{doc.filename}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
          <span className="rounded-full bg-surface-3 px-2 py-0.5 font-medium text-fg-muted">{kindLabel(doc.kind)}</span>
          <span className="tabular-nums">{formatBytes(doc.size_bytes)}</span>
          <span>{formatDate(doc.uploaded_at.slice(0, 10))}</span>
          {subtitle && <span className="truncate">{subtitle}</span>}
        </p>
      </div>
      <Button size="sm" variant="secondary" loading={busy} onClick={download} icon={<Download className="size-4" aria-hidden />} aria-label={`Download ${doc.filename}`}>
        <span className="hidden sm:inline">Download</span>
      </Button>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(doc)}
          aria-label={`Delete ${doc.filename}`}
          className="rounded-lg p-2 text-fg-subtle transition hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  )
}

export function DocumentsPanel({ trip }: { trip: Trip }) {
  const toast = useToast()
  const { data: documents = [], isPending, isError, refetch, isFetching } = useDocuments(trip.id)
  const remove = useDeleteDocument(trip.id)
  const [deleting, setDeleting] = useState<TripDocument | null>(null)

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`“${deleting.filename}” was deleted.`)
      setDeleting(null)
    } catch {
      // Shown inside the dialog.
    }
  }

  return (
    <section aria-label="Travel documents" className="space-y-5">
      <Card>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-fg">Travel documents</h2>
        <p className="mt-1 mb-4 flex items-start gap-2 text-sm text-fg-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
          Private to you. Files are checked on upload, stored with your account, and can only be opened while you’re signed in.
        </p>
        <DocumentUploader tripId={trip.id} />
      </Card>

      {isPending ? (
        <Skeleton className="h-32 rounded-3xl" />
      ) : isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your documents" description="Something went wrong while fetching this trip’s documents.">
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            Try again
          </Button>
        </StateCard>
      ) : documents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-fg-muted">
          No documents yet. Add your passport scan, tickets or booking confirmations so they’re ready when you need them.
        </div>
      ) : (
        <Card className="p-3">
          <ul>
            {documents.map((doc) => (
              <DocumentItem key={doc.id} doc={doc} onDelete={setDeleting} />
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this document?"
        description={deleting ? `“${deleting.filename}” will be permanently removed. This can't be undone.` : ''}
        confirmLabel="Delete document"
        pending={remove.isPending}
        error={remove.error instanceof ApiError ? remove.error.message : remove.error ? 'Failed to delete the document. Please try again.' : null}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null)
          remove.reset()
        }}
      />
    </section>
  )
}
