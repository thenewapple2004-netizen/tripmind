import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { reportsApi } from './reports'
import { tokenStorage } from './tokenStorage'

describe('reportsApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(tokenStorage, 'getAccessToken').mockReturnValue('test-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requestReport calls POST /trips/{tripId}/reports with authorization', async () => {
    const mockResponse = {
      task_id: 'task-abc-123',
      trip_id: 'trip-xyz-789',
      status: 'PENDING',
      message: 'Report generation initiated',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await reportsApi.requestReport('trip-xyz-789')

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/trips/trip-xyz-789/reports',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('getStatus calls GET /trips/{tripId}/reports/{taskId}/status', async () => {
    const mockStatus = {
      task_id: 'task-abc-123',
      trip_id: 'trip-xyz-789',
      status: 'SUCCESS' as const,
      result: {
        filename: 'trip_report.csv',
        file_size: 2048,
        generated_at: '2027-01-01T00:00:00Z',
        row_counts: { activities: 3, expenses: 5, categories: 2 },
      },
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockStatus), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await reportsApi.getStatus('trip-xyz-789', 'task-abc-123')

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/trips/trip-xyz-789/reports/task-abc-123/status',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )
    expect(result).toEqual(mockStatus)
  })

  it('downloadReport fetches CSV blob successfully with Bearer token', async () => {
    const csvData = 'Header1,Header2\nValue1,Value2'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="trip_report.csv"',
        },
      })
    )

    const blob = await reportsApi.downloadReport('trip-xyz-789', 'task-abc-123')
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/trips/trip-xyz-789/reports/task-abc-123/download',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token',
        },
      })
    )
    expect(blob).toBeInstanceOf(Blob)
    const text = await blob.text()
    expect(text).toBe(csvData)
  })

  it('downloadReport throws error when server returns non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Report not ready' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await expect(
      reportsApi.downloadReport('trip-xyz-789', 'task-abc-123')
    ).rejects.toThrow('Report not ready')
  })
})
