import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ArrowUpRight, Download, Eye, FileImage, FileText, Paperclip, Pencil, Trash2, TriangleAlert, X } from 'lucide-react'
import { documentsApi } from '@/api/documents'
import { ApiError } from '@/api/errors'
import type { Booking, BookingStatus, OwnerBooking } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { STATUS_LABEL, TYPE_LABEL, countdown, freeCancellationNote, nextStatuses, timingTone } from '@/lib/bookings'
import { formatBytes, saveBlob } from '@/lib/download'
import { PreviewDialog } from '@/components/documents/PreviewDialog'
import { Timing } from './meta'
import { TravelPass } from './TravelPass'

type AnyBooking = Booking | OwnerBooking

interface Props {
  booking: AnyBooking | null
  today: string
  onClose: () => void
  onEdit: (booking: AnyBooking) => void
  onDelete: (booking: AnyBooking) => void
  onStatusChange: (booking: AnyBooking, status: BookingStatus) => Promise<void>
}

const heading = 'text-sm font-semibold text-fg'

/**
 * The Digital Travel Pass in a side drawer: a right-hand panel on desktop, a full-screen view on
 * phones. A native modal <dialog>, so Esc closes it, focus is trapped and focus returns to
 * whatever opened it.
 */
export function BookingDetailsDrawer({ booking, today, onClose, onEdit, onDelete, onStatusChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const toast = useToast()
  const [changing, setChanging] = useState<BookingStatus | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<Booking['documents'][number] | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (booking && !dialog.open) dialog.showModal()
    else if (!booking && dialog.open) dialog.close()
  }, [booking])

  if (!booking) return <dialog ref={ref} />

  const note = freeCancellationNote(booking, today)
  const timing = countdown(booking, today)
  const tripTitle = 'trip_title' in booking ? booking.trip_title : null

  const changeStatus = async (status: BookingStatus) => {
    setChanging(status)
    try {
      await onStatusChange(booking, status)
    } finally {
      setChanging(null)
    }
  }

  const download = async (id: string, filename: string) => {
    setDownloading(id)
    try {
      saveBlob(await documentsApi.download(booking.trip_id, id), filename)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The download failed. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="animate-drawer-right fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-hidden border-l border-line bg-surface p-0 text-fg shadow-pop open:flex sm:w-[34rem] backdrop:bg-black/50"
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to bookings"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="line-clamp-2 text-base leading-snug font-semibold tracking-tight break-words" title={booking.title}>{booking.title}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
            <span>{TYPE_LABEL[booking.type]}</span>
            {timing && (
              <>
                <span aria-hidden>·</span>
                <Timing label={timing} tone={timingTone(booking, today)} />
              </>
            )}
          </p>
        </div>
        {tripTitle && (
          <Link
            to={`/trips/${booking.trip_id}?tab=bookings`}
            onClick={onClose}
            className="hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-primary-ink hover:bg-surface-2 sm:inline-flex"
          >
            Open trip
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg sm:flex"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5 sm:px-5">
        {tripTitle && (
          <p className="text-sm text-fg-muted">
            Part of{' '}
            <Link to={`/trips/${booking.trip_id}?tab=bookings`} onClick={onClose} className="font-medium text-primary-ink hover:underline">
              {tripTitle}
            </Link>
          </p>
        )}

        <TravelPass booking={booking} />

        {booking.outside_trip_dates && (
          <p className="flex items-start gap-2 border-l-2 border-warn-soft-fg/60 pl-3 text-sm text-fg-muted">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn-soft-fg" aria-hidden />
            This booking starts or ends outside the trip’s dates, which is normal for an early flight or a late checkout.
          </p>
        )}

        {(booking.cancellation_policy || note) && (
          <section aria-label="Cancellation" className="space-y-1.5">
            <h3 className={heading}>Cancellation</h3>
            {note && (
              <p className={cn('text-sm font-medium', note.tone === 'open' ? 'text-primary-ink' : note.tone === 'closing' ? 'text-warn-soft-fg' : 'text-fg-subtle')}>
                {note.text}
              </p>
            )}
            {booking.cancellation_policy && <p className="text-sm whitespace-pre-line text-fg-muted">{booking.cancellation_policy}</p>}
          </section>
        )}

        {booking.notes && (
          <section aria-label="Notes" className="space-y-1.5">
            <h3 className={heading}>Notes</h3>
            <p className="text-sm whitespace-pre-line text-fg-muted">{booking.notes}</p>
          </section>
        )}

        <section aria-label="Linked documents" className="space-y-2">
          <h3 className={cn(heading, 'flex items-center gap-1.5')}>
            <Paperclip className="size-4 text-fg-subtle" aria-hidden />
            Linked documents
          </h3>
          {booking.documents.length === 0 ? (
            <p className="text-sm text-fg-subtle">None linked. Edit the booking to attach a ticket, voucher or confirmation from this trip’s documents.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {booking.documents.map((doc) => {
                const Icon = doc.content_type.startsWith('image/') ? FileImage : FileText
                return (
                  <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
                    <Icon className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm font-medium break-all" title={doc.filename}>{doc.filename}</span>
                      <span className="text-xs text-fg-subtle tabular-nums">{formatBytes(doc.size_bytes)}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setPreviewing(doc)} icon={<Eye className="size-4" aria-hidden />} aria-label={`Preview ${doc.filename}`} />
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={downloading === doc.id}
                      onClick={() => download(doc.id, doc.filename)}
                      icon={<Download className="size-4" aria-hidden />}
                      aria-label={`Download ${doc.filename}`}
                    >
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {nextStatuses(booking.status).length > 0 && (
          <section aria-label="Change status" className="space-y-2">
            <h3 className={heading}>Status</h3>
            <div className="flex flex-wrap items-center gap-2">
              {nextStatuses(booking.status).map((status) => (
                <Button key={status} size="sm" variant="secondary" loading={changing === status} disabled={changing !== null} onClick={() => changeStatus(status)}>
                  {status === 'pending' ? 'Reopen as pending' : `Mark ${STATUS_LABEL[status].toLowerCase()}`}
                </Button>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-line bg-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
        {tripTitle ? (
          <Link
            to={`/trips/${booking.trip_id}?tab=bookings`}
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline sm:hidden"
          >
            Open trip
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="danger-outline" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => onDelete(booking)}>
            Delete
          </Button>
          <Button size="sm" variant="primary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => onEdit(booking)}>
            Edit
          </Button>
        </div>
      </footer>
      <PreviewDialog
        doc={previewing ? { ...previewing, trip_id: booking.trip_id } : null}
        onClose={() => setPreviewing(null)}
        onDownload={(d) => download(d.id, d.filename)}
        downloading={downloading === previewing?.id}
      />
    </dialog>
  )
}
