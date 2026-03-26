import { useInvoices } from '../hooks/useInvoices'

export function Payments() {
  const { payments, loading, error } = useInvoices()

  if (loading) return <div className="odin-loading">Loading payments...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load payments: {(error as Error).message}</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Your payment history</p>
        </div>
      </header>

      {payments.length === 0 ? (
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
                    <span className={`badge ${p.status === 'completed' ? 'badge-paid' : 'badge-pending'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="odin-table-cell text-muted-foreground">{p.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
