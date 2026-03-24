import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import type { Customer, Branch, DeliverySchedule } from '../lib/types'

export function useCustomer() {
  const { portalUser } = useAuthContext()
  const customerId = portalUser?.customer_id

  const customerQuery = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async (): Promise<Customer | null> => {
      if (!customerId) return null
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!customerId,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', customerId],
    queryFn: async (): Promise<Branch[]> => {
      if (!customerId) return []
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('customer_id', customerId)
        .order('name')

      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  const schedulesQuery = useQuery({
    queryKey: ['delivery-schedules', customerId],
    queryFn: async (): Promise<DeliverySchedule[]> => {
      if (!customerId) return []
      const { data, error } = await supabase
        .from('customer_delivery_schedules')
        .select('*')
        .eq('customer_id', customerId)
        .eq('active', true)

      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  return {
    customer: customerQuery.data || null,
    branches: branchesQuery.data || [],
    deliverySchedules: schedulesQuery.data || [],
    loading: customerQuery.isLoading,
    error: customerQuery.error,
  }
}
