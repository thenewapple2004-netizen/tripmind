import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { ApiError } from '@/api/errors'
import type { Inquiry, InquiryStage } from '@/api/crmTypes'
import { FormDialog } from '@/components/ui/FormDialog'
import { TextAreaField } from '@/components/ui/FormFields'
import { useToast } from '@/components/ui/Toast'
import { useMoveInquiry } from '@/hooks/useCrm'
import { STAGE_LABEL, canMove, refusalMessage } from '@/lib/crm'

type Movable = Pick<Inquiry, 'id' | 'stage' | 'converted_trip_id' | 'destination'>

/** Asks why an inquiry is being closed. The reason is optional but ends up in the customer's history. */
function CloseReasonDialog({
  inquiry,
  busy,
  onConfirm,
  onClose,
}: {
  inquiry: Movable | null
  busy: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const { register, handleSubmit, reset } = useForm<{ reason: string }>({ defaultValues: { reason: '' } })
  useEffect(() => {
    if (inquiry) reset({ reason: '' })
  }, [inquiry, reset])

  return (
    <FormDialog
      open={Boolean(inquiry)}
      onClose={onClose}
      title="Close this inquiry?"
      description={inquiry ? `${inquiry.destination} will move to Closed / Lost. You can reopen it later.` : undefined}
      busy={busy}
      submitLabel="Close inquiry"
      busyLabel="Closing…"
      onSubmit={handleSubmit((v) => onConfirm(v.reason.trim()))}
    >
      <TextAreaField
        label="Why did it not go ahead?"
        optional
        rows={3}
        maxLength={300}
        placeholder="e.g. Chose another agency, travel dates changed"
        {...register('reason')}
      />
    </FormDialog>
  )
}

/**
 * Stage changes for the board and the inquiry drawer, in one place: the pipeline's rules are checked first
 * (a refused move explains itself and changes nothing), closing asks for a reason, and the server's answer
 * decides what the owner sees.
 */
export function useStageMoves(): { moveTo: (inquiry: Movable, stage: InquiryStage) => void; pending: boolean; element: ReactNode } {
  const toast = useToast()
  const move = useMoveInquiry()
  const [closing, setClosing] = useState<Movable | null>(null)

  const run = async (inquiry: Movable, stage: InquiryStage, reason?: string) => {
    try {
      await move.mutateAsync({ id: inquiry.id, stage, reason: reason || undefined })
      toast.success(`${inquiry.destination} moved to ${STAGE_LABEL[stage]}`)
      setClosing(null)
    } catch (error) {
      setClosing(null)
      toast.error(error instanceof ApiError ? error.message : 'We couldn’t move that inquiry. Please try again.')
    }
  }

  const moveTo = (inquiry: Movable, stage: InquiryStage) => {
    if (inquiry.stage === stage) return
    if (!canMove(inquiry, stage)) {
      toast.error(refusalMessage(inquiry, stage))
      return
    }
    if (stage === 'closed_lost') setClosing(inquiry)
    else void run(inquiry, stage)
  }

  const element = (
    <CloseReasonDialog
      inquiry={closing}
      busy={move.isPending}
      onClose={() => setClosing(null)}
      onConfirm={(reason) => closing && void run(closing, 'closed_lost', reason)}
    />
  )
  return { moveTo, pending: move.isPending, element }
}
