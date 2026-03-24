import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'

/**
 * Subscribe to Supabase Realtime changes for the current customer.
 * Automatically invalidates relevant TanStack Query caches when
 * portal_orders, invoices, or payments change.
 */
export function useRealtime() {
  const { portalUser } = useAuthContext()
  const queryClient = useQueryClient()
  const customerId = portalUser?.customer_id

  useEffect(() => {
    if (!customerId) return

    const channel = supabase
      .channel(`portal-${customerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'portal_orders',
        filter: `customer_id=eq.${customerId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['portal-orders'] })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invoices',
        filter: `customer_id=eq.${customerId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `customer_id=eq.${customerId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['payments'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customerId, queryClient])
}
