import { useDeliveryNotes } from '../hooks/useDeliveryNotes'

const STATUS_BADGES: Record<string, string> = {
  pending: 'badge-pending',
  dispatched: 'badge-modified',
  delivered: 'badge-paid',
  signed: 'badge-paid',
}

export function DeliveryNotes() {
  const { deliveryNotes, loading, error } = useDeliveryNotes()

  if (loading) return <div className="odin-loading">Loading delivery notes...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load delivery notes</div>

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Delivery Notes</h1>
        <p className="text-sm text-muted-foreground mt-1">View delivery notes for your fulfilled orders</p>
      </header>

      {deliveryNotes.length === 0 ? (
        <div className="odin-empty">
          <p>No delivery notes yet.</p>
        </div>
      ) : (
        <div className="odin-table-container overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="odin-table-header">
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Note #</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Date</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Status</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Notes</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveryNotes.map(note => (
                <tr key={note.id} className="odin-table-row">
                  <td className="odin-table-cell font-semibold">{note.note_number}</td>
                  <td className="odin-table-cell text-muted-foreground">
                    {new Date(note.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="odin-table-cell">
                    <span className={`badge ${STATUS_BADGES[note.status] || 'badge-draft'}`}>{note.status}</span>
                  </td>
                  <td className="odin-table-cell text-muted-foreground max-w-[200px] truncate">{note.notes || '—'}</td>
                  <td className="odin-table-cell">
                    {note.pdf_url ? (
                      <a
                        href={note.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs no-underline hover:underline"
                      >
                        View PDF
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
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
