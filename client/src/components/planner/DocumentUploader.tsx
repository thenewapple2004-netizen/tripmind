import { useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { DocumentKind } from '@/api/types'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useUploadDocument } from '@/hooks/useDocuments'
import { formatBytes } from '@/lib/download'

export const DOCUMENT_KINDS: Array<{ value: DocumentKind; label: string }> = [
  { value: 'passport', label: 'Passport / ID' },
  { value: 'visa', label: 'Visa' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'booking', label: 'Booking' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
]

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const ACCEPT = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

/** Checks the file before sending it. The server repeats every check; this just gives instant feedback. */
export function validateDocument(file: { name: string; type: string; size: number }): string | null {
  if (file.size === 0) return `“${file.name}” is empty.`
  if (file.size > MAX_DOCUMENT_BYTES) return `“${file.name}” is ${formatBytes(file.size)}. The limit is 5 MB.`
  if (!ACCEPT.includes(file.type)) return `“${file.name}” isn’t supported. Use a PDF, PNG, JPEG or WebP.`
  return null
}

export function DocumentUploader({ tripId }: { tripId: string }) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadDocument(tripId)
  const [kind, setKind] = useState<DocumentKind>('other')
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [busyName, setBusyName] = useState<string | null>(null)

  const send = async (files: FileList | File[]) => {
    setProblem(null)
    for (const file of Array.from(files)) {
      const invalid = validateDocument(file)
      if (invalid) {
        setProblem(invalid)
        return
      }
      setBusyName(file.name)
      try {
        await upload.mutateAsync({ file, kind })
        toast.success(`Uploaded “${file.name}”.`)
      } catch (error) {
        setProblem(error instanceof ApiError ? error.message : `We couldn’t upload “${file.name}”. Please try again.`)
        break
      } finally {
        setBusyName(null)
      }
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (!upload.isPending) void send(event.dataTransfer.files)
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="whitespace-nowrap">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} className={cn(inputStyles, 'h-10 sm:w-44')}>
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'mt-3 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition',
          dragging ? 'border-primary bg-primary-soft/40' : 'border-line-strong bg-surface-2/50',
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
          <Upload className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-fg">
          Drag a file here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="font-semibold text-primary-ink underline-offset-2 hover:underline disabled:opacity-60"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-fg-subtle">PDF, PNG, JPEG or WebP · up to 5 MB each</p>
        {busyName && (
          <p role="status" className="text-xs font-medium text-primary-ink">
            Uploading “{busyName}”…
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload travel documents"
          onChange={(e) => {
            if (e.target.files) void send(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {problem && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      )}
    </div>
  )
}
