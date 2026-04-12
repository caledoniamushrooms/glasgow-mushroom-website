import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ModuleKey } from '../lib/modules'
import { MODULE_KEYS } from '../lib/modules'

export interface CustomerWithModules {
  id: string
  name: string
  email: string
  phone: string | null
  created_at: string
  tier_name: string | null
  customer_type_name: string | null
  modules: Record<ModuleKey, boolean>
}

interface CustomerModule {
  id: string
  customer_id: string
  module_key: string
  enabled: boolean
}

interface RawCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  created_at: string
  price_tiers: { name: string; display_name: string } | null
  branches: Array<{ customer_types: { name: string } | null }> | null
}

export function useAdminCustomers() {
  const queryClient = useQueryClient()

  const customersQuery = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async (): Promise<CustomerWithModules[]> => {
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select(`
          id, name, email, phone, created_at,
          price_tiers(name, display_name),
          branches(customer_types:type_id(name))
        `)
        .order('name') as { data: RawCustomer[] | null; error: any }

      if (custError) throw custError

      const { data: modules, error: modError } = await supabase
        .from('customer_modules')
        .select('*')

      if (modError) throw modError

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

        // Get customer type from first branch
        const firstBranch = c.branches?.[0]
        const customerTypeName = (firstBranch?.customer_types as any)?.name || null

        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          created_at: c.created_at,
          tier_name: (c.price_tiers as any)?.display_name || null,
          customer_type_name: customerTypeName,
          modules: moduleMap,
        }
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
