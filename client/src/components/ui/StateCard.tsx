import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

interface StateCardProps {
  icon: LucideIcon
  title: string
  description: string
  tone?: 'neutral' | 'danger'
  children?: ReactNode
}

/** Centered message used for empty, no-result, error and not-found states. */
export function StateCard({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  children,
}: StateCardProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className="animate-fade-in flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center"
    >
      <div
        className={cn(
          'mb-5 flex size-14 items-center justify-center rounded-2xl',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary-soft-fg',
        )}
      >
        <Icon className="size-7" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-fg-muted">{description}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  )
}
