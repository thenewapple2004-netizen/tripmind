import { request } from './http'
import { tokenStorage } from './tokenStorage'
import type {
  AuthTokens,
  PasswordChangeInput,
  PreferencesUpdate,
  Profile,
  ProfileUpdate,
} from './authTypes'

/** Account profile, preferences, security and picture. Everything lives in the Auth Service. */
export const profileApi = {
  get: (signal?: AbortSignal) => request<Profile>('/auth/me', { signal }),

  updateProfile: (input: ProfileUpdate) => request<Profile>('/auth/me', { method: 'PATCH', body: input }),

  updatePreferences: (input: PreferencesUpdate) =>
    request<Profile>('/auth/me/preferences', { method: 'PATCH', body: input }),

  /**
   * Changing the password signs out every other session, so the server answers with fresh
   * tokens that we store to keep this one going.
   */
  changePassword: async (input: PasswordChangeInput): Promise<AuthTokens> => {
    const tokens = await request<AuthTokens>('/auth/me/password', { method: 'POST', body: input })
    tokenStorage.setTokens(tokens)
    return tokens
  },

  uploadAvatar: (image: Blob) => request<Profile>('/auth/me/avatar', { method: 'PUT', body: image }),

  fetchAvatar: (signal?: AbortSignal) => request<Blob>('/auth/me/avatar', { signal, parseAs: 'blob' }),

  removeAvatar: () => request<Profile>('/auth/me/avatar', { method: 'DELETE' }),
}
