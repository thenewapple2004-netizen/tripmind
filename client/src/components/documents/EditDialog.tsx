import { useState } from 'react'
import { ApiError } from '@/api/errors'
import type { DocumentKind, TripDocument } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useUpdateDocument } from '@/hooks/useDocuments'
import { DOCUMENT_KINDS, fileTypeLabel } from '@/lib/documents'

export type EditMode = 'rename' | 'category'

function Content({ doc, mode, onClose }: { doc: TripDocument; mode: EditMode; onClose: () => void }) {
  const toast = useToast()
  const update = useUpdateDocument()
  const [filename, setFilename] = useState(doc.filename)
  const [kind, setKind] = useState<DocumentKind>(doc.kind)
  const [error, setError] = useState<string | null>(null)

  const changed = filename.trim() !== doc.filename || kind !== doc.kind
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!filename.trim()) return setError('Enter a file name.')
    setError(null)
    try {
      await update.mutateAsync({
        tripId: doc.trip_id,
        id: doc.id,
        patch: { ...(filename.trim() !== doc.filename && { filename: filename.trim() }), ...(kind !== doc.kind && { kind }) },
      })
      toast.success('Document updated.')
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We couldn’t save the change. Please try again.')
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <div className="space-y-4 px-5 py-5">
        <h2 className="text-base font-semibold tracking-tight">{mode === 'rename' ? 'Rename document' : 'Change category'}</h2>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-fg">File name</span>
          <input autoFocus={mode === 'rename'} value={filename} maxLength={255} onChange={(e) => setFilename(e.target.value)} className={cn(inputStyles)} />
          <span className="mt-1 block text-xs text-fg-subtle">The file stays a {fileTypeLabel(doc.content_type)}; its extension is kept in step with that.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-fg">Category</span>
          <select autoFocus={mode === 'category'} value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} className={inputStyles}>
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={update.isPending}>Cancel</Button>
        <Button type="submit" variant="primary" loading={update.isPending} disabled={!changed}>Save</Button>
      </div>
    </form>
  )
}

export function EditDialog({ edit, onClose }: { edit: { doc: TripDocument; mode: EditMode } | null; onClose: () => void }) {
  return (
    <Modal open={edit !== null} onClose={onClose} label={edit?.mode === 'category' ? 'Change category' : 'Rename document'} className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-xl border">
      {edit && <Content doc={edit.doc} mode={edit.mode} onClose={onClose} />}
    </Modal>
  )
}
