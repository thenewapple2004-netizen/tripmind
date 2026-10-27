import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { reportsApi, type ReportStatusResponse } from '@/api/reports'

export function useTripReport(tripId: string) {
  const storageKey = `tripmind_report_task_${tripId}`

  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(storageKey)
    } catch {
      return null
    }
  })

  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // 1. Request report generation mutation
  const requestMutation = useMutation({
    mutationFn: () => reportsApi.requestReport(tripId),
    onSuccess: (data) => {
      setActiveTaskId(data.task_id)
      setDownloadError(null)
      try {
        sessionStorage.setItem(storageKey, data.task_id)
      } catch {
        // Ignore session storage errors
      }
    },
  })

  // 2. Poll job status using TanStack Query
  const statusQuery = useQuery<ReportStatusResponse>({
    queryKey: ['tripReportStatus', tripId, activeTaskId],
    queryFn: ({ signal }) => reportsApi.getStatus(tripId, activeTaskId!, signal),
    enabled: Boolean(activeTaskId),
    refetchInterval: (query) => {
      const state = query.state.data?.status
      // Cease polling once worker succeeds or fails
      if (state === 'SUCCESS' || state === 'FAILURE') {
        return false
      }
      return 1500 // Poll every 1.5 seconds while in progress
    },
    refetchIntervalInBackground: true,
  })

  // 3. Download handler
  const handleDownload = async (customFilename?: string) => {
    if (!activeTaskId) return
    setIsDownloading(true)
    setDownloadError(null)
    try {
      const filename = customFilename || statusQuery.data?.result?.filename || `trip_report_${tripId}.csv`
      await reportsApi.downloadReport(tripId, activeTaskId, filename)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  // 4. Reset handler
  const handleReset = () => {
    setActiveTaskId(null)
    setDownloadError(null)
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // Ignore
    }
    requestMutation.reset()
  }

  const currentStatus = statusQuery.data?.status
  const isProcessing =
    requestMutation.isPending ||
    (Boolean(activeTaskId) &&
      (currentStatus === 'PENDING' || currentStatus === 'STARTED' || currentStatus === 'RETRY'))

  return {
    activeTaskId,
    requestReport: () => requestMutation.mutate(),
    isRequesting: requestMutation.isPending,
    requestError: requestMutation.error,
    status: currentStatus,
    statusData: statusQuery.data,
    statusError: statusQuery.error,
    isProcessing,
    isSuccess: currentStatus === 'SUCCESS',
    isFailure: currentStatus === 'FAILURE',
    isDownloading,
    downloadError,
    downloadReport: handleDownload,
    resetReport: handleReset,
  }
}
