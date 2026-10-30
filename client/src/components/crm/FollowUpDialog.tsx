import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { FollowUp } from '@/api/crmTypes'
import { FormDialog } from '@/components/ui/FormDialog'
import { SelectField, TextAreaField } from '@/components/ui/FormFields'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useAllInquiries, useCreateFollowUp, useCustomerOptions, useUpdateFollowUp } from '@/hooks/useCrm'
import { useToday } from '@/hooks/useToday'
import { followUpFormSchema, STAGE_LABEL, type FollowUpFormValues } from '@/lib/crm'
import { applyApiErrors } from '@/lib/formErrors'

const EMPTY: FollowUpFormValues = { title: '', due_date: '', notes: '', customer_id: '', inquiry_id: '' }
const FIELDS = Object.keys(EMPTY) as Array<keyof FollowUpFormValues>

interface Props {
  open: boolean
  onClose: () => void
  /** Editing this follow-up. Omit to schedule a new one. */
  followUp?: FollowUp | null
  /** For a new one: who it is for, when opened from a customer or an inquiry. */
  customerId?: string
  inquiryId?: string
  /** Names for the "for…" line when the subject is fixed. */
  subjectLabel?: string
  initialTitle?: string
}

export function FollowUpDialog({ open, onClose, followUp, customerId, inquiryId, subjectLabel, initialTitle }: Props) {
  const editing = Boolean(followUp)
  const today = useToday()
  const toast = useToast()
  const create = useCreateFollowUp()
  const update = useUpdateFollowUp()
  const customers = useCustomerOptions()
  const [banner, setBanner] = useState<string | null>(null)
  const busy = create.isPending || update.isPending

  const {
    register, handleSubmit, reset, setError, watch, setValue,
    formState: { errors },
  } = useForm<FollowUpFormValues>({ resolver: zodResolver(followUpFormSchema), defaultValues: EMPTY })

  const subjectFixed = editing || Boolean(customerId || inquiryId)
  const chosenCustomer = watch('customer_id')
  const inquiries = useAllInquiries({ customer_id: !subjectFixed && chosenCustomer ? chosenCustomer : undefined })

  useEffect(() => {
    if (!open) return
    setBanner(null)
    reset(
      followUp
        ? { title: followUp.title, due_date: followUp.due_date, notes: followUp.notes ?? '', customer_id: followUp.customer.id, inquiry_id: followUp.inquiry_id ?? '' }
        : { ...EMPTY, title: initialTitle ?? '', due_date: today, customer_id: customerId ?? '', inquiry_id: inquiryId ?? '' },
    )
  }, [open, followUp, customerId, inquiryId, initialTitle, today, reset])

  const onSubmit = handleSubmit(async (v) => {
    setBanner(null)
    try {
      if (followUp) {
        await update.mutateAsync({ id: followUp.id, patch: { title: v.title.trim(), due_date: v.due_date, notes: v.notes.trim() || null } })
        toast.success('Follow-up saved')
      } else {
        await create.mutateAsync({
          title: v.title.trim(),
          due_date: v.due_date,
          notes: v.notes.trim() || null,
          ...(v.inquiry_id ? { inquiry_id: v.inquiry_id } : { customer_id: v.customer_id }),
        })
        toast.success('Follow-up scheduled')
      }
      onClose()
    } catch (error) {
      setBanner(applyApiErrors(error, setError, FIELDS))
    }
  })

  const err = (field: keyof FollowUpFormValues) => errors[field]?.message
  const customerInquiries = (inquiries.data?.items ?? []).filter((i) => i.customer.id === chosenCustomer)

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit follow-up' : 'Schedule a follow-up'}
      description={subjectFixed && subjectLabel ? `For ${subjectLabel}` : undefined}
      busy={busy}
      submitLabel={editing ? 'Save changes' : 'Schedule'}
      busyLabel="Saving…"
      banner={banner}
      onSubmit={onSubmit}
    >
      {!subjectFixed && (
        <>
          <SelectField
            label="Customer"
            error={err('customer_id')}
            {...register('customer_id', { onChange: () => setValue('inquiry_id', '') })}
          >
            <option value="">{customers.isPending ? 'Loading customers…' : 'Choose a customer'}</option>
            {customers.data?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
          {chosenCustomer && customerInquiries.length > 0 && (
            <SelectField label="About an inquiry" optional error={err('inquiry_id')} {...register('inquiry_id')}>
              <option value="">Not about a specific inquiry</option>
              {customerInquiries.map((i) => (
                <option key={i.id} value={i.id}>{i.destination} · {STAGE_LABEL[i.stage]}</option>
              ))}
            </SelectField>
          )}
        </>
      )}
      <TextField label="What needs doing" placeholder="e.g. Send the revised quote" maxLength={150} error={err('title')} {...register('title')} />
      <TextField label="Due" type="date" error={err('due_date')} {...register('due_date')} />
      <TextAreaField label="Notes" optional rows={3} error={err('notes')} {...register('notes')} />
    </FormDialog>
  )
}
