import type { ReactNode } from 'react'
import { Plane } from 'lucide-react'
import { cn } from '@/components/ui/cn'

// Static strings so Tailwind can see every class. Stops are dark enough for white text.
const GRADIENTS = [
  'from-teal-600 to-cyan-800',
  'from-indigo-600 to-violet-800',
  'from-rose-600 to-orange-700',
  'from-sky-600 to-blue-800',
  'from-emerald-600 to-teal-800',
  'from-fuchsia-600 to-purple-800',
  'from-amber-600 to-rose-800',
  'from-blue-600 to-indigo-800',
]

/** FNV-1a with a final mix, so similar names still land on different gradients. */
function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  return h >>> 0
}

/**
 * Decorative cover for a trip. The gradient is derived from the destination so the same
 * place always looks the same, without needing photos or an image service.
 */
export function TripCover({
  destination,
  className,
  children,
}: {
  destination: string
  className?: string
  children?: ReactNode
}) {
  const gradient = GRADIENTS[hash(destination.toLowerCase()) % GRADIENTS.length]
  return (
    <div className={cn('relative isolate overflow-hidden bg-linear-to-br text-white', gradient, className)}>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_88%_8%,rgb(255_255_255/0.28),transparent_46%),linear-gradient(to_top,rgb(0_0_0/0.38),transparent_62%)]"
      />
      <Plane
        aria-hidden
        strokeWidth={1.25}
        className="absolute -right-4 -bottom-5 -z-10 size-32 -rotate-12 text-white/15"
      />
      {children}
    </div>
  )
}
