import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Filters that live in the URL, so a filtered view can be reloaded, shared or reached with Back. Writing starts
 * from the live URL, not the router's copy from the last render, which is stale if two changes land together.
 */
export function useFilterParams() {
  const [params, setParams] = useSearchParams()

  const set = (key: string, value: string | undefined, fallback = '') => {
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search)
        if (value && value !== fallback) next.set(key, value)
        else next.delete(key)
        // A different filter starts again from the first page.
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  /** Clears the named filters, leaving everything else (such as an open drawer) alone. */
  const clear = (...keys: string[]) => {
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search)
        for (const key of keys) next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  return { params, set, clear }
}

export const oneOf = <T extends string>(value: string | null, list: readonly T[]): T | undefined =>
  list.includes(value as T) ? (value as T) : undefined

/** A search box whose text is typed freely and written to the URL a moment after typing stops. */
export function useSearchParam(key = 'q', delay = 250) {
  const { params, set } = useFilterParams()
  const fromUrl = params.get(key) ?? ''
  const [text, setText] = useState(fromUrl)
  const [debounced, setDebounced] = useState(fromUrl.trim())

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  useEffect(() => {
    if ((params.get(key) ?? '') !== debounced) set(key, debounced || undefined)
  }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    text,
    setText,
    /** What the server is asked for. */
    query: debounced,
    clear: () => {
      setText('')
      setDebounced('')
    },
  }
}
