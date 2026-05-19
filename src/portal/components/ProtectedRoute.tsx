import { Navigate } from 'react-router-dom'
import { useAuthContext } from './AuthProvider'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireSystemAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false, requireSystemAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isSystemAdmin, loading } = useAuthContext()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    // Send to the Astro dark-theme login at /portal. window.location.replace
    // is used because /portal is an Astro page, not an SPA route — Navigate
    // would only update the SPA router state.
    window.location.replace('/portal')
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
