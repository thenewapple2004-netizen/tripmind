import { Link, Outlet } from 'react-router'
import { Moon, Sun } from 'lucide-react'
import { LogoMark, Wordmark } from '@/components/ui/Logo'
import { useTheme } from '@/hooks/useTheme'
import { isDarkTheme } from '@/lib/theme'

/** Chrome for the signed-out pages: a calm forest backdrop with the brand and a theme switch. */
export function AuthLayout() {
  const { theme, toggle } = useTheme()
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_32rem_at_15%_-10%,var(--glow),transparent),radial-gradient(44rem_30rem_at_100%_110%,var(--glow),transparent)]"
      />
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3" aria-label="TripMind home">
          <LogoMark />
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={isDarkTheme(theme) ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted transition hover:bg-surface-2 hover:text-fg"
        >
          {isDarkTheme(theme) ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
        </button>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 outline-none sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
