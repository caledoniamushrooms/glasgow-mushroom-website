import { Fragment, useEffect, useState, useMemo, type FormEvent } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, ChevronsUpDown, Package, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'available' | 'under_offer' | 'sold'

const STATUS_LABEL: Record<Status, string> = {
  available: 'Available',
  under_offer: 'Under Offer',
  sold: 'Sold',
}

interface AssetImage {
  id: string
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
  asset_listing_images: AssetImage[]
}

interface Props {
  listings: AssetListing[]
  imageBase: string
}

const STATUS_BADGE_CLASS: Record<Status, string> = {
  available: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-transparent',
  under_offer: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-transparent',
  sold: 'bg-gray-200 text-gray-600 hover:bg-gray-200 border-transparent',
}

function formatPrice(p: number): string {
  if (Number(p) === 0) return 'Free'
  return `£${Number(p).toLocaleString('en-GB')}`
}

type Filter = 'all' | Status | 'free'

export default function AssetBrowser({ listings, imageBase }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [openListing, setOpenListing] = useState<AssetListing | null>(null)
  const [openImageIdx, setOpenImageIdx] = useState<number | null>(null)
  const [showInterest, setShowInterest] = useState(false)

  const categories = useMemo(() => {
    const set = new Set<string>()
    listings.forEach((l) => l.category && set.add(l.category))
    return Array.from(set).sort()
  }, [listings])

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (filter === 'free') {
        if (l.status !== 'available' || Number(l.asking_price) !== 0) return false
      } else if (filter !== 'all' && l.status !== filter) {
        return false
      }
      if (search && !l.name.toLowerCase().includes(search.toLowerCase()) &&
          !(l.category ?? '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [listings, filter, search])

  const freeCount = useMemo(
    () => listings.filter((l) => l.status === 'available' && Number(l.asking_price) === 0).length,
    [listings],
  )

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggleCategory = (cat: string) =>
    setCollapsed((s) => ({ ...s, [cat]: !s[cat] }))

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

  useEffect(() => {
    if (openImageIdx === null || !openListing) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenImageIdx(null)
      if (e.key === 'ArrowRight') {
        setOpenImageIdx((i) => (i === null ? null : Math.min(openListing.asset_listing_images.length - 1, i + 1)))
      }
      if (e.key === 'ArrowLeft') {
        setOpenImageIdx((i) => (i === null ? null : Math.max(0, i - 1)))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openImageIdx, openListing])

  return (
    <div>
      <Card className="border-0 rounded-none shadow-none sm:border sm:rounded-xl sm:shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#009689]" />
            Asset Register
          </CardTitle>
          <CardDescription>
            Equipment, fixtures and fittings for sale as the farm winds down
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="-mx-4 sm:mx-0 max-w-full overflow-x-auto sm:overflow-visible">
              <TabsList className="mx-4 sm:mx-0">
                {(['all', 'available', 'free', 'under_offer', 'sold'] as const).map((f) => {
                  const count =
                    f === 'all'
                      ? listings.length
                      : f === 'free'
                        ? freeCount
                        : listings.filter((l) => l.status === f).length
                  const label =
                    f === 'all' ? 'All' : f === 'free' ? 'Free' : STATUS_LABEL[f]
                  return (
                    <TabsTrigger key={f} value={f}>
                      {label}
                      <span className="ml-1 text-xs opacity-60">{count}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-8"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No items match your filters
            </div>
          ) : (
            <div className="sm:border sm:rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-left w-20 sm:w-24 pl-2">
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
                    <TableHead className="text-left hidden lg:table-cell">Description</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Price</TableHead>
                    <TableHead className="text-left w-28 hidden sm:table-cell">Status</TableHead>
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
                          const isSold = l.status === 'sold'
                          return (
                            <TableRow
                              key={l.id}
                              onClick={() => setOpenListing(l)}
                              className={`hover:bg-gray-50 cursor-pointer ${isSold ? 'opacity-60' : ''}`}
                            >
                              <TableCell className="p-2 sm:p-4">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                                  {cover ? (
                                    <img
                                      src={`${imageBase}/${cover.storage_path}`}
                                      alt={l.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-gray-400">No photo</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium p-2 sm:p-4 whitespace-normal break-words">
                                {l.name}
                                {/* Mobile-only: stack price + status under name */}
                                <div className="flex items-center gap-2 mt-1 sm:hidden text-xs">
                                  <span className="font-semibold">{formatPrice(l.asking_price)}</span>
                                  <Badge variant="outline" className={STATUS_BADGE_CLASS[l.status]}>
                                    {STATUS_LABEL[l.status]}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-gray-600 max-w-xs">
                                <span className="line-clamp-1">{l.description ?? '—'}</span>
                              </TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap hidden sm:table-cell">
                                {formatPrice(l.asking_price)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className={STATUS_BADGE_CLASS[l.status]}>
                                  {STATUS_LABEL[l.status]}
                                </Badge>
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

      {categories.length > 0 && (
        <p className="sr-only">Categories available: {categories.join(', ')}</p>
      )}

      {/* Detail */}
      {openListing && (
        <DetailView
          listing={openListing}
          imageBase={imageBase}
          onClose={() => { setOpenListing(null); setOpenImageIdx(null); setShowInterest(false) }}
          onOpenImage={(i) => setOpenImageIdx(i)}
          onRegisterInterest={() => setShowInterest(true)}
        />
      )}

      {/* Image modal (over detail) */}
      {openListing && openImageIdx !== null && openListing.asset_listing_images[openImageIdx] && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setOpenImageIdx(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpenImageIdx((i) => i === null ? null : Math.max(0, i - 1)) }}
            disabled={openImageIdx === 0}
            className="absolute left-2 md:left-6 text-white text-4xl px-3 py-2 disabled:opacity-20 cursor-pointer"
            aria-label="Previous"
          >‹</button>
          <img
            src={`${imageBase}/${openListing.asset_listing_images[openImageIdx].storage_path}`}
            alt=""
            className="max-w-[95vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setOpenImageIdx((i) => i === null ? null : Math.min(openListing.asset_listing_images.length - 1, i + 1)) }}
            disabled={openImageIdx === openListing.asset_listing_images.length - 1}
            className="absolute right-2 md:right-6 text-white text-4xl px-3 py-2 disabled:opacity-20 cursor-pointer"
            aria-label="Next"
          >›</button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenImageIdx(null) }}
            className="absolute top-3 right-3 text-white text-3xl px-2 cursor-pointer"
            aria-label="Close"
          >×</button>
          <div className="absolute bottom-3 left-0 right-0 text-center text-white/80 text-sm">
            {openImageIdx + 1} / {openListing.asset_listing_images.length}
          </div>
        </div>
      )}

      {/* Interest form (over detail) */}
      {openListing && showInterest && (
        <InterestForm
          listing={openListing}
          onClose={() => setShowInterest(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------
function DetailView({
  listing,
  imageBase,
  onClose,
  onOpenImage,
  onRegisterInterest,
}: {
  listing: AssetListing
  imageBase: string
  onClose: () => void
  onOpenImage: (idx: number) => void
  onRegisterInterest: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 md:p-6 flex items-stretch md:items-center justify-center overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-3xl md:rounded-lg shadow-xl flex flex-col max-h-screen"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
          <h2 className="font-semibold text-zinc-900">{listing.name}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 text-2xl leading-none cursor-pointer" aria-label="Close">×</button>
        </header>
        <div className="overflow-y-auto p-4 grid gap-4">
          {listing.asset_listing_images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {listing.asset_listing_images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => onOpenImage(idx)}
                  className="aspect-square overflow-hidden rounded border border-zinc-200 cursor-zoom-in"
                >
                  <img
                    src={`${imageBase}/${img.storage_path}`}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          <div>
            <div className="flex flex-wrap gap-2 items-center mb-2">
              <Badge variant="outline" className={STATUS_BADGE_CLASS[listing.status]}>
                {STATUS_LABEL[listing.status]}
              </Badge>
              {listing.category && (
                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-transparent">
                  {listing.category}
                </Badge>
              )}
            </div>
            <p className="text-2xl font-semibold text-zinc-900">{formatPrice(listing.asking_price)}</p>
          </div>
          {listing.description && (
            <p className="text-zinc-700 whitespace-pre-line leading-relaxed">{listing.description}</p>
          )}
        </div>
        <footer className="px-4 py-3 border-t border-zinc-200 flex gap-2 justify-end bg-white">
          {listing.status !== 'sold' && (
            <button
              onClick={onRegisterInterest}
              className="bg-zinc-900 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-zinc-800"
            >
              Register interest
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm border border-zinc-200 bg-white cursor-pointer hover:bg-zinc-50"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
function InterestForm({ listing, onClose }: { listing: AssetListing; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('listing_id', listing.id)
    try {
      const res = await fetch('/api/asset-interest', { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Submission failed.')
        return
      }
      setSent(true)
    } catch {
      setError('Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/60 flex items-stretch md:items-center justify-center md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md md:rounded-lg shadow-xl flex flex-col max-h-screen"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
          <h2 className="font-semibold text-zinc-900">Register interest</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 text-2xl leading-none cursor-pointer" aria-label="Close">×</button>
        </header>
        {sent ? (
          <div className="p-6 grid gap-3 text-center">
            <p className="text-zinc-900 font-medium">Thanks — we've got your details.</p>
            <p className="text-sm text-zinc-600">We'll be in touch shortly.</p>
            <button
              onClick={onClose}
              className="mt-2 bg-zinc-900 text-white px-4 py-2 rounded-md text-sm cursor-pointer hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 grid gap-3 overflow-y-auto">
            <p className="text-sm text-zinc-600">
              Interested in <strong>{listing.name}</strong> at {formatPrice(listing.asking_price)}.
            </p>
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Your name *</label>
              <input name="name" required className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-sm bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input name="email" type="email" required className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-sm bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input name="phone" type="tel" className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-sm bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Collection or delivery?</label>
              <select name="collection_preference" className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-sm bg-white">
                <option value="">— No preference —</option>
                <option value="collection">Collection</option>
                <option value="delivery">Delivery</option>
                <option value="either">Either</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea name="message" rows={4} className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-sm bg-white" />
            </div>
            {/* Honeypot */}
            <input type="text" name="website" autoComplete="off" tabIndex={-1} className="hidden" aria-hidden="true" />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm border border-zinc-200 bg-white cursor-pointer hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-zinc-900 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-zinc-800 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
