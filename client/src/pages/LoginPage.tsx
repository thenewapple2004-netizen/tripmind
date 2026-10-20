import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Compass, Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/components/ui/Toast'
import { ApiError } from '@/api/errors'

export function LoginPage() {
  useDocumentTitle('Log in')
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  // If already logged in, redirect away from login page
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setGeneralError(null)

    const errors: Record<string, string> = {}
    if (!email.trim()) errors.email = 'Email address is required.'
    if (!password) errors.password = 'Password is required.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    try {
      await login({ email, password })
      toast.success('Welcome back! You are now logged in.')
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors)
        } else {
          setGeneralError(err.message)
        }
      } else {
        setGeneralError('Incorrect email or password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-lg">
            <Compass className="size-7" aria-hidden />
          </span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-fg">
          Log in to TripMind
        </h2>
        <p className="mt-2 text-center text-sm text-fg-muted">
          Or{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {generalError && (
              <div
                role="alert"
                className="rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-soft-fg"
              >
                {generalError}
              </div>
            )}

            <TextField
              label="Email address"
              type="email"
              required
              autoComplete="email"
              value={email}
              error={fieldErrors.email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (fieldErrors.email) {
                  setFieldErrors((prev) => {
                    const next = { ...prev }
                    delete next.email
                    return next
                  })
                }
              }}
              placeholder="you@example.com"
              icon={<Mail className="size-4 text-fg-subtle" />}
            />

            <TextField
              label="Password"
              type="password"
              required
              showPasswordToggle
              autoComplete="current-password"
              value={password}
              error={fieldErrors.password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) {
                  setFieldErrors((prev) => {
                    const next = { ...prev }
                    delete next.password
                    return next
                  })
                }
              }}
              placeholder="••••••••"
              icon={<Lock className="size-4 text-fg-subtle" />}
            />

            <Button type="submit" variant="primary" loading={loading} className="w-full justify-center">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
