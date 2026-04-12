import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'

export interface StockoutRequest {
  id: string
  customer_id: string
  branch_id: string | null
  portal_user_id: string
  product_id: string | null
  product_name_text: string | null
  quantity_needed: number | null
  urgency: 'low' | 'normal' | 'urgent'
  message: string | null
  status: 'submitted' | 'acknowledged' | 'resolved' | 'cancelled'
  staff_notes: string | null
  resolved_at: string | null
  created_at: string
}

export function useStockouts() {
  const { portalUser } = useAuthContext()
  const customerId = portalUser?.customer_id
  const branchId = portalUser?.branch_id
  const queryClient = useQueryClient()

  const stockoutsQuery = useQuery({
    queryKey: ['stockout-requests', customerId],
    queryFn: async (): Promise<StockoutRequest[]> => {
      if (!customerId) return []
      const { data, error } = await supabase
        .from('stockout_requests')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  const submitRequest = useMutation({
    mutationFn: async (request: {
      product_id: string | null
      product_name_text: string | null
      quantity_needed: number | null
      urgency: 'low' | 'normal' | 'urgent'
      message: string | null
    }) => {
      if (!customerId || !portalUser) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('stockout_requests')
        .insert({
          customer_id: customerId,
          branch_id: branchId || null,
          portal_user_id: portalUser.id,
          ...request,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockout-requests'] })
    },
  })

  return {
    requests: stockoutsQuery.data || [],
    loading: stockoutsQuery.isLoading,
    error: stockoutsQuery.error,
    submitRequest,
  }
}
