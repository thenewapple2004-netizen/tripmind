import { cn } from './cn'

/** Profile picture when there is one; otherwise initials on the brand colour. */
export function Avatar({
  initials,
  src,
  className,
}: {
  initials: string
  src?: string | null
  className?: string
}) {
  const base = 'flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-primary/30'
  if (src) {
    return <img src={src} alt="" className={cn(base, 'object-cover', className)} />
  }
  return (
    <span aria-hidden className={cn(base, 'bg-primary font-display text-sm font-bold text-primary-fg', className)}>
      {initials}
    </span>
  )
}
