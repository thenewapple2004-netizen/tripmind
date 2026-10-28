import { useMemo, useState } from 'react'
import { Globe2, LocateFixed } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { Profile } from '@/api/authTypes'
import { Banner, SaveBar, SettingsCard } from '@/components/settings/SettingsCard'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { inputStyles } from '@/components/ui/TextField'
import { useUpdatePreferences } from '@/hooks/useProfile'
import { CURRENCIES, deviceTimezone, timeInZone, timezoneOptions } from '@/lib/profile'

function currencyLabel(code: string): string {
  try {
    return `${code} — ${new Intl.DisplayNames('en', { type: 'currency' }).of(code) ?? code}`
  } catch {
    return code
  }
}

/** What an amount will look like in the chosen currency, using the same formatting as the app. */
function sample(code: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(1234.5)
  } catch {
    return ''
  }
}

export function RegionalForm({ profile }: { profile: Profile }) {
  const toast = useToast()
  const update = useUpdatePreferences()
  const [currency, setCurrency] = useState(profile.currency)
  const [timezone, setTimezone] = useState(profile.timezone)
  const [banner, setBanner] = useState<string | null>(null)

  const zones = useMemo(() => {
    const all = timezoneOptions()
    return all.includes(timezone) ? all : [timezone, ...all]
  }, [timezone])
  const device = deviceTimezone()
  const dirty = currency !== profile.currency || timezone !== profile.timezone

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBanner(null)
    try {
      const next = await update.mutateAsync({ currency, timezone })
      setCurrency(next.currency)
      setTimezone(next.timezone)
      toast.success('Currency and timezone saved.')
    } catch (error) {
      setBanner(error instanceof ApiError ? error.message : 'We couldn’t save your settings. Please try again.')
    }
  }

  return (
    <SettingsCard
      id="regional"
      icon={<Globe2 className="size-4" aria-hidden />}
      title="Currency & timezone"
      description="How amounts and times are shown to you"
    >
      <form onSubmit={submit} className="space-y-5">
        {banner && <Banner tone="error">{banner}</Banner>}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-fg">Preferred currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputStyles}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {currencyLabel(code)}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-fg-subtle">
              Example: <span className="font-semibold text-fg tabular-nums">{sample(currency)}</span>. This changes the symbol
              used; existing amounts aren’t converted.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-fg">Timezone</span>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputStyles}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
              <span>
                Local time there: <span className="font-semibold text-fg">{timeInZone(timezone)}</span>
              </span>
              {device !== timezone && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" icon={<LocateFixed className="size-3.5" aria-hidden />} onClick={() => setTimezone(device)}>
                  Use {device.replaceAll('_', ' ')}
                </Button>
              )}
            </span>
          </label>
        </div>

        <SaveBar dirty={dirty} saving={update.isPending} onReset={() => { setCurrency(profile.currency); setTimezone(profile.timezone) }} />
      </form>
    </SettingsCard>
  )
}
