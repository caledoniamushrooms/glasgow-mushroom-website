import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { useViewAs } from '../components/ViewAsProvider'
import type { Invoice, Payment } from '../lib/types'

export function useInvoices() {
  const { portalUser } = useAuthContext()
  const { viewAsCustomerId } = useViewAs()
  const customerId = viewAsCustomerId || portalUser?.customer_id
  const branchId = viewAsCustomerId ? null : (portalUser?.branch_id ?? null)

  const invoicesQuery = useQuery({
    queryKey: ['invoices', customerId, branchId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!customerId) return []
      let query = supabase
        .from('invoice_balances')
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

  const paymentsQuery = useQuery({
    queryKey: ['payments', customerId, branchId],
    queryFn: async (): Promise<Payment[]> => {
      if (!customerId) return []
      let query = supabase
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })

      // Payments may not have branch_id — filter via invoice join if needed
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  const outstandingBalance = (invoicesQuery.data || [])
    .reduce((sum, inv) => sum + (inv.amount_due || 0), 0)

  const unpaidCount = (invoicesQuery.data || [])
    .filter(inv => inv.status !== 'paid' && (inv.amount_due || 0) > 0).length

  return {
    invoices: invoicesQuery.data || [],
    payments: paymentsQuery.data || [],
    outstandingBalance,
    unpaidCount,
    loading: invoicesQuery.isLoading || paymentsQuery.isLoading,
    error: invoicesQuery.error || paymentsQuery.error,
    refetchInvoices: invoicesQuery.refetch,
    refetchPayments: paymentsQuery.refetch,
  }
}
