import { useState, type ReactNode } from 'react'
import { Plane } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useDestinationPhoto } from '@/hooks/useDestinationPhoto'

// Static strings so Tailwind can see every class. Stops are dark enough for white text.
const GRADIENTS = [
  'from-teal-600 to-emerald-900',
  'from-emerald-600 to-teal-900',
  'from-cyan-700 to-slate-900',
  'from-sky-600 to-teal-900',
  'from-lime-700 to-emerald-900',
  'from-green-600 to-cyan-900',
  'from-amber-700 to-emerald-900',
  'from-teal-700 to-sky-900',
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
 * Cover for a trip. Shows a destination photo (looked up from Wikipedia) when one exists;
 * otherwise, or while it loads, a gradient derived from the destination so the same place
 * always looks the same.
 */
export function TripCover({
  destination,
  className,
  children,
  zoomOnHover = false,
}: {
  destination: string
  className?: string
  children?: ReactNode
  /** Slowly scales the photo when an ancestor with the `group` class is hovered. */
  zoomOnHover?: boolean
}) {
  const gradient = GRADIENTS[hash(destination.toLowerCase()) % GRADIENTS.length]
  const { data: photo } = useDestinationPhoto(destination)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const showPhoto = Boolean(photo) && loadedSrc === photo

  return (
    <div className={cn('relative isolate overflow-hidden bg-linear-to-br text-white', gradient, className)}>
      {photo && (
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedSrc(photo)}
          onError={() => setLoadedSrc(null)}
          className={cn(
            'absolute inset-0 -z-20 size-full object-cover opacity-0 transition duration-700',
            showPhoto && 'opacity-100',
            zoomOnHover && 'group-hover:scale-105',
          )}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(4_14_8/0.78),rgb(4_14_8/0.18)_58%,transparent)]"
      />
      {!showPhoto && (
        <Plane
          aria-hidden
          strokeWidth={1.25}
          className="absolute -right-4 -bottom-5 -z-10 size-32 -rotate-12 text-white/15"
        />
      )}
      {children}
    </div>
  )
}
