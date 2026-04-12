import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { useViewAs } from '../components/ViewAsProvider'

export interface DeliveryNote {
  id: string
  customer_id: string
  branch_id: string | null
  sale_id: string | null
  portal_order_id: string | null
  note_number: string
  date: string
  pdf_url: string | null
  status: 'pending' | 'dispatched' | 'delivered' | 'signed'
  signed_by: string | null
  signed_at: string | null
  notes: string | null
  created_at: string
}

export function useDeliveryNotes() {
  const { portalUser } = useAuthContext()
  const { viewAsCustomerId } = useViewAs()
  const customerId = viewAsCustomerId || portalUser?.customer_id
  const branchId = viewAsCustomerId ? null : (portalUser?.branch_id ?? null)

  const notesQuery = useQuery({
    queryKey: ['delivery-notes', customerId, branchId],
    queryFn: async (): Promise<DeliveryNote[]> => {
      if (!customerId) return []
      let query = supabase
        .from('delivery_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  return {
    deliveryNotes: notesQuery.data || [],
    loading: notesQuery.isLoading,
    error: notesQuery.error,
  }
}
