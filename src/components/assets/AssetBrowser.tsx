import { Fragment, useEffect, useState, useMemo, useRef, type FormEvent } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronsUpDown, Package, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { priceIncVat, formatGBP } from '@/lib/vat'

type Status = 'available' | 'under_offer' | 'sold'

const STATUS_LABEL: Record<Status, string> = {
  available: 'Available',
  under_offer: 'Under Offer',
  sold: 'Sold',
}

const STORAGE_KEY = 'gmc-asset-cart-v1'

interface AssetImage {
  id: string
  storage_path: string
  position: number
}

interface AssetListing {
  id: string
  name: string
  description: string | null
  asking_price: number | null
  category: string | null
  status: Status
  allow_offers: boolean
  is_poa: boolean
  is_zero_rated: boolean
  sort_order: number
  asset_listing_images: AssetImage[]
}

interface Props {
  listings: AssetListing[]
  imageBase: string
}

// Record<listing_id, offer_string>. Presence == selected. Offer is the raw
// input string (may be ''); the API endpoint parses it. Empty offer means
// the visitor is just registering interest without a specific number.
type Selection = Record<string, string>

const STATUS_BADGE_CLASS: Record<Status, string> = {
  available: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-transparent',
  under_offer: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-transparent',
  sold: 'bg-gray-200 text-gray-600 hover:bg-gray-200 border-transparent',
}

// Display model: POA wins; a set price shows as a price (an explicit
// £0 means "Free"); no price at all (null) means the price is TBD.
function priceLabel(l: AssetListing): string {
  if (l.is_poa) return 'POA'
  if (l.asking_price == null) return 'TBD'
  if (l.asking_price === 0) return 'Free'
  return formatGBP(priceIncVat(l.asking_price, l.is_zero_rated))
}

function hasQuotedPrice(l: AssetListing): boolean {
  return !l.is_poa && l.asking_price != null && l.asking_price > 0
}

type Filter = 'all' | Status | 'free'

export default function AssetBrowser({ listings, imageBase }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [openListing, setOpenListing] = useState<AssetListing | null>(null)
  const [openImageIdx, setOpenImageIdx] = useState<number | null>(null)
  const [showSummary, setShowSummary] = useState(false)

  const [selection, setSelection] = useState<Selection>({})
  const [hydrated, setHydrated] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<number | null>(null)

  const setOffer = (id: string, value: string) =>
    setSelection((s) => ({ ...s, [id]: value }))

  const toggleSelected = (id: string) =>
    setSelection((s) => {
      if (id in s) {
        const { [id]: _drop, ...rest } = s
        return rest
      }
      return { ...s, [id]: '' }
    })

  const showFlashNotice = (msg: string) => {
    setNotice(msg)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000)
  }

  // ---- localStorage hydrate / persist ----
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const validIds = new Set(
          listings.filter((l) => l.status !== 'sold').map((l) => l.id),
        )
        const cleaned: Selection = {}
        for (const [id, val] of Object.entries(parsed)) {
          if (validIds.has(id)) cleaned[id] = typeof val === 'string' ? val : ''
        }
        const dropped = Object.keys(parsed).length - Object.keys(cleaned).length
        setSelection(cleaned)
        if (dropped > 0) {
          showFlashNotice(
            `${dropped} item${dropped === 1 ? '' : 's'} from your previous selection ${dropped === 1 ? 'is' : 'are'} no longer available.`,
          )
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true)
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      if (Object.keys(selection).length === 0) {
        window.localStorage.removeItem(STORAGE_KEY)
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
      }
    } catch {
      /* ignore */
    }
  }, [selection, hydrated])

  // ---- Cookie banner detection so the FAB doesn't clash ----
  const [bannerVisible, setBannerVisible] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const banner = document.getElementById('cookie-banner') as HTMLElement | null
    if (!banner) return
    setBannerVisible(!banner.hidden)
    const obs = new MutationObserver(() => setBannerVisible(!banner.hidden))
    obs.observe(banner, { attributes: true, attributeFilter: ['hidden'] })
    return () => obs.disconnect()
  }, [])

  // ---- Filtering / grouping ----
  const categories = useMemo(() => {
    const set = new Set<string>()
    listings.forEach((l) => l.category && set.add(l.category))
    return Array.from(set).sort()
  }, [listings])

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (filter === 'free') {
        // Free = an explicit £0 price. Excludes POA and unpriced (TBD) items.
        if (l.status !== 'available' || l.asking_price !== 0 || l.is_poa) return false
      } else if (filter !== 'all' && l.status !== filter) {
        return false
      }
      if (
        search &&
        !l.name.toLowerCase().includes(search.toLowerCase()) &&
        !(l.category ?? '').toLowerCase().includes(search.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [listings, filter, search])

  const freeCount = useMemo(
    () =>
      listings.filter(
        (l) =>
          l.status === 'available' &&
          l.asking_price === 0 &&
          !l.is_poa,
      ).length,
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

  // One keyboard handler for the whole modal stack: Escape closes the
  // top-most layer (lightbox → summary → detail); arrows page the lightbox.
  useEffect(() => {
    if (!openListing && !showSummary) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openImageIdx !== null) setOpenImageIdx(null)
        else if (showSummary) setShowSummary(false)
        else setOpenListing(null)
        return
      }
      if (openImageIdx === null || !openListing) return
      if (e.key === 'ArrowRight') {
        setOpenImageIdx((i) =>
          i === null ? null : Math.min(openListing.asset_listing_images.length - 1, i + 1),
        )
      }
      if (e.key === 'ArrowLeft') {
        setOpenImageIdx((i) => (i === null ? null : Math.max(0, i - 1)))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openImageIdx, openListing, showSummary])

  // Lock background scroll while any modal layer is open
  useEffect(() => {
    if (!openListing && !showSummary) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [openListing, showSummary])

  // ---- View tracking (production only, no PII) ----
  const trackedListings = useRef<Set<string>>(new Set())
  const track = (kind: 'page' | 'listing', listingId?: string) => {
    if (!import.meta.env.PROD) return
    fetch('/api/asset-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kind === 'page' ? { kind } : { kind, listing_id: listingId }),
      keepalive: true,
    }).catch(() => {})
  }

  useEffect(() => {
    track('page')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openDetail = (l: AssetListing) => {
    setOpenListing(l)
    if (!trackedListings.current.has(l.id)) {
      trackedListings.current.add(l.id)
      track('listing', l.id)
    }
  }

  const selectedCount = Object.keys(selection).length
  const selectedItems = useMemo(
    () =>
      Object.keys(selection)
        .map((id) => listings.find((l) => l.id === id))
        .filter((l): l is AssetListing => !!l),
    [selection, listings],
  )

  const handleSummarySuccess = () => {
    setSelection({})
    setShowSummary(false)
  }

  return (
    <div>
      <Card className="border-0 rounded-none shadow-none sm:border sm:rounded-xl sm:shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#009689]" />
            Equipment Sale
          </CardTitle>
          <CardDescription>
            Equipment, fixtures and fittings for sale as the farm winds down.
            Prices include VAT where applicable.
            <span className="block mt-2">
              To register interest, select the items you'd like, then use the{' '}
              <span className="font-medium text-zinc-700">Register interest</span>{' '}
              button in the bottom-right corner to send us your selection.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          {notice && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              {notice}
            </div>
          )}

          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
            <p className="font-medium mb-1">Make us an offer!</p>
            <p>We are open to negotiation. If you see something you're interested we encourage you to make an offer using the box provided.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as Filter)}
              className="-mx-4 sm:mx-0 max-w-full overflow-x-auto sm:overflow-visible"
            >
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
                aria-label="Search listings"
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
                    <TableHead className="w-8 sm:w-10 pl-3 sm:pl-4"></TableHead>
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
                          const selected = l.id in selection
                          const offerValue = selection[l.id] ?? ''
                          return (
                            <TableRow
                              key={l.id}
                              onClick={() => openDetail(l)}
                              className={cn(
                                'hover:bg-gray-50 cursor-pointer',
                                isSold && 'opacity-60',
                                selected && 'bg-emerald-50/40',
                              )}
                            >
                              <TableCell
                                className="w-8 sm:w-10 pl-3 sm:pl-4 p-2 sm:p-4 align-middle"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleSelected(l.id)}
                                  disabled={isSold}
                                  aria-label={`Select ${l.name}`}
                                  className="h-4 w-4 accent-zinc-900 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </TableCell>
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
                                {/* Mobile-only stacked details */}
                                <div className="flex flex-wrap items-center gap-2 mt-1 sm:hidden text-xs">
                                  <span className={cn('font-semibold', l.allow_offers && 'text-zinc-500 font-normal')}>
                                    {l.allow_offers && hasQuotedPrice(l) ? `Asking ${priceLabel(l)}` : priceLabel(l)}
                                  </span>
                                  <Badge variant="outline" className={STATUS_BADGE_CLASS[l.status]}>
                                    {STATUS_LABEL[l.status]}
                                  </Badge>
                                </div>
                                {l.allow_offers && !isSold && (
                                  <div
                                    className="mt-2 sm:hidden"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Setting an offer selects the item (presence in the
                                        selection map IS selection) — no toggle call here. */}
                                    <OfferInput
                                      value={offerValue}
                                      onChange={(v) => setOffer(l.id, v)}
                                    />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-gray-600 max-w-xs">
                                <span className="line-clamp-1">{l.description ?? '—'}</span>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap hidden sm:table-cell">
                                <div className="flex flex-col items-end gap-1">
                                  <span className={cn('font-semibold', l.allow_offers && 'text-xs text-zinc-500 font-normal')}>
                                    {l.allow_offers && hasQuotedPrice(l) ? `Asking ${priceLabel(l)}` : priceLabel(l)}
                                  </span>
                                  {l.allow_offers && !isSold && (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <OfferInput
                                        value={offerValue}
                                        onChange={(v) => setOffer(l.id, v)}
                                      />
                                    </div>
                                  )}
                                </div>
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
          selected={openListing.id in selection}
          offerValue={selection[openListing.id] ?? ''}
          onToggleSelected={() => toggleSelected(openListing.id)}
          onOfferChange={(v) => setOffer(openListing.id, v)}
          onClose={() => { setOpenListing(null); setOpenImageIdx(null) }}
          onOpenImage={(i) => setOpenImageIdx(i)}
        />
      )}

      {/* Image modal (over detail) */}
      {openListing && openImageIdx !== null && openListing.asset_listing_images[openImageIdx] && (
        <div
          className="fixed inset-0 z-[10010] bg-black/90 flex items-center justify-center"
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

      {/* Floating Action Button */}
      {selectedCount > 0 && !showSummary && (
        <button
          type="button"
          onClick={() => setShowSummary(true)}
          aria-label={`Register interest in ${selectedCount} item${selectedCount === 1 ? '' : 's'}`}
          className={cn(
            'fixed right-4 sm:right-6 z-[10000] bg-zinc-900 text-white px-5 py-3 rounded-full shadow-lg font-medium text-sm hover:bg-zinc-800 cursor-pointer transition-all',
            bannerVisible ? 'bottom-56 sm:bottom-24' : 'bottom-6',
          )}
        >
          Register interest ({selectedCount})
        </button>
      )}

      {/* Summary modal */}
      {showSummary && (
        <SummaryModal
          items={selectedItems}
          selection={selection}
          onRemove={(id) => toggleSelected(id)}
          onClose={() => setShowSummary(false)}
          onSuccess={handleSummarySuccess}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------
function OfferInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-zinc-500">Offer £</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="—"
        aria-label="Offer amount in pounds"
        className="h-7 w-20 px-2 border border-zinc-200 rounded text-base md:text-sm bg-white"
      />
    </div>
  )
}

// ---------------------------------------------------------------
function DetailView({
  listing,
  imageBase,
  selected,
  offerValue,
  onClose,
  onOpenImage,
  onToggleSelected,
  onOfferChange,
}: {
  listing: AssetListing
  imageBase: string
  selected: boolean
  offerValue: string
  onClose: () => void
  onOpenImage: (idx: number) => void
  onToggleSelected: () => void
  onOfferChange: (v: string) => void
}) {
  const isSold = listing.status === 'sold'
  return (
    <div
      className="fixed inset-0 z-[10001] bg-black/50 md:p-6 flex items-stretch md:items-center justify-center overflow-y-auto"
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
              {listing.allow_offers && (
                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-transparent">
                  Offers welcome
                </Badge>
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-2xl font-semibold text-zinc-900">
                {listing.allow_offers && hasQuotedPrice(listing)
                  ? `Asking ${priceLabel(listing)}`
                  : priceLabel(listing)}
                {hasQuotedPrice(listing) && !listing.is_zero_rated && (
                  <span className="ml-1 text-sm font-normal text-zinc-500">incl. VAT</span>
                )}
              </p>
              {hasQuotedPrice(listing) &&
                (listing.is_zero_rated ? (
                  <p className="text-sm text-zinc-500">No VAT applies to this item</p>
                ) : (
                  <p className="text-sm text-zinc-500">
                    {formatGBP(listing.asking_price!)} excl. VAT
                  </p>
                ))}
              {!listing.is_poa && listing.asking_price == null && (
                <p className="text-sm text-zinc-500">
                  Price to be confirmed — register your interest and we'll come back to you.
                </p>
              )}
            </div>
          </div>
          {listing.description && (
            <p className="text-zinc-700 whitespace-pre-line leading-relaxed">{listing.description}</p>
          )}
          {listing.allow_offers && !isSold && (
            <div className="rounded-md border border-zinc-200 p-3 bg-zinc-50">
              <label htmlFor="detail-offer-input" className="block text-sm font-medium mb-1">Your offer (optional)</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-zinc-500">£</span>
                <input
                  id="detail-offer-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={offerValue}
                  onChange={(e) => onOfferChange(e.target.value)}
                  placeholder="Offer amount"
                  className="h-9 w-32 px-2 border border-zinc-200 rounded text-base md:text-sm bg-white"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-2">Leave blank if you just want to express interest.</p>
            </div>
          )}
        </div>
        <footer className="px-4 py-3 border-t border-zinc-200 flex flex-wrap gap-2 justify-end bg-white">
          {!isSold && (
            <button
              onClick={onToggleSelected}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium cursor-pointer flex items-center gap-2',
                selected
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-zinc-900 text-white hover:bg-zinc-800',
              )}
            >
              {selected && <Check className="h-4 w-4" />}
              {selected ? 'Added to selection' : 'Add to selection'}
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
function SummaryModal({
  items,
  selection,
  onRemove,
  onClose,
  onSuccess,
}: {
  items: AssetListing[]
  selection: Selection
  onRemove: (id: string) => void
  onClose: () => void
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // An entered offer counts toward the total (even on POA/TBD items);
  // otherwise the inc-VAT asking price does. POA/TBD items without an
  // offer have no quotable figure and are counted separately.
  const { quotedTotal, unpricedCount } = useMemo(() => {
    let total = 0
    let unpriced = 0
    for (const l of items) {
      const offerStr = selection[l.id]
      const offer = offerStr ? Number(offerStr) : NaN
      if (Number.isFinite(offer) && offer >= 0) {
        total += offer
        continue
      }
      if (l.is_poa || l.asking_price == null) {
        unpriced += 1
        continue
      }
      total += priceIncVat(l.asking_price, l.is_zero_rated)
    }
    return { quotedTotal: total, unpricedCount: unpriced }
  }, [items, selection])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    for (const l of items) {
      const v = selection[l.id]
      if (v && (!Number.isFinite(Number(v)) || Number(v) < 0)) {
        setError(`The offer for "${l.name}" isn't a valid amount.`)
        return
      }
    }
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const payload = {
      name: formData.get('name')?.toString().trim(),
      email: formData.get('email')?.toString().trim(),
      phone: formData.get('phone')?.toString().trim() || null,
      message: formData.get('message')?.toString().trim() || null,
      collection_preference: formData.get('collection_preference')?.toString() || null,
      website: formData.get('website')?.toString() || '',
      items: items.map((l) => {
        const v = selection[l.id]
        const offer_value = v && Number.isFinite(Number(v)) ? Number(v) : null
        return { listing_id: l.id, offer_value }
      }),
    }
    try {
      const res = await fetch('/api/asset-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
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
      className="fixed inset-0 z-[10005] bg-black/60 flex items-stretch md:items-center justify-center md:p-6 overflow-y-auto"
      onClick={sent ? onSuccess : onClose}
    >
      <div
        className="bg-white w-full md:max-w-lg md:rounded-lg shadow-xl flex flex-col max-h-screen"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
          <h2 className="font-semibold text-zinc-900">Register interest</h2>
          <button onClick={sent ? onSuccess : onClose} className="text-zinc-500 hover:text-zinc-900 text-2xl leading-none cursor-pointer" aria-label="Close">×</button>
        </header>

        {sent ? (
          <div className="p-6 grid gap-3 text-center">
            <p className="text-zinc-900 font-medium">Thanks — we've got your details.</p>
            <p className="text-sm text-zinc-600">We'll be in touch shortly.</p>
            <button
              onClick={onSuccess}
              className="mt-2 bg-zinc-900 text-white px-4 py-2 rounded-md text-sm cursor-pointer hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto">
            <div className="p-4 grid gap-3">
              {/* Selected items */}
              <div className="border border-zinc-200 rounded-md divide-y divide-zinc-200">
                {items.length === 0 && (
                  <div className="px-3 py-2 text-sm text-zinc-500">No items selected.</div>
                )}
                {items.map((l) => {
                  const offerStr = selection[l.id]
                  const offer = offerStr && Number.isFinite(Number(offerStr)) ? Number(offerStr) : null
                  return (
                    <div key={l.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{l.name}</p>
                        <p className="text-xs text-zinc-500">
                          {l.allow_offers && hasQuotedPrice(l) ? `Asking ${priceLabel(l)}` : priceLabel(l)}
                          {offer != null && ` · Offer ${formatGBP(offer)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(l.id)}
                        aria-label={`Remove ${l.name}`}
                        className="text-zinc-400 hover:text-red-600 text-lg leading-none cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>

              {items.length > 0 && (
                <div className="flex items-baseline justify-between text-sm border-b border-zinc-200 pb-2">
                  <span className="font-medium">Total</span>
                  <span>
                    {formatGBP(quotedTotal)}
                    {unpricedCount > 0 && (
                      <span className="text-zinc-500"> + {unpricedCount} POA/TBD</span>
                    )}
                  </span>
                </div>
              )}

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
              )}

              <div>
                <label htmlFor="si-name" className="block text-sm font-medium mb-1">Your name *</label>
                <input
                  id="si-name"
                  name="name"
                  autoComplete="name"
                  required
                  className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-base md:text-sm bg-white"
                />
              </div>
              <div>
                <label htmlFor="si-email" className="block text-sm font-medium mb-1">Email *</label>
                <input
                  id="si-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-base md:text-sm bg-white"
                />
              </div>
              <div>
                <label htmlFor="si-phone" className="block text-sm font-medium mb-1">Phone</label>
                <input
                  id="si-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-base md:text-sm bg-white"
                />
              </div>
              <div>
                <label htmlFor="si-pref" className="block text-sm font-medium mb-1">Collection or delivery?</label>
                <select
                  id="si-pref"
                  name="collection_preference"
                  className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-base md:text-sm bg-white"
                >
                  <option value="">— No preference —</option>
                  <option value="collection">Collection</option>
                  <option value="delivery">Delivery</option>
                  <option value="either">Either</option>
                </select>
              </div>
              <div>
                <label htmlFor="si-message" className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  id="si-message"
                  name="message"
                  rows={3}
                  className="w-full px-2.5 py-2 border border-zinc-200 rounded-md text-base md:text-sm bg-white"
                />
              </div>
              {/* Honeypot */}
              <input type="text" name="website" autoComplete="off" tabIndex={-1} className="hidden" aria-hidden="true" />
            </div>

            <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-4 py-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm border border-zinc-200 bg-white cursor-pointer hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || items.length === 0}
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
