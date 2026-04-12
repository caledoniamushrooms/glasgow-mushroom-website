import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { useViewAs } from '../components/ViewAsProvider'

interface RecurringOrder {
  id: string
  customer_id: string
  branch_id: string | null
  name: string
  days_of_week: number[]
  active: boolean
  paused_until: string | null
  source: string
  created_at: string
  items?: RecurringOrderItem[]
}

interface RecurringOrderItem {
  id: string
  recurring_order_id: string
  product_type_id: string
  quantity: number
}

export function useRecurringOrders() {
  const { portalUser } = useAuthContext()
  const { viewAsCustomerId } = useViewAs()
  const customerId = viewAsCustomerId || portalUser?.customer_id
  const branchId = viewAsCustomerId ? null : (portalUser?.branch_id ?? null)
  const queryClient = useQueryClient()

  const recurringQuery = useQuery({
    queryKey: ['recurring-orders', customerId, branchId],
    queryFn: async (): Promise<RecurringOrder[]> => {
      if (!customerId) return []
      let query = supabase
        .from('recurring_orders')
        .select('*, recurring_order_items(*)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []).map(o => ({ ...o, items: o.recurring_order_items }))
    },
    enabled: !!customerId,
  })

  const createRecurring = useMutation({
    mutationFn: async (order: {
      name: string
      branch_id: string | null
      days_of_week: number[]
      items: Array<{ product_type_id: string; quantity: number }>
    }) => {
      if (!customerId) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('recurring_orders')
        .insert({
          customer_id: customerId,
          branch_id: order.branch_id,
          name: order.name,
          days_of_week: order.days_of_week,
          active: true,
          source: 'portal',
          end_type: 'indefinite',
        })
        .select()
        .single()

      if (error) throw error

      // Insert items
      if (order.items.length > 0) {
        const items = order.items.map(item => ({
          recurring_order_id: data.id,
          product_type_id: item.product_type_id,
          quantity: item.quantity,
        }))
        await supabase.from('recurring_order_items').insert(items)
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-orders'] })
    },
  })

  const togglePause = useMutation({
    mutationFn: async ({ orderId, pauseUntil }: { orderId: string; pauseUntil: string | null }) => {
      const { error } = await supabase
        .from('recurring_orders')
        .update({
          paused_until: pauseUntil,
          active: !pauseUntil,
        })
        .eq('id', orderId)
        .eq('customer_id', customerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-orders'] })
    },
  })

  const cancelRecurring = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('recurring_orders')
        .update({ active: false })
        .eq('id', orderId)
        .eq('customer_id', customerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-orders'] })
    },
  })

  return {
    recurringOrders: recurringQuery.data || [],
    loading: recurringQuery.isLoading,
    error: recurringQuery.error,
    createRecurring,
    togglePause,
    cancelRecurring,
  }
}
