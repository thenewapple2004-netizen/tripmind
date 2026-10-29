import { useMemo, useRef, useState, type DragEvent } from 'react'
import { CircleAlert, CircleCheck, FileText, LoaderCircle, Upload, X } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { DocumentKind, Trip } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Modal, SHEET } from '@/components/ui/Modal'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useUploadDocument } from '@/hooks/useDocuments'
import { ACCEPTED_TYPES, DOCUMENT_KINDS, validateDocument } from '@/lib/documents'
import { formatBytes } from '@/lib/download'
import { formatDateRange, sortTrips } from '@/lib/trips'

type Status = 'ready' | 'uploading' | 'done' | 'failed'
interface Entry {
  id: string
  file: File
  /** Why this file can't be sent (checked in the browser), if it can't. */
  invalid: string | null
  status: Status
  /** The server's reason, when an upload failed. */
  failure?: string
}

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`

function EntryIcon({ entry }: { entry: Entry }) {
  if (entry.status === 'uploading') return <LoaderCircle className="size-4 animate-spin text-primary-ink" aria-hidden />
  if (entry.status === 'done') return <CircleCheck className="size-4 text-success-soft-fg" aria-hidden />
  if (entry.invalid || entry.status === 'failed') return <CircleAlert className="size-4 text-danger" aria-hidden />
  return <FileText className="size-4 text-fg-subtle" aria-hidden />
}

const STATUS_TEXT: Record<Status, string> = { ready: 'Ready', uploading: 'Uploading…', done: 'Uploaded', failed: 'Failed' }

function Content({ trips, defaultTripId, lockTrip, onClose }: { trips: Trip[]; defaultTripId?: string; lockTrip?: boolean; onClose: () => void }) {
  const toast = useToast()
  const upload = useUploadDocument()
  const inputRef = useRef<HTMLInputElement>(null)
  const ordered = useMemo(() => sortTrips(trips, 'upcoming'), [trips])
  const [tripId, setTripId] = useState(defaultTripId && trips.some((t) => t.id === defaultTripId) ? defaultTripId : (ordered[0]?.id ?? ''))
  const [kind, setKind] = useState<DocumentKind>('other')
  const [entries, setEntries] = useState<Entry[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const patch = (id: string, change: Partial<Entry>) => setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...change } : e)))
  const sendable = entries.filter((e) => !e.invalid && e.status !== 'done')

  const add = (files: FileList | File[]) => {
    // Copy now: the input is cleared right after this, which empties a live FileList.
    const picked = Array.from(files)
    setEntries((list) => {
      const known = new Set(list.map((e) => fileKey(e.file)))
      const fresh = picked
        .filter((f) => !known.has(fileKey(f)))
        .map((file): Entry => ({ id: crypto.randomUUID(), file, invalid: validateDocument(file), status: 'ready' }))
      return [...list, ...fresh]
    })
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (!busy) add(event.dataTransfer.files)
  }

  const send = async () => {
    setBusy(true)
    let ok = 0
    let failed = 0
    for (const entry of sendable) {
      patch(entry.id, { status: 'uploading', failure: undefined })
      try {
        await upload.mutateAsync({ tripId, file: entry.file, kind })
        patch(entry.id, { status: 'done' })
        ok += 1
      } catch (error) {
        patch(entry.id, { status: 'failed', failure: error instanceof ApiError ? error.message : 'The upload failed. Please try again.' })
        failed += 1
      }
    }
    setBusy(false)
    if (ok > 0) toast.success(ok === 1 ? 'Document uploaded.' : `${ok} documents uploaded.`)
    if (failed === 0 && ok > 0) onClose()
  }

  const uploaded = entries.filter((e) => e.status === 'done').length
  const queued = entries.filter((e) => !e.invalid).length

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight">Upload documents</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex size-9 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-50">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-fg">Trip</span>
            <select value={tripId} onChange={(e) => setTripId(e.target.value)} disabled={busy || lockTrip} className={inputStyles}>
              {ordered.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {formatDateRange(t.start_date, t.end_date)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-fg">Category</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} disabled={busy} className={inputStyles}>
              {DOCUMENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn('flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center transition-colors', dragging ? 'border-primary bg-primary-soft/40' : 'border-line-strong bg-surface-2/50')}
        >
          <Upload className="size-6 text-fg-subtle" aria-hidden />
          <p className="text-sm text-fg">
            Drop files here, or{' '}
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="font-semibold text-primary-ink underline-offset-2 hover:underline disabled:opacity-60">
              choose files
            </button>
          </p>
          <p className="text-xs text-fg-subtle">PDF, PNG, JPEG or WebP · up to 5 MB each</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose documents to upload"
            onChange={(e) => {
              if (e.target.files) add(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {entries.length > 0 && (
          <ul aria-label="Files to upload" className="divide-y divide-line rounded-lg border border-line">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                <span className="mt-0.5 shrink-0"><EntryIcon entry={e} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-all text-fg">{e.file.name}</span>
                  <span className="text-xs text-fg-subtle tabular-nums">{formatBytes(e.file.size)}</span>
                  {(e.invalid || e.failure) && <span role="alert" className="mt-0.5 block text-xs text-danger">{e.invalid ?? e.failure}</span>}
                </span>
                <span className={cn('shrink-0 text-xs', e.status === 'done' ? 'text-success-soft-fg' : e.status === 'failed' || e.invalid ? 'text-danger' : 'text-fg-subtle')}>
                  {e.invalid ? 'Not sent' : STATUS_TEXT[e.status]}
                </span>
                {!busy && e.status !== 'uploading' && (
                  <button type="button" onClick={() => setEntries((list) => list.filter((x) => x.id !== e.id))} aria-label={`Remove ${e.file.name}`} className="-my-1 flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg">
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p role="status" className="sr-only">{busy ? `Uploading, ${uploaded} of ${queued} done` : ''}</p>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
        <p className="text-xs text-fg-subtle tabular-nums" aria-hidden>
          {busy ? `${uploaded} of ${queued} uploaded` : entries.length > 0 ? `${sendable.length} ready to upload` : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{uploaded > 0 && sendable.length === 0 ? 'Done' : 'Cancel'}</Button>
          <Button variant="primary" onClick={send} loading={busy} disabled={sendable.length === 0 || !tripId} icon={<Upload className="size-4" aria-hidden />}>
            {sendable.length > 1 ? `Upload ${sendable.length} files` : 'Upload'}
          </Button>
        </div>
      </footer>
    </>
  )
}

/** Upload one or many documents to a chosen trip. Files are checked here first, then sent one at a time with a status each. */
export function UploadDialog({ open, trips, defaultTripId, lockTrip, onClose }: { open: boolean; trips: Trip[]; defaultTripId?: string; lockTrip?: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Upload documents" className={cn(SHEET, 'sm:max-w-xl')}>
      <Content trips={trips} defaultTripId={defaultTripId} lockTrip={lockTrip} onClose={onClose} />
    </Modal>
  )
}
