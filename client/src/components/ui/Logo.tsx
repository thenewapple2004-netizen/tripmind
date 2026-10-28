import { Compass } from 'lucide-react'
import { cn } from './cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg',
        className,
      )}
    >
      <Compass className="size-5" strokeWidth={2.25} aria-hidden />
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-xl font-semibold tracking-tight text-fg', className)}>
      Trip<span className="text-primary-ink">Mind</span>
    </span>
  )
}
