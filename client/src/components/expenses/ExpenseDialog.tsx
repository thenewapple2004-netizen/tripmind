import { useEffect, useId, useRef, useState } from 'react'
import { useForm, type UseFormSetError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar, CircleAlert, Tag, X } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { Expense, Trip } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useCreateExpense, useUpdateExpense } from '@/hooks/useExpenses'
import {
  EXPENSE_CATEGORIES,
  expenseFormSchema,
  toExpenseInput,
  type ExpenseFormValues,
} from '@/lib/schema'
import { currencySymbol } from '@/lib/money'

interface ExpenseDialogProps {
  open: boolean
  trip: Trip
  expense?: Expense | null
  onClose: () => void
}

const DEFAULT_VALUES: ExpenseFormValues = {
  title: '',
  amount: '',
  category: 'Other',
  expense_date: '',
  description: '',
}

export function ExpenseDialog({ open, trip, expense, onClose }: ExpenseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const toast = useToast()
  const [serverError, setServerError] = useState<string | null>(null)

  const isEditing = Boolean(expense)
  const createExpense = useCreateExpense(trip.id)
  const updateExpense = useUpdateExpense(trip.id)
  const isSubmitting = createExpense.isPending || updateExpense.isPending

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
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
      if (expense) {
        reset({
          title: expense.title,
          amount: String(expense.amount),
          category: expense.category,
          expense_date: expense.expense_date,
          description: expense.description ?? '',
        })
      } else {
        reset({
          ...DEFAULT_VALUES,
          expense_date: trip.start_date,
        })
      }
    }
  }, [open, expense, trip.start_date, reset])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    if (values.expense_date < trip.start_date || values.expense_date > trip.end_date) {
      setError('expense_date', {
        type: 'manual',
        message: `Date must be between ${trip.start_date} and ${trip.end_date}.`,
      })
      return
    }

    try {
      const input = toExpenseInput(values)
      if (isEditing && expense) {
        await updateExpense.mutateAsync({ expenseId: expense.id, patch: input })
        toast.success(`Updated “${values.title}”`)
      } else {
        await createExpense.mutateAsync(input)
        toast.success(`Recorded “${values.title}”`)
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
          {isEditing ? 'Edit Expense' : 'Log Expense'}
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
          label="Expense title"
          placeholder="e.g. Hotel reservation, Flight, Group dinner"
          maxLength={150}
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            prefix={currencySymbol()}
            placeholder="0.00"
            error={errors.amount?.message}
            {...register('amount')}
          />

          <div>
            <label htmlFor="expense-category" className="mb-1.5 block text-sm font-medium text-fg">
              Category
            </label>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle"
              >
                <Tag className="size-4" />
              </span>
              <select
                id="expense-category"
                className="block h-11 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm text-fg shadow-sm transition-colors hover:border-fg-subtle focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/25"
                {...register('category')}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {errors.category?.message && (
              <p className="mt-1.5 text-sm text-danger">{errors.category.message}</p>
            )}
          </div>
        </div>

        <TextField
          label="Date of expense"
          type="date"
          min={trip.start_date}
          max={trip.end_date}
          icon={<Calendar className="size-4" />}
          hint={`Must be between ${trip.start_date} and ${trip.end_date}`}
          error={errors.expense_date?.message}
          {...register('expense_date')}
        />

        <div>
          <label htmlFor="expense-description" className="mb-1.5 block text-sm font-medium text-fg">
            Notes / Receipt info <span className="font-normal text-fg-subtle">(Optional)</span>
          </label>
          <textarea
            id="expense-description"
            rows={3}
            maxLength={500}
            placeholder="Payment method, receipt notes, split details..."
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
            {isEditing ? 'Save Changes' : 'Record Expense'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

function applyApiError(error: unknown, setError: UseFormSetError<ExpenseFormValues>): string | null {
  if (!(error instanceof ApiError)) return 'Something unexpected went wrong. Please try again.'

  const unmatched: string[] = [...error.formErrors]
  const fields = ['title', 'amount', 'category', 'expense_date', 'description']
  let focused = false

  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (fields.includes(field)) {
      setError(field as keyof ExpenseFormValues, { type: 'server', message }, { shouldFocus: !focused })
      focused = true
    } else {
      unmatched.push(message)
    }
  }

  if (unmatched.length > 0) return unmatched.join(' ')
  return focused ? null : error.message
}
