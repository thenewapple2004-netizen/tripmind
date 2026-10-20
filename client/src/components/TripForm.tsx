import { useEffect, useRef, useState } from 'react'
import { useForm, type UseFormSetError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, MapPin, Sparkles } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { tripFormSchema, type TripFormValues } from '@/lib/schema'

type FieldName = keyof TripFormValues
const FIELDS: FieldName[] = ['title', 'destination', 'start_date', 'end_date', 'budget']

interface DemoTrip {
  title: string
  destination: string
  daysFromNow: number
  durationDays: number
  budget: string
}

const DEMO_TRIPS: DemoTrip[] = [
  {
    title: 'Kyoto Zen & Bamboo Groves',
    destination: 'Kyoto, Japan',
    daysFromNow: 30,
    durationDays: 8,
    budget: '3200.00',
  },
  {
    title: 'Amalfi Coast & Capri Escape',
    destination: 'Positano, Italy',
    daysFromNow: 45,
    durationDays: 7,
    budget: '2850.00',
  },
  {
    title: 'Swiss Alps Hiking & Fondue',
    destination: 'Zermatt, Switzerland',
    daysFromNow: 60,
    durationDays: 6,
    budget: '3900.00',
  },
  {
    title: 'Northern Lights & Glaciers',
    destination: 'Reykjavik, Iceland',
    daysFromNow: 20,
    durationDays: 7,
    budget: '3400.00',
  },
  {
    title: 'Bali Temples & Waterfalls',
    destination: 'Ubud, Indonesia',
    daysFromNow: 40,
    durationDays: 10,
    budget: '1850.00',
  },
  {
    title: 'Parisian Cafés & Modern Art',
    destination: 'Paris, France',
    daysFromNow: 25,
    durationDays: 5,
    budget: '2600.00',
  },
  {
    title: 'Patagonia Peaks & Fjords',
    destination: 'El Chaltén, Argentina',
    daysFromNow: 75,
    durationDays: 12,
    budget: '4200.00',
  },
  {
    title: 'Santorini Sunsets & Caldera',
    destination: 'Santorini, Greece',
    daysFromNow: 50,
    durationDays: 6,
    budget: '2750.00',
  },
  {
    title: 'Canadian Rockies Road Trip',
    destination: 'Banff, Canada',
    daysFromNow: 35,
    durationDays: 8,
    budget: '2950.00',
  },
  {
    title: 'Scottish Castles & Highlands',
    destination: 'Edinburgh, Scotland',
    daysFromNow: 42,
    durationDays: 7,
    budget: '2300.00',
  },
  {
    title: 'Costa Rica Eco Rainforest',
    destination: 'La Fortuna, Costa Rica',
    daysFromNow: 65,
    durationDays: 9,
    budget: '2100.00',
  },
  {
    title: 'Barcelona Architecture & Beach',
    destination: 'Barcelona, Spain',
    daysFromNow: 18,
    durationDays: 6,
    budget: '1950.00',
  },
  {
    title: 'Tokyo Neon & Culinary Tour',
    destination: 'Tokyo, Japan',
    daysFromNow: 15,
    durationDays: 9,
    budget: '3100.00',
  },
  {
    title: 'Maui Beaches & Haleakala Sunrise',
    destination: 'Maui, Hawaii, USA',
    daysFromNow: 28,
    durationDays: 7,
    budget: '3600.00',
  },
  {
    title: 'Dubrovnik Old Town & Adriatic Sea',
    destination: 'Dubrovnik, Croatia',
    daysFromNow: 55,
    durationDays: 6,
    budget: '2250.00',
  },
  {
    title: 'Serengeti Safari Expedition',
    destination: 'Arusha, Tanzania',
    daysFromNow: 90,
    durationDays: 10,
    budget: '4800.00',
  },
]

function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface TripFormProps {
  defaultValues?: TripFormValues
  submitLabel: string
  submittingLabel: string
  cancelTo: string
  showDemoButton?: boolean
  /** Rejects with an ApiError to surface server-side problems on the form. */
  onSubmit: (values: TripFormValues, dirty: Partial<Record<FieldName, boolean>>) => Promise<void>
}

const EMPTY: TripFormValues = { title: '', destination: '', start_date: '', end_date: '', budget: '' }

export function TripForm({
  defaultValues = EMPTY,
  submitLabel,
  submittingLabel,
  cancelTo,
  showDemoButton = false,
  onSubmit,
}: TripFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const lastDemoIndex = useRef<number>(-1)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    trigger,
    watch,
    formState: { errors, isSubmitting, dirtyFields, touchedFields },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues,
    mode: 'onTouched',
  })

  const handleFillDemoData = () => {
    let nextIndex: number
    if (DEMO_TRIPS.length <= 1) {
      nextIndex = 0
    } else {
      // Pick a random offset from 1 to DEMO_TRIPS.length - 1 so it is guaranteed different every time
      const offset = 1 + Math.floor(Math.random() * (DEMO_TRIPS.length - 1))
      const baseIndex = lastDemoIndex.current >= 0 ? lastDemoIndex.current : Math.floor(Math.random() * DEMO_TRIPS.length)
      nextIndex = (baseIndex + offset) % DEMO_TRIPS.length
    }
    lastDemoIndex.current = nextIndex

    const demo = DEMO_TRIPS[nextIndex]
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() + demo.daysFromNow)

    const end = new Date(start)
    end.setDate(start.getDate() + demo.durationDays)

    setFormError(null)
    clearErrors()
    setValue('title', demo.title, { shouldValidate: true, shouldDirty: true })
    setValue('destination', demo.destination, { shouldValidate: true, shouldDirty: true })
    setValue('start_date', formatDateString(start), { shouldValidate: true, shouldDirty: true })
    setValue('end_date', formatDateString(end), { shouldValidate: true, shouldDirty: true })
    setValue('budget', demo.budget, { shouldValidate: true, shouldDirty: true })
  }

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
      {showDemoButton && (
        <div className="flex flex-col gap-3 rounded-xl border border-line-strong/70 bg-surface-2/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-sm text-fg-muted">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <span>Need inspiration? Auto-generate a realistic trip itinerary.</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            id="fill-demo-data-btn"
            data-testid="fill-demo-data-btn"
            icon={<Sparkles className="size-3.5 text-primary" aria-hidden />}
            onClick={handleFillDemoData}
            className="self-end sm:self-auto"
            title="Auto-fill with new demo trip data"
          >
            Fill Demo Data
          </Button>
        </div>
      )}

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
