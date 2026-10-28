import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Download, FileImage, FileText, Paperclip, Pencil, Trash2, TriangleAlert, X } from 'lucide-react'
import { documentsApi } from '@/api/documents'
import { ApiError } from '@/api/errors'
import type { Booking, BookingStatus, OwnerBooking } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import {
  CABIN_CLASSES, ENDPOINT_LABELS, STATUS_LABEL, TRANSPORT_MODES, TYPE_LABEL, countdown, formatBookingWhen,
  freeCancellationNote, nextStatuses, shortDate,
} from '@/lib/bookings'
import { formatClock, toMinutes } from '@/lib/itinerary'
import { saveBlob, formatBytes } from '@/lib/download'
import { formatMoneyIn } from '@/lib/money'
import { CopyButton } from './CopyButton'
import { BookingStatusBadge, TypeTile } from './meta'

type AnyBooking = Booking | OwnerBooking

const DETAIL_LABELS: Record<string, string> = {
  flight_number: 'Flight number', airline: 'Airline', departure_airport: 'From', arrival_airport: 'To',
  departure_terminal: 'Departure terminal', arrival_terminal: 'Arrival terminal', seat: 'Seat', cabin_class: 'Cabin',
  address: 'Address', room_type: 'Room', guests: 'Guests', mode: 'Mode', pickup_location: 'Pickup',
  dropoff_location: 'Drop-off', vehicle: 'Vehicle', participants: 'Participants', meeting_point: 'Meeting point',
}

function detailValue(key: string, value: string | number): string {
  if (key === 'mode') return TRANSPORT_MODES.find((m) => m.value === value)?.label ?? String(value)
  if (key === 'cabin_class') return CABIN_CLASSES.find((c) => c.value === value)?.label ?? String(value)
  return String(value)
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-fg">{children}</dd>
    </div>
  )
}

interface Props {
  booking: AnyBooking | null
  today: string
  onClose: () => void
  onEdit: (booking: AnyBooking) => void
  onDelete: (booking: AnyBooking) => void
  onStatusChange: (booking: AnyBooking, status: BookingStatus) => Promise<void>
}

export function BookingDetailsDialog({ booking, today, onClose, onEdit, onDelete, onStatusChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const toast = useToast()
  const [changing, setChanging] = useState<BookingStatus | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (booking && !dialog.open) dialog.showModal()
    else if (!booking && dialog.open) dialog.close()
  }, [booking])

  if (!booking) return <dialog ref={ref} />

  const [startLabel, endLabel] = ENDPOINT_LABELS[booking.type]
  const clock = (t: string | null) => (t ? ` · ${formatClock(toMinutes(t))}` : '')
  const note = freeCancellationNote(booking, today)
  const details = Object.entries(booking.details ?? {}).filter(([k]) => DETAIL_LABELS[k])
  const hasEnd = booking.end_date || booking.end_time

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
      className="animate-dialog-in m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      <header className="flex items-start gap-3 border-b border-line p-5">
        <TypeTile type={booking.type} className="size-12" />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-xl font-extrabold tracking-tight">
            {booking.title}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
            <span>{TYPE_LABEL[booking.type]}</span>
            {booking.provider && <span>· {booking.provider}</span>}
            <span className="text-fg-subtle">· {countdown(booking, today)}</span>
          </p>
        </div>
        <BookingStatusBadge status={booking.status} />
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-xl p-1.5 text-fg-subtle transition hover:bg-surface-2 hover:text-fg">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="space-y-6 p-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Fact label={startLabel}>
            {shortDate(booking.start_date)}
            {clock(booking.start_time)}
          </Fact>
          {hasEnd && (
            <Fact label={endLabel}>
              {shortDate(booking.end_date ?? booking.start_date)}
              {clock(booking.end_time)}
            </Fact>
          )}
          <Fact label="When">{formatBookingWhen(booking)}</Fact>
          <Fact label="Total cost">
            <span className="tabular-nums">{formatMoneyIn(booking.total_cost, booking.currency)}</span>
          </Fact>
          {booking.location && <Fact label="Location">{booking.location}</Fact>}
          {booking.confirmation_number && (
            <Fact label="Confirmation number">
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                {booking.confirmation_number}
                <CopyButton value={booking.confirmation_number} label="Copy confirmation number" />
              </span>
            </Fact>
          )}
          {'trip_title' in booking && (
            <Fact label="Trip">
              <Link to={`/trips/${booking.trip_id}?tab=bookings`} className="text-primary-ink hover:underline" onClick={onClose}>
                {booking.trip_title}
              </Link>
            </Fact>
          )}
        </dl>

        {booking.outside_trip_dates && (
          <p className="flex items-start gap-2 rounded-2xl bg-warn-soft/60 p-3 text-sm text-warn-soft-fg">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            This booking starts or ends outside the trip's dates. That's fine for an early flight or a late checkout.
          </p>
        )}

        {details.length > 0 && (
          <section aria-label={`${TYPE_LABEL[booking.type]} details`}>
            <h3 className="mb-2 font-display text-sm font-bold">{TYPE_LABEL[booking.type]} details</h3>
            <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-surface-2 p-4 sm:grid-cols-2">
              {details.map(([key, value]) => (
                <Fact key={key} label={DETAIL_LABELS[key]}>
                  {detailValue(key, value)}
                </Fact>
              ))}
            </dl>
          </section>
        )}

        {(booking.cancellation_policy || note) && (
          <section aria-label="Cancellation">
            <h3 className="mb-2 font-display text-sm font-bold">Cancellation</h3>
            <div className="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
              {note && (
                <p className={cn('font-semibold', note.tone === 'open' ? 'text-primary-ink' : note.tone === 'closing' ? 'text-warn-soft-fg' : 'text-fg-subtle')}>
                  {note.text}
                </p>
              )}
              {booking.cancellation_policy && <p className="whitespace-pre-line text-fg-muted">{booking.cancellation_policy}</p>}
            </div>
          </section>
        )}

        {booking.notes && (
          <section aria-label="Notes">
            <h3 className="mb-2 font-display text-sm font-bold">Notes</h3>
            <p className="rounded-2xl bg-surface-2 p-4 text-sm whitespace-pre-line text-fg-muted">{booking.notes}</p>
          </section>
        )}

        <section aria-label="Linked documents">
          <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold">
            <Paperclip className="size-4 text-primary-ink" aria-hidden />
            Linked documents
          </h3>
          {booking.documents.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-fg-subtle">
              No documents linked. Edit the booking to attach a ticket, voucher or confirmation from this trip's documents.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {booking.documents.map((doc) => {
                const Icon = doc.content_type.startsWith('image/') ? FileImage : FileText
                return (
                  <li key={doc.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{doc.filename}</span>
                      <span className="text-xs text-fg-subtle tabular-nums">{formatBytes(doc.size_bytes)}</span>
                    </span>
                    <Button size="sm" variant="secondary" loading={downloading === doc.id} onClick={() => download(doc.id, doc.filename)} icon={<Download className="size-4" aria-hidden />} aria-label={`Download ${doc.filename}`}>
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5">
        <div className="flex flex-wrap items-center gap-2">
          {nextStatuses(booking.status).map((status) => (
            <Button key={status} size="sm" variant="secondary" loading={changing === status} disabled={changing !== null} onClick={() => changeStatus(status)}>
              {status === 'pending' ? 'Reopen as pending' : `Mark ${STATUS_LABEL[status].toLowerCase()}`}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="danger-outline" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => onDelete(booking)}>
            Delete
          </Button>
          <Button size="sm" variant="primary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => onEdit(booking)}>
            Edit
          </Button>
        </div>
      </footer>
    </dialog>
  )
}
