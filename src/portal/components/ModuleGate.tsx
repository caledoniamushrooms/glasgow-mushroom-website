import { Navigate } from 'react-router-dom'
import { useModules } from '../hooks/useModules'
import type { ModuleKey } from '../lib/modules'

interface ModuleGateProps {
  moduleKey: ModuleKey
  children: React.ReactNode
}

export function ModuleGate({ moduleKey, children }: ModuleGateProps) {
  const { isModuleEnabled, loading } = useModules()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!isModuleEnabled(moduleKey)) {
    return <Navigate to="/portal/home" replace />
  }

  return <>{children}</>
}
