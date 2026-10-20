import { useEffect, useState } from 'react'
import { useForm, type UseFormSetError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, MapPin } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { tripFormSchema, type TripFormValues } from '@/lib/schema'

type FieldName = keyof TripFormValues
const FIELDS: FieldName[] = ['title', 'destination', 'start_date', 'end_date', 'budget']

interface TripFormProps {
  defaultValues?: TripFormValues
  submitLabel: string
  submittingLabel: string
  cancelTo: string
  /** Rejects with an ApiError to surface server-side problems on the form. */
  onSubmit: (values: TripFormValues, dirty: Partial<Record<FieldName, boolean>>) => Promise<void>
}

const EMPTY: TripFormValues = { title: '', destination: '', start_date: '', end_date: '', budget: '' }

export function TripForm({
  defaultValues = EMPTY,
  submitLabel,
  submittingLabel,
  cancelTo,
  onSubmit,
}: TripFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    trigger,
    watch,
    formState: { errors, isSubmitting, dirtyFields, touchedFields },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues,
    mode: 'onTouched',
  })

  // Moving the start date past the end date should flag the end date straight away.
  const startDate = watch('start_date')
  const endDate = watch('end_date')
  useEffect(() => {
    if (endDate && (touchedFields.end_date || errors.end_date)) void trigger('end_date')
    // Deliberately keyed on the start date only: typing in the end date is handled by the form mode.
  }, [startDate])

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit(values, dirtyFields)
    } catch (error) {
      setFormError(applyApiError(error, setError))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-soft-fg"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{formError}</p>
            <p className="mt-0.5 opacity-90">Your entries are still here, so you can try again.</p>
          </div>
        </div>
      )}

      <TextField
        label="Trip title"
        placeholder="e.g. Summer in the Dolomites"
        autoComplete="off"
        maxLength={100}
        error={errors.title?.message}
        {...register('title')}
      />

      <TextField
        label="Destination"
        placeholder="e.g. Cortina d'Ampezzo, Italy"
        hint="City and country work best, for example “Kyoto, Japan”."
        autoComplete="off"
        maxLength={100}
        icon={<MapPin className="size-4" />}
        error={errors.destination?.message}
        {...register('destination')}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Start date"
          type="date"
          error={errors.start_date?.message}
          {...register('start_date')}
        />
        <TextField
          label="End date"
          type="date"
          min={startDate || undefined}
          error={errors.end_date?.message}
          {...register('end_date')}
        />
      </div>

      <TextField
        label="Budget"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0.00"
        prefix="$"
        hint="Total budget in US dollars."
        error={errors.budget?.message}
        {...register('budget')}
      />

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
        <ButtonLink to={cancelTo} variant="ghost" size="lg" aria-disabled={isSubmitting || undefined}>
          Cancel
        </ButtonLink>
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/**
 * Puts server validation messages on their fields and returns the banner text for
 * everything else (outages, 5xx, 404s, or validation errors with no matching field).
 */
function applyApiError(error: unknown, setError: UseFormSetError<TripFormValues>): string | null {
  if (!(error instanceof ApiError)) return 'Something unexpected went wrong. Please try again.'

  const unmatched: string[] = [...error.formErrors]
  let focused = false
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if ((FIELDS as string[]).includes(field)) {
      setError(field as FieldName, { type: 'server', message }, { shouldFocus: !focused })
      focused = true
    } else {
      unmatched.push(message)
    }
  }

  if (unmatched.length > 0) return unmatched.join(' ')
  // Field-level messages already explain the problem; no banner needed.
  return focused ? null : error.message
}
