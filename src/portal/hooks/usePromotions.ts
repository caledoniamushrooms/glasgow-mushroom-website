import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'

export interface Promotion {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string | null
  discount_type: 'percentage' | 'fixed' | 'free_sample' | 'bundle' | 'info_only'
  discount_value: number | null
  applicable_product_ids: string[] | null
  applicable_customer_ids: string[] | null
  min_order_quantity: number | null
  active: boolean
  image_url: string | null
  created_at: string
}

export function usePromotions() {
  const { portalUser } = useAuthContext()
  const customerId = portalUser?.customer_id

  const promotionsQuery = useQuery({
    queryKey: ['promotions', customerId],
    queryFn: async (): Promise<Promotion[]> => {
      if (!customerId) return []
      // RLS handles customer targeting — just fetch all active promotions
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('active', true)
        .lte('start_date', new Date().toISOString().split('T')[0])
        .order('start_date', { ascending: false })

      if (error) throw error
      // Client-side filter for end_date (or() with null is cleaner in RLS)
      return (data || []).filter(
        p => !p.end_date || p.end_date >= new Date().toISOString().split('T')[0]
      )
    },
    enabled: !!customerId,
  })

  return {
    promotions: promotionsQuery.data || [],
    loading: promotionsQuery.isLoading,
    error: promotionsQuery.error,
  }
}
