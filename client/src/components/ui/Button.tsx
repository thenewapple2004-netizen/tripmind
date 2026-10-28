import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap ' +
  'transition duration-200 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ' +
  'aria-disabled:pointer-events-none aria-disabled:opacity-60'

const variants: Record<Variant, string> = {
  primary: 'bg-primary font-semibold text-primary-fg shadow-sm hover:bg-primary-hover hover:shadow-glow',
  secondary: 'border border-line-strong bg-surface text-fg shadow-sm hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-danger-fg shadow-sm hover:bg-danger-hover',
  'danger-outline':
    'border border-danger-line bg-surface text-danger shadow-sm hover:bg-danger-soft',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
}

export function buttonStyles({
  variant = 'secondary',
  size = 'md',
  className,
}: {
  variant?: Variant
  size?: Size
  className?: string
} = {}) {
  return cn(base, variants[variant], sizes[size], className)
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  size?: Size
  /** Shows a spinner and blocks clicks while keeping the button's width stable. */
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant,
  size,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function ButtonLink({ variant, size, icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, className })} {...props}>
      {icon}
      {children}
    </Link>
  )
}
