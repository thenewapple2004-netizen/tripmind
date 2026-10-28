import { useRef, useState, type DragEvent } from 'react'
import { Camera, Trash2, Upload } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { Profile } from '@/api/authTypes'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useAvatarUrl, useRemoveAvatar, useUploadAvatar } from '@/hooks/useProfile'
import { AVATAR_ACCEPT, validateAvatarFile } from '@/lib/profile'

export function AvatarUploader({ profile, initials }: { profile: Profile; initials: string }) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const url = useAvatarUrl(profile.avatar_version)
  const busy = upload.isPending || remove.isPending

  const send = (file: File | undefined) => {
    if (!file) return
    const invalid = validateAvatarFile(file)
    setProblem(invalid)
    if (invalid) return
    upload.mutate(file, {
      onSuccess: () => toast.success('Profile picture updated.'),
      onError: (error) =>
        setProblem(error instanceof ApiError ? error.message : 'We couldn’t use that image. Try a different one.'),
    })
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (!busy) send(event.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:items-start">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn('group relative rounded-full transition', dragging && 'ring-4 ring-primary/50')}
      >
        <Avatar initials={initials} src={url} className={cn('size-28 text-3xl ring-4 ring-surface', busy && 'opacity-60')} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Change profile picture"
          className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lift ring-4 ring-surface transition hover:bg-primary-hover disabled:opacity-60"
        >
          <Camera className="size-4" aria-hidden />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload profile picture"
        onChange={(e) => {
          send(e.target.files?.[0])
          e.target.value = '' // lets the same file be chosen again after an error
        }}
      />

      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        <Button
          size="sm"
          variant="secondary"
          loading={upload.isPending}
          disabled={busy}
          icon={<Upload className="size-4" aria-hidden />}
          onClick={() => inputRef.current?.click()}
        >
          {profile.avatar_version ? 'Replace' : 'Upload photo'}
        </Button>
        {profile.avatar_version !== null && (
          <Button
            size="sm"
            variant="ghost"
            loading={remove.isPending}
            disabled={busy}
            icon={<Trash2 className="size-4" aria-hidden />}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => toast.success('Profile picture removed.'),
                onError: () => setProblem('We couldn’t remove your picture. Please try again.'),
              })
            }
          >
            Remove
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-fg-subtle sm:text-left">PNG, JPEG or WebP. We crop it to a square.</p>
      {problem && (
        <p role="alert" className="text-center text-xs text-danger sm:text-left">
          {problem}
        </p>
      )}
    </div>
  )
}
