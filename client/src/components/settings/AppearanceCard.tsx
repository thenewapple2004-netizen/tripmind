import { Moon, MoonStar, Palette, Sun, Sunrise, Sunset, Waves } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { cn } from '@/components/ui/cn'
import { useAppearance } from '@/hooks/useAppearance'
import { THEMES } from '@/lib/theme'

const ICONS = { dark: Moon, ocean: Waves, dusk: Sunset, twilight: MoonStar, light: Sun, sand: Sunrise } as const

/** Appearance changes apply instantly and are saved to the account in the background. */
export function AppearanceCard() {
  const { theme, collapsed, setTheme, setCollapsed, saving, error } = useAppearance()

  return (
    <SettingsCard
      id="appearance"
      icon={<Palette className="size-4" aria-hidden />}
      title="Appearance"
      description="Saved to your account, so it follows you to other devices"
    >
      <div role="radiogroup" aria-label="Theme" className="space-y-5">
        {([['Dark', true], ['Light', false]] as const).map(([heading, wantDark]) => (
          <div key={heading}>
            <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{heading}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {THEMES.filter((t) => t.isDark === wantDark).map(({ value, label, hint, swatch }) => {
                const Icon = ICONS[value]
                const selected = theme === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex items-center gap-4 rounded-lg border p-4 text-left transition',
                      selected ? 'border-primary bg-primary-soft' : 'border-line bg-surface-2 hover:border-line-strong',
                    )}
                  >
                    <span className="flex h-12 w-16 shrink-0 overflow-hidden rounded-xl border border-line-strong" aria-hidden>
                      {swatch.map((color) => (
                        <span key={color} className="flex-1" style={{ background: color }} />
                      ))}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('flex items-center gap-2 text-sm font-semibold', selected ? 'text-primary-soft-fg' : 'text-fg')}>
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs text-fg-subtle">{hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-surface-2 p-4">
        <div>
          <p id="sidebar-label" className="text-sm font-medium text-fg">Compact sidebar</p>
          <p className="text-xs text-fg-subtle">Show only icons in the navigation on large screens.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={collapsed}
          aria-labelledby="sidebar-label"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', collapsed ? 'bg-primary' : 'bg-line-strong')}
        >
          <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', collapsed && 'translate-x-5 bg-primary-fg')} />
        </button>
      </div>

      <p aria-live="polite" className={cn('mt-3 h-4 text-xs', error ? 'text-danger' : 'text-fg-subtle')}>
        {error
          ? error instanceof ApiError
            ? error.message
            : 'We couldn’t save that. Your previous setting was restored.'
          : saving
            ? 'Saving…'
            : ''}
      </p>
    </SettingsCard>
  )
}
