import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

/** The standard surface: a 1px border on a flat fill, with a barely-there shadow. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('tm-card rounded-xl border border-line bg-surface shadow-card', className)}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-40 flex-1 items-center gap-3">
        {icon && <span className="shrink-0 text-fg-subtle [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 truncate text-xs text-fg-subtle">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Compact placeholder for a card with nothing to show yet. */
export function EmptyNote({
  icon,
  children,
  className,
}: {
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-fg-subtle',
        className,
      )}
    >
      {icon && <span className="text-fg-subtle/80">{icon}</span>}
      <p className="max-w-56">{children}</p>
    </div>
  )
}
