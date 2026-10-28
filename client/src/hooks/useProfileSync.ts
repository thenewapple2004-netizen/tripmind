import { useEffect, useRef } from 'react'
import { applySidebarCollapsed } from '@/hooks/useSidebarPreference'
import { applyTheme } from '@/hooks/useTheme'
import { useProfile } from '@/hooks/useProfile'
import { setDisplayCurrency } from '@/lib/money'

/**
 * Brings the owner's saved account preferences onto this device: theme and sidebar once per
 * session (after that, local changes are saved back by `useAppearance`), and the display
 * currency whenever it changes. Returns the currency so callers can re-render on change.
 */
export function useProfileSync(): string {
  const { data: profile } = useProfile()
  const appliedFor = useRef<string | null>(null)

  // Set during render so everything below renders with the right currency straight away.
  setDisplayCurrency(profile?.currency)

  useEffect(() => {
    if (!profile || appliedFor.current === profile.id) return
    appliedFor.current = profile.id
    applyTheme(profile.theme)
    applySidebarCollapsed(profile.sidebar_collapsed)
  }, [profile])

  return profile?.currency ?? 'USD'
}
