import { Fragment, useMemo, useState, useRef, useEffect, type FormEvent, type DragEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronsUpDown, Package, Plus, Trash2, Pencil, ArrowUp, ArrowDown, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { assetImageUrl } from '../lib/assetImage'
import { resizeImage } from '../lib/resizeImage'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { priceIncVat } from '@/lib/vat'

type Status = 'available' | 'under_offer' | 'sold'

const STATUS_LABEL: Record<Status, string> = {
  available: 'Available',
  under_offer: 'Under Offer',
  sold: 'Sold',
}

interface AssetImage {
  id: string
  listing_id: string
  storage_path: string
  position: number
}

interface AssetListing {
  id: string
  name: string
  description: string | null
  asking_price: number
  original_cost: number | null
  category: string | null
  status: Status
  allow_offers: boolean
  is_poa: boolean
  is_zero_rated: boolean
  sort_order: number
  created_at: string
  updated_at: string
  asset_listing_images: AssetImage[]
}

function parseNum(v: string): number | null {
  if (v === '' || v === '-' || v === '.') return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2)
}

function calcDiscountPercent(cost: number | null, asking: number | null): string {
  if (cost == null || cost <= 0 || asking == null) return ''
  return fmtNum(((cost - asking) / cost) * 100)
}

function calcDiscountAmount(cost: number | null, asking: number | null): string {
  if (cost == null || asking == null) return ''
  return fmtNum(cost - asking)
}

const STATUS_BADGE_CLASS: Record<Status, string> = {
  available: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-transparent',
  under_offer: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-transparent',
  sold: 'bg-gray-200 text-gray-600 hover:bg-gray-200 border-transparent',
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}

function formatPrice(exVat: number, isZeroRated: boolean): string {
  const inc = priceIncVat(Number(exVat), isZeroRated)
  return `£${inc.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
}

export function AssetRegister() {
  const { isSystemAdmin } = useAuthContext()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<AssetListing | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | Status>('all')

  const listingsQuery = useQuery({
    queryKey: ['admin-asset-listings'],
    queryFn: async (): Promise<AssetListing[]> => {
      const { data, error } = await supabase
        .from('asset_listings')
        .select('*, asset_listing_images(*)')
        .order('sort_order')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((l) => ({
        ...l,
        asset_listing_images: (l.asset_listing_images ?? []).sort(
          (a: AssetImage, b: AssetImage) => a.position - b.position,
        ),
      }))
    },
  })

  const deleteListing = useMutation({
    mutationFn: async (id: string) => {
      const res = await authedFetch(`/api/asset-listings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-asset-listings'] }),
  })

  if (!isSystemAdmin) {
    return <p className="text-muted-foreground">You do not have access to this page.</p>
  }

  const listings = listingsQuery.data ?? []
  const filtered = filter === 'all' ? listings : listings.filter((l) => l.status === filter)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggleCategory = (cat: string) =>
    setCollapsed((s) => ({ ...s, [cat]: !s[cat] }))

  // Group filtered by category, preserving each row's sort_order within the
  // group. Categories themselves are sorted alphabetically (Uncategorised last).
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const l of filtered) {
      const key = l.category ?? 'Uncategorised'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Uncategorised') return 1
      if (b === 'Uncategorised') return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  const allExpanded = grouped.length > 0 && grouped.every(([cat]) => !collapsed[cat])
  const toggleAll = () => {
    if (allExpanded) {
      const next: Record<string, boolean> = {}
      grouped.forEach(([cat]) => { next[cat] = true })
      setCollapsed(next)
    } else {
      setCollapsed({})
    }
  }

  const openNew = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (l: AssetListing) => { setEditing(l); setDialogOpen(true) }

  // Categories already used across all listings — feeds the dropdown for fast
  // reuse and consistency.
  const existingCategories = Array.from(
    new Set(listings.map((l) => l.category).filter((c): c is string => !!c)),
  ).sort()

  return (
    <>
      <Card className="border-0 rounded-none shadow-none -mx-4 sm:mx-0 sm:border sm:rounded-xl sm:shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#009689]" />
            Asset Register
          </CardTitle>
          <CardDescription>
            Manage equipment listings for the public for-sale page
          </CardDescription>
          <CardAction>
            <Button onClick={openNew} aria-label="New listing">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New listing</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              {(['all', 'available', 'under_offer', 'sold'] as const).map((f) => {
                const count = f === 'all' ? listings.length : listings.filter((l) => l.status === f).length
                const label = f === 'all' ? 'All' : STATUS_LABEL[f]
                return (
                  <TabsTrigger key={f} value={f}>
                    {label}
                    <span className="ml-1 text-xs opacity-60">{count}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>

          {listingsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No listings yet
            </div>
          ) : (
            <div className="sm:border sm:rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-20 sm:w-24 pl-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleAll}
                        className="h-7 w-7"
                        aria-label={allExpanded ? 'Collapse all categories' : 'Expand all categories'}
                      >
                        <ChevronsUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-left">Item</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Price</TableHead>
                    <TableHead className="text-left hidden sm:table-cell w-28">Status</TableHead>
                    <TableHead className="text-right hidden md:table-cell w-20">Photos</TableHead>
                    <TableHead className="text-right w-20 sm:w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.map(([category, items]) => {
                    const isCollapsed = !!collapsed[category]
                    return (
                      <Fragment key={category}>
                        <TableRow
                          className="bg-gray-100 hover:bg-gray-200 cursor-pointer"
                          onClick={() => toggleCategory(category)}
                        >
                          <TableCell colSpan={99} className="py-2 px-3 sm:px-4">
                            <div className="flex items-center gap-2 font-medium text-sm">
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 transition-transform',
                                  isCollapsed && '-rotate-90',
                                )}
                              />
                              <span>{category}</span>
                              <span className="text-xs text-gray-500 font-normal">
                                {items.length}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && items.map((l) => {
                          const cover = l.asset_listing_images[0]
                          return (
                            <TableRow key={l.id} className="hover:bg-gray-50">
                              <TableCell className="p-2 sm:p-4">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                                  {cover ? (
                                    <img
                                      src={assetImageUrl(cover.storage_path)}
                                      alt={l.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[9px] text-gray-400">No photo</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="p-2 sm:p-4 whitespace-normal break-words">
                                <div className="font-medium">{l.name}</div>
                                {/* Mobile-only: stack price + status + photos below name */}
                                <div className="flex items-center gap-2 mt-1 sm:hidden text-xs">
                                  <span className="font-semibold">{formatPrice(l.asking_price, l.is_zero_rated)}</span>
                                  <Badge variant="outline" className={STATUS_BADGE_CLASS[l.status]}>
                                    {STATUS_LABEL[l.status]}
                                  </Badge>
                                  <span className="text-gray-500">{l.asset_listing_images.length} photo{l.asset_listing_images.length === 1 ? '' : 's'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap hidden sm:table-cell">
                                {formatPrice(l.asking_price, l.is_zero_rated)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className={STATUS_BADGE_CLASS[l.status]}>
                                  {STATUS_LABEL[l.status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm text-gray-500 hidden md:table-cell">
                                {l.asset_listing_images.length}
                              </TableCell>
                              <TableCell className="text-right p-2 sm:p-4">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEdit(l)}
                                    className="h-8 w-8 sm:hidden"
                                    aria-label="Edit"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEdit(l)}
                                    className="hidden sm:inline-flex"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      if (confirm(`Delete "${l.name}" and its photos?`)) deleteListing.mutate(l.id)
                                    }}
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ListingDialog
        open={dialogOpen}
        initial={editing}
        existingCategories={existingCategories}
        onOpenChange={setDialogOpen}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-asset-listings'] })}
      />
    </>
  )
}

// ---------------------------------------------------------------
// Form Dialog
// ---------------------------------------------------------------
function ListingDialog({
  open,
  initial,
  existingCategories,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  initial: AssetListing | null
  existingCategories: string[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  // Reset state whenever the dialog is opened with a new (or null) initial
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [originalCost, setOriginalCost] = useState(initial?.original_cost?.toString() ?? '')
  const [askingPrice, setAskingPrice] = useState(initial?.asking_price?.toString() ?? '')
  const [discountPercent, setDiscountPercent] = useState(
    calcDiscountPercent(initial?.original_cost ?? null, initial?.asking_price ?? null),
  )
  const [discountAmount, setDiscountAmount] = useState(
    calcDiscountAmount(initial?.original_cost ?? null, initial?.asking_price ?? null),
  )
  const [category, setCategory] = useState(initial?.category ?? '')
  const [status, setStatus] = useState<Status>(initial?.status ?? 'available')
  const [allowOffers, setAllowOffers] = useState(initial?.allow_offers ?? false)
  const [isPoa, setIsPoa] = useState(initial?.is_poa ?? false)
  const [isZeroRated, setIsZeroRated] = useState(initial?.is_zero_rated ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listingId, setListingId] = useState<string | null>(initial?.id ?? null)
  const [images, setImages] = useState<AssetImage[]>(initial?.asset_listing_images ?? [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Sync form when initial prop changes
  const initialId = initial?.id ?? null
  const [lastInitialId, setLastInitialId] = useState<string | null | undefined>(undefined)
  if (lastInitialId !== initialId) {
    setLastInitialId(initialId)
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setOriginalCost(initial?.original_cost?.toString() ?? '')
    setAskingPrice(initial?.asking_price?.toString() ?? '')
    setDiscountPercent(calcDiscountPercent(initial?.original_cost ?? null, initial?.asking_price ?? null))
    setDiscountAmount(calcDiscountAmount(initial?.original_cost ?? null, initial?.asking_price ?? null))
    setCategory(initial?.category ?? '')
    setStatus(initial?.status ?? 'available')
    setAllowOffers(initial?.allow_offers ?? false)
    setIsPoa(initial?.is_poa ?? false)
    setIsZeroRated(initial?.is_zero_rated ?? false)
    setListingId(initialId)
    setImages(initial?.asset_listing_images ?? [])
    setError(null)
    pendingPreviews.forEach((url) => URL.revokeObjectURL(url))
    setPendingFiles([])
    setPendingPreviews([])
  }

  const refreshImages = async (id: string) => {
    const { data } = await supabase
      .from('asset_listing_images')
      .select('*')
      .eq('listing_id', id)
      .order('position')
    setImages((data as AssetImage[]) ?? [])
  }

  const uploadFilesTo = async (id: string, files: File[]): Promise<boolean> => {
    if (files.length === 0) return true
    // Resize client-side so we stay well under Vercel's 4.5 MB serverless
    // body limit and the upload itself is faster on mobile data.
    const resized = await Promise.all(files.map((f) => resizeImage(f)))
    const formData = new FormData()
    resized.forEach((f) => formData.append('files', f))
    const res = await authedFetch(`/api/asset-listings/${id}/images`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const r = await res.json().catch(() => ({}))
      setError(r.error || 'Upload failed.')
      return false
    }
    return true
  }

  // Linked price field handlers: editing any of cost / % / £ discount / asking
  // recalculates the others so the four fields stay coherent.
  const handleCostChange = (val: string) => {
    setOriginalCost(val)
    const cost = parseNum(val)
    const asking = parseNum(askingPrice)
    if (cost == null || cost <= 0) {
      setDiscountPercent('')
      setDiscountAmount('')
      return
    }
    if (asking == null) return
    setDiscountPercent(fmtNum(((cost - asking) / cost) * 100))
    setDiscountAmount(fmtNum(cost - asking))
  }

  const handlePercentChange = (val: string) => {
    setDiscountPercent(val)
    const pct = parseNum(val)
    const cost = parseNum(originalCost)
    if (pct == null || cost == null || cost <= 0) return
    const newAsking = cost * (1 - pct / 100)
    setAskingPrice(fmtNum(newAsking))
    setDiscountAmount(fmtNum(cost - newAsking))
  }

  const handleAmountChange = (val: string) => {
    setDiscountAmount(val)
    const amount = parseNum(val)
    const cost = parseNum(originalCost)
    if (amount == null || cost == null || cost <= 0) return
    const newAsking = cost - amount
    setAskingPrice(fmtNum(newAsking))
    setDiscountPercent(fmtNum((amount / cost) * 100))
  }

  const handleAskingChange = (val: string) => {
    setAskingPrice(val)
    const asking = parseNum(val)
    const cost = parseNum(originalCost)
    if (asking == null || cost == null || cost <= 0) return
    setDiscountAmount(fmtNum(cost - asking))
    setDiscountPercent(fmtNum(((cost - asking) / cost) * 100))
  }

  const costNum = parseNum(originalCost)
  const askingNum = parseNum(askingPrice)
  const hasCost = costNum != null && costNum > 0
  const isMarkup = hasCost && askingNum != null && askingNum > costNum

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        asking_price: Number(askingPrice),
        original_cost: originalCost.trim() === '' ? null : Number(originalCost),
        category,
        status,
        allow_offers: allowOffers,
        is_poa: isPoa,
        is_zero_rated: isZeroRated,
      }
      const url = listingId ? `/api/asset-listings/${listingId}` : '/api/asset-listings'
      const method = listingId ? 'PATCH' : 'POST'
      const res = await authedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Save failed.')
        return
      }
      const id = listingId ?? result.id
      if (!listingId) setListingId(id)

      if (pendingFiles.length > 0) {
        setUploading(true)
        const ok = await uploadFilesTo(id, pendingFiles)
        setUploading(false)
        if (ok) {
          pendingPreviews.forEach((url) => URL.revokeObjectURL(url))
          setPendingFiles([])
          setPendingPreviews([])
        } else {
          onSaved()
          return
        }
      }
      onSaved()
      onOpenChange(false)
    } catch {
      setError('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      setError('Please drop image files only.')
      return
    }
    if (!listingId) {
      setPendingFiles((prev) => [...prev, ...imageFiles])
      setPendingPreviews((prev) => [...prev, ...imageFiles.map((f) => URL.createObjectURL(f))])
      return
    }
    setUploading(true)
    setError(null)
    try {
      const ok = await uploadFilesTo(listingId, imageFiles)
      if (ok) {
        await refreshImages(listingId)
        onSaved()
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removePending = (idx: number) => {
    URL.revokeObjectURL(pendingPreviews[idx])
    setPendingFiles((p) => p.filter((_, i) => i !== idx))
    setPendingPreviews((p) => p.filter((_, i) => i !== idx))
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!listingId) return
    const res = await authedFetch(`/api/asset-listings/${listingId}/images/${imageId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await refreshImages(listingId)
      onSaved()
    }
  }

  const handleMove = async (imageId: string, direction: -1 | 1) => {
    if (!listingId) return
    const idx = images.findIndex((i) => i.id === imageId)
    if (idx < 0) return
    const next = idx + direction
    if (next < 0 || next >= images.length) return
    const reordered = [...images]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(next, 0, moved)
    setImages(reordered)
    await authedFetch(`/api/asset-listings/${listingId}/images`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: reordered.map((i) => i.id) }),
    })
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{listingId ? 'Edit listing' : 'New listing'}</DialogTitle>
          <DialogDescription>
            {listingId ? 'Update the listing details and photos.' : 'Create a new equipment listing for the for-sale page.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="asset-name">Name *</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-description">Description</Label>
            <Textarea
              id="asset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset-cost">Original cost (£)</Label>
              <Input
                id="asset-cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={originalCost}
                onChange={(e) => handleCostChange(e.target.value)}
                placeholder="What we paid"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-status">Status</Label>
              {/* Native <select> on mobile so iOS gives the wheel picker. */}
              <select
                id="asset-status-mobile"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="sm:hidden flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="available">Available</option>
                <option value="under_offer">Under Offer</option>
                <option value="sold">Sold</option>
              </select>
              <div className="hidden sm:block">
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger id="asset-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="under_offer">Under Offer</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset-discount-pct" className={isMarkup ? 'text-amber-700' : ''}>
                {isMarkup ? 'Markup (%)' : 'Discount (%)'}
              </Label>
              <Input
                id="asset-discount-pct"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={discountPercent}
                onChange={(e) => handlePercentChange(e.target.value)}
                disabled={!hasCost}
                placeholder={hasCost ? '0' : 'Set cost first'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-discount-amt" className={isMarkup ? 'text-amber-700' : ''}>
                {isMarkup ? 'Markup (£)' : 'Discount (£)'}
              </Label>
              <Input
                id="asset-discount-amt"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={discountAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={!hasCost}
                placeholder={hasCost ? '0' : 'Set cost first'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-price">Asking price ex-VAT (£) *</Label>
              <Input
                id="asset-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={askingPrice}
                onChange={(e) => handleAskingChange(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Sale options */}
          <div className="space-y-2">
            <Label>Sale options</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-2 rounded-md border border-input px-3 py-2 cursor-pointer hover:bg-accent/50">
                <input
                  type="checkbox"
                  checked={allowOffers}
                  onChange={(e) => setAllowOffers(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-foreground"
                />
                <span className="text-sm">
                  <span className="font-medium block">Allow offers</span>
                  <span className="text-muted-foreground text-xs">Visitors can submit a £ offer alongside their interest.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-input px-3 py-2 cursor-pointer hover:bg-accent/50">
                <input
                  type="checkbox"
                  checked={isPoa}
                  onChange={(e) => setIsPoa(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-foreground"
                />
                <span className="text-sm">
                  <span className="font-medium block">Price on application (POA)</span>
                  <span className="text-muted-foreground text-xs">Public price shows "POA" instead of the asking price.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-input px-3 py-2 cursor-pointer hover:bg-accent/50">
                <input
                  type="checkbox"
                  checked={isZeroRated}
                  onChange={(e) => setIsZeroRated(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-foreground"
                />
                <span className="text-sm">
                  <span className="font-medium block">Zero-rated for VAT</span>
                  <span className="text-muted-foreground text-xs">No VAT is added to the displayed price.</span>
                </span>
              </label>
            </div>
            {isPoa && askingNum != null && askingNum === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                POA hides the asking price, so an asking price of £0 has no effect. Did you mean to leave the asking price blank or set a real figure?
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            {/* Native <select> on mobile so iOS gives the wheel picker. */}
            <div className="sm:hidden">
              <MobileCategoryPicker
                value={category}
                onChange={setCategory}
                options={existingCategories}
              />
            </div>
            <div className="hidden sm:block">
              <CategoryPicker
                value={category}
                onChange={setCategory}
                options={existingCategories}
              />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Photos</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,image/heic,image/heif"
                multiple
                onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Plus className="h-3.5 w-3.5" />
                {uploading ? 'Uploading…' : 'Add photos'}
              </Button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-md p-4 text-center text-sm cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-accent'
                  : 'border-input text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {isDragging
                ? 'Drop photos here'
                : 'Drag photos here, or tap to choose from camera or library'}
            </div>

            {!listingId && pendingFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {pendingFiles.length} photo{pendingFiles.length === 1 ? '' : 's'} ready —
                they'll upload when you create the listing.
              </p>
            )}

            {(images.length > 0 || pendingFiles.length > 0) && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <li key={img.id} className="relative group">
                    <img
                      src={assetImageUrl(img.storage_path)}
                      alt=""
                      className="w-full aspect-square object-cover rounded border"
                    />
                    {idx === 0 && (
                      <Badge variant="outline" className="absolute top-1 left-1 bg-foreground text-background border-transparent">
                        Cover
                      </Badge>
                    )}
                    <div className="absolute bottom-1 left-1 right-1 flex justify-between gap-1">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleMove(img.id, -1)}
                          disabled={idx === 0}
                          className="h-6 w-6 bg-white/90"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleMove(img.id, 1)}
                          disabled={idx === images.length - 1}
                          className="h-6 w-6 bg-white/90"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteImage(img.id)}
                        className="h-6 w-6 bg-white/90 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
                {pendingPreviews.map((url, idx) => (
                  <li key={`pending-${idx}`} className="relative">
                    <img
                      src={url}
                      alt=""
                      className="w-full aspect-square object-cover rounded border border-dashed border-amber-400 opacity-90"
                    />
                    <Badge variant="outline" className="absolute top-1 left-1 bg-amber-100 text-amber-800 border-transparent">
                      Pending
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removePending(idx)}
                      className="absolute bottom-1 right-1 h-6 w-6 bg-white/90 text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : listingId ? 'Save changes' : 'Create listing'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------
// Category picker — searchable dropdown that also lets you type a
// brand new value. Mirrors the Odin CustomerType combobox style.
// ---------------------------------------------------------------
function CategoryPicker({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  const trimmedQuery = query.trim()
  // Merge the current value into the options so a just-added category
  // (only on form state, not yet persisted to a saved listing) still
  // shows up — with a tick — when the user reopens the dropdown.
  const mergedOptions =
    value && !options.some((o) => o.toLowerCase() === value.toLowerCase())
      ? [...options, value].sort((a, b) => a.localeCompare(b))
      : options
  const filtered = trimmedQuery
    ? mergedOptions.filter((o) => o.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : mergedOptions
  const exactMatch = mergedOptions.some(
    (o) => o.toLowerCase() === trimmedQuery.toLowerCase(),
  )

  const select = (val: string) => {
    onChange(val)
    setQuery('')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full justify-between font-normal',
          !value && 'text-muted-foreground',
        )}
      >
        {value || 'Select or type a category'}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or type new…"
              className="flex h-10 w-full bg-transparent py-2 text-base md:text-sm placeholder:text-muted-foreground outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (trimmedQuery && !exactMatch) select(trimmedQuery)
                  else if (filtered.length === 1) select(filtered[0])
                }
                if (e.key === 'Escape') setOpen(false)
              }}
            />
          </div>
          <ul className="max-h-[260px] overflow-y-auto p-1">
            {filtered.length === 0 && !trimmedQuery && (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                No categories yet — type to add one.
              </li>
            )}
            {filtered.map((opt) => (
              <li key={opt}>
                {/* onMouseDown fires BEFORE iOS reinterprets the tap as a
                    keyboard-dismiss, so the selection actually runs. */}
                <div
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => { e.preventDefault(); select(opt) }}
                  onTouchEnd={(e) => { e.preventDefault(); select(opt) }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                >
                  <Check className={cn('h-4 w-4', value === opt ? 'opacity-100' : 'opacity-0')} />
                  {opt}
                </div>
              </li>
            ))}
            {trimmedQuery && !exactMatch && (
              <>
                {filtered.length > 0 && <li className="my-1 h-px bg-border" />}
                <li>
                  <div
                    role="button"
                    tabIndex={0}
                    onMouseDown={(e) => { e.preventDefault(); select(trimmedQuery) }}
                    onTouchEnd={(e) => { e.preventDefault(); select(trimmedQuery) }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-primary font-medium hover:bg-gray-100 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Add "{trimmedQuery}"
                  </div>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// Mobile category picker — native <select> so iOS surfaces the
// wheel picker. An extra "Add new…" sentinel option switches the
// control into a text input for typing a brand new category.
// ---------------------------------------------------------------
function MobileCategoryPicker({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  const ADD_NEW = '__add_new__'
  // Merge the current value in so a freshly-added one still shows as selected.
  const mergedOptions =
    value && !options.some((o) => o.toLowerCase() === value.toLowerCase())
      ? [...options, value].sort((a, b) => a.localeCompare(b))
      : options
  const [addingNew, setAddingNew] = useState(false)

  if (addingNew) {
    return (
      <div className="space-y-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="New category"
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setAddingNew(false)
            onChange('')
          }}
          className="text-xs text-muted-foreground underline"
        >
          ← Pick from existing
        </button>
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAddingNew(true)
        } else {
          onChange(e.target.value)
        }
      }}
      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">Select a category…</option>
      {mergedOptions.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new category…</option>
    </select>
  )
}
