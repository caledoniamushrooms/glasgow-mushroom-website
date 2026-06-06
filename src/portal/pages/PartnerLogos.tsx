import { useState, useRef, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, Upload, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import type { PartnerLogo, Customer } from '../lib/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export function PartnerLogos() {
  const { isSystemAdmin } = useAuthContext()
  const queryClient = useQueryClient()

  const [uploadOpen, setUploadOpen] = useState(false)
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
    enabled: uploadOpen,
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
      const { error } = await supabase.from('partner_logos').delete().eq('id', logo.id)
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

  const resetUpload = () => {
    setSelectedCustomerId('')
    setCustomerSearch('')
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

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

      setUploadStep('Processing and uploading…')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customer_id', selectedCustomerId)

      const res = await fetch('/api/partner-logos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Upload failed.')
        return
      }

      queryClient.invalidateQueries({ queryKey: ['partner-logos'] })
      setUploadOpen(false)
      resetUpload()
    } catch {
      setError('Upload failed.')
    } finally {
      setUploading(false)
      setUploadStep('')
    }
  }

  const logos = logosQuery.data || []
  const customers = customersQuery.data || []

  const usedCustomerIds = new Set(logos.map(l => l.customer_id))
  const availableCustomers = customers.filter(c => !usedCustomerIds.has(c.id))
  const filteredCustomers = customerSearch
    ? availableCustomers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    : availableCustomers

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  if (!isSystemAdmin) {
    return <p className="text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-[#009689]" />
            Partner Logos
          </CardTitle>
          <CardDescription>
            Manage logos shown on the homepage business showcase
          </CardDescription>
          <CardAction>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload logo
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {logosQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : logos.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No logos uploaded yet
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-left w-24 sm:w-40">Preview</TableHead>
                    <TableHead className="text-left">Customer</TableHead>
                    <TableHead className="text-left hidden sm:table-cell w-24">Status</TableHead>
                    <TableHead className="text-left hidden md:table-cell w-24">Order</TableHead>
                    <TableHead className="text-right w-20 sm:w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logos.map((logo, idx) => (
                    <TableRow key={logo.id} className="hover:bg-gray-50">
                      <TableCell className="p-2 sm:p-4">
                        <div className="flex gap-1.5">
                          <div className="w-10 h-8 sm:w-16 sm:h-12 bg-zinc-900 rounded flex items-center justify-center p-1" title="Light (website)">
                            <img
                              src={logo.logo_url}
                              alt={logo.customers?.name || ''}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          {logo.logo_url_dark && (
                            <div className="w-10 h-8 sm:w-16 sm:h-12 bg-zinc-100 rounded flex items-center justify-center p-1 hidden sm:flex" title="Dark (Odin)">
                              <img
                                src={logo.logo_url_dark}
                                alt={logo.customers?.name || ''}
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-2 sm:p-4">
                        <div className="font-medium">{logo.customers?.name || 'Unknown'}</div>
                        {logo.customers?.website_url && (
                          <a
                            href={logo.customers.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground hidden sm:inline"
                          >
                            {logo.customers.website_url}
                          </a>
                        )}
                        {/* Mobile-only inline status */}
                        <div className="mt-1 sm:hidden">
                          <button
                            type="button"
                            onClick={() => toggleActive.mutate({ id: logo.id, active: !logo.active })}
                          >
                            <Badge
                              variant="outline"
                              className={
                                logo.active
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-transparent'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-200 border-transparent'
                              }
                            >
                              {logo.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <button
                          type="button"
                          onClick={() => toggleActive.mutate({ id: logo.id, active: !logo.active })}
                          className="cursor-pointer"
                        >
                          <Badge
                            variant="outline"
                            className={
                              logo.active
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-transparent'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-200 border-transparent'
                            }
                          >
                            {logo.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveLogo.mutate({ id: logo.id, direction: 'up' })}
                            disabled={idx === 0}
                            className="h-7 w-7"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveLogo.mutate({ id: logo.id, direction: 'down' })}
                            disabled={idx === logos.length - 1}
                            className="h-7 w-7"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right p-2 sm:p-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Delete "${logo.customers?.name}" logo?`)) {
                              deleteLogo.mutate(logo)
                            }
                          }}
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={uploadOpen}
        onOpenChange={(o) => {
          setUploadOpen(o)
          if (!o) resetUpload()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload logo</DialogTitle>
            <DialogDescription>
              Pick a customer and an image. We'll convert it to white-on-transparent for the homepage showcase.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpload} className="space-y-4">
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Customer</Label>
              {selectedCustomer ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-white">
                  <span className="text-sm font-medium flex-1">{selectedCustomer.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedCustomerId(''); setCustomerSearch('') }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customers…"
                    autoFocus
                  />
                  {customerSearch && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map((c) => (
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
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
                      No matching customers
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo-file">Logo</Label>
              <Input
                ref={fileRef}
                id="logo-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                required
              />
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP, or AVIF. Will be converted to white on transparent.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setUploadOpen(false); resetUpload() }}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || !selectedCustomerId}>
                {uploading ? (uploadStep || 'Uploading…') : 'Upload'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
