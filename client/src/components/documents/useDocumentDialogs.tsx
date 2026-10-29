import { useState, type ReactNode } from 'react'
import { documentsApi } from '@/api/documents'
import { ApiError } from '@/api/errors'
import type { LinkedBooking, TripDocument } from '@/api/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useDeleteDocument } from '@/hooks/useDocuments'
import { saveBlob } from '@/lib/download'
import { EditDialog, type EditMode } from './EditDialog'
import { PreviewDialog } from './PreviewDialog'

export type Doc = TripDocument & { bookings?: LinkedBooking[] }

export interface DocumentActions {
  view: (doc: Doc) => void
  download: (doc: Doc) => void
  rename: (doc: Doc) => void
  recategorise: (doc: Doc) => void
  askDelete: (doc: Doc) => void
  downloadingId: string | null
}

/** One place that owns the preview, the edit form, the delete confirmation and downloads, for every list of documents. */
export function useDocumentDialogs(): DocumentActions & { element: ReactNode } {
  const toast = useToast()
  const remove = useDeleteDocument()
  const [previewing, setPreviewing] = useState<Doc | null>(null)
  const [edit, setEdit] = useState<{ doc: Doc; mode: EditMode } | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const download = async (doc: Doc) => {
    setDownloadingId(doc.id)
    try {
      saveBlob(await documentsApi.download(doc.trip_id, doc.id), doc.filename)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The download failed. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync({ tripId: deleting.trip_id, id: deleting.id })
      toast.success(`“${deleting.filename}” was deleted.`)
      setDeleting(null)
    } catch {
      // Shown inside the dialog.
    }
  }

  const linked = deleting?.bookings?.length ?? 0
  return {
    view: setPreviewing,
    download,
    rename: (doc) => setEdit({ doc, mode: 'rename' }),
    recategorise: (doc) => setEdit({ doc, mode: 'category' }),
    askDelete: setDeleting,
    downloadingId,
    element: (
      <>
        <PreviewDialog doc={previewing} onClose={() => setPreviewing(null)} onDownload={download} downloading={downloadingId === previewing?.id} />
        <EditDialog edit={edit} onClose={() => setEdit(null)} />
        <ConfirmDialog
          open={deleting !== null}
          title="Delete this document?"
          description={
            deleting
              ? `“${deleting.filename}” will be permanently removed.${linked > 0 ? ` It will also be detached from ${linked === 1 ? 'the reservation' : `${linked} reservations`} it is linked to.` : ''} This can't be undone.`
              : ''
          }
          confirmLabel="Delete document"
          pending={remove.isPending}
          error={remove.error instanceof ApiError ? remove.error.message : remove.error ? 'Failed to delete the document. Please try again.' : null}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null)
            remove.reset()
          }}
        />
      </>
    ),
  }
}
