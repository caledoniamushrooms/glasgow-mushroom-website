import { useState, useRef, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import type { PartnerLogo, Customer } from '../lib/types'

export function PartnerLogos() {
  const { isSystemAdmin } = useAuthContext()
  const queryClient = useQueryClient()

  const [showUpload, setShowUpload] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const logosQuery = useQuery({
    queryKey: ['partner-logos'],
    queryFn: async (): Promise<PartnerLogo[]> => {
      const { data, error } = await supabase
        .from('partner_logos')
        .select('*, customers(name, website_url)')
        .order('sort_order')
        .order('created_at')

      if (error) throw error
      return data || []
    },
  })

  const customersQuery = useQuery({
    queryKey: ['customers-list'],
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, website_url')
        .eq('active', true)
        .order('name')

      if (error) throw error
      return data || []
    },
    enabled: showUpload,
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('partner_logos')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner-logos'] }),
  })

  const deleteLogo = useMutation({
    mutationFn: async (logo: PartnerLogo) => {
      const url = new URL(logo.logo_url)
      const filename = url.pathname.split('/').pop()
      if (filename) {
        await supabase.storage.from('partner-logos').remove([filename])
      }
      const { error } = await supabase
        .from('partner_logos')
        .delete()
        .eq('id', logo.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner-logos'] }),
  })

  const moveLogo = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const logos = logosQuery.data || []
      const idx = logos.findIndex(l => l.id === id)
      if (idx < 0) return

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= logos.length) return

      const current = logos[idx]
      const swap = logos[swapIdx]

      await Promise.all([
        supabase.from('partner_logos').update({ sort_order: swap.sort_order, updated_at: new Date().toISOString() }).eq('id', current.id),
        supabase.from('partner_logos').update({ sort_order: current.sort_order, updated_at: new Date().toISOString() }).eq('id', swap.id),
      ])
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner-logos'] }),
  })

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const file = fileRef.current?.files?.[0]
    if (!file || !selectedCustomerId) {
      setError('Customer and file are required.')
      return
    }

    setUploading(true)
    try {
      setUploadStep('Authenticating…')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated.')
        return
      }

      setUploadStep('Preparing image…')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customer_id', selectedCustomerId)

      setUploadStep('Processing and uploading…')
      const res = await fetch('/api/partner-logos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      setUploadStep('Saving…')
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Upload failed.')
        return
      }

      queryClient.invalidateQueries({ queryKey: ['partner-logos'] })
      setShowUpload(false)
      setSelectedCustomerId('')
      setCustomerSearch('')
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setError('Upload failed.')
    } finally {
      setUploading(false)
      setUploadStep('')
    }
  }

  const logos = logosQuery.data || []
  const customers = customersQuery.data || []

  // Filter customers already linked to a logo
  const usedCustomerIds = new Set(logos.map(l => l.customer_id))
  const availableCustomers = customers.filter(c => !usedCustomerIds.has(c.id))
  const filteredCustomers = customerSearch
    ? availableCustomers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    : availableCustomers

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  if (!isSystemAdmin) {
    return <p className="text-muted-foreground">You do not have access to this page.</p>
  }

  if (logosQuery.isLoading) return <div className="text-muted-foreground">Loading logos...</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Partner Logos</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage logos shown on the homepage business showcase</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          Upload Logo
        </button>
      </header>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-4">{error}</div>
      )}

      {showUpload && (
        <form onSubmit={handleUpload} className="odin-card p-4 mb-6 grid gap-3 max-w-[400px]">
          <div>
            <label className="block text-sm font-medium mb-1">Customer</label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 px-2.5 py-2 border border-input rounded-md bg-white">
                <span className="text-sm font-medium flex-1">{selectedCustomer.name}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedCustomerId(''); setCustomerSearch('') }}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Search customers…"
                  className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
                  autoFocus
                />
                {customerSearch && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {customerSearch && filteredCustomers.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
                    No matching customers
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Logo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              required
              className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-white file:text-foreground file:cursor-pointer hover:file:bg-accent"
            />
            <p className="text-xs text-muted-foreground mt-1">PNG, JPEG, WebP, or AVIF. Will be converted to white on transparent.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading || !selectedCustomerId}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm cursor-pointer font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {uploading ? uploadStep : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => { setShowUpload(false); setError(null); setSelectedCustomerId(''); setCustomerSearch('') }}
              className="bg-transparent border border-border px-4 py-2 rounded-md text-sm cursor-pointer text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {logos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No logos uploaded yet.</p>
      ) : (
        <div className="odin-table-container overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="odin-table-header">
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide w-40">Preview</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Customer</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide w-24">Status</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide w-24">Order</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logos.map((logo, idx) => (
                <tr key={logo.id} className="odin-table-row">
                  <td className="odin-table-cell">
                    <div className="flex gap-2">
                      <div className="w-16 h-12 bg-zinc-900 rounded flex items-center justify-center p-1" title="Light (website)">
                        <img
                          src={logo.logo_url}
                          alt={logo.customers?.name || ''}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      {logo.logo_url_dark && (
                        <div className="w-16 h-12 bg-zinc-100 rounded flex items-center justify-center p-1" title="Dark (Odin)">
                          <img
                            src={logo.logo_url_dark}
                            alt={logo.customers?.name || ''}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="odin-table-cell">
                    <div className="font-semibold">{logo.customers?.name || 'Unknown'}</div>
                    {logo.customers?.website_url && (
                      <a href={logo.customers.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
                        {logo.customers.website_url}
                      </a>
                    )}
                  </td>
                  <td className="odin-table-cell">
                    <button
                      onClick={() => toggleActive.mutate({ id: logo.id, active: !logo.active })}
                      className={`badge cursor-pointer ${logo.active ? 'badge-paid' : 'badge-draft'}`}
                    >
                      {logo.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="odin-table-cell">
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveLogo.mutate({ id: logo.id, direction: 'up' })}
                        disabled={idx === 0}
                        className="px-1.5 py-0.5 text-xs border border-border rounded hover:bg-accent disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                        title="Move up"
                      >
                        &uarr;
                      </button>
                      <button
                        onClick={() => moveLogo.mutate({ id: logo.id, direction: 'down' })}
                        disabled={idx === logos.length - 1}
                        className="px-1.5 py-0.5 text-xs border border-border rounded hover:bg-accent disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                        title="Move down"
                      >
                        &darr;
                      </button>
                    </div>
                  </td>
                  <td className="odin-table-cell">
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${logo.customers?.name}" logo?`)) {
                          deleteLogo.mutate(logo)
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-xs font-medium cursor-pointer transition-colors"
                    >
                      Delete
                    </button>
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
