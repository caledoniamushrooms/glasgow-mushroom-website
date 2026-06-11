import { useState, useEffect, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, setCachedAccessToken } from '../lib/supabase'
import type { PortalUser } from '../lib/types'

interface AuthState {
  session: Session | null
  user: User | null
  portalUser: PortalUser | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    portalUser: null,
    loading: true,
    error: null,
  })

  const fetchPortalUser = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('portal_users')
      .select('*')
      .eq('auth_user_id', userId)
      .eq('status', 'active')
      .single()

    if (error) {
      console.error('Failed to fetch portal user:', error)
      return null
    }
    return data as PortalUser
  }, [])

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

    const applySession = async (session: Session | null, event: string) => {
      // Mirror the access token into module scope so authedFetch() and the
      // photo XHR don't need to call supabase.auth.getSession() at request
      // time (which can stall on mobile when the SDK is mid-refresh).
      setCachedAccessToken(session?.access_token ?? null)

      if (session?.user) {
        const portalUser = await fetchPortalUser(session.user.id)

        if (event === 'SIGNED_IN' && portalUser) {
          await supabase
            .from('portal_users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', portalUser.id)
        }

        setState({
          session,
          user: session.user,
          portalUser,
          loading: false,
          error: portalUser ? null : 'No active portal account found',
        })
      } else {
        setState({ session: null, user: null, portalUser: null, loading: false, error: null })
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        resolvedInitial = true
        if (fallbackTimer) {
          clearTimeout(fallbackTimer)
          fallbackTimer = null
        }
        await applySession(session, event)
      },
    )

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
    await supabase.auth.signOut()
    setState({ session: null, user: null, portalUser: null, loading: false, error: null })
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
