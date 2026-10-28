import { useCallback, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tripmind-theme-v2'
const listeners = new Set<() => void>()

/** The initial theme is applied by a script in index.html; this store reads and changes it. */
function read(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Applies a theme everywhere (every component using `useTheme` updates) and remembers it on this device. */
export function applyTheme(next: Theme) {
  if (read() === next && document.documentElement.dataset.theme === next) return
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
  listeners.forEach((listener) => listener())
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark' as Theme)
  const toggle = useCallback(() => applyTheme(read() === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle, setTheme: applyTheme }
}
