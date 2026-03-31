import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import type { PortalOrder, Product, ProductType } from '../lib/types'

export function useOrders() {
  const { portalUser } = useAuthContext()
  const customerId = portalUser?.customer_id
  const branchId = portalUser?.branch_id
  const queryClient = useQueryClient()

  const ordersQuery = useQuery({
    queryKey: ['portal-orders', customerId, branchId],
    queryFn: async (): Promise<PortalOrder[]> => {
      if (!customerId) return []
      let query = supabase
        .from('portal_orders')
        .select('*, portal_order_items(*)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []).map(o => ({ ...o, items: o.portal_order_items }))
    },
    enabled: !!customerId,
  })

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) throw error
      return data || []
    },
  })

  const productTypesQuery = useQuery({
    queryKey: ['product-types'],
    queryFn: async (): Promise<ProductType[]> => {
      const { data, error } = await supabase
        .from('product_types')
        .select('*')
        .order('name')

      if (error) throw error
      return data || []
    },
  })

  const submitOrder = useMutation({
    mutationFn: async (order: {
      branch_id: string | null
      requested_date: string
      customer_notes: string
      items: Array<{ product_id: string; product_type_id: string; quantity: number; estimated_price: number | null }>
    }) => {
      if (!customerId || !portalUser) throw new Error('Not authenticated')

      // Insert portal order
      const { data: portalOrder, error: orderError } = await supabase
        .from('portal_orders')
        .insert({
          customer_id: customerId,
          branch_id: order.branch_id,
          portal_user_id: portalUser.id,
          requested_date: order.requested_date,
          customer_notes: order.customer_notes || null,
          status: 'submitted',
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Insert order items
      const items = order.items.map(item => ({
        portal_order_id: portalOrder.id,
        product_id: item.product_id,
        product_type_id: item.product_type_id,
        quantity: item.quantity,
        estimated_price: item.estimated_price,
      }))

      const { error: itemsError } = await supabase
        .from('portal_order_items')
        .insert(items)

      if (itemsError) throw itemsError

      return portalOrder
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-orders'] })
    },
  })

  const updateOrder = useMutation({
    mutationFn: async (order: {
      id: string
      branch_id: string | null
      requested_date: string
      customer_notes: string
      items: Array<{ product_id: string; product_type_id: string; quantity: number; estimated_price: number | null }>
    }) => {
      if (!customerId || !portalUser) throw new Error('Not authenticated')

      // Update portal order
      const { error: orderError } = await supabase
        .from('portal_orders')
        .update({
          branch_id: order.branch_id,
          requested_date: order.requested_date,
          customer_notes: order.customer_notes || null,
        })
        .eq('id', order.id)
        .eq('status', 'submitted')

      if (orderError) throw orderError

      // Delete existing items and re-insert
      const { error: deleteError } = await supabase
        .from('portal_order_items')
        .delete()
        .eq('portal_order_id', order.id)

      if (deleteError) throw deleteError

      const items = order.items.map(item => ({
        portal_order_id: order.id,
        product_id: item.product_id,
        product_type_id: item.product_type_id,
        quantity: item.quantity,
        estimated_price: item.estimated_price,
      }))

      const { error: itemsError } = await supabase
        .from('portal_order_items')
        .insert(items)

      if (itemsError) throw itemsError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-orders'] })
    },
  })

  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('portal_orders')
        .update({
          status: 'cancelled',
          cancelled_by: 'customer',
          cancelled_reason: 'Cancelled by customer',
        })
        .eq('id', orderId)
        .eq('status', 'submitted')

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-orders'] })
    },
  })

  const upcomingOrders = (ordersQuery.data || [])
    .filter(o => ['submitted', 'confirmed', 'modified'].includes(o.status))
    .sort((a, b) => a.requested_date.localeCompare(b.requested_date))

  return {
    orders: ordersQuery.data || [],
    upcomingOrders,
    products: productsQuery.data || [],
    productTypes: productTypesQuery.data || [],
    loading: ordersQuery.isLoading,
    error: ordersQuery.error,
    submitOrder,
    updateOrder,
    cancelOrder,
  }
}
