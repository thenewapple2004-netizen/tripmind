import { CalendarClock, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { FollowUp } from '@/api/crmTypes'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useDeleteFollowUp, useUpdateFollowUp } from '@/hooks/useCrm'
import { dueLabel } from '@/lib/crm'
import { useWorkspace } from './Workspace'

const DUE_TONE: Record<FollowUp['status'], string> = {
  overdue: 'font-semibold text-danger',
  today: 'font-semibold text-primary-ink',
  upcoming: 'text-fg-muted',
  completed: 'text-fg-subtle',
}

/**
 * One reminder. The checkbox completes or reopens it; the customer and inquiry names link back to their
 * drawers, so a follow-up is never a dead end.
 */
export function FollowUpRow({
  followUp,
  today,
  context = 'both',
}: {
  followUp: FollowUp
  today: string
  /** Which links to show: a row inside a customer's drawer already knows the customer. */
  context?: 'both' | 'inquiry' | 'none'
}) {
  const workspace = useWorkspace()
  const toast = useToast()
  const update = useUpdateFollowUp()
  const remove = useDeleteFollowUp()
  const done = followUp.is_completed
  const busy = update.isPending || remove.isPending

  const toggle = async () => {
    try {
      await update.mutateAsync({ id: followUp.id, patch: { completed: !done } })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'We couldn’t update that follow-up.')
    }
  }
  const destroy = async () => {
    try {
      await remove.mutateAsync(followUp.id)
      toast.success('Follow-up deleted')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'We couldn’t delete that follow-up.')
    }
  }

  return (
    <li className={cn('group flex items-start gap-3 py-3', busy && 'opacity-60')}>
      <input
        type="checkbox"
        checked={done}
        disabled={busy}
        onChange={() => void toggle()}
        aria-label={done ? `Reopen “${followUp.title}”` : `Mark “${followUp.title}” done`}
        className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--ring)]"
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium break-words', done ? 'text-fg-subtle line-through' : 'text-fg')}>{followUp.title}</p>
        {followUp.notes && <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{followUp.notes}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className={cn('inline-flex items-center gap-1', DUE_TONE[followUp.status])}>
            <CalendarClock className="size-3.5" aria-hidden />
            {dueLabel(followUp.due_date, today, done)}
          </span>
          {context === 'both' && (
            <button
              type="button"
              onClick={() => workspace.openCustomer(followUp.customer.id)}
              className="font-medium text-primary-ink hover:underline"
            >
              {followUp.customer.name}
            </button>
          )}
          {context !== 'none' && followUp.inquiry_id && followUp.inquiry_destination && (
            <button
              type="button"
              onClick={() => workspace.openInquiry(followUp.inquiry_id as string)}
              className="text-fg-muted hover:text-fg hover:underline"
            >
              {context === 'both' ? `· ${followUp.inquiry_destination}` : followUp.inquiry_destination}
            </button>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => workspace.editFollowUp(followUp)}
          aria-label={`Edit “${followUp.title}”`}
          className="flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => void destroy()}
          disabled={busy}
          aria-label={`Delete “${followUp.title}”`}
          className="flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}
