import { useId, type ComponentProps, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from './cn'

const inputBase =
  'block h-11 w-full rounded-lg border bg-surface px-3 text-base text-fg shadow-sm transition-colors ' +
  'placeholder:text-fg-subtle focus:outline-none focus:ring-3 ' +
  'disabled:opacity-60 sm:text-sm'

/** Shared by text inputs, the search box and selects. */
export const inputStyles = `${inputBase} border-line-strong hover:border-fg-subtle focus:border-primary focus:ring-primary/25`
const inputErrorStyles = `${inputBase} border-danger focus:border-danger focus:ring-danger/25`

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string
  error?: string
  hint?: string
  /** Decorative icon shown inside the left edge of the input. */
  icon?: ReactNode
  /** Short text such as a currency symbol shown inside the left edge. */
  prefix?: string
}

export function TextField({
  label,
  error,
  hint,
  icon,
  prefix,
  className,
  ref,
  ...props
}: TextFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const hasLeading = Boolean(icon || prefix)

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        {hasLeading && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle"
          >
            {icon ?? <span className="text-base font-medium sm:text-sm">{prefix}</span>}
          </span>
        )}
        <input
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            error ? inputErrorStyles : inputStyles,
            hasLeading && 'pl-9',
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
