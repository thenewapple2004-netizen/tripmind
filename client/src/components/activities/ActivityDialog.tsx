import { useEffect, useId, useRef, useState } from 'react'
import { useForm, type UseFormSetError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar, CircleAlert, DollarSign, MapPin, X } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { Activity, Trip } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useCreateActivity, useUpdateActivity } from '@/hooks/useActivities'
import { activityFormSchema, toActivityInput, type ActivityFormValues } from '@/lib/schema'

interface ActivityDialogProps {
  open: boolean
  trip: Trip
  activity?: Activity | null
  onClose: () => void
}

const DEFAULT_VALUES: ActivityFormValues = {
  title: '',
  activity_date: '',
  cost: '0',
  location: '',
  description: '',
}

export function ActivityDialog({ open, trip, activity, onClose }: ActivityDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const toast = useToast()
  const [serverError, setServerError] = useState<string | null>(null)

  const isEditing = Boolean(activity)
  const createActivity = useCreateActivity(trip.id)
  const updateActivity = useUpdateActivity(trip.id)
  const isSubmitting = createActivity.isPending || updateActivity.isPending

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setServerError(null)
      if (activity) {
        reset({
          title: activity.title,
          activity_date: activity.activity_date,
          cost: String(activity.cost),
          location: activity.location ?? '',
          description: activity.description ?? '',
        })
      } else {
        reset({
          ...DEFAULT_VALUES,
          activity_date: trip.start_date,
        })
      }
    }
  }, [open, activity, trip.start_date, reset])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    // Validate date against trip bounds
    if (values.activity_date < trip.start_date || values.activity_date > trip.end_date) {
      setError('activity_date', {
        type: 'manual',
        message: `Date must be between ${trip.start_date} and ${trip.end_date}.`,
      })
      return
    }

    try {
      const input = toActivityInput(values)
      if (isEditing && activity) {
        await updateActivity.mutateAsync({ activityId: activity.id, patch: input })
        toast.success(`Updated “${values.title}”`)
      } else {
        await createActivity.mutateAsync(input)
        toast.success(`Added “${values.title}”`)
      }
      onClose()
    } catch (err) {
      const banner = applyApiError(err, setError)
      setServerError(banner)
    }
  })

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (!isSubmitting) onClose()
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !isSubmitting) onClose()
      }}
      className="animate-dialog-in m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-slate-950/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {isEditing ? 'Edit Activity' : 'Add Activity'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus:outline-none"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4 p-6">
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-soft-fg"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{serverError}</span>
          </div>
        )}

        <TextField
          label="Activity title"
          placeholder="e.g. Scuba diving, Museum tour, Dinner at Luigi's"
          maxLength={100}
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Activity date"
            type="date"
            min={trip.start_date}
            max={trip.end_date}
            icon={<Calendar className="size-4" />}
            hint={`Between ${trip.start_date} and ${trip.end_date}`}
            error={errors.activity_date?.message}
            {...register('activity_date')}
          />

          <TextField
            label="Cost"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            prefix="$"
            placeholder="0.00"
            hint="In US dollars (0 for free)"
            icon={<DollarSign className="size-4" />}
            error={errors.cost?.message}
            {...register('cost')}
          />
        </div>

        <TextField
          label="Location"
          placeholder="e.g. Downtown Plaza, Kyoto Tower"
          maxLength={100}
          icon={<MapPin className="size-4" />}
          error={errors.location?.message}
          {...register('location')}
        />

        <div>
          <label htmlFor="activity-description" className="mb-1.5 block text-sm font-medium text-fg">
            Notes / Description <span className="font-normal text-fg-subtle">(Optional)</span>
          </label>
          <textarea
            id="activity-description"
            rows={3}
            maxLength={500}
            placeholder="Booking confirmation, what to bring, ticket numbers..."
            className="block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/25"
            {...register('description')}
          />
          {errors.description?.message && (
            <p className="mt-1.5 text-sm text-danger">{errors.description.message}</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Add Activity'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

function applyApiError(error: unknown, setError: UseFormSetError<ActivityFormValues>): string | null {
  if (!(error instanceof ApiError)) return 'Something unexpected went wrong. Please try again.'

  const unmatched: string[] = [...error.formErrors]
  const fields = ['title', 'activity_date', 'cost', 'location', 'description']
  let focused = false

  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (fields.includes(field)) {
      setError(field as keyof ActivityFormValues, { type: 'server', message }, { shouldFocus: !focused })
      focused = true
    } else {
      unmatched.push(message)
    }
  }

  if (unmatched.length > 0) return unmatched.join(' ')
  return focused ? null : error.message
}
