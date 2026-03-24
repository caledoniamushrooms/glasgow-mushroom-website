import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import type { Invoice, Payment } from '../lib/types'

export function useInvoices() {
  const { portalUser } = useAuthContext()
  const customerId = portalUser?.customer_id

  const invoicesQuery = useQuery({
    queryKey: ['invoices', customerId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!customerId) return []
      const { data, error } = await supabase
        .from('invoice_balances')
        .select('*')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  const paymentsQuery = useQuery({
    queryKey: ['payments', customerId],
    queryFn: async (): Promise<Payment[]> => {
      if (!customerId) return []
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })

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
