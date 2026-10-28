import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '@/api/profile'
import type { PasswordChangeInput, PreferencesUpdate, Profile, ProfileUpdate } from '@/api/authTypes'
import { useAuth } from '@/hooks/useAuth'
import { squareAvatarBlob } from '@/lib/image'
import { displayNameFromEmail, initialsOf } from '@/lib/owner'

export const profileKeys = {
  all: ['profile'] as const,
  avatar: (version: number | null) => ['profile', 'avatar', version] as const,
}

/** The signed-in owner's full profile. Mutations below write the server's reply straight into the cache. */
export function useProfile() {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: ({ signal }) => profileApi.get(signal),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })
}

function useProfileMutation<TInput>(fn: (input: TInput) => Promise<Profile>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (profile) => queryClient.setQueryData(profileKeys.all, profile),
  })
}

export const useUpdateProfile = () => useProfileMutation((input: ProfileUpdate) => profileApi.updateProfile(input))
export const useUpdatePreferences = () =>
  useProfileMutation((input: PreferencesUpdate) => profileApi.updatePreferences(input))
export const useRemoveAvatar = () => useProfileMutation(() => profileApi.removeAvatar())
export const useUploadAvatar = () =>
  useProfileMutation(async (file: File) => profileApi.uploadAvatar(await squareAvatarBlob(file)))

export function useChangePassword() {
  return useMutation({ mutationFn: (input: PasswordChangeInput) => profileApi.changePassword(input) })
}

/**
 * Object URL for the profile picture. The image endpoint needs the auth header, so it can't be
 * used as a plain <img src>; we fetch it once per picture version and keep it cached.
 */
export function useAvatarUrl(version: number | null | undefined): string | null {
  const { data: blob } = useQuery({
    queryKey: profileKeys.avatar(version ?? null),
    queryFn: ({ signal }) => profileApi.fetchAvatar(signal),
    enabled: typeof version === 'number',
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: false,
  })
  // Created and revoked inside the effect so React StrictMode's mount/unmount/mount cycle can't
  // leave us holding a revoked URL.
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  return typeof version === 'number' ? url : null
}

/** Who the signed-in owner is, for headers and greetings: display name, falling back to the email. */
export function useIdentity() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const email = profile?.email ?? user?.email ?? ''
  const name = profile?.display_name?.trim() || displayNameFromEmail(email)
  const avatarUrl = useAvatarUrl(profile?.avatar_version)
  return { profile, email, name, firstName: name.split(' ')[0], initials: initialsOf(name), avatarUrl }
}
