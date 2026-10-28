import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, UserRound } from 'lucide-react'
import type { Profile } from '@/api/authTypes'
import { Banner, SaveBar, SettingsCard } from '@/components/settings/SettingsCard'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useUpdateProfile } from '@/hooks/useProfile'
import { applyApiErrors } from '@/lib/formErrors'
import { profileFormSchema, toProfileUpdate, type ProfileFormValues } from '@/lib/profile'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'

const FIELDS = ['display_name', 'bio', 'location'] as const

function valuesOf(profile: Profile): ProfileFormValues {
  return { display_name: profile.display_name ?? '', bio: profile.bio ?? '', location: profile.location ?? '' }
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const toast = useToast()
  const update = useUpdateProfile()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema), defaultValues: valuesOf(profile) })

  // Pick up changes made elsewhere (another tab, a refetch) as long as the form is untouched.
  useEffect(() => {
    if (!isDirty) reset(valuesOf(profile))
  }, [profile, isDirty, reset])

  const bioLength = (watch('bio') ?? '').length

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      const saved = await update.mutateAsync(toProfileUpdate(values))
      reset(valuesOf(saved))
      toast.success('Profile saved.')
    } catch (error) {
      setBanner(applyApiErrors(error, setError, FIELDS))
    }
  })

  return (
    <SettingsCard icon={<UserRound className="size-4" aria-hidden />} title="Profile details" description="How you appear across TripMind">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {banner && <Banner tone="error">{banner}</Banner>}

        <TextField
          label="Display name"
          autoComplete="name"
          placeholder="How should we call you?"
          hint="Shown in your greeting and profile instead of your email."
          error={errors.display_name?.message}
          maxLength={120}
          {...register('display_name')}
        />

        <div>
          <label htmlFor="profile-bio" className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-fg">
            About you
            <span className={cn('text-xs font-normal tabular-nums', bioLength > 280 ? 'text-danger' : 'text-fg-subtle')}>
              {bioLength}/280
            </span>
          </label>
          <textarea
            id="profile-bio"
            rows={3}
            placeholder="A line or two about how you like to travel"
            aria-invalid={errors.bio ? true : undefined}
            aria-describedby={errors.bio ? 'profile-bio-error' : undefined}
            className={cn(inputStyles, 'h-auto min-h-24 resize-y py-2.5', errors.bio && 'border-danger')}
            {...register('bio')}
          />
          {errors.bio && (
            <p id="profile-bio-error" className="mt-1.5 text-sm text-danger">
              {errors.bio.message}
            </p>
          )}
        </div>

        <TextField
          label="Home base"
          autoComplete="address-level2"
          placeholder="City, Country"
          icon={<MapPin className="size-4" />}
          error={errors.location?.message}
          maxLength={140}
          {...register('location')}
        />

        <TextField label="Email" value={profile.email} readOnly disabled hint="Your sign-in email can’t be changed here." />

        <SaveBar dirty={isDirty} saving={update.isPending} onReset={() => reset(valuesOf(profile))} />
      </form>
    </SettingsCard>
  )
}
