import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from './cn'

/** Classes that make a dialog a full-screen sheet on phones and a centred panel from `sm` up. */
export const SHEET = 'm-0 h-dvh max-h-none w-full max-w-none rounded-none border-0 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:rounded-xl sm:border'

/**
 * A modal on the native <dialog>: focus is trapped, Escape closes it and focus returns to what opened it.
 * Children are only mounted while open, so every opening starts from a clean state.
 */
export function Modal({
  open,
  onClose,
  label,
  className,
  dismissible = true,
  children,
}: {
  open: boolean
  onClose: () => void
  /** The dialog's accessible name. */
  label: string
  className?: string
  /** False while something is in flight, so a stray Escape or click can't abandon it. */
  dismissible?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current && dismissible) onClose()
      }}
      className={cn(
        'animate-dialog-in overflow-hidden border-line-strong bg-surface p-0 text-fg shadow-pop backdrop:bg-black/60 open:flex open:flex-col',
        className,
      )}
    >
      {open ? children : null}
    </dialog>
  )
}
