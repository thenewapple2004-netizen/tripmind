import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export interface TabDef {
  id: string
  label: string
  icon: ReactNode
  /** Small pill after the label (a count or progress). */
  badge?: string
  badgeTone?: 'default' | 'warn'
}

/** Accessible tab list: arrow keys, Home and End move between tabs. */
export function TripTabs({
  tabs,
  active,
  onChange,
  idPrefix,
}: {
  tabs: TabDef[]
  active: string
  onChange: (id: string) => void
  idPrefix: string
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    onChange(tabs[next].id)
    document.getElementById(`${idPrefix}-tab-${tabs[next].id}`)?.focus()
  }

  return (
    <div role="tablist" aria-label="Trip sections" className="-mx-1 flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1 shadow-card">
      {tabs.map((tab, index) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition',
              selected ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <span aria-hidden>{tab.icon}</span>
            {tab.label}
            {tab.badge && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                  tab.badgeTone === 'warn'
                    ? 'bg-warn-soft text-warn-soft-fg'
                    : selected
                      ? 'bg-primary-fg/15 text-primary-fg'
                      : 'bg-surface-3 text-fg-muted',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
