import { useState } from 'react'
import { useRegistrations, type RegistrationRequest, type RegistrationStatus } from '../../hooks/useRegistrations'
import { useCustomerTypes } from '../../hooks/useCustomerTypes'

type Tab = 'interest' | 'applications' | 'all'

export function Registrations() {
  const {
    registrations,
    interestPending, reviewPending,
    interestPendingCount, reviewPendingCount,
    loading, error,
    approveRegistration, acceptApplication, rejectApplication,
  } = useRegistrations()
  const { data: customerTypes = [] } = useCustomerTypes()

  const [tab, setTab] = useState<Tab>('interest')
  const [actionError, setActionError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const list = tab === 'interest' ? interestPending
             : tab === 'applications' ? reviewPending
             : registrations

  const wrap = async (fn: () => Promise<unknown>) => {
    setActionError(null)
    try { await fn() } catch (err) { setActionError((err as Error).message) }
  }

  const onApprove = (id: string) => wrap(async () => {
    await approveRegistration.mutateAsync(id); setConfirmingId(null)
  })
  const onAccept = (id: string) => wrap(async () => {
    await acceptApplication.mutateAsync(id); setConfirmingId(null); setExpandedId(null)
  })
  const onReject = (id: string) => wrap(async () => {
    await rejectApplication.mutateAsync({ requestId: id, reason: rejectReason || undefined })
    setRejectingId(null); setRejectReason('')
  })

  if (loading) return <div className="odin-loading">Loading registrations...</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Registration Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review new customer registrations and completed applications.
          </p>
        </div>
      </header>

      {actionError && <Banner kind="error">{actionError}</Banner>}
      {error && <Banner kind="error">Failed to load registrations</Banner>}

      <div className="flex gap-1 mb-6">
        <TabButton active={tab === 'interest'} onClick={() => setTab('interest')}>
          Interest <Count n={interestPendingCount} />
        </TabButton>
        <TabButton active={tab === 'applications'} onClick={() => setTab('applications')}>
          Applications <Count n={reviewPendingCount} />
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>All</TabButton>
      </div>

      {list.length === 0 ? (
        <div className="odin-empty"><p>Nothing here.</p></div>
      ) : (
        <div className="odin-table-container overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="odin-table-header">
                <Th>Business</Th>
                <Th>Contact</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {list.map(req => (
                <RowGroup
                  key={req.id}
                  req={req}
                  isExpanded={expandedId === req.id}
                  onToggleExpand={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  isConfirming={confirmingId === req.id}
                  onStartConfirm={() => setConfirmingId(req.id)}
                  onCancelConfirm={() => setConfirmingId(null)}
                  isRejecting={rejectingId === req.id}
                  onStartReject={() => setRejectingId(req.id)}
                  onCancelReject={() => { setRejectingId(null); setRejectReason('') }}
                  rejectReason={rejectReason}
                  setRejectReason={setRejectReason}
                  onApprove={() => onApprove(req.id)}
                  onAccept={() => onAccept(req.id)}
                  onReject={() => onReject(req.id)}
                  busy={approveRegistration.isPending || acceptApplication.isPending || rejectApplication.isPending}
                  customerTypeName={customerTypes.find(t => t.id === req.site_type_id)?.name}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Row + expanded detail
// ---------------------------------------------------------------------

function RowGroup(props: {
  req: RegistrationRequest
  isExpanded: boolean
  onToggleExpand: () => void
  isConfirming: boolean
  onStartConfirm: () => void
  onCancelConfirm: () => void
  isRejecting: boolean
  onStartReject: () => void
  onCancelReject: () => void
  rejectReason: string
  setRejectReason: (v: string) => void
  onApprove: () => void
  onAccept: () => void
  onReject: () => void
  busy: boolean
  customerTypeName?: string
}) {
  const { req, isExpanded, onToggleExpand, isConfirming, onStartConfirm, onCancelConfirm,
    isRejecting, onStartReject, onCancelReject, rejectReason, setRejectReason,
    onApprove, onAccept, onReject, busy, customerTypeName } = props

  const expandable = req.status === 'submitted_for_review'

  return (
    <>
      <tr className="odin-table-row">
        <Td>
          {expandable ? (
            <button onClick={onToggleExpand} className="font-semibold text-left cursor-pointer hover:underline">
              {req.business_name}
            </button>
          ) : (
            <span className="font-semibold">{req.business_name}</span>
          )}
        </Td>
        <Td>{req.contact_name}</Td>
        <Td className="text-muted-foreground">{req.email}</Td>
        <Td className="text-muted-foreground">{req.phone || '—'}</Td>
        <Td className="text-muted-foreground text-xs">
          {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Td>
        <Td>{statusBadge(req.status)}</Td>
        <Td>
          <Actions
            req={req}
            isConfirming={isConfirming}
            onStartConfirm={onStartConfirm}
            onCancelConfirm={onCancelConfirm}
            isRejecting={isRejecting}
            onStartReject={onStartReject}
            onCancelReject={onCancelReject}
            rejectReason={rejectReason}
            setRejectReason={setRejectReason}
            onApprove={onApprove}
            onAccept={onAccept}
            onReject={onReject}
            busy={busy}
          />
        </Td>
      </tr>
      {expandable && isExpanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 p-4">
            <ApplicationDetail req={req} customerTypeName={customerTypeName} />
          </td>
        </tr>
      )}
    </>
  )
}

function ApplicationDetail({ req, customerTypeName }: { req: RegistrationRequest; customerTypeName?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <Detail label="Website" value={req.website} />
      <Detail label="Fulfilment" value={req.fulfilment_method} />
      <Detail label="Payment method" value={req.payment_method} />
      <Detail label="Site name" value={req.site_name} />
      <Detail label="Site type" value={customerTypeName} />
      <Detail label="Address" value={joinAddress(req)} />
      <Detail label="City" value={req.city} />
      <Detail label="Postcode" value={req.postcode} />
      <Detail label="Site phone" value={req.site_phone} />
      <Detail label="Site email" value={req.site_email} />
      <Detail label="Interest message" value={req.message} wide />
      <Detail label="Special requirements" value={req.notes} wide />
    </div>
  )
}

function Detail({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground">{value || '—'}</div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Actions cell
// ---------------------------------------------------------------------

function Actions(props: {
  req: RegistrationRequest
  isConfirming: boolean
  onStartConfirm: () => void
  onCancelConfirm: () => void
  isRejecting: boolean
  onStartReject: () => void
  onCancelReject: () => void
  rejectReason: string
  setRejectReason: (v: string) => void
  onApprove: () => void
  onAccept: () => void
  onReject: () => void
  busy: boolean
}) {
  const { req, isConfirming, onStartConfirm, onCancelConfirm,
    isRejecting, onStartReject, onCancelReject, rejectReason, setRejectReason,
    onApprove, onAccept, onReject, busy } = props

  if (req.status === 'rejected' || req.status === 'active') return null

  if (isRejecting) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          placeholder="Reason (optional)"
          rows={2}
          className="w-48 px-2 py-1 border border-input rounded text-xs bg-white odin-focus resize-none"
        />
        <div className="flex gap-2">
          <button onClick={onReject} disabled={busy}
            className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-50">
            {busy ? '...' : 'Reject'}
          </button>
          <button onClick={onCancelReject}
            className="bg-transparent border border-border px-3 py-1 rounded text-xs cursor-pointer text-muted-foreground hover:bg-accent">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (isConfirming) {
    const isAcceptStep = req.status === 'submitted_for_review'
    return (
      <div className="flex gap-2 items-center">
        <button onClick={isAcceptStep ? props.onAccept : props.onApprove} disabled={busy}
          className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-50">
          {busy ? '...' : 'Confirm'}
        </button>
        <button onClick={onCancelConfirm}
          className="bg-transparent border border-border px-3 py-1 rounded text-xs cursor-pointer text-muted-foreground hover:bg-accent">
          Cancel
        </button>
      </div>
    )
  }

  // Default state — show the right primary action for the status
  const primaryLabel = req.status === 'interest_submitted' ? 'Approve'
                     : req.status === 'submitted_for_review' ? 'Accept'
                     : null

  if (!primaryLabel) {
    // approved / onboarding_in_progress — only reject available
    return (
      <button onClick={onStartReject}
        className="bg-transparent border border-red-300 text-red-600 px-3 py-1 rounded text-xs cursor-pointer hover:bg-red-50">
        Reject
      </button>
    )
  }

  return (
    <div className="flex gap-2">
      <button onClick={onStartConfirm}
        className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-90">
        {primaryLabel}
      </button>
      <button onClick={onStartReject}
        className="bg-transparent border border-red-300 text-red-600 px-3 py-1 rounded text-xs cursor-pointer hover:bg-red-50">
        Reject
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------
// Misc UI
// ---------------------------------------------------------------------

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
        active ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-accent'
      }`}>
      {children}
    </button>
  )
}

function Count({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <span className="ml-2 inline-flex items-center justify-center bg-white/30 text-current text-xs font-bold rounded-full w-5 h-5">
      {n}
    </span>
  )
}

function Banner({ kind, children }: { kind: 'error'; children: React.ReactNode }) {
  const cls = kind === 'error' ? 'bg-red-50 border-red-200 text-red-700' : ''
  return <div className={`px-4 py-3 border rounded-md text-sm mb-4 ${cls}`}>{children}</div>
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="odin-table-cell text-left text-xs uppercase tracking-wide">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`odin-table-cell ${className}`}>{children}</td>
}

function statusBadge(status: RegistrationStatus) {
  const map: Record<RegistrationStatus, string> = {
    interest_submitted:     'badge-pending',
    approved:               'badge-info',
    onboarding_in_progress: 'badge-info',
    submitted_for_review:   'badge-pending',
    active:                 'badge-paid',
    rejected:               'badge-cancelled',
  }
  const label: Record<RegistrationStatus, string> = {
    interest_submitted:     'Interest',
    approved:               'Approved',
    onboarding_in_progress: 'In progress',
    submitted_for_review:   'For review',
    active:                 'Active',
    rejected:               'Rejected',
  }
  return <span className={`badge ${map[status]}`}>{label[status]}</span>
}

function joinAddress(req: RegistrationRequest): string {
  return [req.address_line_1, req.address_line_2, req.address_line_3]
    .filter(Boolean).join(', ')
}
