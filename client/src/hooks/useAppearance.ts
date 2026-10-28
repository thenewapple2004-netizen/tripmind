import { applySidebarCollapsed, useSidebarCollapsedValue } from '@/hooks/useSidebarPreference'
import { applyTheme, useTheme } from '@/hooks/useTheme'
import { useUpdatePreferences } from '@/hooks/useProfile'
import type { ThemePreference } from '@/api/authTypes'

/**
 * Appearance choices for a signed-in owner: applied instantly on this device and saved to the
 * account in the background, so they follow the owner to other browsers.
 */
export function useAppearance() {
  const { theme } = useTheme()
  const collapsed = useSidebarCollapsedValue()
  const save = useUpdatePreferences()

  const setTheme = (next: ThemePreference) => {
    const previous = theme
    applyTheme(next)
    save.mutate({ theme: next }, { onError: () => applyTheme(previous) })
  }
  const setCollapsed = (next: boolean) => {
    const previous = collapsed
    applySidebarCollapsed(next)
    save.mutate({ sidebar_collapsed: next }, { onError: () => applySidebarCollapsed(previous) })
  }

  return {
    theme,
    collapsed,
    setTheme,
    setCollapsed,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    toggleCollapsed: () => setCollapsed(!collapsed),
    saving: save.isPending,
    error: save.error,
  }
}
