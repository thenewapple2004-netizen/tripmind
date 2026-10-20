import { request } from './http'
import type { Activity, ActivityInput, ActivityPatch } from './types'

export const activitiesApi = {
  list: (tripId: string, signal?: AbortSignal) =>
    request<Activity[]>(`/trips/${encodeURIComponent(tripId)}/activities`, { signal }),

  get: (tripId: string, activityId: string, signal?: AbortSignal) =>
    request<Activity>(
      `/trips/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(activityId)}`,
      { signal },
    ),

  create: (tripId: string, input: ActivityInput) =>
    request<Activity>(`/trips/${encodeURIComponent(tripId)}/activities`, {
      method: 'POST',
      body: input,
    }),

  update: (tripId: string, activityId: string, patch: ActivityPatch) =>
    request<Activity>(
      `/trips/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(activityId)}`,
      {
        method: 'PATCH',
        body: patch,
      },
    ),

  remove: (tripId: string, activityId: string) =>
    request<void>(
      `/trips/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(activityId)}`,
      { method: 'DELETE' },
    ),
}
