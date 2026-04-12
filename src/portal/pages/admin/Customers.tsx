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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('admin-selected-customers')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  const filteredDropdown = customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const selectedCustomers = customers.filter(c => selectedIds.has(c.id))

  const toggleCustomer = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('admin-selected-customers', JSON.stringify([...next]))
      return next
    })
  }

  const enabledCount = (c: CustomerWithModules) =>
    MODULE_KEYS.filter(k => c.modules[k]).length

  const handleToggle = async (customerId: string, moduleKey: ModuleKey, currentValue: boolean) => {
    await toggleModule.mutateAsync({ customerId, moduleKey, enabled: !currentValue })
  }

  const handleViewAs = (customer: CustomerWithModules) => {
    startViewAs(customer.id, customer.name)
    navigate('/portal')
  }

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

      {/* Customer selector dropdown */}
      <div ref={dropdownRef} className="relative mb-6 max-w-[400px]">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-white text-foreground odin-focus flex items-center justify-between cursor-pointer"
        >
          <span className={selectedIds.size > 0 ? 'text-foreground' : 'text-muted-foreground/60'}>
            {selectedIds.size > 0 ? `${selectedIds.size} customer${selectedIds.size !== 1 ? 's' : ''} selected` : 'Select customers...'}
          </span>
          <svg className={`w-4 h-4 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg z-20 max-h-[320px] overflow-hidden flex flex-col">
            {/* Search filter */}
            <div className="p-2 border-b border-border">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter..."
                autoFocus
                className="w-full px-2.5 py-1.5 border border-input rounded text-sm bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
              />
            </div>
            {/* Customer list */}
            <div className="overflow-y-auto max-h-[260px]">
              {filteredDropdown.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-muted-foreground">No customers found.</p>
              ) : (
                filteredDropdown.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleCustomer(c.id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors cursor-pointer bg-transparent border-none flex items-center gap-3"
                  >
                    <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${selectedIds.has(c.id) ? 'bg-primary border-primary' : 'border-input'}`}>
                      {selectedIds.has(c.id) && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.customer_type_name && (
                        <span className="text-xs text-muted-foreground ml-2">{c.customer_type_name}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected customers — collapsible rows */}
      {selectedCustomers.length === 0 ? (
        <div className="odin-empty">
          <p>Select customers above to manage their profiles.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {selectedCustomers.map(c => {
            const isExpanded = expandedId === c.id
            return (
              <div key={c.id} className="odin-card overflow-hidden">
                {/* Summary row */}
                <button
                  className="w-full flex items-center justify-between px-5 py-4 bg-transparent border-none cursor-pointer text-left hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.customer_type_name && (
                        <span className="text-xs text-muted-foreground">{c.customer_type_name}</span>
                      )}
                      {c.tier_name && (
                        <span className="text-xs text-muted-foreground">· {c.tier_name}</span>
                      )}
                      <span className="badge badge-paid">{enabledCount(c)} / {MODULE_KEYS.length}</span>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-muted-foreground shrink-0 ml-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Module toggles */}
                    <div className="px-5 py-4">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Modules</h4>
                      <div className="grid gap-1">
                        {MODULE_KEYS.map(key => {
                          const enabled = c.modules[key]
                          return (
                            <label key={key} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => handleToggle(c.id, key, enabled)}
                                className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                              />
                              <span className={`text-sm font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {MODULE_LABELS[key]}
                              </span>
                              {enabled && key === 'pricing' && c.tier_name && (
                                <span className="text-xs text-muted-foreground ml-auto">{c.tier_name}</span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 px-5 py-3 border-t border-border bg-muted/20">
                      <button
                        onClick={() => handleViewAs(c)}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        View As
                      </button>
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
