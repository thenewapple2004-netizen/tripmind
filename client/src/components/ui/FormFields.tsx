import { useId, type ComponentProps, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from './cn'
import { inputStyles } from './TextField'

function FieldShell({
  id,
  label,
  optional,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {optional && <span className="ml-1 font-normal text-fg-subtle">(optional)</span>}
      </label>
      {children}
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

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'id'> {
  label: string
  optional?: boolean
  error?: string
  hint?: string
}

export function SelectField({ label, optional, error, hint, className, children, ...props }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} optional={optional} error={error} hint={hint} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(inputStyles, error && 'border-danger focus:border-danger focus:ring-danger/25')}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}

interface TextAreaFieldProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  label: string
  optional?: boolean
  error?: string
  hint?: string
}

export function TextAreaField({ label, optional, error, hint, className, rows = 3, ...props }: TextAreaFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} optional={optional} error={error} hint={hint} className={className}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(
          inputStyles,
          'h-auto min-h-20 resize-y py-2.5 leading-relaxed sm:py-2',
          error && 'border-danger focus:border-danger focus:ring-danger/25',
        )}
        {...props}
      />
    </FieldShell>
  )
}

/**
 * A set of options the owner can switch on and off (accommodation types, travel styles). Real checkboxes
 * under the buttons, so keyboard and screen-reader behaviour comes for free.
 */
export function ChipGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  hint,
}: {
  legend: string
  options: Array<{ value: T; label: string }>
  value: readonly string[]
  onChange: (next: T[]) => void
  hint?: string
}) {
  const toggle = (option: T) =>
    onChange((value.includes(option) ? value.filter((v) => v !== option) : [...value, option]) as T[])
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value.includes(option.value)
          return (
            <label
              key={option.value}
              className={cn(
                'flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-primary/30',
                on
                  ? 'border-primary-line bg-primary-soft text-primary-soft-fg'
                  : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </div>
      {hint && <p className="mt-1.5 text-sm text-fg-subtle">{hint}</p>}
    </fieldset>
  )
}

/** Pick one of a few options, or none: comfort level, pace. Clicking the chosen one again clears it. */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: Array<{ value: T; label: string; hint?: string }>
  value: string
  onChange: (next: T | '') => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">
        {legend}
        <span className="ml-1 font-normal text-fg-subtle">(optional)</span>
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const on = value === option.value
          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer flex-col rounded-lg border px-3 py-2 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-primary/30',
                on ? 'border-primary-line bg-primary-soft' : 'border-line-strong bg-surface hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name={legend}
                checked={on}
                onChange={() => onChange(option.value)}
                onClick={() => on && onChange('')}
                className="sr-only"
              />
              <span className={cn('text-sm font-medium', on ? 'text-primary-soft-fg' : 'text-fg')}>{option.label}</span>
              {option.hint && <span className="text-xs text-fg-subtle">{option.hint}</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
