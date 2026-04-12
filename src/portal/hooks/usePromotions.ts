import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'

export interface Promotion {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  discount_percent: number
  price_tier_id: string | null
  customer_type_id: string | null
  product_id: string | null
  product_type_id: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export function usePromotions() {
  const { portalUser } = useAuthContext()
  const customerId = portalUser?.customer_id

  const promotionsQuery = useQuery({
    queryKey: ['promotions', customerId],
    queryFn: async (): Promise<Promotion[]> => {
      if (!customerId) return []
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('active', true)
        .lte('start_date', today)
        .gte('end_date', today)
        .order('start_date', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  return {
    promotions: promotionsQuery.data || [],
    loading: promotionsQuery.isLoading,
    error: promotionsQuery.error,
  }
}
