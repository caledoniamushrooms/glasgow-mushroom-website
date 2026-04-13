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

      // Fetch from view for calculated fields
      let query = supabase
        .from('invoice_balances')
        .select('*')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data: balances, error: balError } = await query
      if (balError) throw balError

      // Fetch PDF URLs from invoices table
      const invoiceIds = (balances || []).map((b: any) => b.invoice_id).filter(Boolean)
      let pdfMap = new Map<string, { pdf_url: string | null; xero_pdf_url: string | null; online_payment_url: string | null }>()

      if (invoiceIds.length > 0) {
        const { data: invoiceRows } = await supabase
          .from('invoices')
          .select('id, pdf_url, xero_pdf_url, online_payment_url')
          .in('id', invoiceIds)

        for (const row of invoiceRows || []) {
          pdfMap.set(row.id, { pdf_url: row.pdf_url, xero_pdf_url: row.xero_pdf_url, online_payment_url: row.online_payment_url })
        }
      }

      return (balances || []).map((b: any) => {
        const urls = pdfMap.get(b.invoice_id)
        return {
          ...b,
          id: b.invoice_id,
          pdf_url: urls?.pdf_url || urls?.xero_pdf_url || null,
          online_payment_url: urls?.online_payment_url || null,
        }
      })
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
    .reduce((sum, inv) => sum + (inv.amount_due ?? 0), 0)

  const unpaidCount = (invoicesQuery.data || [])
    .filter(inv => inv.calculated_status !== 'paid' && (inv.amount_due ?? 0) > 0).length

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
