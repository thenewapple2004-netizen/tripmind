export type ApiErrorKind = 'network' | 'timeout' | 'http'

/** Maps a form field name (as the API spells it) to a message. */
export type FieldErrors = Record<string, string>

interface FastApiIssue {
  type?: string
  loc?: Array<string | number>
  msg?: string
  ctx?: Record<string, unknown>
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  /** Per-field problems from a 422 or 400, keyed by the API's field name. */
  readonly fieldErrors: FieldErrors
  /** Problems that don't belong to a single field. */
  readonly formErrors: string[]

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind
      status?: number | null
      fieldErrors?: FieldErrors
      formErrors?: string[]
    },
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = options.kind
    this.status = options.status ?? null
    this.fieldErrors = options.fieldErrors ?? {}
    this.formErrors = options.formErrors ?? []
  }

  get isTransient(): boolean {
    return this.kind !== 'http' || (this.status !== null && this.status >= 500)
  }

  get isNotFound(): boolean {
    return this.kind === 'http' && this.status === 404
  }

  static network(): ApiError {
    return new ApiError(
      "Can't reach the server. Check your connection and that the services are running.",
      { kind: 'network' },
    )
  }

  static timeout(): ApiError {
    return new ApiError('The server took too long to respond. Please try again.', {
      kind: 'timeout',
    })
  }

  static fromResponse(status: number, body: unknown): ApiError {
    const detail = (body as { detail?: unknown } | null)?.detail

    // Handle 422 Pydantic validation issues
    if (Array.isArray(detail)) {
      const { fieldErrors, formErrors } = parseValidationIssues(detail as FastApiIssue[])
      const hasFieldErrors = Object.keys(fieldErrors).length > 0
      const message = hasFieldErrors
        ? 'Please fix the highlighted fields.'
        : (formErrors[0] ?? 'The request was not valid.')
      return new ApiError(message, { kind: 'http', status, fieldErrors, formErrors })
    }

    // Handle string detail (e.g. 400 Bad Request, 404, or custom detail)
    if (typeof detail === 'string' && detail && status < 500) {
      const field = fieldNamedIn(detail)
      if (field) {
        const message = friendlyText(detail)
        return new ApiError(message, { kind: 'http', status, fieldErrors: { [field]: message } })
      }
      return new ApiError(detail, { kind: 'http', status })
    }

    if (status === 404) {
      return new ApiError("We couldn't find that trip. It may have been deleted.", {
        kind: 'http',
        status,
      })
    }

    if (status === 502 || status === 503 || status === 504) {
      return new ApiError(
        'The server is unavailable right now. Make sure it is running and try again.',
        { kind: 'http', status },
      )
    }

    if (status >= 500) {
      return new ApiError('The server ran into a problem. Please try again in a moment.', {
        kind: 'http',
        status,
      })
    }

    return new ApiError(`Something went wrong (HTTP ${status}).`, { kind: 'http', status })
  }
}

const FIELD_NAMES = ['title', 'destination', 'start_date', 'end_date', 'budget', 'email', 'password']

function parseValidationIssues(issues: FastApiIssue[]) {
  const fieldErrors: FieldErrors = {}
  const formErrors: string[] = []

  for (const issue of issues) {
    const message = friendlyMessage(issue)
    const loc = issue.loc ?? []
    const field = loc[0] === 'body' && typeof loc[1] === 'string' ? loc[1] : null

    if (field) {
      fieldErrors[field] ??= message
      continue
    }

    const named = fieldNamedIn(issue.msg ?? '')
    if (named) fieldErrors[named] ??= message
    else formErrors.push(message)
  }

  return { fieldErrors, formErrors }
}

function fieldNamedIn(text: string): string | null {
  const lower = text.toLowerCase()
  if (lower.includes('email')) return 'email'
  if (lower.includes('password')) return 'password'

  let best: { name: string; index: number } | null = null
  for (const name of FIELD_NAMES) {
    const index = lower.indexOf(name)
    if (index !== -1 && (best === null || index < best.index)) best = { name, index }
  }
  return best?.name ?? null
}

function friendlyMessage(issue: FastApiIssue): string {
  const ctx = issue.ctx ?? {}
  switch (issue.type) {
    case 'missing':
      return 'This field is required.'
    case 'string_too_short':
      return ctx.min_length === 1
        ? 'This field cannot be empty.'
        : `Must be at least ${String(ctx.min_length)} characters.`
    case 'string_too_long':
      return `Must be at most ${String(ctx.max_length)} characters.`
    case 'greater_than':
      return `Must be greater than ${String(ctx.gt)}.`
    case 'date_from_datetime_parsing':
    case 'date_parsing':
    case 'date_type':
      return 'Enter a valid date.'
    case 'uuid_parsing':
      return 'That is not a valid trip ID.'
  }

  return friendlyText(issue.msg ?? 'Invalid value.')
}

function friendlyText(text: string): string {
  const raw = text.replace(/^Value error,\s*/i, '')
  if (/end_date cannot be earlier than start_date/i.test(raw)) {
    return "End date can't be before the start date."
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
