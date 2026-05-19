import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'

// SPA Login is deprecated as a visible surface — the dark-theme Astro page
// at /portal is the canonical login. Anyone landing on /portal/login (old
// deep links, ProtectedRoute redirects from earlier builds, etc.) gets
// bounced there. Authenticated users still get the normal home redirect.
export function Login() {
  const { isAuthenticated, loading } = useAuthContext()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.replace('/portal')
    }
  }, [loading, isAuthenticated])

  if (isAuthenticated) return <Navigate to="/portal/home" replace />

  return (
    <div className="flex items-center justify-center min-h-screen text-muted-foreground">
      Redirecting…
    </div>
  )
}
