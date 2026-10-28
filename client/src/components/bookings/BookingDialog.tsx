import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, FileImage, FileText, Paperclip, X } from 'lucide-react'
import type { Booking, BookingType, OwnerBooking } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { TextField, inputStyles } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useCreateBooking, useUpdateBooking } from '@/hooks/useBookings'
import { useDocuments } from '@/hooks/useDocuments'
import { useTrips } from '@/hooks/useTrips'
import {
  BOOKING_STATUSES, BOOKING_TYPES, CABIN_CLASSES, ENDPOINT_LABELS, STATUS_LABEL, TRANSPORT_MODES, TYPE_LABEL,
} from '@/lib/bookings'
import {
  EMPTY_BOOKING_FORM, bookingFormSchema, bookingToFormValues, toBookingInput, type BookingFormValues,
} from '@/lib/bookingForm'
import { applyApiErrors } from '@/lib/formErrors'
import { getDisplayCurrency } from '@/lib/money'
import { CURRENCIES } from '@/lib/profile'
import { formatBytes } from '@/lib/download'
import { formatDateRange, sortTrips } from '@/lib/trips'
import { TYPE_META } from './meta'

const FIELDS = Object.keys(EMPTY_BOOKING_FORM) as Array<keyof BookingFormValues>

interface Props {
  open: boolean
  onClose: () => void
  /** Editing this booking. Omit to create a new one. */
  booking?: Booking | OwnerBooking | null
  /** Fixes the trip (when adding from a trip's own page). Otherwise the form lets the owner choose. */
  tripId?: string
  onSaved?: (booking: Booking) => void
}

const select = (extra?: string) => cn(inputStyles, extra)

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {children}
      {optional && <span className="ml-1 font-normal text-fg-subtle">(optional)</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-line bg-surface-2/40 p-4">
      <legend className="px-2 font-display text-sm font-bold text-fg">{title}</legend>
      {children}
    </fieldset>
  )
}

export function BookingDialog({ open, onClose, booking, tripId, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const toast = useToast()
  const create = useCreateBooking()
  const update = useUpdateBooking()
  const { data: trips = [] } = useTrips()
  const [banner, setBanner] = useState<string | null>(null)
  const editing = Boolean(booking)
  const busy = create.isPending || update.isPending

  const {
    register, handleSubmit, reset, setError, watch, setValue, control,
    formState: { errors },
  } = useForm<BookingFormValues>({ resolver: zodResolver(bookingFormSchema), defaultValues: EMPTY_BOOKING_FORM })

  const type = watch('type')
  const selectedTripId = watch('trip_id')
  const documents = useDocuments(selectedTripId)
  const orderedTrips = useMemo(() => sortTrips(trips, 'upcoming'), [trips])
  const [startLabel, endLabel] = ENDPOINT_LABELS[type]

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    setBanner(null)
    if (booking) reset(bookingToFormValues(booking))
    else {
      const fallback = tripId ?? orderedTrips.find((t) => t.end_date >= new Date().toISOString().slice(0, 10))?.id ?? orderedTrips[0]?.id ?? ''
      reset({ ...EMPTY_BOOKING_FORM, trip_id: fallback, currency: getDisplayCurrency() as BookingFormValues['currency'] })
    }
  }, [open, booking, tripId, orderedTrips, reset])

  // Documents belong to a trip, so changing the trip clears any that were picked for the old one.
  const changeTrip = (id: string) => {
    setValue('trip_id', id, { shouldValidate: false })
    setValue('document_ids', [])
  }

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      const input = toBookingInput(values)
      const saved = editing && booking
        ? await update.mutateAsync({ tripId: booking.trip_id, id: booking.id, patch: input })
        : await create.mutateAsync({ tripId: values.trip_id, input })
      toast.success(editing ? `Updated “${saved.title}”` : `Added “${saved.title}”`)
      onSaved?.(saved)
      onClose()
    } catch (error) {
      setBanner(applyApiErrors(error, setError, FIELDS))
    }
  })

  const err = (field: keyof BookingFormValues) => errors[field]?.message as string | undefined
  const noTrips = !editing && !tripId && orderedTrips.length === 0

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose()
      }}
      className="animate-dialog-in m-auto max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-6 py-4 backdrop-blur">
        <h2 id={titleId} className="font-display text-lg font-extrabold">
          {editing ? 'Edit booking' : 'New booking'}
        </h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog" className="rounded-xl p-1.5 text-fg-subtle transition hover:bg-surface-2 hover:text-fg">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {noTrips ? (
        <div className="p-6 text-sm text-fg-muted">
          Bookings belong to a trip. <Link to="/trips/new" className="font-semibold text-primary-ink hover:underline" onClick={onClose}>Create a trip</Link> first.
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5 p-6">
          {banner && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-soft-fg">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{banner}</span>
            </div>
          )}

          <div role="radiogroup" aria-label="Booking type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BOOKING_TYPES.map((t: BookingType) => {
              const Icon = TYPE_META[t].icon
              const selected = type === t
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue('type', t, { shouldValidate: false })}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition',
                    selected ? 'border-primary bg-primary-soft text-primary-soft-fg shadow-glow' : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {TYPE_LABEL[t]}
                </button>
              )
            })}
          </div>

          <Section title="Basics">
            {editing ? (
              <p className="text-sm text-fg-muted">
                Trip: <span className="font-semibold text-fg">{'trip_title' in (booking ?? {}) ? (booking as OwnerBooking).trip_title : trips.find((t) => t.id === booking?.trip_id)?.title}</span>
              </p>
            ) : (
              !tripId && (
                <div>
                  <Label htmlFor="booking-trip">Trip</Label>
                  <select id="booking-trip" value={selectedTripId} onChange={(e) => changeTrip(e.target.value)} className={select()} aria-invalid={errors.trip_id ? true : undefined}>
                    {orderedTrips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} · {formatDateRange(t.start_date, t.end_date)}
                      </option>
                    ))}
                  </select>
                  {err('trip_id') && <p className="mt-1.5 text-sm text-danger">{err('trip_id')}</p>}
                </div>
              )
            )}
            <TextField label="Title" placeholder={type === 'flight' ? 'e.g. Islamabad to Dubai' : type === 'hotel' ? 'e.g. Serena Hotel, Gilgit' : type === 'transportation' ? 'e.g. Airport pickup' : 'e.g. Baltit Fort guided tour'} maxLength={150} error={err('title')} {...register('title')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Provider" placeholder={type === 'flight' ? 'e.g. Emirates' : 'e.g. Booking.com, local operator'} maxLength={120} error={err('provider')} {...register('provider')} />
              <TextField label="Confirmation number" placeholder="e.g. ABC123" maxLength={60} error={err('confirmation_number')} {...register('confirmation_number')} />
            </div>
            <div>
              <Label htmlFor="booking-status">Status</Label>
              <select id="booking-status" className={select('sm:w-60')} {...register('status')}>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-fg-subtle">Only confirmed and completed bookings appear on the trip’s itinerary.</p>
            </div>
          </Section>

          <Section title="When">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={`${startLabel} date`} type="date" error={err('start_date')} {...register('start_date')} />
              <TextField label={`${startLabel} time`} type="time" hint="Optional" error={err('start_time')} {...register('start_time')} />
              <TextField label={`${endLabel} date`} type="date" hint={type === 'hotel' ? undefined : 'Optional'} error={err('end_date')} {...register('end_date')} />
              <TextField label={`${endLabel} time`} type="time" hint="Optional" error={err('end_time')} {...register('end_time')} />
            </div>
          </Section>

          {type === 'flight' && (
            <Section title="Flight details">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Flight number" placeholder="e.g. EK615" maxLength={10} error={err('flight_number')} {...register('flight_number')} />
                <TextField label="Airline" placeholder="e.g. Emirates" maxLength={80} hint="Optional" error={err('airline')} {...register('airline')} />
                <TextField label="From (airport)" placeholder="ISB" maxLength={10} hint="3-letter code" error={err('departure_airport')} {...register('departure_airport')} />
                <TextField label="To (airport)" placeholder="DXB" maxLength={10} hint="3-letter code" error={err('arrival_airport')} {...register('arrival_airport')} />
                <TextField label="Departure terminal" maxLength={10} hint="Optional" error={err('departure_terminal')} {...register('departure_terminal')} />
                <TextField label="Arrival terminal" maxLength={10} hint="Optional" error={err('arrival_terminal')} {...register('arrival_terminal')} />
                <TextField label="Seat" placeholder="e.g. 12A" maxLength={10} hint="Optional" error={err('seat')} {...register('seat')} />
                <div>
                  <Label htmlFor="booking-cabin" optional>Cabin</Label>
                  <select id="booking-cabin" className={select()} {...register('cabin_class')}>
                    <option value="">Not set</option>
                    {CABIN_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            </Section>
          )}

          {type === 'hotel' && (
            <Section title="Stay details">
              <TextField label="Location" placeholder="City or area" maxLength={200} error={err('location')} {...register('location')} />
              <TextField label="Address" maxLength={200} hint="Optional" error={err('address')} {...register('address')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Room type" placeholder="e.g. Double, mountain view" maxLength={80} hint="Optional" error={err('room_type')} {...register('room_type')} />
                <TextField label="Guests" type="number" min={1} max={20} inputMode="numeric" hint="Optional" error={err('guests')} {...register('guests')} />
              </div>
            </Section>
          )}

          {type === 'transportation' && (
            <Section title="Transfer details">
              <div>
                <Label htmlFor="booking-mode">Mode</Label>
                <select id="booking-mode" className={select('sm:w-60')} {...register('mode')}>
                  {TRANSPORT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Pickup location" maxLength={200} error={err('pickup_location')} {...register('pickup_location')} />
                <TextField label="Drop-off location" maxLength={200} error={err('dropoff_location')} {...register('dropoff_location')} />
              </div>
              <TextField label="Vehicle" placeholder="e.g. Toyota Land Cruiser" maxLength={80} hint="Optional" error={err('vehicle')} {...register('vehicle')} />
            </Section>
          )}

          {type === 'activity' && (
            <Section title="Activity details">
              <TextField label="Location" placeholder="Where it happens" maxLength={200} error={err('location')} {...register('location')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Meeting point" maxLength={200} hint="Optional" error={err('meeting_point')} {...register('meeting_point')} />
                <TextField label="Participants" type="number" min={1} max={100} inputMode="numeric" hint="Optional" error={err('participants')} {...register('participants')} />
              </div>
            </Section>
          )}

          <Section title="Cost">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Total cost" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" error={err('total_cost')} {...register('total_cost')} />
              <div>
                <Label htmlFor="booking-currency">Currency</Label>
                <select id="booking-currency" className={select()} {...register('currency')}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="mt-1.5 text-xs text-fg-subtle">Kept as entered, never converted.</p>
              </div>
            </div>
          </Section>

          <Section title="Cancellation & notes">
            <div>
              <Label htmlFor="booking-policy" optional>Cancellation policy</Label>
              <textarea id="booking-policy" rows={2} maxLength={1000} placeholder="e.g. Free cancellation until 48 hours before check-in" className={select('h-auto py-2.5')} aria-invalid={errors.cancellation_policy ? true : undefined} {...register('cancellation_policy')} />
              {err('cancellation_policy') && <p className="mt-1.5 text-sm text-danger">{err('cancellation_policy')}</p>}
            </div>
            <TextField label="Free cancellation until" type="date" hint="Optional. Must be on or before the start date." error={err('free_cancellation_until')} {...register('free_cancellation_until')} />
            <div>
              <Label htmlFor="booking-notes" optional>Notes</Label>
              <textarea id="booking-notes" rows={3} maxLength={2000} placeholder="Booking details, contact numbers, what to bring…" className={select('h-auto py-2.5')} aria-invalid={errors.notes ? true : undefined} {...register('notes')} />
              {err('notes') && <p className="mt-1.5 text-sm text-danger">{err('notes')}</p>}
            </div>
          </Section>

          <Section title="Linked documents">
            <p className="-mt-1 text-xs text-fg-subtle">Attach files you’ve already uploaded to this trip. They’re linked, not copied.</p>
            <Controller
              control={control}
              name="document_ids"
              render={({ field }) =>
                documents.isPending ? (
                  <p className="text-sm text-fg-subtle">Loading documents…</p>
                ) : (documents.data ?? []).length === 0 ? (
                  <p className="flex items-start gap-2 text-sm text-fg-subtle">
                    <Paperclip className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>This trip has no documents yet. Add some on the <Link to="/documents" className="font-medium text-primary-ink hover:underline" onClick={onClose}>Documents page</Link>, then link them here.</span>
                  </p>
                ) : (
                  <ul className="max-h-44 space-y-1 overflow-y-auto">
                    {(documents.data ?? []).map((doc) => {
                      const checked = field.value.includes(doc.id)
                      const Icon = doc.content_type.startsWith('image/') ? FileImage : FileText
                      return (
                        <li key={doc.id}>
                          <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-sm transition', checked ? 'border-primary bg-primary-soft/60' : 'border-line hover:border-line-strong')}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => field.onChange(checked ? field.value.filter((id) => id !== doc.id) : [...field.value, doc.id])}
                              className="size-4 accent-[var(--primary)]"
                            />
                            <Icon className="size-4 shrink-0 text-primary-ink" aria-hidden />
                            <span className="min-w-0 flex-1 truncate font-medium">{doc.filename}</span>
                            <span className="text-xs text-fg-subtle tabular-nums">{formatBytes(doc.size_bytes)}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )
              }
            />
            {err('document_ids') && <p className="text-sm text-danger">{err('document_ids')}</p>}
          </Section>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" loading={busy}>{editing ? 'Save changes' : 'Add booking'}</Button>
          </div>
        </form>
      )}
    </dialog>
  )
}
