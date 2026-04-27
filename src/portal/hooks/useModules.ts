import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { useViewAs } from '../components/ViewAsProvider'
import type { ModuleKey } from '../lib/modules'
import { MODULE_KEYS } from '../lib/modules'

interface CustomerModule {
  id: string
  customer_id: string
  module_key: string
  enabled: boolean
  config: Record<string, any> | null
  enabled_at: string
  enabled_by: string | null
}

export function useModules() {
  const { portalUser, isSystemAdmin } = useAuthContext()
  const { isViewingAs, viewAsCustomerId } = useViewAs()
  const customerId = viewAsCustomerId || portalUser?.customer_id

  const modulesQuery = useQuery({
    queryKey: ['customer-modules', customerId],
    queryFn: async (): Promise<CustomerModule[]> => {
      if (!customerId) return []
      const { data, error } = await supabase
        .from('customer_modules')
        .select('*')
        .eq('customer_id', customerId)
        .eq('enabled', true)

      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  const bypassModuleCheck = isSystemAdmin && !isViewingAs

  const enabledModules = new Set<ModuleKey>(
    bypassModuleCheck
      ? MODULE_KEYS
      : (modulesQuery.data || [])
          .filter(m => MODULE_KEYS.includes(m.module_key as ModuleKey))
          .map(m => m.module_key as ModuleKey)
  )

  const isModuleEnabled = (key: ModuleKey): boolean => {
    if (bypassModuleCheck) return true
    return enabledModules.has(key)
  }

  const getModuleConfig = (key: ModuleKey): Record<string, any> => {
    if (bypassModuleCheck) return {}
    const mod = (modulesQuery.data || []).find(m => m.module_key === key)
    return mod?.config || {}
  }

  return {
    enabledModules,
    isModuleEnabled,
    getModuleConfig,
    loading: modulesQuery.isLoading,
    error: modulesQuery.error,
  }
}
