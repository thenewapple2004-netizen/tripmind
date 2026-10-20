import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from './cn'

type Variant = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  variant: Variant
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = use(ToastContext)
  if (!api) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}

const icons = { success: CircleCheck, error: CircleAlert, info: Info } as const
const accents: Record<Variant, string> = {
  success: 'text-success-soft-fg bg-success-soft',
  error: 'text-danger bg-danger-soft',
  info: 'text-info-soft-fg bg-info-soft',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (variant: Variant, message: string) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-2), { id, message, variant }])
      // Errors stay longer: they usually need reading, not just glancing at.
      window.setTimeout(() => dismiss(id), variant === 'error' ? 8000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext value={api}>
      {children}
      {/* The live region must exist before messages are added for them to be announced. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((toast) => {
          const Icon = icons[toast.variant]
          return (
            <div
              key={toast.id}
              role={toast.variant === 'error' ? 'alert' : undefined}
              className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-pop"
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  accents[toast.variant],
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="min-w-0 flex-1 self-center text-sm font-medium text-fg">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-m-1 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}
