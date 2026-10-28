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
      className="animate-fade-in flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center"
    >
      <div
        className={cn(
          'mb-4 flex size-11 items-center justify-center rounded-lg',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface-3 text-fg-muted',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-fg-muted">{description}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  )
}
