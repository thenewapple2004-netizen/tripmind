import type { ReactNode } from 'react'
import { cn } from './cn'

/** Circular progress. Pass `danger` to switch the arc to the warning colour. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  danger = false,
  label,
  children,
  className,
}: {
  /** 0–100; values above 100 are clamped for the arc. */
  value: number
  size?: number
  stroke?: number
  danger?: boolean
  label: string
  children?: ReactNode
  className?: string
}) {
  const clamped = Math.min(100, Math.max(0, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={cn('transition-[stroke-dashoffset] duration-700', danger ? 'stroke-danger' : 'stroke-primary')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
