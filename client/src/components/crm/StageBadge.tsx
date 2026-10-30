import type { InquiryStage } from '@/api/crmTypes'
import { cn } from '@/components/ui/cn'
import { STAGE_LABEL } from '@/lib/crm'

/** Restrained tints from the existing palette; the label carries the meaning, the colour only helps scanning. */
export const STAGE_TONE: Record<InquiryStage, string> = {
  new: 'bg-neutral-soft text-neutral-soft-fg',
  contacted: 'bg-info-soft text-info-soft-fg',
  planning: 'bg-warn-soft text-warn-soft-fg',
  quoted: 'bg-primary-soft text-primary-soft-fg',
  confirmed: 'bg-success-soft text-success-soft-fg',
  closed_lost: 'bg-danger-soft text-danger-soft-fg',
}

export const STAGE_DOT: Record<InquiryStage, string> = {
  new: 'bg-fg-subtle',
  contacted: 'bg-info-soft-fg',
  planning: 'bg-warn-soft-fg',
  quoted: 'bg-primary-ink',
  confirmed: 'bg-success-soft-fg',
  closed_lost: 'bg-danger',
}

export function StageBadge({ stage, className }: { stage: InquiryStage; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        STAGE_TONE[stage],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', STAGE_DOT[stage])} />
      {STAGE_LABEL[stage]}
    </span>
  )
}
