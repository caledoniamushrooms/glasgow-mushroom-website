import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import type { PortalUser } from '../lib/types'
import './Invoices.css'

export function Team() {
  const { portalUser, isAdmin } = useAuthContext()
  const customerId = portalUser?.customer_id
  const queryClient = useQueryClient()

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const teamQuery = useQuery({
    queryKey: ['team', customerId],
    queryFn: async (): Promise<PortalUser[]> => {
      if (!customerId) return []
      const { data, error } = await supabase
        .from('portal_users')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at')

      if (error) throw error
      return data || []
    },
    enabled: !!customerId,
  })

  const inviteMember = useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      // Call the portal-registration Edge Function to invite
      const { data, error } = await supabase.functions.invoke('portal-registration', {
        body: {
          action: 'invite_existing',
          customer_id: customerId,
          email,
          display_name: name,
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
    },
  })

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await inviteMember.mutateAsync({ email: inviteEmail, name: inviteName })
    } catch (err) {
      setError((err as Error).message || 'Failed to send invitation')
    }
  }

  const team = teamQuery.data || []

  if (teamQuery.isLoading) return <div className="portal-loading">Loading team...</div>

  return (
    <div>
      <header className="invoices-header">
        <div>
          <h1>Team</h1>
          <p>Manage who can access your portal account</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            style={{
              background: 'var(--portal-green)', color: 'var(--portal-white)',
              border: 'none', padding: '8px 16px', borderRadius: 'var(--portal-radius-sm)',
              fontWeight: 600, fontSize: 'var(--portal-text-sm)', cursor: 'pointer',
            }}
          >
            Invite Member
          </button>
        )}
      </header>

      {error && <div className="portal-error" style={{ marginBottom: 'var(--portal-space-md)' }}>{error}</div>}

      {/* Invite form */}
      {showInvite && isAdmin && (
        <form onSubmit={handleInvite} style={{
          padding: 'var(--portal-space-md)',
          background: 'var(--portal-surface)',
          border: '1px solid var(--portal-border)',
          borderRadius: 'var(--portal-radius)',
          marginBottom: 'var(--portal-space-lg)',
          display: 'grid',
          gap: 'var(--portal-space-sm)',
          maxWidth: '400px',
        }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: 'var(--portal-text-sm)', marginBottom: '4px' }}>Name</label>
            <input
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Colleague's name"
              required
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)', fontSize: 'var(--portal-text-sm)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: 'var(--portal-text-sm)', marginBottom: '4px' }}>Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@business.com"
              required
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)', fontSize: 'var(--portal-text-sm)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--portal-space-sm)' }}>
            <button type="submit" disabled={inviteMember.isPending} style={{
              background: 'var(--portal-green)', color: 'var(--portal-white)',
              border: 'none', padding: '8px 16px', borderRadius: 'var(--portal-radius-sm)',
              fontSize: 'var(--portal-text-sm)', cursor: 'pointer', fontWeight: 500,
            }}>
              {inviteMember.isPending ? 'Sending...' : 'Send Invite'}
            </button>
            <button type="button" onClick={() => setShowInvite(false)} style={{
              background: 'none', border: '1px solid var(--portal-border)',
              padding: '8px 16px', borderRadius: 'var(--portal-radius-sm)',
              fontSize: 'var(--portal-text-sm)', cursor: 'pointer', color: 'var(--portal-text-muted)',
            }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Team list */}
      <div className="invoices-table-wrap">
        <table className="invoices-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            {team.map(member => (
              <tr key={member.id}>
                <td className="font-semibold">
                  {member.display_name}
                  {member.id === portalUser?.id && (
                    <span style={{ fontSize: 'var(--portal-text-xs)', color: 'var(--portal-text-muted)', marginLeft: '4px' }}>(you)</span>
                  )}
                </td>
                <td className="text-muted">{member.email}</td>
                <td>
                  <span className={`invoice-badge ${member.role === 'admin' ? 'badge-modified' : 'badge-draft'}`}>
                    {member.role}
                  </span>
                </td>
                <td>
                  <span className={`invoice-badge ${member.status === 'active' ? 'badge-paid' : 'badge-pending'}`}>
                    {member.status}
                  </span>
                </td>
                <td className="text-muted" style={{ fontSize: 'var(--portal-text-xs)' }}>
                  {member.last_login_at
                    ? new Date(member.last_login_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <p style={{ marginTop: 'var(--portal-space-md)', fontSize: 'var(--portal-text-xs)', color: 'var(--portal-text-muted)' }}>
          Only account admins can invite new team members.
        </p>
      )}
    </div>
  )
}
