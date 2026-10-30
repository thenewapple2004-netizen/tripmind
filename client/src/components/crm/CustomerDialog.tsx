import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CustomerDetail } from '@/api/crmTypes'
import { FormDialog } from '@/components/ui/FormDialog'
import { SelectField, TextAreaField } from '@/components/ui/FormFields'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useCreateCustomer, useUpdateCustomer } from '@/hooks/useCrm'
import {
  CONTACT_METHODS, EMPTY_CUSTOMER_FORM, customerFormSchema, customerToForm, toCustomerInput, type CustomerFormValues,
} from '@/lib/crm'
import { applyApiErrors } from '@/lib/formErrors'

const FIELDS = Object.keys(EMPTY_CUSTOMER_FORM) as Array<keyof CustomerFormValues>

interface Props {
  open: boolean
  onClose: () => void
  /** Editing this customer. Omit to add a new one. */
  customer?: CustomerDetail | null
  onSaved?: (customer: CustomerDetail) => void
}

export function CustomerDialog({ open, onClose, customer, onSaved }: Props) {
  const editing = Boolean(customer)
  const toast = useToast()
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const [banner, setBanner] = useState<string | null>(null)
  const busy = create.isPending || update.isPending

  const {
    register, handleSubmit, reset, setError,
    formState: { errors },
  } = useForm<CustomerFormValues>({ resolver: zodResolver(customerFormSchema), defaultValues: EMPTY_CUSTOMER_FORM })

  useEffect(() => {
    if (!open) return
    setBanner(null)
    reset(customer ? customerToForm(customer) : EMPTY_CUSTOMER_FORM)
  }, [open, customer, reset])

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      const input = toCustomerInput(values)
      const saved = customer
        ? await update.mutateAsync({ id: customer.id, patch: input })
        : await create.mutateAsync(input)
      toast.success(editing ? `Saved ${saved.name}` : `Added ${saved.name}`)
      onSaved?.(saved)
      onClose()
    } catch (error) {
      setBanner(applyApiErrors(error, setError, FIELDS))
    }
  })

  const err = (field: keyof CustomerFormValues) => errors[field]?.message

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit customer' : 'Add customer'}
      description={editing ? undefined : 'Keep their details here so every inquiry and trip links back to them.'}
      busy={busy}
      submitLabel={editing ? 'Save changes' : 'Add customer'}
      busyLabel="Saving…"
      banner={banner}
      onSubmit={onSubmit}
    >
      <TextField label="Full name" autoComplete="off" maxLength={120} error={err('name')} {...register('name')} />

      <fieldset className="space-y-4">
        <legend className="mb-0.5 text-sm font-semibold text-fg">How to reach them</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Email" type="email" inputMode="email" autoComplete="off" error={err('email')} {...register('email')} />
          <TextField label="Phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+92 300 1234567" error={err('phone')} {...register('phone')} />
        </div>
        <SelectField label="Prefers to be contacted by" error={err('preferred_contact')} {...register('preferred_contact')}>
          {CONTACT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </SelectField>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="City" autoComplete="off" error={err('city')} {...register('city')} />
        <TextField label="Country" autoComplete="off" error={err('country')} {...register('country')} />
      </div>

      <TextAreaField
        label="Travel preferences"
        optional
        hint="The kind of trips they like, who they travel with, dislikes."
        error={err('preferences')}
        {...register('preferences')}
      />
      <TextAreaField label="Private notes" optional error={err('notes')} {...register('notes')} />
    </FormDialog>
  )
}
