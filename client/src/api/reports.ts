import { request } from './http'
import { tokenStorage } from './tokenStorage'

export interface ReportJobResponse {
  task_id: string
  trip_id: string
  status: string
  message: string
}

export interface ReportStatusResponse {
  task_id: string
  trip_id: string
  status: 'PENDING' | 'STARTED' | 'RETRY' | 'SUCCESS' | 'FAILURE'
  message?: string
  result?: {
    filename: string
    file_size: number
    generated_at: string
    row_counts: {
      activities: number
      expenses: number
      categories: number
    }
  }
  error?: string
}

export const reportsApi = {
  requestReport: (tripId: string) =>
    request<ReportJobResponse>(`/trips/${encodeURIComponent(tripId)}/reports`, {
      method: 'POST',
    }),

  getStatus: (tripId: string, taskId: string, signal?: AbortSignal) =>
    request<ReportStatusResponse>(
      `/trips/${encodeURIComponent(tripId)}/reports/${encodeURIComponent(taskId)}/status`,
      { signal }
    ),

  downloadReport: async (tripId: string, taskId: string, filename?: string): Promise<Blob> => {
    const token = tokenStorage.getAccessToken()
    const targetFilename = filename || `trip_report_${tripId}.csv`

    const response = await fetch(
      `/api/v1/trips/${encodeURIComponent(tripId)}/reports/${encodeURIComponent(taskId)}/download`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(errorData?.detail || `Failed to download report (HTTP ${response.status})`)
    }

    const blob = await response.blob()
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = targetFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
    return blob
  },
}
