import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ModuleKey } from '../lib/modules'
import { MODULE_KEYS } from '../lib/modules'

interface CustomerWithModules {
  id: string
  name: string
  email: string
  phone: string | null
  created_at: string
  modules: Record<ModuleKey, boolean>
}

interface CustomerModule {
  id: string
  customer_id: string
  module_key: string
  enabled: boolean
}

export function useAdminCustomers() {
  const queryClient = useQueryClient()

  const customersQuery = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async (): Promise<CustomerWithModules[]> => {
      // Fetch all customers
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name, email, phone, created_at')
        .order('name')

      if (custError) throw custError

      // Fetch all customer_modules
      const { data: modules, error: modError } = await supabase
        .from('customer_modules')
        .select('*')

      if (modError) throw modError

      // Merge modules into customers
      const modulesByCustomer = new Map<string, CustomerModule[]>()
      for (const mod of modules || []) {
        const existing = modulesByCustomer.get(mod.customer_id) || []
        existing.push(mod)
        modulesByCustomer.set(mod.customer_id, existing)
      }

      return (customers || []).map(c => {
        const customerModules = modulesByCustomer.get(c.id) || []
        const moduleMap = {} as Record<ModuleKey, boolean>
        for (const key of MODULE_KEYS) {
          const found = customerModules.find(m => m.module_key === key)
          moduleMap[key] = found ? found.enabled : false
        }
        return { ...c, modules: moduleMap }
      })
    },
  })

  const toggleModule = useMutation({
    mutationFn: async ({ customerId, moduleKey, enabled }: {
      customerId: string
      moduleKey: ModuleKey
      enabled: boolean
    }) => {
      const { error } = await supabase
        .from('customer_modules')
        .upsert(
          {
            customer_id: customerId,
            module_key: moduleKey,
            enabled,
            enabled_at: new Date().toISOString(),
          },
          { onConflict: 'customer_id,module_key' }
        )

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
    },
  })

  return {
    customers: customersQuery.data || [],
    loading: customersQuery.isLoading,
    error: customersQuery.error,
    toggleModule,
  }
}
