import { useState } from 'react'
import { Ban, PlaneTakeoff } from 'lucide-react'
import type { Inquiry, InquiryStage } from '@/api/crmTypes'
import { cn } from '@/components/ui/cn'
import { STAGES, STAGE_HINT, STAGE_LABEL, canMove, groupByStage } from '@/lib/crm'
import { InquiryCard } from './InquiryCard'
import { STAGE_DOT } from './StageBadge'
import { useWorkspace } from './Workspace'

/**
 * The Kanban board. Dragging a card highlights the columns it may enter and dims the ones it may not; dropping
 * on an allowed column moves it (the server has the last word), dropping elsewhere explains why not and moves nothing.
 * `MoveMenu` on each card is the same action without a mouse.
 */
export function InquiryBoard({ inquiries, today }: { inquiries: Inquiry[]; today: string }) {
  const workspace = useWorkspace()
  const [dragged, setDragged] = useState<Inquiry | null>(null)
  const [over, setOver] = useState<InquiryStage | null>(null)
  const groups = groupByStage(inquiries)

  const endDrag = () => {
    setDragged(null)
    setOver(null)
  }

  return (
    <div className="relative -mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <div className="flex min-w-max gap-3 lg:grid lg:min-w-0 lg:grid-cols-6">
        {STAGES.map((stage) => {
          const cards = groups[stage]
          const allowed = dragged ? canMove(dragged, stage) : false
          const isSource = dragged?.stage === stage
          const hovering = over === stage && dragged !== null
          return (
            <section
              key={stage}
              aria-labelledby={`stage-${stage}`}
              onDragOver={(e) => {
                if (!dragged) return
                // Every column accepts the drop so that a refused move can say why; the dimmed columns already
                // show where a card may go.
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (over !== stage) setOver(stage)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((current) => (current === stage ? null : current))
              }}
              onDrop={(e) => {
                e.preventDefault()
                const target = dragged
                endDrag()
                if (target && target.stage !== stage) workspace.moveTo(target, stage)
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border bg-surface-2/50 transition-colors lg:w-auto lg:min-w-0',
                !dragged && 'border-line',
                dragged && allowed && 'border-primary-line/70 bg-primary-soft/40',
                dragged && !allowed && !isSource && 'border-line opacity-55',
                dragged && isSource && 'border-line',
                hovering && allowed && 'border-primary bg-primary-soft/70',
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                <h2 id={`stage-${stage}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg">
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', STAGE_DOT[stage])} />
                  <span className="truncate">{STAGE_LABEL[stage]}</span>
                </h2>
                <span className="rounded bg-surface-3 px-1.5 py-px text-xs font-semibold text-fg-muted tabular-nums">
                  {cards.length}
                  <span className="sr-only"> inquiries</span>
                </span>
              </header>

              <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {cards.map((inquiry) => (
                  <li key={inquiry.id}>
                    <InquiryCard
                      inquiry={inquiry}
                      today={today}
                      dragging={dragged?.id === inquiry.id}
                      onDragStart={(item, event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', item.id)
                        setDragged(item)
                      }}
                      onDragEnd={endDrag}
                    />
                  </li>
                ))}
                {cards.length === 0 && (
                  <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-xs text-fg-subtle">
                    {dragged && allowed ? (
                      'Drop here'
                    ) : dragged && !allowed && !isSource ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Ban className="size-3.5" aria-hidden />
                        Not from {STAGE_LABEL[dragged.stage]}
                      </span>
                    ) : stage === 'confirmed' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <PlaneTakeoff className="size-3.5" aria-hidden />
                        {STAGE_HINT[stage]}
                      </span>
                    ) : (
                      STAGE_HINT[stage]
                    )}
                  </li>
                )}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
