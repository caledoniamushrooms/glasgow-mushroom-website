import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminCustomers, type CustomerWithModules } from '../../hooks/useAdminCustomers'
import { useViewAs } from '../../components/ViewAsProvider'
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from '../../lib/modules'

export function Customers() {
  const { customers, loading, error, toggleModule } = useAdminCustomers()
  const { startViewAs } = useViewAs()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalCustomer, setModalCustomer] = useState<CustomerWithModules | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredDropdown = search
    ? customers.filter(c =>
        !selectedIds.has(c.id) &&
        (c.name.toLowerCase().includes(search.toLowerCase()) ||
         c.email.toLowerCase().includes(search.toLowerCase()))
      )
    : []

  const selectedCustomers = customers.filter(c => selectedIds.has(c.id))

  const addCustomer = (id: string) => {
    setSelectedIds(prev => new Set(prev).add(id))
    setSearch('')
    setDropdownOpen(false)
  }

  const removeCustomer = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const enabledCount = (c: CustomerWithModules) =>
    MODULE_KEYS.filter(k => c.modules[k]).length

  const handleToggle = async (customerId: string, moduleKey: ModuleKey, currentValue: boolean) => {
    await toggleModule.mutateAsync({ customerId, moduleKey, enabled: !currentValue })
  }

  const handleViewAs = (customer: CustomerWithModules) => {
    setModalCustomer(null)
    startViewAs(customer.id, customer.name)
    navigate('/portal')
  }

  // Keep modal customer in sync with latest data
  const liveModalCustomer = modalCustomer
    ? customers.find(c => c.id === modalCustomer.id) || modalCustomer
    : null

  if (loading) return <div className="odin-loading">Loading customers...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load customers</div>

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search and manage customer accounts ({customers.length} total)
        </p>
      </header>

      {/* Searchable dropdown */}
      <div ref={dropdownRef} className="relative mb-6 max-w-[400px]">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
          onFocus={() => { if (search) setDropdownOpen(true) }}
          placeholder="Search customers by name or email..."
          className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
        />
        {dropdownOpen && filteredDropdown.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg z-20 max-h-[240px] overflow-y-auto">
            {filteredDropdown.slice(0, 20).map(c => (
              <button
                key={c.id}
                onClick={() => addCustomer(c.id)}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors cursor-pointer bg-transparent border-none flex justify-between items-center"
              >
                <div>
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-muted-foreground ml-2">{c.email}</span>
                </div>
                {c.customer_type_name && (
                  <span className="text-xs text-muted-foreground">{c.customer_type_name}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected customers table */}
      {selectedCustomers.length === 0 ? (
        <div className="odin-empty">
          <p>Search and select a customer above to manage their profile.</p>
        </div>
      ) : (
        <div className="odin-table-container overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="odin-table-header">
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Customer</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Type</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Tier</th>
                <th className="odin-table-cell text-center text-xs uppercase tracking-wide">Modules</th>
                <th className="odin-table-cell text-center text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedCustomers.map(c => (
                <tr
                  key={c.id}
                  className="odin-table-row cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setModalCustomer(c)}
                >
                  <td className="odin-table-cell">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="odin-table-cell text-muted-foreground">{c.customer_type_name || '—'}</td>
                  <td className="odin-table-cell text-muted-foreground">{c.tier_name || '—'}</td>
                  <td className="odin-table-cell text-center">
                    <span className="badge badge-paid">{enabledCount(c)} / {MODULE_KEYS.length}</span>
                  </td>
                  <td className="odin-table-cell text-center" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => removeCustomer(c.id)}
                      className="text-muted-foreground text-xs hover:text-red-600 bg-transparent border-none cursor-pointer p-0"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Profile Modal */}
      {liveModalCustomer && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={() => setModalCustomer(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-[560px] max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Customer Profile</h2>
              </div>
              <button
                onClick={() => setModalCustomer(null)}
                className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Customer info */}
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-xl font-semibold text-foreground">{liveModalCustomer.name}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{liveModalCustomer.email}</p>
              <div className="flex gap-2 mt-2">
                {liveModalCustomer.customer_type_name && (
                  <span className="badge badge-modified">{liveModalCustomer.customer_type_name}</span>
                )}
                {liveModalCustomer.tier_name && (
                  <span className="badge badge-draft">{liveModalCustomer.tier_name}</span>
                )}
              </div>
            </div>

            {/* Module sections */}
            <div className="px-6 py-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Modules</h4>
              <div className="grid gap-1">
                {MODULE_KEYS.map(key => {
                  const enabled = liveModalCustomer.modules[key]
                  return (
                    <div key={key} className={`rounded-md border transition-colors ${enabled ? 'border-border bg-white' : 'border-transparent bg-muted/30'}`}>
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-transparent border-none cursor-pointer text-left"
                        onClick={() => handleToggle(liveModalCustomer.id, key, enabled)}
                      >
                        <span className={`text-sm font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {MODULE_LABELS[key]}
                        </span>
                        <div className={`w-9 h-5 rounded-full relative transition-colors ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </button>
                      {enabled && (
                        <div className="px-4 pb-3 text-xs text-muted-foreground">
                          {key === 'pricing' && liveModalCustomer.tier_name
                            ? `Tier: ${liveModalCustomer.tier_name}`
                            : 'Enabled'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => handleViewAs(liveModalCustomer)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
              >
                View As
              </button>
              <button
                onClick={() => setModalCustomer(null)}
                className="bg-transparent border border-border px-4 py-2 rounded-md text-sm cursor-pointer text-muted-foreground hover:bg-accent transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
