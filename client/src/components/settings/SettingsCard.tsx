import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'

export function SettingsCard({
  id,
  icon,
  title,
  description,
  children,
}: {
  id?: string
  icon: ReactNode
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader title={title} description={description} icon={icon} />
      {children}
    </Card>
  )
}

export function Banner({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
        tone === 'error'
          ? 'border-danger-line bg-danger-soft text-danger-soft-fg'
          : 'border-primary/30 bg-primary-soft text-primary-soft-fg',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

/** Footer for a form card: Save is only enabled when there is something to save. */
export function SaveBar({
  dirty,
  saving,
  onReset,
  label = 'Save changes',
}: {
  dirty: boolean
  saving: boolean
  onReset?: () => void
  label?: string
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
      {dirty && !saving && <p className="mr-auto text-xs text-fg-subtle">You have unsaved changes.</p>}
      {onReset && (
        <Button variant="ghost" onClick={onReset} disabled={!dirty || saving}>
          Discard
        </Button>
      )}
      <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
        {label}
      </Button>
    </div>
  )
}

/** Accessible segmented choice (radio group) used for pace, budget style and theme. */
export function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  columns = 3,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string; hint?: string }>
  columns?: 2 | 3
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg border p-3 text-left transition',
              selected
                ? 'border-primary bg-primary-soft'
                : 'border-line bg-surface-2 hover:border-line-strong',
            )}
          >
            <span className={cn('block text-sm font-semibold', selected ? 'text-primary-soft-fg' : 'text-fg')}>{option.label}</span>
            {option.hint && <span className="mt-0.5 block text-xs text-fg-subtle">{option.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
