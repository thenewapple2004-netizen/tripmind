import { useCallback, useState, type ReactNode } from 'react'
import { ApiError } from '@/api/errors'
import type { Booking, BookingStatus, OwnerBooking } from '@/api/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useDeleteBooking, useUpdateBooking } from '@/hooks/useBookings'
import { useToday } from '@/hooks/useToday'
import { BookingDetailsDrawer } from './BookingDetailsDrawer'
import { BookingDialog } from './BookingDialog'

type AnyBooking = Booking | OwnerBooking

/**
 * One place that owns the details view, the create/edit form and the delete confirmation, so the
 * Bookings page and a trip's Bookings tab work exactly the same way.
 */
export function useBookingDialogs({ tripId }: { tripId?: string } = {}): {
  openDetails: (b: AnyBooking) => void
  openEdit: (b: AnyBooking) => void
  openCreate: () => void
  askDelete: (b: AnyBooking) => void
  element: ReactNode
} {
  const toast = useToast()
  const update = useUpdateBooking()
  const remove = useDeleteBooking()
  const [details, setDetails] = useState<AnyBooking | null>(null)
  const [form, setForm] = useState<{ booking: AnyBooking | null } | null>(null)
  const [deleting, setDeleting] = useState<AnyBooking | null>(null)
  const today = useToday()

  const changeStatus = useCallback(
    async (booking: AnyBooking, status: BookingStatus) => {
      try {
        const saved = await update.mutateAsync({ tripId: booking.trip_id, id: booking.id, patch: { status } })
        setDetails((current) => (current?.id === booking.id ? { ...current, ...saved } : current))
        toast.success(`“${booking.title}” marked ${status}.`)
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : 'We couldn’t change the status. Please try again.')
      }
    },
    [update, toast],
  )

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync({ tripId: deleting.trip_id, id: deleting.id })
      toast.success(`“${deleting.title}” was deleted.`)
      setDeleting(null)
      setDetails(null)
    } catch {
      // Shown inside the confirmation dialog.
    }
  }

  const element = (
    <>
      <BookingDetailsDrawer
        booking={details}
        today={today}
        onClose={() => setDetails(null)}
        onEdit={(b) => {
          setDetails(null)
          setForm({ booking: b })
        }}
        onDelete={(b) => setDeleting(b)}
        onStatusChange={changeStatus}
      />
      <BookingDialog
        open={form !== null}
        booking={form?.booking ?? null}
        tripId={tripId}
        onClose={() => setForm(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this booking?"
        description={
          deleting
            ? `“${deleting.title}” will be removed from your trip. Any documents linked to it stay in your Documents.`
            : ''
        }
        confirmLabel="Delete booking"
        pending={remove.isPending}
        error={remove.error instanceof ApiError ? remove.error.message : remove.error ? 'Failed to delete the booking. Please try again.' : null}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null)
          remove.reset()
        }}
      />
    </>
  )

  return {
    openDetails: setDetails,
    openEdit: (b) => setForm({ booking: b }),
    openCreate: () => setForm({ booking: null }),
    askDelete: setDeleting,
    element,
  }
}
