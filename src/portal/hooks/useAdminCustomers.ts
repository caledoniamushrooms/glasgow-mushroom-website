import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ModuleKey } from '../lib/modules'
import { MODULE_KEYS } from '../lib/modules'
import type { PortalUser } from '../lib/types'

export interface ModuleConfig {
  visible_grades?: string[] // product_type IDs visible to this customer
}

export interface CustomerWithDetails {
  id: string
  name: string
  email: string
  phone: string | null
  active: boolean
  portal_enabled: boolean
  created_at: string
  tier_name: string | null
  customer_type_name: string | null
  modules: Record<ModuleKey, { enabled: boolean; config: ModuleConfig }>
  team: PortalUser[]
}

export function useAdminCustomers() {
  const queryClient = useQueryClient()

  const customersQuery = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async (): Promise<CustomerWithDetails[]> => {
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select(`
          id, name, email, phone, active, portal_enabled, created_at,
          price_tiers(name, display_name),
          branches(customer_types:type_id(name))
        `)
        .order('name')

      if (custError) throw custError

      const { data: modules, error: modError } = await supabase
        .from('customer_modules')
        .select('*')

      if (modError) throw modError

      const { data: portalUsers, error: puError } = await supabase
        .from('portal_users')
        .select('*')
        .order('created_at')

      if (puError) throw puError

      // Group modules by customer
      const modulesByCustomer = new Map<string, Array<{ module_key: string; enabled: boolean; config: ModuleConfig }>>()
      for (const mod of modules || []) {
        const existing = modulesByCustomer.get(mod.customer_id) || []
        existing.push({ module_key: mod.module_key, enabled: mod.enabled, config: (mod as any).config || {} })
        modulesByCustomer.set(mod.customer_id, existing)
      }

      // Group portal users by customer
      const usersByCustomer = new Map<string, PortalUser[]>()
      for (const pu of (portalUsers || []) as PortalUser[]) {
        const existing = usersByCustomer.get(pu.customer_id) || []
        existing.push(pu)
        usersByCustomer.set(pu.customer_id, existing)
      }

      return (customers || []).map((c: any) => {
        const customerModules = modulesByCustomer.get(c.id) || []
        const moduleMap = {} as Record<ModuleKey, { enabled: boolean; config: ModuleConfig }>
        for (const key of MODULE_KEYS) {
          const found = customerModules.find(m => m.module_key === key)
          moduleMap[key] = {
            enabled: found ? found.enabled : false,
            config: found?.config || {},
          }
        }

        const firstBranch = c.branches?.[0]
        const customerTypeName = firstBranch?.customer_types?.name || null

        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          active: c.active,
          portal_enabled: c.portal_enabled,
          created_at: c.created_at,
          tier_name: c.price_tiers?.display_name || null,
          customer_type_name: customerTypeName,
          modules: moduleMap,
          team: usersByCustomer.get(c.id) || [],
        }
      })
    },
  })

  const togglePortalAccess = useMutation({
    mutationFn: async ({ customerId, enabled }: { customerId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('customers')
        .update({ portal_enabled: enabled })
        .eq('id', customerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
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

  const inviteUser = useMutation({
    mutationFn: async ({ customerId, email, displayName, role }: {
      customerId: string
      email: string
      displayName: string
      role: 'admin' | 'member'
    }) => {
      const { data, error } = await supabase.functions.invoke('portal-registration', {
        body: {
          action: 'invite_existing',
          customer_id: customerId,
          email,
          display_name: displayName,
          role,
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
    },
  })

  const updateModuleConfig = useMutation({
    mutationFn: async ({ customerId, moduleKey, config }: {
      customerId: string
      moduleKey: ModuleKey
      config: ModuleConfig
    }) => {
      const { error } = await supabase
        .from('customer_modules')
        .upsert(
          {
            customer_id: customerId,
            module_key: moduleKey,
            enabled: true,
            config,
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
    togglePortalAccess,
    toggleModule,
    updateModuleConfig,
    inviteUser,
  }
}
