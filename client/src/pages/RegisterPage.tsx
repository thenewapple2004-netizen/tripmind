import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/components/ui/Toast'
import { ApiError } from '@/api/errors'

export function RegisterPage() {
  useDocumentTitle('Create an account')
  const { register, login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  // If user is already authenticated, redirect them to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setGeneralError(null)

    const errors: Record<string, string> = {}
    if (!email.trim()) {
      errors.email = 'Email address is required.'
    }
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.'
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    try {
      await register({ email, password })
      await login({ email, password })
      toast.success('Account created successfully! Welcome to TripMind.')
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors)
        } else {
          setGeneralError(err.message)
        }
      } else {
        setGeneralError('Failed to create account. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight text-fg">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-fg-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
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
              autoComplete="new-password"
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
              hint="Must be at least 8 characters long"
              icon={<Lock className="size-4 text-fg-subtle" />}
            />

            <TextField
              label="Confirm password"
              type="password"
              required
              showPasswordToggle
              autoComplete="new-password"
              value={confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => {
                    const next = { ...prev }
                    delete next.confirmPassword
                    return next
                  })
                }
              }}
              placeholder="••••••••"
              icon={<Lock className="size-4 text-fg-subtle" />}
            />

            <Button type="submit" variant="primary" loading={loading} className="w-full justify-center">
              Register
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
