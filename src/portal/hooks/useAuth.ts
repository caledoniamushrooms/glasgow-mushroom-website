import { useState, useEffect, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
    )

    return () => subscription.unsubscribe()
  }, [fetchPortalUser])

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
    }
  }

  const signOut = async () => {
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
