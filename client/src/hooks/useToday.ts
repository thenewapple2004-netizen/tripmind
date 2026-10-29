import { useIdentity } from '@/hooks/useProfile'
import { todayIn } from '@/lib/bookings'

/** Today's date in the owner's profile time zone (the device's own until the profile has loaded). */
export function useToday(): string {
  const { profile } = useIdentity()
  return todayIn(profile?.timezone)
}
