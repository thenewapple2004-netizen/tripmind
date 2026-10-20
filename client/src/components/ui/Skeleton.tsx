import { cn } from './cn'

/** Placeholder block that shimmers while content loads. Decorative, so hidden from assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-md bg-size-[200%_100%]',
        'bg-[linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-shine)_50%,var(--skeleton)_75%)]',
        className,
      )}
    />
  )
}
