import { useCallback, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tripmind-theme'

/** The initial theme is applied by a script in index.html; this hook only reads and toggles it. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the choice just won't persist.
    }
    setTheme(next)
  }, [theme])

  return { theme, toggle }
}
