import { useState, useRef, type FormEvent, type DragEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { assetImageUrl } from '../lib/assetImage'

type Status = 'available' | 'reserved' | 'sold'

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
  category: string | null
  status: Status
  sort_order: number
  created_at: string
  updated_at: string
  asset_listing_images: AssetImage[]
}

const STATUS_OPTIONS: Status[] = ['available', 'reserved', 'sold']

const STATUS_PILL: Record<Status, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  reserved: 'bg-amber-100 text-amber-800',
  sold: 'bg-zinc-200 text-zinc-700',
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}

export function AssetRegister() {
  const { isSystemAdmin } = useAuthContext()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<AssetListing | null>(null)
  const [showForm, setShowForm] = useState(false)
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

  return (
    <div>
      <header className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Asset Register</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage equipment listings for the public for-sale page.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold text-sm cursor-pointer hover:opacity-90"
        >
          + New listing
        </button>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'available', 'reserved', 'sold'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize cursor-pointer ${
              filter === f
                ? 'bg-foreground text-background border-foreground'
                : 'bg-white text-muted-foreground border-border hover:bg-accent'
            }`}
          >
            {f}
            <span className="ml-1.5 opacity-70">
              ({f === 'all' ? listings.length : listings.filter((l) => l.status === f).length})
            </span>
          </button>
        ))}
      </div>

      {showForm && (
        <ListingForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-asset-listings'] })
          }}
        />
      )}

      {listingsQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">No listings yet.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((l) => (
            <article
              key={l.id}
              className="bg-white border border-border rounded-lg p-3 flex gap-4 items-start"
            >
              <div className="w-24 h-24 bg-zinc-100 rounded shrink-0 overflow-hidden flex items-center justify-center">
                {l.asset_listing_images[0] ? (
                  <img
                    src={assetImageUrl(l.asset_listing_images[0].storage_path)}
                    alt={l.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No photo</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 items-center mb-1">
                  <h3 className="font-semibold text-foreground">{l.name}</h3>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_PILL[l.status]}`}>
                    {l.status}
                  </span>
                  {l.category && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                      {l.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground font-medium">
                  £{Number(l.asking_price).toLocaleString('en-GB')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {l.asset_listing_images.length} photo{l.asset_listing_images.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => { setEditing(l); setShowForm(true) }}
                  className="text-xs font-medium px-3 py-1 border border-border rounded hover:bg-accent cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${l.name}" and its photos?`)) deleteListing.mutate(l.id)
                  }}
                  className="text-xs font-medium px-3 py-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// Form
// ---------------------------------------------------------------
function ListingForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: AssetListing | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [askingPrice, setAskingPrice] = useState(initial?.asking_price?.toString() ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [status, setStatus] = useState<Status>(initial?.status ?? 'available')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listingId, setListingId] = useState<string | null>(initial?.id ?? null)
  const [images, setImages] = useState<AssetImage[]>(initial?.asset_listing_images ?? [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)

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
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
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

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        asking_price: Number(askingPrice),
        category,
        status,
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

      // Flush any staged photos
      if (pendingFiles.length > 0) {
        setUploading(true)
        const ok = await uploadFilesTo(id, pendingFiles)
        setUploading(false)
        if (ok) {
          pendingPreviews.forEach((url) => URL.revokeObjectURL(url))
          setPendingFiles([])
          setPendingPreviews([])
          await refreshImages(id)
        }
      }
      onSaved()
    } catch {
      setError('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) {
      setError('Please drop image files only.')
      return
    }
    if (!listingId) {
      // Stage until listing is created
      setPendingFiles((prev) => [...prev, ...images])
      setPendingPreviews((prev) => [...prev, ...images.map((f) => URL.createObjectURL(f))])
      return
    }
    setUploading(true)
    setError(null)
    try {
      const ok = await uploadFilesTo(listingId, images)
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
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch md:items-center justify-center p-0 md:p-4 overflow-y-auto">
      <div className="bg-white w-full md:max-w-2xl md:rounded-lg shadow-xl flex flex-col max-h-screen">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold">{listingId ? 'Edit listing' : 'New listing'}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSave} className="p-4 grid gap-3 overflow-y-auto">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Asking price (£) *</label>
              <input
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white capitalize"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Sterilisation, Cold chain, Office"
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : listingId ? 'Save changes' : 'Create listing'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm border border-border bg-transparent cursor-pointer hover:bg-accent"
            >
              Close
            </button>
          </div>
        </form>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Photos</h3>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,image/heic,image/heif"
              multiple
              onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-sm px-3 py-1.5 border border-border rounded cursor-pointer hover:bg-accent disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '+ Add photos'}
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-md p-4 text-center text-sm cursor-pointer transition-colors mb-3 ${
              isDragging
                ? 'border-primary bg-accent'
                : 'border-border text-muted-foreground hover:bg-accent/50'
            }`}
          >
            {isDragging
              ? 'Drop photos here'
              : 'Drag photos here, or tap to choose from camera or library'}
          </div>

          {!listingId && pendingFiles.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              {pendingFiles.length} photo{pendingFiles.length === 1 ? '' : 's'} ready —
              they'll upload when you create the listing.
            </p>
          )}

          {(images.length === 0 && pendingFiles.length === 0) ? (
            <p className="text-xs text-muted-foreground">No photos yet.</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <li key={img.id} className="relative group">
                  <img
                    src={assetImageUrl(img.storage_path)}
                    alt=""
                    className="w-full aspect-square object-cover rounded border border-border"
                  />
                  {idx === 0 && (
                    <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 bg-foreground text-background rounded">
                      Cover
                    </span>
                  )}
                  <div className="absolute bottom-1 left-1 right-1 flex justify-between gap-1">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(img.id, -1)}
                        disabled={idx === 0}
                        className="bg-white/90 border border-border rounded text-xs px-1.5 cursor-pointer disabled:opacity-30"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => handleMove(img.id, 1)}
                        disabled={idx === images.length - 1}
                        className="bg-white/90 border border-border rounded text-xs px-1.5 cursor-pointer disabled:opacity-30"
                      >↓</button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="bg-white/90 border border-border rounded text-xs px-1.5 text-red-600 cursor-pointer"
                    >Delete</button>
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
                  <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                    Pending
                  </span>
                  <button
                    type="button"
                    onClick={() => removePending(idx)}
                    className="absolute bottom-1 right-1 bg-white/90 border border-border rounded text-xs px-1.5 text-red-600 cursor-pointer"
                  >Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
