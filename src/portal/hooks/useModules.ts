import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import type { ModuleKey } from '../lib/modules'
import { MODULE_KEYS } from '../lib/modules'

interface CustomerModule {
  id: string
  customer_id: string
  module_key: string
  enabled: boolean
  enabled_at: string
  enabled_by: string | null
}

export function useModules() {
  const { portalUser, isSystemAdmin } = useAuthContext()
  const customerId = portalUser?.customer_id

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

  const enabledModules = new Set<ModuleKey>(
    isSystemAdmin
      ? MODULE_KEYS
      : (modulesQuery.data || [])
          .filter(m => MODULE_KEYS.includes(m.module_key as ModuleKey))
          .map(m => m.module_key as ModuleKey)
  )

  const isModuleEnabled = (key: ModuleKey): boolean => {
    if (isSystemAdmin) return true
    return enabledModules.has(key)
  }

  return {
    enabledModules,
    isModuleEnabled,
    loading: modulesQuery.isLoading,
    error: modulesQuery.error,
  }
}
