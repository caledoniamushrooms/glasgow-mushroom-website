import { Link } from 'react-router-dom'
import { useInvoices } from '../hooks/useInvoices'

const STATUS_CLASSES: Record<string, string> = {
  paid: 'badge badge-paid',
  unpaid: 'badge badge-pending',
  partially_paid: 'badge badge-modified',
  draft: 'badge badge-draft',
  sent: 'badge badge-pending',
  voided: 'badge badge-cancelled',
}

export function Invoices() {
  const { invoices, loading, error, outstandingBalance } = useInvoices()

  if (loading) return <div className="odin-loading">Loading invoices...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load invoices: {(error as Error).message}</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">View and pay your invoices</p>
        </div>
        {outstandingBalance > 0 && (
          <div className="text-right">
            <span className="block text-xs text-muted-foreground uppercase tracking-wide">Outstanding</span>
            <span className="text-2xl font-bold text-red-600">&pound;{outstandingBalance.toFixed(2)}</span>
          </div>
        )}
      </header>

      {invoices.length === 0 ? (
        <div className="odin-empty">
          <p>No invoices yet.</p>
        </div>
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
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="odin-table-row">
                  <td className="odin-table-cell font-semibold">{inv.invoice_no}</td>
                  <td className="odin-table-cell text-muted-foreground">{new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="odin-table-cell text-right">&pound;{inv.total?.toFixed(2)}</td>
                  <td className="odin-table-cell text-right font-semibold">&pound;{(inv.amount_due || 0).toFixed(2)}</td>
                  <td className="odin-table-cell">
                    <span className={STATUS_CLASSES[inv.status] || 'badge'}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="odin-table-cell">
                    <div className="flex gap-3">
                      <Link to={`/portal/invoices/${inv.id}`} className="text-primary font-medium no-underline hover:underline">View</Link>
                      {inv.online_payment_url && (inv.amount_due || 0) > 0 && (
                        <a href={inv.online_payment_url} target="_blank" rel="noopener noreferrer" className="text-white bg-primary px-2.5 py-0.5 rounded text-xs font-medium no-underline hover:opacity-90">
                          Pay
                        </a>
                      )}
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary font-medium no-underline hover:underline">
                          PDF
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
