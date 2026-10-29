import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Download, FileQuestion, LoaderCircle, Ticket, X } from 'lucide-react'
import { documentsApi } from '@/api/documents'
import { ApiError } from '@/api/errors'
import type { LinkedBooking, TripDocument } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Modal, SHEET } from '@/components/ui/Modal'
import { cn } from '@/components/ui/cn'
import { fileTypeLabel, isPreviewable, kindLabel } from '@/lib/documents'
import { formatBytes } from '@/lib/download'

type Doc = TripDocument & { bookings?: LinkedBooking[] }
type State = { phase: 'loading' } | { phase: 'ready'; url: string } | { phase: 'error'; message: string } | { phase: 'unsupported' }

/**
 * Shows a PDF or image without downloading it. The file is fetched with the owner's token (so there is no
 * public URL), held as a temporary in-memory object URL, and released the moment the preview closes.
 * Only PDF and raster images are ever rendered; anything else offers a download instead.
 */
function Content({ doc, onClose, onDownload, downloading }: { doc: Doc; onClose: () => void; onDownload: (doc: Doc) => void; downloading: boolean }) {
  const [state, setState] = useState<State>(isPreviewable(doc.content_type) ? { phase: 'loading' } : { phase: 'unsupported' })

  useEffect(() => {
    if (!isPreviewable(doc.content_type)) return
    const controller = new AbortController()
    let url: string | null = null
    documentsApi
      .download(doc.trip_id, doc.id)
      .then((blob) => {
        if (controller.signal.aborted) return
        // Re-type from the metadata the server verified, so the browser never decides the type itself.
        url = URL.createObjectURL(blob.slice(0, blob.size, doc.content_type))
        setState({ phase: 'ready', url })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: error instanceof ApiError ? error.message : 'We couldn’t load this file.' })
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc.id, doc.trip_id, doc.content_type])

  return (
    <>
      <header className="flex items-start gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight break-words">{doc.filename}</h2>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {kindLabel(doc.kind)} · {fileTypeLabel(doc.content_type)} · <span className="tabular-nums">{formatBytes(doc.size_bytes)}</span>
          </p>
          {doc.bookings && doc.bookings.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
              <Ticket className="size-3.5 text-fg-subtle" aria-hidden />
              {doc.bookings.map((b) => (
                <Link key={b.id} to={`/bookings?open=${b.id}`} onClick={onClose} className="font-medium text-primary-ink hover:underline">
                  {b.title}
                </Link>
              ))}
            </p>
          )}
        </div>
        <Button size="sm" variant="secondary" loading={downloading} onClick={() => onDownload(doc)} icon={<Download className="size-4" aria-hidden />}>
          <span className="hidden sm:inline">Download</span>
          <span className="sr-only sm:hidden">Download</span>
        </Button>
        <button type="button" onClick={onClose} aria-label="Close preview" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className={cn('flex min-h-0 flex-1 items-center justify-center bg-surface-2', state.phase === 'ready' && doc.content_type === 'application/pdf' && 'items-stretch')}>
        {state.phase === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-sm text-fg-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Loading preview…
          </p>
        )}
        {state.phase === 'ready' && doc.content_type === 'application/pdf' && (
          <iframe src={state.url} title={`Preview of ${doc.filename}`} referrerPolicy="no-referrer" className="h-full min-h-[60dvh] w-full border-0 bg-white" />
        )}
        {state.phase === 'ready' && doc.content_type !== 'application/pdf' && (
          <img src={state.url} alt={doc.filename} className="max-h-full max-w-full object-contain p-3" />
        )}
        {(state.phase === 'error' || state.phase === 'unsupported') && (
          <div role={state.phase === 'error' ? 'alert' : undefined} className="flex max-w-sm flex-col items-center gap-3 px-6 py-10 text-center">
            <FileQuestion className="size-8 text-fg-subtle" aria-hidden />
            <p className="text-sm text-fg-muted">
              {state.phase === 'error' ? state.message : 'This file type can’t be previewed here.'} You can still download it.
            </p>
            <Button variant="primary" loading={downloading} onClick={() => onDownload(doc)} icon={<Download className="size-4" aria-hidden />}>
              Download
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

export function PreviewDialog({ doc, onClose, onDownload, downloading }: { doc: Doc | null; onClose: () => void; onDownload: (doc: Doc) => void; downloading: boolean }) {
  return (
    <Modal open={doc !== null} onClose={onClose} label={doc ? `Preview of ${doc.filename}` : 'Preview'} className={cn(SHEET, 'sm:h-[90dvh] sm:max-w-4xl')}>
      {doc && <Content doc={doc} onClose={onClose} onDownload={onDownload} downloading={downloading} />}
    </Modal>
  )
}
