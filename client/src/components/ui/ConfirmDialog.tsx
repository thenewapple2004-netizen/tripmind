import { useEffect, useId, useRef } from 'react'
import { CircleAlert, TriangleAlert } from 'lucide-react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  /** Failure from the last attempt; the dialog stays open so the user can retry. */
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Destructive-action confirmation built on the native <dialog> element, which provides
 * focus trapping, Escape-to-close, inert background and top-layer stacking for free.
 * Focus starts on "Cancel" (the first focusable control) so Enter can't delete by accident.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // Escape: let React state decide, and ignore it mid-request.
        event.preventDefault()
        if (!pending) onCancel()
      }}
      onClick={(event) => {
        if (event.target === ref.current && !pending) onCancel() // click on the backdrop
      }}
      className="animate-dialog-in m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-slate-950/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <TriangleAlert className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <p id={descriptionId} className="mt-1.5 text-sm text-fg-muted">
              {description}
            </p>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger-soft-fg"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 rounded-b-2xl border-t border-line bg-surface-2 px-6 py-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={pending}>
          {pending ? 'Deleting…' : confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
