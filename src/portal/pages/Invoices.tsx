import { Link } from 'react-router-dom'
import { useInvoices } from '../hooks/useInvoices'
import './Invoices.css'

const STATUS_CLASSES: Record<string, string> = {
  paid: 'badge-paid',
  unpaid: 'badge-pending',
  partially_paid: 'badge-modified',
  draft: 'badge-draft',
  sent: 'badge-pending',
  voided: 'badge-cancelled',
}

export function Invoices() {
  const { invoices, loading, error, outstandingBalance } = useInvoices()

  if (loading) return <div className="portal-loading">Loading invoices...</div>
  if (error) return <div className="portal-error">Failed to load invoices: {(error as Error).message}</div>

  return (
    <div className="invoices-page">
      <header className="invoices-header">
        <div>
          <h1>Invoices</h1>
          <p>View and pay your invoices</p>
        </div>
        {outstandingBalance > 0 && (
          <div className="invoices-balance">
            <span className="invoices-balance-label">Outstanding</span>
            <span className="invoices-balance-amount">&pound;{outstandingBalance.toFixed(2)}</span>
          </div>
        )}
      </header>

      {invoices.length === 0 ? (
        <div className="invoices-empty">
          <p>No invoices yet.</p>
        </div>
      ) : (
        <div className="invoices-table-wrap">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th className="text-right">Total</th>
                <th className="text-right">Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td className="invoice-no">{inv.invoice_no}</td>
                  <td className="text-muted">{new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="text-right">&pound;{inv.total?.toFixed(2)}</td>
                  <td className="text-right font-semibold">&pound;{(inv.amount_due || 0).toFixed(2)}</td>
                  <td>
                    <span className={`invoice-badge ${STATUS_CLASSES[inv.status] || ''}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="invoice-actions">
                    <Link to={`/portal/invoices/${inv.id}`} className="invoice-link">View</Link>
                    {inv.online_payment_url && (inv.amount_due || 0) > 0 && (
                      <a href={inv.online_payment_url} target="_blank" rel="noopener noreferrer" className="invoice-pay-link">
                        Pay
                      </a>
                    )}
                    {inv.pdf_url && (
                      <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="invoice-link">
                        PDF
                      </a>
                    )}
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
