import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from './cn'

/**
 * A right-hand panel on desktop and a full-screen view on phones. A native modal <dialog>: Escape closes it,
 * focus is trapped and returns to whatever opened it. Children are mounted only while it is open, so every
 * opening starts from a clean state. Dialogs opened from inside it stack on top of it.
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  actions,
  backLabel = 'Back',
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** A line above the title (the customer's name, the stage...). */
  eyebrow?: ReactNode
  /** Buttons for the header's right edge, before the close button. */
  actions?: ReactNode
  backLabel?: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'animate-drawer-right fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-hidden border-l border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-black/50 open:flex sm:w-[38rem]',
        className,
      )}
    >
      {open && (
        <>
          <header className="flex items-start gap-2 border-b border-line px-3 py-3 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              aria-label={backLabel}
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:hidden"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 pt-0.5">
              {eyebrow && <div className="mb-0.5 text-xs text-fg-muted">{eyebrow}</div>}
              <h2 id={titleId} className="text-lg leading-snug font-semibold tracking-tight break-words">
                {title}
              </h2>
            </div>
            {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg sm:flex"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          {children}
        </>
      )}
    </dialog>
  )
}
