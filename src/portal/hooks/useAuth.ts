import { useState, useEffect, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseUrl, supabaseAnonKey, setCachedAccessToken } from '../lib/supabase'
import type { PortalUser } from '../lib/types'

interface AuthState {
  session: Session | null
  user: User | null
  portalUser: PortalUser | null
  loading: boolean
  error: string | null
}

// Look up the portal_users row with a PLAIN fetch rather than supabase-js.
// The SDK resolves the access token before every PostgREST call, and if the
// stored token is stale that means joining a token-refresh HTTP request
// with no timeout — on a flaky mobile connection it stalls forever, which
// left ProtectedRoute stuck on "Loading…" with nothing in the console.
// We already hold a token here, so use it directly, bounded by an abort
// timeout with one retry. Throws on network failure/timeout; resolves null
// when the user genuinely has no active portal_users row.
const PORTAL_USER_TIMEOUT_MS = 8_000

async function fetchPortalUserRest(userId: string, accessToken: string): Promise<PortalUser | null> {
  const url =
    `${supabaseUrl}/rest/v1/portal_users` +
    `?select=*&auth_user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`

  const attempt = async (): Promise<PortalUser | null> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PORTAL_USER_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`portal_users fetch failed: ${res.status}`)
      const rows = (await res.json()) as PortalUser[]
      return rows[0] ?? null
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    return await attempt()
  } catch {
    return attempt()
  }
}

// Best-effort, never awaited in the auth path.
function touchLastLogin(portalUserId: string, accessToken: string): void {
  fetch(`${supabaseUrl}/rest/v1/portal_users?id=eq.${encodeURIComponent(portalUserId)}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ last_login_at: new Date().toISOString() }),
    keepalive: true,
  }).catch(() => {})
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    portalUser: null,
    loading: true,
    error: null,
  })

  const fetchPortalUser = useCallback(fetchPortalUserRest, [])

  useEffect(() => {
    // Use onAuthStateChange as the single source of truth.
    // It fires INITIAL_SESSION on setup, avoiding the deadlock
    // that occurs when getSession() and onAuthStateChange compete
    // for the internal auth lock in @supabase/supabase-js v2.
    //
    // BUT: supabase-js's internal _initialize() blocks INITIAL_SESSION on
    // a token-refresh HTTP request with no timeout. On a slow mobile cold
    // network the request can stall and the listener never fires, leaving
    // ProtectedRoute stuck on "Loading…". A hard refresh fixes it because
    // the connection is then warm. The fallback below escapes that hang by
    // reading the cached session from localStorage and proceeding
    // optimistically — the SDK still completes in the background and any
    // subsequent SIGNED_IN / TOKEN_REFRESHED event will update state.
    let resolvedInitial = false
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    // Monotonic guard: events can queue up (INITIAL_SESSION, then
    // TOKEN_REFRESHED) and applySession runs are async — only the
    // latest event is allowed to commit state.
    let applySeq = 0

    const applySession = async (session: Session | null, event: string, seq: number) => {
      // Mirror the access token into module scope so authedFetch() and the
      // photo XHR don't need to call supabase.auth.getSession() at request
      // time (which can stall on mobile when the SDK is mid-refresh).
      setCachedAccessToken(session?.access_token ?? null)

      if (!session?.user) {
        if (seq !== applySeq) return
        setState({ session: null, user: null, portalUser: null, loading: false, error: null })
        return
      }

      let portalUser: PortalUser | null = null
      try {
        portalUser = await fetchPortalUser(session.user.id, session.access_token)
      } catch (err) {
        console.warn('[useAuth] portal_users lookup failed/timed out:', err)
        if (seq !== applySeq) return
        setState((prev) => {
          // A working signed-in state already exists for this user (e.g. a
          // token refresh hit a network blip) — keep it, just swap session.
          if (prev.portalUser && prev.user?.id === session.user.id) {
            return { ...prev, session, user: session.user, loading: false }
          }
          // Initial load couldn't complete — bail to the same fresh-load
          // recovery as the INITIAL_SESSION timeout below.
          return { session: null, user: null, portalUser: null, loading: false, error: null }
        })
        return
      }

      if (event === 'SIGNED_IN' && portalUser) {
        touchLastLogin(portalUser.id, session.access_token)
      }

      if (seq !== applySeq) return
      setState({
        session,
        user: session.user,
        portalUser,
        loading: false,
        error: portalUser ? null : 'No active portal account found',
      })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        resolvedInitial = true
        if (fallbackTimer) {
          clearTimeout(fallbackTimer)
          fallbackTimer = null
        }
        const seq = ++applySeq
        // Defer out of the callback: supabase-js awaits its listeners, so
        // doing network work inline here blocks the SDK's own event loop
        // (a documented deadlock source).
        setTimeout(() => void applySession(session, event, seq), 0)
      },
    )

    // Absolute ceiling: whatever path gets wedged, never show "Loading…"
    // for more than 10s. Bail to the fresh-load recovery instead.
    const watchdog = setTimeout(() => {
      setState((prev) => {
        if (!prev.loading) return prev
        console.warn('[useAuth] auth init still loading after 10s — bailing to fresh-load recovery')
        return { session: null, user: null, portalUser: null, loading: false, error: null }
      })
    }, 10_000)

    fallbackTimer = setTimeout(() => {
      if (resolvedInitial) return
      // Don't try to act on a cached session here: portal_users queries via
      // PostgREST also go through supabase-js, which would re-enter the
      // same stalled token-refresh and hang again. Instead bail to a clean
      // "no session" state. ProtectedRoute will then do a full nav to
      // /portal, which creates a fresh supabase client whose _initialize()
      // gets to try again on a (now-warm) network — the same recovery the
      // user currently performs by hand.
      //
      // We deliberately do NOT call supabase.auth.signOut(): localStorage
      // keeps the cached session, so the /portal Astro page (and its own
      // getSession check) can recover the user straight back into
      // /portal/home once the SDK unsticks.
      console.warn('[useAuth] INITIAL_SESSION did not fire within 5s — bailing to fresh-load recovery')
      setState({ session: null, user: null, portalUser: null, loading: false, error: null })
    }, 5000)

    return () => {
      subscription.unsubscribe()
      if (fallbackTimer) clearTimeout(fallbackTimer)
      clearTimeout(watchdog)
    }
  }, [fetchPortalUser])

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
    }
  }

  const signOut = async () => {
    setCachedAccessToken(null)
    // Clear UI state immediately — logout must never block on the network.
    setState({ session: null, user: null, portalUser: null, loading: false, error: null })
    let finished = false
    await Promise.race([
      supabase.auth
        .signOut()
        .then(() => {
          finished = true
        })
        .catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ])
    if (!finished) {
      // The SDK call stalled — drop the persisted session by hand so the
      // login page doesn't see it and bounce straight back in.
      try {
        window.localStorage.removeItem('sb-portal-auth')
      } catch {
        /* ignore */
      }
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/portal/reset-password`,
    })
    return { error }
  }

  return {
    ...state,
    isAuthenticated: !!state.session && !!state.portalUser,
    isSystemAdmin: state.portalUser?.role === 'system_admin',
    isAdmin: state.portalUser?.role === 'admin' || state.portalUser?.role === 'system_admin',
    branchId: state.portalUser?.branch_id ?? null,
    signIn,
    signOut,
    resetPassword,
  }
}
