import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import type { Inquiry } from '@/api/crmTypes'
import type { Trip } from '@/api/types'
import { FormDialog } from '@/components/ui/FormDialog'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useConvertInquiry } from '@/hooks/useCrm'
import {
  conversionDraft, conversionFormSchema, toConversionInput, budgetLabel, datesLabel, type ConversionFormValues,
} from '@/lib/crm'
import { applyApiErrors } from '@/lib/formErrors'
import { currencySymbol } from '@/lib/money'

const FIELDS: Array<keyof ConversionFormValues> = ['title', 'destination', 'start_date', 'end_date', 'budget', 'confirm']

/**
 * Review step before a confirmed inquiry becomes a trip. The fields start from the inquiry; the owner can
 * change any of them. Nothing happens until the confirmation box is ticked and the button pressed.
 */
export function ConvertDialog({
  open,
  inquiry,
  onClose,
  onConverted,
}: {
  open: boolean
  inquiry: Inquiry | null
  onClose: () => void
  onConverted?: (trip: Trip) => void
}) {
  const toast = useToast()
  const convert = useConvertInquiry()
  const [banner, setBanner] = useState<string | null>(null)

  const {
    register, handleSubmit, reset, setError,
    formState: { errors },
  } = useForm<ConversionFormValues>({ resolver: zodResolver(conversionFormSchema) })

  useEffect(() => {
    if (open && inquiry) {
      setBanner(null)
      reset(conversionDraft(inquiry))
    }
  }, [open, inquiry, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!inquiry) return
    setBanner(null)
    try {
      const { trip } = await convert.mutateAsync({ id: inquiry.id, input: toConversionInput(values) })
      toast.success(`Created the trip “${trip.title}”`)
      onConverted?.(trip)
      onClose()
    } catch (error) {
      setBanner(applyApiErrors(error, setError, FIELDS))
    }
  })

  const err = (field: keyof ConversionFormValues) => errors[field]?.message
  const budget = inquiry ? budgetLabel(inquiry) : null

  return (
    <FormDialog
      open={open && Boolean(inquiry)}
      onClose={onClose}
      title="Create a trip from this inquiry"
      description={inquiry ? `${inquiry.customer.name} · ${inquiry.destination}` : undefined}
      busy={convert.isPending}
      submitLabel="Create trip"
      busyLabel="Creating…"
      banner={banner}
      onSubmit={onSubmit}
    >
      <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/60 p-3 text-sm text-fg-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
        <p>
          This adds a <strong className="font-semibold text-fg">new trip</strong> to your trips, linked to {inquiry?.customer.name}.
          The inquiry stays as it is, and no existing trip is changed.
        </p>
      </div>

      <TextField label="Trip title" maxLength={100} error={err('title')} {...register('title')} />
      <TextField label="Destination" maxLength={100} error={err('destination')} {...register('destination')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Starts" type="date" error={err('start_date')} {...register('start_date')} />
        <TextField label="Ends" type="date" error={err('end_date')} {...register('end_date')} />
      </div>
      {inquiry && (!inquiry.date_from || !inquiry.date_to) && (
        <p className="-mt-2 text-sm text-fg-subtle">The inquiry has {datesLabel(inquiry).toLowerCase()}. Trips need both dates, so choose them here.</p>
      )}
      <TextField
        label="Budget"
        inputMode="decimal"
        prefix={inquiry ? currencySymbol(inquiry.currency) : undefined}
        hint={budget ? `The customer’s budget was ${budget}. Trips keep a single figure.` : 'The customer gave no budget. Trips need one, so enter it here.'}
        error={err('budget')}
        {...register('budget')}
      />

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ring)]" aria-invalid={errors.confirm ? true : undefined} {...register('confirm')} />
          <span className="font-medium text-fg">I’ve checked these details and want to create this trip.</span>
        </label>
        {errors.confirm && <p className="mt-1.5 pl-7 text-sm text-danger">{errors.confirm.message}</p>}
      </div>
    </FormDialog>
  )
}
