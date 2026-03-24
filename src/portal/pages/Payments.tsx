import { useInvoices } from '../hooks/useInvoices'
import './Invoices.css'

export function Payments() {
  const { payments, loading, error } = useInvoices()

  if (loading) return <div className="portal-loading">Loading payments...</div>
  if (error) return <div className="portal-error">Failed to load payments: {(error as Error).message}</div>

  return (
    <div>
      <header className="invoices-header">
        <div>
          <h1>Payments</h1>
          <p>Your payment history</p>
        </div>
      </header>

      {payments.length === 0 ? (
        <div className="invoices-empty"><p>No payments recorded yet.</p></div>
      ) : (
        <div className="invoices-table-wrap">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="text-right font-semibold">&pound;{p.amount?.toFixed(2)}</td>
                  <td>{p.method || p.source || '-'}</td>
                  <td>
                    <span className={`invoice-badge ${p.status === 'completed' ? 'badge-paid' : 'badge-pending'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="text-muted">{p.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
