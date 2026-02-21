"use client"

import { useState, useEffect, useCallback } from "react"
import { saveFairValue, loadFairValue, clearFairValue as clearFV } from "@/lib/fair-value"

export function useFairValue(marketId: string, defaultValue?: number) {
  const [fairValue, setFairValueState] = useState<number | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    const result = loadFairValue(marketId)
    if (result.ok && result.data !== null) {
      setFairValueState(result.data)
      setIsCustom(true)
    } else if (defaultValue !== undefined) {
      setFairValueState(defaultValue)
      setIsCustom(false)
    }
    setLoaded(true)
  }, [marketId, defaultValue])

  const setFairValue = useCallback(
    (v: number) => {
      setFairValueState(v)
      setIsCustom(true)
      saveFairValue(marketId, v)
    },
    [marketId]
  )

  const clearFairValue = useCallback(() => {
    clearFV(marketId)
    setIsCustom(false)
    if (defaultValue !== undefined) {
      setFairValueState(defaultValue)
    } else {
      setFairValueState(null)
    }
  }, [marketId, defaultValue])

  return {
    fairValue: loaded ? fairValue : null,
    setFairValue,
    clearFairValue,
    isCustom,
  }
}
