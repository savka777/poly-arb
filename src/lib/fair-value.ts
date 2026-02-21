import type { Result } from "@/lib/types"
import { ok, err } from "@/lib/result"

const KEY_PREFIX = "darwin_fv_"

export function saveFairValue(marketId: string, value: number): Result<void> {
  try {
    localStorage.setItem(`${KEY_PREFIX}${marketId}`, String(value))
    return ok(undefined)
  } catch (e) {
    return err(`Failed to save fair value: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export function loadFairValue(marketId: string): Result<number | null> {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${marketId}`)
    if (raw === null) return ok(null)
    const value = parseFloat(raw)
    if (!Number.isFinite(value)) return ok(null)
    return ok(value)
  } catch (e) {
    return err(`Failed to load fair value: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export function clearFairValue(marketId: string): Result<void> {
  try {
    localStorage.removeItem(`${KEY_PREFIX}${marketId}`)
    return ok(undefined)
  } catch (e) {
    return err(`Failed to clear fair value: ${e instanceof Error ? e.message : String(e)}`)
  }
}
