import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { useViewAs } from '../components/ViewAsProvider'
import type { PortalUser } from '../lib/types'

export function Team() {
  const { portalUser, isAdmin } = useAuthContext()
  const { viewAsCustomerId } = useViewAs()
  const customerId = viewAsCustomerId || portalUser?.customer_id
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

  if (teamQuery.isLoading) return <div className="odin-loading">Loading team...</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage who can access your portal account</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity"
          >
            Invite Member
          </button>
        )}
      </header>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-4">{error}</div>
      )}

      {/* Invite form */}
      {showInvite && isAdmin && (
        <form onSubmit={handleInvite} className="odin-card p-4 mb-6 grid gap-3 max-w-[400px]">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Colleague's name"
              required
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@business.com"
              required
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={inviteMember.isPending} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm cursor-pointer font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {inviteMember.isPending ? 'Sending...' : 'Send Invite'}
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="bg-transparent border border-border px-4 py-2 rounded-md text-sm cursor-pointer text-muted-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Team list */}
      <div className="odin-table-container overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="odin-table-header">
              <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Name</th>
              <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Email</th>
              <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Role</th>
              <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Status</th>
              <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {team.map(member => (
              <tr key={member.id} className="odin-table-row">
                <td className="odin-table-cell font-semibold">
                  {member.display_name}
                  {member.id === portalUser?.id && (
                    <span className="text-xs text-muted-foreground ml-1">(you)</span>
                  )}
                </td>
                <td className="odin-table-cell text-muted-foreground">{member.email}</td>
                <td className="odin-table-cell">
                  <span className={`badge ${member.role === 'admin' ? 'badge-modified' : 'badge-draft'}`}>
                    {member.role}
                  </span>
                </td>
                <td className="odin-table-cell">
                  <span className={`badge ${member.status === 'active' ? 'badge-paid' : 'badge-pending'}`}>
                    {member.status}
                  </span>
                </td>
                <td className="odin-table-cell text-muted-foreground text-xs">
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
        <p className="mt-4 text-xs text-muted-foreground">
          Only account admins can invite new team members.
        </p>
      )}
    </div>
  )
}
