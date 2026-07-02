import { getCachedAccessToken } from './supabase'

const FETCH_TIMEOUT_MS = 20_000

/**
 * fetch() wrapper that attaches the current Supabase access token as a
 * Bearer header and aborts after a timeout.
 *
 * Reads the token from the in-memory cache rather than calling
 * supabase.auth.getSession() — that call goes through the SDK's auth lock
 * and can stall on mobile while a token refresh is in flight, which leaves
 * UI actions stuck on a spinner forever.
 */
export async function authedFetch(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  const token = getCachedAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? FETCH_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, headers, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
