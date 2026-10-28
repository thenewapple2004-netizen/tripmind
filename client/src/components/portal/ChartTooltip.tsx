import { formatCompactCurrency } from '@/lib/owner'

interface Entry {
  name?: string | number
  value?: unknown
  color?: string
}

/** Recharts tooltip styled for the dark surfaces. */
export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Entry[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-lift">
      {label !== undefined && <p className="mb-1 font-semibold text-fg">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2 text-fg-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}:<span className="font-semibold tabular-nums text-fg">{formatCompactCurrency(Number(p.value) || 0)}</span>
        </p>
      ))}
    </div>
  )
}
