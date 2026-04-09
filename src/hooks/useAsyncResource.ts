'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsyncState } from '@/lib/super-admin/types'

/**
 * Hook genérico para fetch tipado con discriminated union de estado.
 * No expone booleans sueltos. Siempre haz pattern matching sobre `state.status`.
 */
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): { state: AsyncState<T>; reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' })
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false })

  const run = useCallback(async (): Promise<void> => {
    abortRef.current.aborted = false
    const token = abortRef.current
    setState({ status: 'loading' })
    try {
      const data = await fetcher()
      if (!token.aborted) setState({ status: 'success', data })
    } catch (err) {
      if (token.aborted) return
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setState({ status: 'error', message })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void run()
    const token = abortRef.current
    return () => {
      token.aborted = true
      abortRef.current = { aborted: false }
    }
  }, [run])

  const reload = useCallback((): void => {
    void run()
  }, [run])

  return { state, reload }
}
