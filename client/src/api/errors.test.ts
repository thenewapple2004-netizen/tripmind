import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'

describe('ApiError.fromResponse', () => {
  it('maps FastAPI field errors to friendly per-field messages', () => {
    const error = ApiError.fromResponse(422, {
      detail: [
        { type: 'string_too_short', loc: ['body', 'title'], msg: 'String should have at least 1 character', ctx: { min_length: 1 } },
        { type: 'missing', loc: ['body', 'destination'], msg: 'Field required' },
        { type: 'greater_than', loc: ['body', 'budget'], msg: 'Input should be greater than 0', ctx: { gt: 0 } },
      ],
    })
    expect(error.status).toBe(422)
    expect(error.message).toBe('Please fix the highlighted fields.')
    expect(error.fieldErrors).toEqual({
      title: 'This field cannot be empty.',
      destination: 'This field is required.',
      budget: 'Must be greater than 0.',
    })
    expect(error.formErrors).toEqual([])
    expect(error.isTransient).toBe(false)
  })

  it('attaches the model-level date error to the end_date field', () => {
    const error = ApiError.fromResponse(422, {
      detail: [
        { type: 'value_error', loc: ['body'], msg: 'Value error, end_date cannot be earlier than start_date' },
      ],
    })
    expect(error.fieldErrors).toEqual({ end_date: "End date can't be before the start date." })
    expect(error.formErrors).toEqual([])
  })

  it('keeps unattributable validation errors at form level', () => {
    const error = ApiError.fromResponse(422, {
      detail: [{ type: 'value_error', loc: ['body'], msg: 'Value error, something odd' }],
    })
    expect(error.fieldErrors).toEqual({})
    expect(error.formErrors).toEqual(['Something odd'])
    expect(error.message).toBe('Something odd')
  })

  it('translates the plain-string date error PATCH returns as a 400', () => {
    const error = ApiError.fromResponse(400, { detail: 'end_date cannot be earlier than start_date' })
    expect(error.fieldErrors).toEqual({ end_date: "End date can't be before the start date." })
    expect(error.message).toBe("End date can't be before the start date.")
  })

  it('uses the detail string from 404 responses', () => {
    const notFound = ApiError.fromResponse(404, { detail: "Trip with id 'x' not found" })
    expect(notFound.isNotFound).toBe(true)
    expect(notFound.message).toBe("Trip with id 'x' not found")
  })

  it('falls back to a friendly message when the body is empty or not JSON', () => {
    expect(ApiError.fromResponse(404, null).message).toMatch(/couldn't find that trip/i)
    expect(ApiError.fromResponse(503, null).message).toMatch(/unavailable/i)
    expect(ApiError.fromResponse(500, null).message).toMatch(/ran into a problem/i)
    expect(ApiError.fromResponse(418, null).message).toBe('Something went wrong (HTTP 418).')
  })

  it('never shows raw server error text for 5xx responses', () => {
    expect(ApiError.fromResponse(500, { detail: 'psycopg2.OperationalError: connection refused' }).message)
      .toMatch(/ran into a problem/i)
  })

  it('flags outages, timeouts and 5xx as transient, but not 4xx', () => {
    expect(ApiError.network().isTransient).toBe(true)
    expect(ApiError.timeout().isTransient).toBe(true)
    expect(ApiError.fromResponse(503, null).isTransient).toBe(true)
    expect(ApiError.fromResponse(404, null).isTransient).toBe(false)
    expect(ApiError.fromResponse(422, { detail: [] }).isTransient).toBe(false)
  })
})
