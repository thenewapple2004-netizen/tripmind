import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { Inquiry } from '@/api/crmTypes'
import { Button } from '@/components/ui/Button'
import { FormDialog } from '@/components/ui/FormDialog'
import { ChipGroup, ChoiceGroup, SelectField, TextAreaField } from '@/components/ui/FormFields'
import { TextField } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useCreateInquiry, useCustomerOptions, useUpdateInquiry } from '@/hooks/useCrm'
import {
  ACCOMMODATION_TYPES, COMFORT_LEVELS, EMPTY_INQUIRY_FORM, INQUIRY_STEPS, PACES, SOURCES, TRAVEL_STYLES,
  inquiryFormSchema, inquiryToForm, toInquiryCreate, toInquiryPatch, type InquiryFormValues,
} from '@/lib/crm'
import { applyApiErrors } from '@/lib/formErrors'
import { getDisplayCurrency, currencySymbol } from '@/lib/money'
import { CURRENCIES } from '@/lib/profile'

const FIELDS = Object.keys(EMPTY_INQUIRY_FORM) as Array<keyof InquiryFormValues>
const LAST = INQUIRY_STEPS.length - 1

interface Props {
  open: boolean
  onClose: () => void
  /** Editing this inquiry (and its travel brief). Omit to start a new one. */
  inquiry?: Inquiry | null
  /** For a new inquiry: the customer it is for. */
  customerId?: string
  /** Which step to open on; editing from a section of the drawer jumps straight to it. */
  initialStep?: number
  onSaved?: (inquiry: Inquiry) => void
}

/**
 * The guided form for an inquiry and its travel brief. Nothing past the destination is required, so a quick
 * phone call can be saved from the first step; the rest can be filled in now or later, at any stage.
 */
export function InquiryDialog({ open, onClose, inquiry, customerId, initialStep = 0, onSaved }: Props) {
  const editing = Boolean(inquiry)
  const toast = useToast()
  const create = useCreateInquiry()
  const update = useUpdateInquiry()
  const customers = useCustomerOptions()
  const [step, setStep] = useState(0)
  const [banner, setBanner] = useState<string | null>(null)
  const busy = create.isPending || update.isPending

  const {
    register, handleSubmit, reset, setError, setValue, watch, trigger,
    formState: { errors },
  } = useForm<InquiryFormValues>({ resolver: zodResolver(inquiryFormSchema), defaultValues: EMPTY_INQUIRY_FORM })

  useEffect(() => {
    if (!open) return
    setBanner(null)
    setStep(Math.min(Math.max(initialStep, 0), LAST))
    reset(
      inquiry
        ? inquiryToForm(inquiry)
        : { ...EMPTY_INQUIRY_FORM, customer_id: customerId ?? '', currency: getDisplayCurrency() as InquiryFormValues['currency'] },
    )
  }, [open, inquiry, customerId, initialStep, reset])

  const err = (field: keyof InquiryFormValues) => errors[field]?.message as string | undefined
  const values = watch()
  const flexible = values.flexible_dates
  const stepOf = (field: string) => INQUIRY_STEPS.findIndex((s) => (s.fields as readonly string[]).includes(field))

  const goTo = async (next: number) => {
    // Moving forward checks the step being left; moving back is always allowed.
    if (next > step && !(await trigger([...INQUIRY_STEPS[step].fields] as Array<keyof InquiryFormValues>))) return
    setStep(next)
  }

  const save = handleSubmit(
    async (v) => {
      setBanner(null)
      try {
        const saved = inquiry
          ? await update.mutateAsync({ id: inquiry.id, patch: toInquiryPatch(v) })
          : await create.mutateAsync(toInquiryCreate(v))
        toast.success(editing ? 'Inquiry saved' : `Inquiry for ${saved.destination} added`)
        onSaved?.(saved)
        onClose()
      } catch (error) {
        setBanner(applyApiErrors(error, setError, FIELDS))
        if (error instanceof ApiError) {
          const first = Object.keys(error.fieldErrors).map(stepOf).filter((i) => i >= 0)
          if (first.length) setStep(Math.min(...first))
        }
      }
    },
    // A client-side problem on another step: take the owner to it.
    (problems) => {
      const bad = Object.keys(problems).map(stepOf).filter((i) => i >= 0)
      if (bad.length) setStep(Math.min(...bad))
    },
  )

  const current = INQUIRY_STEPS[step]

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      wide
      title={editing ? 'Edit inquiry and travel brief' : 'New inquiry'}
      description={
        editing
          ? 'Changes save to the inquiry and its brief. You can edit these at any stage.'
          : 'Start with what you know. Everything after the destination is optional and can be added later.'
      }
      busy={busy}
      submitLabel={editing ? 'Save changes' : 'Add inquiry'}
      busyLabel="Saving…"
      banner={banner}
      onSubmit={(e) => {
        // Pressing Enter inside a field moves to the next step rather than saving half the form.
        const submitter = (e.nativeEvent as SubmitEvent).submitter
        if (!submitter && step < LAST) {
          e.preventDefault()
          void goTo(step + 1)
          return
        }
        void save(e)
      }}
      footerStart={
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => void goTo(step - 1)} disabled={step === 0 || busy} icon={<ChevronLeft className="size-4" aria-hidden />}>
            Back
          </Button>
          {step < LAST && (
            <Button size="sm" onClick={() => void goTo(step + 1)} disabled={busy}>
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      }
    >
      <nav aria-label="Steps" className="-mt-1">
        <ol className="flex gap-1 overflow-x-auto pb-1">
          {INQUIRY_STEPS.map((s, i) => {
            const state = i === step ? 'current' : i < step ? 'done' : 'todo'
            const hasError = s.fields.some((f) => errors[f as keyof InquiryFormValues])
            return (
              <li key={s.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => void goTo(i)}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={cn(
                    'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium whitespace-nowrap transition-colors',
                    state === 'current' ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                    hasError && 'text-danger',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                      state === 'current' ? 'bg-primary text-primary-fg' : state === 'done' ? 'bg-primary-soft text-primary-soft-fg' : 'bg-surface-3 text-fg-subtle',
                    )}
                  >
                    {state === 'done' && !hasError ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.title}</span>
                  <span className="sr-only sm:hidden">{s.title}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <h3 className="text-base font-semibold">
        <span className="sr-only">Step {step + 1} of {INQUIRY_STEPS.length}: </span>
        {current.title}
      </h3>

      {/* Every step stays mounted (hidden) so its values are never lost and a server error can still point at it. */}
      <section hidden={current.id !== 'trip'} className="space-y-4">
        {editing ? (
          <p className="text-sm text-fg-muted">
            For <span className="font-semibold text-fg">{inquiry?.customer.name}</span>
          </p>
        ) : (
          <SelectField label="Customer" error={err('customer_id')} {...register('customer_id')}>
            <option value="">{customers.isPending ? 'Loading customers…' : 'Choose a customer'}</option>
            {customers.data?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
        )}
        {customers.data?.truncated && !editing && (
          <p className="-mt-2 text-xs text-fg-subtle">Showing your first 100 customers. Open a customer to add an inquiry for someone else.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Destination" placeholder="e.g. Hunza Valley" maxLength={100} error={err('destination')} {...register('destination')} />
          <SelectField label="How did they find you?" error={err('source')} {...register('source')}>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Preferred start" type="date" error={err('date_from')} {...register('date_from')} />
          <TextField label="Preferred end" type="date" error={err('date_to')} {...register('date_to')} />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ring)]" {...register('flexible_dates')} />
          <span>
            <span className="font-medium text-fg">The dates are flexible</span>
            <span className="block text-fg-subtle">The customer can move the trip a few days either way.</span>
          </span>
        </label>
        {flexible && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Days either side" inputMode="numeric" placeholder="e.g. 5" error={err('flexibility_days')} {...register('flexibility_days')} />
            <TextField label="Trip length (nights)" inputMode="numeric" placeholder="e.g. 7" error={err('trip_length_nights')} {...register('trip_length_nights')} />
          </div>
        )}
        {!flexible && (
          <TextField label="Trip length (nights)" inputMode="numeric" placeholder="e.g. 7" className="sm:max-w-[calc(50%-0.5rem)]" error={err('trip_length_nights')} {...register('trip_length_nights')} />
        )}
        {!editing && (
          <TextField
            label="First follow-up"
            type="date"
            hint="Optional. Creates a follow-up for this inquiry on that day."
            error={err('follow_up_on')}
            {...register('follow_up_on')}
          />
        )}
      </section>

      <section hidden={current.id !== 'group'} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Number of travelers" inputMode="numeric" error={err('travelers')} hint="Everyone going, children included." {...register('travelers')} />
          <TextField label="Of them, children" inputMode="numeric" error={err('children')} hint="Leave at 0 if there are none." {...register('children')} />
        </div>
      </section>

      <section hidden={current.id !== 'stay'} className="space-y-5">
        <ChipGroup
          legend="Where they would like to stay"
          options={ACCOMMODATION_TYPES}
          value={values.accommodation_types}
          onChange={(next) => setValue('accommodation_types', next, { shouldDirty: true })}
        />
        <ChoiceGroup
          legend="Comfort level"
          options={COMFORT_LEVELS}
          value={values.comfort_level}
          onChange={(next) => setValue('comfort_level', next, { shouldDirty: true })}
        />
        <TextField label="Rooms and beds" placeholder="e.g. one double and a twin room" error={err('room_preferences')} {...register('room_preferences')} />
        <ChipGroup
          legend="Travel style"
          options={TRAVEL_STYLES}
          value={values.travel_styles}
          onChange={(next) => setValue('travel_styles', next, { shouldDirty: true })}
        />
        <ChoiceGroup legend="Pace" options={PACES} value={values.pace} onChange={(next) => setValue('pace', next, { shouldDirty: true })} />
        <TextField label="Getting around" placeholder="e.g. private driver, no night drives" error={err('transport_preferences')} {...register('transport_preferences')} />
      </section>

      <section hidden={current.id !== 'budget'} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Currency" error={err('currency')} {...register('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectField>
          <TextField label="From" inputMode="decimal" prefix={currencySymbol(values.currency)} placeholder="Lowest" error={err('budget_min')} {...register('budget_min')} />
          <TextField label="Up to" inputMode="decimal" prefix={currencySymbol(values.currency)} placeholder="Highest" error={err('budget_max')} {...register('budget_max')} />
        </div>
        <p className="text-sm text-fg-subtle">The whole trip for the whole group. Leave both empty if they haven’t said.</p>
      </section>

      <section hidden={current.id !== 'requests'} className="space-y-4">
        <TextAreaField
          label="Special requests"
          optional
          hint="Dietary needs, accessibility, celebrations, must-see places."
          error={err('special_requests')}
          {...register('special_requests')}
        />
        <TextAreaField label="Anything else the customer said" optional error={err('additional_notes')} {...register('additional_notes')} />
        <TextAreaField label="Your own notes on this inquiry" optional hint="Private. Not part of the brief." error={err('notes')} {...register('notes')} />
      </section>
    </FormDialog>
  )
}
