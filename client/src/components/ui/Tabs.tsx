import { createContext, use, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from './cn'

export interface TabDef<T extends string> {
  id: T
  label: string
  /** A count shown beside the label (a real number, or nothing). */
  count?: number
}

const TabsContext = createContext('')

/**
 * An accessible tab list: arrow keys, Home and End move between tabs, only the selected one is in the tab
 * order. Render the panel yourself with `tabPanelProps`.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
  children,
}: {
  tabs: Array<TabDef<T>>
  value: T
  onChange: (id: T) => void
  label: string
  className?: string
  /** The panels: render a <TabPanel id=...> for the selected tab. */
  children?: ReactNode
}) {
  const baseId = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <TabsContext value={baseId}>
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el
            }}
            id={`${baseId}-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${baseId}-${tab.id}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              '-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
              selected ? 'border-primary text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded bg-surface-3 px-1.5 py-px text-xs font-semibold text-fg-muted tabular-nums">{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
    {children}
    </TabsContext>
  )
}

/** The panel for one tab. Put it inside <Tabs> and render only the selected tab's panel. */
export function TabPanel({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const baseId = use(TabsContext)
  return (
    <div id={`${baseId}-${id}-panel`} role="tabpanel" aria-labelledby={`${baseId}-${id}-tab`} tabIndex={0} className={cn('outline-none', className)}>
      {children}
    </div>
  )
}

