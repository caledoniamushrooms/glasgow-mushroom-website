import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAdminCustomers, type CustomerWithDetails } from '../../hooks/useAdminCustomers'
import { useViewAs } from '../../components/ViewAsProvider'
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from '../../lib/modules'
import { supabase } from '../../lib/supabase'

type FilterTab = 'all' | 'enabled' | 'not_enabled'

export function Customers() {
  const { customers, loading, error, togglePortalAccess, toggleModule, updateModuleConfig, inviteUser } = useAdminCustomers()

  // Fetch product types (grades) for pricing config
  const gradesQuery = useQuery({
    queryKey: ['product-types-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_types').select('id, name').order('name')
      if (error) throw error
      return data || []
    },
  })
  const allGrades = gradesQuery.data || []
  const { startViewAs } = useViewAs()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState<{ customerId: string; role: 'admin' | 'member' } | null>(null)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const filtered = customers.filter(c => {
    if (filter === 'enabled' && !c.portal_enabled) return false
    if (filter === 'not_enabled' && c.portal_enabled) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false
    }
    return true
  })

  const enabledCount = (c: CustomerWithDetails) =>
    MODULE_KEYS.filter(k => c.modules[k]?.enabled).length

  const portalEnabledCount = customers.filter(c => c.portal_enabled).length

  const handleTogglePortal = async (customerId: string, current: boolean) => {
    await togglePortalAccess.mutateAsync({ customerId, enabled: !current })
  }

  const handleToggleModule = async (customerId: string, moduleKey: ModuleKey, current: boolean) => {
    await toggleModule.mutateAsync({ customerId, moduleKey, enabled: !current })
  }

  const handleViewAs = (c: CustomerWithDetails) => {
    startViewAs(c.id, c.name)
    navigate('/portal/home')
  }

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteForm) return
    setInviteError(null)
    try {
      await inviteUser.mutateAsync({
        customerId: inviteForm.customerId,
        email: inviteEmail,
        displayName: inviteName,
        role: inviteForm.role,
      })
      setInviteForm(null)
      setInviteName('')
      setInviteEmail('')
    } catch (err) {
      setInviteError((err as Error).message || 'Failed to send invitation')
    }
  }

  const closeInviteForm = () => {
    setInviteForm(null)
    setInviteName('')
    setInviteEmail('')
    setInviteError(null)
  }

  if (loading) return <div className="odin-loading">Loading customers...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load customers</div>

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {customers.length} total · {portalEnabledCount} portal enabled
        </p>
      </header>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 max-w-[320px] px-3 py-2 border border-input rounded-md text-sm bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
        />
        <div className="flex gap-1">
          {([
            ['all', 'All'],
            ['enabled', 'Portal Enabled'],
            ['not_enabled', 'Not Enabled'],
          ] as [FilterTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div className="odin-empty">
          <p>{search ? 'No customers match your search.' : 'No customers found.'}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(c => {
            const isExpanded = expandedId === c.id
            return (
              <div key={c.id} className="odin-card overflow-hidden">
                {/* Summary row */}
                <button
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-transparent border-none cursor-pointer text-left hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{c.customer_type_name || ''}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{c.tier_name || ''}</span>
                    <span className={`badge shrink-0 ${c.portal_enabled ? 'badge-paid' : 'badge-draft'}`}>
                      {c.portal_enabled ? 'Enabled' : 'Not enabled'}
                    </span>
                    {c.portal_enabled && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {c.team.length} user{c.team.length !== 1 ? 's' : ''} · {enabledCount(c)} module{enabledCount(c) !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-muted-foreground shrink-0 ml-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Portal access */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-border">
                      <div>
                        <h4 className="text-sm font-medium text-foreground">Portal Access</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.portal_enabled ? 'This customer can access the trade portal' : 'Portal access is disabled for this customer'}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={c.portal_enabled}
                          onChange={() => handleTogglePortal(c.id, c.portal_enabled)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                        <span className="text-sm font-medium">{c.portal_enabled ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    </div>

                    {c.portal_enabled && (
                      <>
                        {/* Team */}
                        <div className="px-5 py-4 border-b border-border">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team</h4>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { closeInviteForm(); setInviteForm({ customerId: c.id, role: 'admin' }) }}
                                className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-90"
                              >
                                Invite Admin
                              </button>
                              <button
                                onClick={() => { closeInviteForm(); setInviteForm({ customerId: c.id, role: 'member' }) }}
                                className="bg-transparent border border-border px-3 py-1 rounded text-xs font-medium cursor-pointer text-muted-foreground hover:bg-accent"
                              >
                                Invite Team
                              </button>
                            </div>
                          </div>

                          {/* Invite form */}
                          {inviteForm?.customerId === c.id && (
                            <form onSubmit={handleInvite} className="bg-muted/30 rounded-md p-3 mb-3">
                              <p className="text-xs font-medium text-foreground mb-2">
                                Invite {inviteForm.role === 'admin' ? 'an admin' : 'a team member'}
                              </p>
                              {inviteError && (
                                <div className="px-2.5 py-1.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs mb-2">{inviteError}</div>
                              )}
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <input
                                  value={inviteName}
                                  onChange={e => setInviteName(e.target.value)}
                                  placeholder="Name"
                                  required
                                  className="px-2.5 py-1.5 border border-input rounded text-sm bg-white odin-focus"
                                />
                                <input
                                  type="email"
                                  value={inviteEmail}
                                  onChange={e => setInviteEmail(e.target.value)}
                                  placeholder="Email"
                                  required
                                  className="px-2.5 py-1.5 border border-input rounded text-sm bg-white odin-focus"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={inviteUser.isPending}
                                  className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-50"
                                >
                                  {inviteUser.isPending ? 'Sending...' : 'Send Invite'}
                                </button>
                                <button
                                  type="button"
                                  onClick={closeInviteForm}
                                  className="bg-transparent border border-border px-3 py-1.5 rounded text-xs cursor-pointer text-muted-foreground hover:bg-accent"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Team list */}
                          {c.team.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No portal users yet. Invite an admin to get started.</p>
                          ) : (
                            <div className="grid gap-1">
                              {c.team.map(u => (
                                <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded text-sm">
                                  <div>
                                    <span className="font-medium text-foreground">{u.display_name}</span>
                                    <span className="text-muted-foreground text-xs ml-2">{u.email}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`badge ${u.role === 'admin' || u.role === 'system_admin' ? 'badge-modified' : 'badge-draft'}`}>
                                      {u.role}
                                    </span>
                                    <span className={`badge ${u.status === 'active' ? 'badge-paid' : 'badge-pending'}`}>
                                      {u.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Modules */}
                        <div className="px-5 py-4 border-b border-border">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Modules</h4>
                          <div className="grid gap-1">
                            {MODULE_KEYS.map(key => {
                              const mod = c.modules[key]
                              const isEnabled = mod?.enabled
                              const visibleGrades = mod?.config?.visible_grades || []

                              const handleGradeToggle = (gradeId: string) => {
                                const current = new Set(visibleGrades)
                                if (current.has(gradeId)) current.delete(gradeId)
                                else current.add(gradeId)
                                updateModuleConfig.mutate({
                                  customerId: c.id,
                                  moduleKey: key,
                                  config: { ...mod?.config, visible_grades: Array.from(current) },
                                })
                              }

                              const handleSelectAllGrades = () => {
                                updateModuleConfig.mutate({
                                  customerId: c.id,
                                  moduleKey: key,
                                  config: { ...mod?.config, visible_grades: allGrades.map(g => g.id) },
                                })
                              }

                              const handleClearGrades = () => {
                                updateModuleConfig.mutate({
                                  customerId: c.id,
                                  moduleKey: key,
                                  config: { ...mod?.config, visible_grades: [] },
                                })
                              }

                              return (
                                <div key={key}>
                                  <label className="flex items-center gap-2 py-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => handleToggleModule(c.id, key, isEnabled)}
                                      className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                                    />
                                    <span className={`text-sm ${isEnabled ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                      {MODULE_LABELS[key]}
                                    </span>
                                  </label>

                                  {isEnabled && key === 'pricing' && allGrades.length > 0 && (
                                    <div className="ml-6 mt-1 mb-2 p-3 bg-muted/30 rounded-md">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visible Grades</span>
                                        <div className="flex gap-2">
                                          <button onClick={handleSelectAllGrades} className="text-xs text-primary bg-transparent border-none cursor-pointer hover:underline p-0">All</button>
                                          <button onClick={handleClearGrades} className="text-xs text-muted-foreground bg-transparent border-none cursor-pointer hover:underline p-0">None</button>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {allGrades.map(g => (
                                          <label key={g.id} className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={visibleGrades.includes(g.id)}
                                              onChange={() => handleGradeToggle(g.id)}
                                              className="w-3.5 h-3.5 accent-primary cursor-pointer"
                                            />
                                            <span className="text-xs text-foreground">{g.name}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 px-5 py-3 bg-muted/20">
                      {c.portal_enabled && (
                        <button
                          onClick={() => handleViewAs(c)}
                          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          View As
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
