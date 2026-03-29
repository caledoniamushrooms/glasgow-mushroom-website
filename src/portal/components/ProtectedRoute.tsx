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
    return <Navigate to="/portal/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/portal" replace />
  }

  if (requireSystemAdmin && !isSystemAdmin) {
    return <Navigate to="/portal" replace />
  }

  return <>{children}</>
}
