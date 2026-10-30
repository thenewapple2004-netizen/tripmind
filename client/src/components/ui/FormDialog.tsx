import type { FormEventHandler, ReactNode } from 'react'
import { CircleAlert, X } from 'lucide-react'
import { Button } from './Button'
import { Modal, SHEET } from './Modal'
import { cn } from './cn'

/** The error shown above a form when the server refused something that doesn't belong to one field. */
export function FormBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger-soft-fg">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}

/**
 * The frame every form dialog in the Customer Workspace shares: a title, a scrolling body and a footer that
 * stays in view. A full-screen sheet on phones. Its children mount only while it is open, so a form always
 * starts from its own defaults.
 */
export function FormDialog({
  open,
  onClose,
  title,
  description,
  busy = false,
  onSubmit,
  submitLabel,
  busyLabel,
  banner = null,
  footerStart,
  wide = false,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  busy?: boolean
  onSubmit: FormEventHandler<HTMLFormElement>
  submitLabel: string
  busyLabel?: string
  banner?: string | null
  /** Left side of the footer: Back, or a hint. */
  footerStart?: ReactNode
  wide?: boolean
  children: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      label={title}
      dismissible={!busy}
      className={cn(SHEET, 'sm:w-[calc(100%-2rem)]', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
    >
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="-mr-1.5 rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <FormBanner message={banner} />
          {children}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-3.5 sm:px-6">
          <div className="min-w-0 text-sm text-fg-muted">{footerStart}</div>
          <div className="flex shrink-0 gap-2">
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              {busy && busyLabel ? busyLabel : submitLabel}
            </Button>
          </div>
        </footer>
      </form>
    </Modal>
  )
}
