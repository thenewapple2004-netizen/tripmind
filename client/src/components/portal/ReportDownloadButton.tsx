import { useState } from 'react'
import { Download } from 'lucide-react'
import { reportsApi } from '@/api/reports'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

/** Downloads a finished report with the user's auth token (a plain link would be rejected). */
export function ReportDownloadButton({
  tripId,
  taskId,
  filename,
}: {
  tripId: string
  taskId: string
  filename: string
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      await reportsApi.downloadReport(tripId, taskId, filename)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={download}
      icon={<Download className="size-3.5" aria-hidden />}
      aria-label={`Download ${filename}`}
    >
      CSV
    </Button>
  )
}
