import { useCallback, useSyncExternalStore } from 'react'
import type { ThemePreference } from '@/api/authTypes'
import { normalizeTheme, toggledTheme } from '@/lib/theme'

const STORAGE_KEY = 'tripmind-theme-v2'
const listeners = new Set<() => void>()

/** The initial theme is applied by a script in index.html; this store reads and changes it. */
function read(): ThemePreference {
  return normalizeTheme(document.documentElement.dataset.theme)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Applies a theme everywhere (every component using `useTheme` updates) and remembers it on this device. */
export function applyTheme(next: ThemePreference) {
  if (document.documentElement.dataset.theme === next) return
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
  listeners.forEach((listener) => listener())
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark' as ThemePreference)
  const toggle = useCallback(() => applyTheme(toggledTheme(read())), [])
  return { theme, toggle, setTheme: applyTheme }
}
