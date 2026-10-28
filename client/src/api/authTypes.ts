export interface User {
  id: string
  email: string
  created_at: string
}

export type TravelPace = 'relaxed' | 'balanced' | 'packed'
export type BudgetStyle = 'budget' | 'mid_range' | 'luxury'
export type ThemePreference = 'dark' | 'light' | 'ocean' | 'dusk' | 'twilight' | 'sand'

/** The signed-in owner's full account profile, as returned by the Auth Service `/auth/me`. */
export interface Profile extends User {
  display_name: string | null
  bio: string | null
  location: string | null
  currency: string
  timezone: string
  travel_interests: string[]
  travel_pace: TravelPace
  budget_style: BudgetStyle
  theme: ThemePreference
  sidebar_collapsed: boolean
  /** Epoch seconds of the last picture change; null when there is no picture. */
  avatar_version: number | null
}

export interface ProfileUpdate {
  display_name?: string | null
  bio?: string | null
  location?: string | null
}

export type PreferencesUpdate = Partial<
  Pick<
    Profile,
    'currency' | 'timezone' | 'travel_interests' | 'travel_pace' | 'budget_style' | 'theme' | 'sidebar_collapsed'
  >
>

export interface PasswordChangeInput {
  current_password: string
  new_password: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterInput {
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}
