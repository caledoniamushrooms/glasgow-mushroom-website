import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface CustomerType {
  id: string
  name: string
}

export function useCustomerTypes() {
  return useQuery({
    queryKey: ['customer-types', 'portal-visible'],
    queryFn: async (): Promise<CustomerType[]> => {
      const { data, error } = await supabase
        .from('customer_types')
        .select('id, name')
        .eq('is_portal_visible', true)
        .eq('active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 60,
  })
}
