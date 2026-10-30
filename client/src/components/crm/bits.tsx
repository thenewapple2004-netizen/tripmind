import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

/** A small label over a value: how facts about a customer or inquiry are laid out. */
export function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-fg">{children}</dd>
    </div>
  )
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-fg">{children}</h3>
      {action}
    </div>
  )
}

/** The muted line shown where a section has nothing in it yet. */
export function Nothing({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-sm text-fg-subtle">{children}</p>
}
