import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors'
import { profileApi } from './profile'
import { tokenStorage } from './tokenStorage'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const PROFILE = { id: 'u1', email: 'a@b.com', created_at: '2026-01-01T00:00:00Z', display_name: 'Ammar' }

describe('profileApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(tokenStorage, 'getAccessToken').mockReturnValue('tok')
  })
  afterEach(() => vi.restoreAllMocks())

  const lastCall = (spy: ReturnType<typeof vi.spyOn>) => {
    const [url, init] = spy.mock.calls.at(-1) as [string, RequestInit & { headers: Record<string, string> }]
    return { url, init }
  }

  it('loads the profile with the bearer token', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(PROFILE))
    expect(await profileApi.get()).toEqual(PROFILE)
    const { url, init } = lastCall(spy)
    expect(url).toBe('/api/v1/auth/me')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('PATCHes profile fields to /auth/me', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(PROFILE))
    await profileApi.updateProfile({ display_name: 'Ammar', bio: null })
    const { url, init } = lastCall(spy)
    expect(url).toBe('/api/v1/auth/me')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ display_name: 'Ammar', bio: null })
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('PATCHes preferences to /auth/me/preferences', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(PROFILE))
    await profileApi.updatePreferences({ currency: 'EUR', theme: 'light' })
    const { url, init } = lastCall(spy)
    expect(url).toBe('/api/v1/auth/me/preferences')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ currency: 'EUR', theme: 'light' })
  })

  it('changes the password and stores the fresh tokens that keep this session alive', async () => {
    const setTokens = vi.spyOn(tokenStorage, 'setTokens').mockImplementation(() => {})
    const tokens = { access_token: 'new-a', refresh_token: 'new-r', token_type: 'bearer' }
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(tokens))

    await profileApi.changePassword({ current_password: 'old-pass-1', new_password: 'new-pass-2' })

    const { url, init } = lastCall(spy)
    expect(url).toBe('/api/v1/auth/me/password')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ current_password: 'old-pass-1', new_password: 'new-pass-2' })
    expect(setTokens).toHaveBeenCalledWith(tokens)
  })

  it('does not store tokens when the current password is wrong', async () => {
    const setTokens = vi.spyOn(tokenStorage, 'setTokens').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ detail: 'Current password is incorrect' }, 400))
    await expect(profileApi.changePassword({ current_password: 'x', new_password: 'new-pass-2' })).rejects.toMatchObject({
      status: 400,
      message: 'Current password is incorrect',
    })
    expect(setTokens).not.toHaveBeenCalled()
  })

  it('uploads a picture as a raw body with its own content type', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ ...PROFILE, avatar_version: 5 }))
    const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
    await profileApi.uploadAvatar(image)
    const { url, init } = lastCall(spy)
    expect(url).toBe('/api/v1/auth/me/avatar')
    expect(init.method).toBe('PUT')
    expect(init.headers['Content-Type']).toBe('image/jpeg')
    expect(init.body).toBe(image)
  })

  it('downloads the picture as a blob', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/png' } }),
    )
    const blob = await profileApi.fetchAvatar()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBe(3)
  })

  it('removes the picture with DELETE', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ ...PROFILE, avatar_version: null }))
    await profileApi.removeAvatar()
    const { url, init } = lastCall(spy)
    expect(url).toBe('/api/v1/auth/me/avatar')
    expect(init.method).toBe('DELETE')
  })

  it('surfaces server validation problems as field errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      json({ detail: [{ type: 'value_error', loc: ['body', 'display_name'], msg: 'Value error, Must be a single line' }] }, 422),
    )
    const error = await profileApi.updateProfile({ display_name: 'a\nb' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors).toHaveProperty('display_name')
  })
})
