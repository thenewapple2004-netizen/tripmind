import { useEffect, useRef } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Compass, Moon, Plus, Sun } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { useTheme } from '@/hooks/useTheme'

export function AppShell() {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const lastPathname = useRef(pathname)

  // After in-app navigation, move focus to the page so keyboard and screen-reader
  // users start at the top of the new content rather than on a stale link.
  // Comparing paths (rather than skipping "the first run") keeps the initial page
  // load untouched even when StrictMode runs effects twice in development.
  useEffect(() => {
    if (lastPathname.current === pathname) return
    lastPathname.current = pathname
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="-ml-1 flex items-center gap-2.5 rounded-lg p-1 text-lg font-semibold tracking-tight text-fg"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm">
              <Compass className="size-5" aria-hidden />
            </span>
            TripMind
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex size-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {theme === 'dark' ? (
                <Sun className="size-5" aria-hidden />
              ) : (
                <Moon className="size-5" aria-hidden />
              )}
            </button>
            <ButtonLink to="/trips/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
              New trip
            </ButtonLink>
          </div>
        </div>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-10 lg:px-8"
      >
        <Outlet />
      </main>

      <ScrollRestoration />
    </div>
  )
}
