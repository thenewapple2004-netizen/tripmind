import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/components/ui/cn'

/** Copies text (a confirmation number) to the clipboard and briefly says so. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (insecure context): the number is still on screen to copy by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : label}
      title={copied ? 'Copied' : label}
      className={cn('rounded-md p-1 text-fg-subtle transition hover:bg-surface-3 hover:text-fg', className)}
    >
      {copied ? <Check className="size-3.5 text-primary-ink" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  )
}
