import { useState } from 'react'
import { useRegistrations, type RegistrationRequest } from '../../hooks/useRegistrations'

export function Registrations() {
  const { registrations, pendingCount, loading, error, approveRegistration, rejectRegistration } = useRegistrations()
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingApprove, setConfirmingApprove] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const filtered = filter === 'pending'
    ? registrations.filter(r => r.status === 'pending')
    : registrations

  const handleApprove = async (id: string) => {
    setActionError(null)
    try {
      await approveRegistration.mutateAsync(id)
      setConfirmingApprove(null)
    } catch (err) {
      setActionError((err as Error).message || 'Failed to approve registration')
    }
  }

  const handleReject = async (id: string) => {
    setActionError(null)
    try {
      await rejectRegistration.mutateAsync({ requestId: id, reason: rejectReason || undefined })
      setRejectingId(null)
      setRejectReason('')
    } catch (err) {
      setActionError((err as Error).message || 'Failed to reject registration')
    }
  }

  const statusBadge = (status: RegistrationRequest['status']) => {
    const classes: Record<string, string> = {
      pending: 'badge-pending',
      invited: 'badge-paid',
      registered: 'badge-paid',
      rejected: 'badge-cancelled',
    }
    return <span className={`badge ${classes[status] || 'badge-draft'}`}>{status}</span>
  }

  if (loading) return <div className="odin-loading">Loading registrations...</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Registration Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve new customer registrations
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5">
                {pendingCount}
              </span>
            )}
          </p>
        </div>
      </header>

      {actionError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-4">{actionError}</div>
      )}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-4">Failed to load registrations</div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {(['pending', 'all'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              filter === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-accent'
            }`}
          >
            {tab === 'pending' ? `Pending (${pendingCount})` : 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="odin-empty">
          <p>{filter === 'pending' ? 'No pending registration requests.' : 'No registration requests found.'}</p>
        </div>
      ) : (
        <div className="odin-table-container overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="odin-table-header">
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Business</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Contact</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Email</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Phone</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Message</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Date</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Status</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(req => (
                <tr key={req.id} className="odin-table-row">
                  <td className="odin-table-cell font-semibold">{req.business_name}</td>
                  <td className="odin-table-cell">{req.contact_name}</td>
                  <td className="odin-table-cell text-muted-foreground">{req.email}</td>
                  <td className="odin-table-cell text-muted-foreground">{req.phone || '—'}</td>
                  <td className="odin-table-cell text-muted-foreground max-w-[200px] truncate">{req.message || '—'}</td>
                  <td className="odin-table-cell text-muted-foreground text-xs">
                    {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="odin-table-cell">{statusBadge(req.status)}</td>
                  <td className="odin-table-cell">
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        {confirmingApprove === req.id ? (
                          <div className="flex gap-2 items-center">
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={approveRegistration.isPending}
                              className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-50"
                            >
                              {approveRegistration.isPending ? '...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmingApprove(null)}
                              className="bg-transparent border border-border px-3 py-1 rounded text-xs cursor-pointer text-muted-foreground hover:bg-accent"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : rejectingId === req.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              placeholder="Reason (optional)"
                              rows={2}
                              className="w-48 px-2 py-1 border border-input rounded text-xs bg-white odin-focus resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReject(req.id)}
                                disabled={rejectRegistration.isPending}
                                className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-50"
                              >
                                {rejectRegistration.isPending ? '...' : 'Reject'}
                              </button>
                              <button
                                onClick={() => { setRejectingId(null); setRejectReason('') }}
                                className="bg-transparent border border-border px-3 py-1 rounded text-xs cursor-pointer text-muted-foreground hover:bg-accent"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setConfirmingApprove(req.id)}
                              className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-90"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingId(req.id)}
                              className="bg-transparent border border-red-300 text-red-600 px-3 py-1 rounded text-xs cursor-pointer hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
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
