export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error }
}

export function isOk<T>(result: Result<T>): result is { ok: true; data: T } {
  return result.ok === true
}
