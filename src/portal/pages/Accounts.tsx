import { useState } from 'react'
import { useInvoices } from '../hooks/useInvoices'
import { supabase } from '../lib/supabase'

const STATUS_CLASSES: Record<string, string> = {
  paid: 'badge badge-paid',
  unpaid: 'badge badge-pending',
  partially_paid: 'badge badge-modified',
  draft: 'badge badge-draft',
  sent: 'badge badge-pending',
  voided: 'badge badge-cancelled',
}

type Tab = 'invoices' | 'payments'

export function Accounts() {
  const { invoices, payments, loading, error, outstandingBalance } = useInvoices()
  const [tab, setTab] = useState<Tab>('invoices')
  const [openingPdf, setOpeningPdf] = useState<string | null>(null)

  const handleInvoiceClick = async (invoiceNo: string) => {
    setOpeningPdf(invoiceNo)
    try {
      // Search storage bucket for this invoice's PDF
      const year = '2025' // Try 2025 first, then 2026
      for (const y of ['2026', '2025']) {
        const { data } = await supabase.storage
          .from('invoices')
          .list(y, { search: invoiceNo })

        if (data && data.length > 0) {
          // Get the latest version (highest timestamp)
          const sorted = data
            .filter(f => f.name.startsWith(invoiceNo))
            .sort((a, b) => b.name.localeCompare(a.name))
          if (sorted.length > 0) {
            const { data: urlData } = supabase.storage
              .from('invoices')
              .getPublicUrl(`${y}/${sorted[0].name}`)
            window.open(urlData.publicUrl, '_blank')
            setOpeningPdf(null)
            return
          }
        }
      }

      // Also check root level files
      const { data: rootFiles } = await supabase.storage
        .from('invoices')
        .list('', { search: invoiceNo })

      if (rootFiles && rootFiles.length > 0) {
        const match = rootFiles.find(f => f.name.includes(invoiceNo))
        if (match) {
          const { data: urlData } = supabase.storage
            .from('invoices')
            .getPublicUrl(match.name)
          window.open(urlData.publicUrl, '_blank')
          setOpeningPdf(null)
          return
        }
      }

      alert(`No PDF found for ${invoiceNo}`)
    } catch (err) {
      console.error('Failed to find invoice PDF:', err)
      alert('Failed to load invoice PDF')
    }
    setOpeningPdf(null)
  }

  if (loading) return <div className="odin-loading">Loading accounts...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load account data</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Invoices and payment history</p>
        </div>
        {outstandingBalance > 0 && (
          <div className="text-right">
            <span className="block text-xs text-muted-foreground uppercase tracking-wide">Outstanding</span>
            <span className="text-2xl font-bold text-red-600">&pound;{outstandingBalance.toFixed(2)}</span>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {([
          ['invoices', `Invoices (${invoices.length})`],
          ['payments', `Payments (${payments.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px bg-transparent ${
              tab === key
                ? 'text-foreground border-b-foreground'
                : 'text-muted-foreground border-b-transparent hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Invoices tab */}
      {tab === 'invoices' && (
        invoices.length === 0 ? (
          <div className="odin-empty"><p>No invoices yet.</p></div>
        ) : (
          <div className="odin-table-container overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="odin-table-header">
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Invoice</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Date</th>
                  <th className="odin-table-cell text-right text-xs uppercase tracking-wide">Total</th>
                  <th className="odin-table-cell text-right text-xs uppercase tracking-wide">Due</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr
                    key={(inv as any).invoice_id || inv.id}
                    className="odin-table-row cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleInvoiceClick(inv.invoice_no)}
                  >
                    <td className="odin-table-cell font-semibold">
                      <span className="text-primary">{inv.invoice_no}</span>
                      {openingPdf === inv.invoice_no && <span className="text-xs text-muted-foreground ml-2">Opening...</span>}
                    </td>
                    <td className="odin-table-cell text-muted-foreground">{new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="odin-table-cell text-right">&pound;{inv.invoice_total?.toFixed(2)}</td>
                    <td className="odin-table-cell text-right font-semibold">&pound;{(inv.amount_due || 0).toFixed(2)}</td>
                    <td className="odin-table-cell">
                      <span className={STATUS_CLASSES[inv.calculated_status] || 'badge'}>{inv.calculated_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Payments tab */}
      {tab === 'payments' && (
        payments.length === 0 ? (
          <div className="odin-empty"><p>No payments recorded yet.</p></div>
        ) : (
          <div className="odin-table-container overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="odin-table-header">
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Date</th>
                  <th className="odin-table-cell text-right text-xs uppercase tracking-wide">Amount</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Method</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Status</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="odin-table-row">
                    <td className="odin-table-cell">{new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="odin-table-cell text-right font-semibold">&pound;{p.amount?.toFixed(2)}</td>
                    <td className="odin-table-cell">{p.method || p.source || '-'}</td>
                    <td className="odin-table-cell">
                      <span className={`badge ${p.status === 'completed' ? 'badge-paid' : 'badge-pending'}`}>{p.status}</span>
                    </td>
                    <td className="odin-table-cell text-muted-foreground">{p.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
