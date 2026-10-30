import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import type { Inquiry } from '@/api/crmTypes'
import { cn } from '@/components/ui/cn'
import { STAGE_LABEL } from '@/lib/crm'
import { STAGE_DOT } from './StageBadge'
import { useWorkspace } from './Workspace'

/**
 * "Move to…" for an inquiry. Dragging is the quick way on a mouse; this is the way for the keyboard, for
 * touch screens and for screen readers, and it lists only the stages the pipeline allows.
 */
export function MoveMenu({ inquiry, className }: { inquiry: Inquiry; className?: string }) {
  const workspace = useWorkspace()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const targets = inquiry.allowed_stages

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector<HTMLElement>('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (targets.length === 0) return null

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') items[(index + 1) % items.length]?.focus()
    else if (e.key === 'ArrowUp') items[(index - 1 + items.length) % items.length]?.focus()
    else return
    e.preventDefault()
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Move the ${inquiry.destination} inquiry to another stage`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg"
      >
        <ArrowRightLeft className="size-3.5" aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Move to"
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-30 mt-1 w-44 rounded-lg border border-line-strong bg-surface p-1 shadow-pop"
        >
          <p className="px-2.5 py-1 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">Move to</p>
          {targets.map((stage) => (
            <button
              key={stage}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                workspace.moveTo(inquiry, stage)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-fg hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            >
              <span aria-hidden className={cn('size-2 rounded-full', STAGE_DOT[stage])} />
              {STAGE_LABEL[stage]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
