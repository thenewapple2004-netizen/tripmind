import { useState } from 'react'
import { Compass } from 'lucide-react'
import type { BudgetStyle, Profile, TravelPace } from '@/api/authTypes'
import { Banner, ChoiceGroup, SaveBar, SettingsCard } from '@/components/settings/SettingsCard'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useUpdatePreferences } from '@/hooks/useProfile'
import { ApiError } from '@/api/errors'
import { BUDGET_STYLES, TRAVEL_INTERESTS, TRAVEL_PACES } from '@/lib/profile'

interface Draft {
  interests: string[]
  pace: TravelPace
  budget: BudgetStyle
}

const draftOf = (p: Profile): Draft => ({ interests: p.travel_interests, pace: p.travel_pace, budget: p.budget_style })

export function TravelPreferencesForm({ profile }: { profile: Profile }) {
  const toast = useToast()
  const update = useUpdatePreferences()
  const [draft, setDraft] = useState<Draft>(() => draftOf(profile))
  const [banner, setBanner] = useState<string | null>(null)

  const saved = draftOf(profile)
  const dirty =
    draft.pace !== saved.pace ||
    draft.budget !== saved.budget ||
    draft.interests.length !== saved.interests.length ||
    draft.interests.some((i) => !saved.interests.includes(i))

  const toggle = (value: string) =>
    setDraft((d) => ({
      ...d,
      interests: d.interests.includes(value) ? d.interests.filter((i) => i !== value) : [...d.interests, value],
    }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBanner(null)
    try {
      const next = await update.mutateAsync({
        travel_interests: draft.interests,
        travel_pace: draft.pace,
        budget_style: draft.budget,
      })
      setDraft(draftOf(next))
      toast.success('Travel preferences saved.')
    } catch (error) {
      setBanner(error instanceof ApiError ? error.message : 'We couldn’t save your preferences. Please try again.')
    }
  }

  return (
    <SettingsCard
      icon={<Compass className="size-4" aria-hidden />}
      title="Travel preferences"
      description="Tell TripMind how you like to travel"
    >
      <form onSubmit={submit} className="space-y-6">
        {banner && <Banner tone="error">{banner}</Banner>}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">What are you into?</legend>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_INTERESTS.map((interest) => {
              const on = draft.interests.includes(interest.value)
              return (
                <button
                  key={interest.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(interest.value)}
                  className={cn(
                    'h-9 rounded-full border px-4 text-sm font-medium transition',
                    on
                      ? 'border-primary bg-primary text-primary-fg shadow-glow'
                      : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
                  )}
                >
                  {interest.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <p className="mb-2 text-sm font-medium text-fg">Travel pace</p>
          <ChoiceGroup label="Travel pace" value={draft.pace} onChange={(pace) => setDraft((d) => ({ ...d, pace }))} options={TRAVEL_PACES} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-fg">Budget style</p>
          <ChoiceGroup label="Budget style" value={draft.budget} onChange={(budget) => setDraft((d) => ({ ...d, budget }))} options={BUDGET_STYLES} />
        </div>

        <SaveBar dirty={dirty} saving={update.isPending} onReset={() => setDraft(saved)} label="Save preferences" />
      </form>
    </SettingsCard>
  )
}
