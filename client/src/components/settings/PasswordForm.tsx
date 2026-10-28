import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { Banner, SettingsCard } from '@/components/settings/SettingsCard'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useChangePassword } from '@/hooks/useProfile'
import { applyApiErrors } from '@/lib/formErrors'
import { passwordFormSchema, passwordStrength, type PasswordFormValues } from '@/lib/profile'

const EMPTY: PasswordFormValues = { current_password: '', new_password: '', confirm_password: '' }
const STRENGTH_COLOR = ['', 'bg-danger', 'bg-warn-soft-fg', 'bg-primary/70', 'bg-primary']

export function PasswordForm() {
  const toast = useToast()
  const change = useChangePassword()
  const [banner, setBanner] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema), defaultValues: EMPTY })

  const strength = passwordStrength(watch('new_password') ?? '')

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    setDone(false)
    try {
      await change.mutateAsync({ current_password: values.current_password, new_password: values.new_password })
      reset(EMPTY)
      setDone(true)
      toast.success('Password changed.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        // The server answers 400 when the current password doesn't match.
        setError('current_password', { type: 'server', message: 'That isn’t your current password.' }, { shouldFocus: true })
        return
      }
      setBanner(applyApiErrors(error, setError, ['current_password', 'new_password']))
    }
  })

  return (
    <SettingsCard
      id="security"
      icon={<KeyRound className="size-4" aria-hidden />}
      title="Password"
      description="Choose a strong password you don’t use elsewhere"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {banner && <Banner tone="error">{banner}</Banner>}
        {done && (
          <Banner tone="success">
            Your password was updated. Any other devices signed in to your account have been signed out.
          </Banner>
        )}

        <TextField
          label="Current password"
          type="password"
          showPasswordToggle
          autoComplete="current-password"
          error={errors.current_password?.message}
          {...register('current_password')}
        />

        <div>
          <TextField
            label="New password"
            type="password"
            showPasswordToggle
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            error={errors.new_password?.message}
            {...register('new_password')}
          />
          {strength.score > 0 && (
            <div className="mt-2 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= strength.score ? STRENGTH_COLOR[strength.score] : 'bg-surface-3')} />
                ))}
              </div>
              <span className="w-14 text-xs font-medium text-fg-muted">{strength.label}</span>
            </div>
          )}
        </div>

        <TextField
          label="Confirm new password"
          type="password"
          showPasswordToggle
          autoComplete="new-password"
          error={errors.confirm_password?.message}
          {...register('confirm_password')}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="flex items-center gap-2 text-xs text-fg-subtle">
            <ShieldCheck className="size-4 text-primary-ink" aria-hidden />
            Changing it signs out your other devices.
          </p>
          <Button type="submit" variant="primary" loading={change.isPending} disabled={!isDirty}>
            Update password
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
