import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from './AuthProvider'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireSystemAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false, requireSystemAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isSystemAdmin, loading, session, signOut } = useAuthContext()

  // Edge case: there's an auth.users session but no active portal_users
  // row (e.g. the user is mid-onboarding with status='pending', or their
  // row was suspended/removed). Without this, /portal/home → /portal →
  // /portal/home loops forever because /portal sees the session and
  // forwards back here. Sign out first so /portal lands clean.
  useEffect(() => {
    if (!loading && !isAuthenticated && session) {
      // signOut() makes a network call with no timeout — never let it block
      // the recovery redirect. If it hasn't finished within 2s, drop the
      // cached session by hand (otherwise /portal sees it and bounces back
      // here in a loop) and redirect anyway.
      let done = false
      const finish = () => {
        if (done) return
        done = true
        window.location.replace('/portal')
      }
      const timer = setTimeout(() => {
        try {
          window.localStorage.removeItem('sb-portal-auth')
        } catch {
          /* ignore */
        }
        finish()
      }, 2000)
      void signOut()
        .catch(() => {
          try {
            window.localStorage.removeItem('sb-portal-auth')
          } catch {
            /* ignore */
          }
        })
        .finally(() => {
          clearTimeout(timer)
          finish()
        })
      return () => clearTimeout(timer)
    }
  }, [loading, isAuthenticated, session, signOut])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    if (!session) {
      // No session at all — just bounce to the Astro login.
      window.location.replace('/portal')
    }
    // Either no session (above) or session-but-no-portalUser (handled by
    // the useEffect above). Render nothing in the meantime.
    return null
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/portal/home" replace />
  }

  if (requireSystemAdmin && !isSystemAdmin) {
    return <Navigate to="/portal/home" replace />
  }

  return <>{children}</>
}
