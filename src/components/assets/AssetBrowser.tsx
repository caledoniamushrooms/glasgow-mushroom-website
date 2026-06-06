import { useEffect, useState, useMemo, type FormEvent } from 'react'

type Status = 'available' | 'reserved' | 'sold'

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

const STATUS_BADGE: Record<Status, string> = {
  available: 'badge badge-paid',
  reserved: 'badge badge-pending',
  sold: 'badge badge-draft',
}

function formatPrice(p: number): string {
  return `£${Number(p).toLocaleString('en-GB')}`
}

export default function AssetBrowser({ listings, imageBase }: Props) {
  const [filter, setFilter] = useState<'all' | Status>('all')
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
      if (filter !== 'all' && l.status !== filter) return false
      if (search && !l.name.toLowerCase().includes(search.toLowerCase()) &&
          !(l.category ?? '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [listings, filter, search])

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
      <div className="odin-card">
        <div className="odin-card-header flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="odin-card-title">Asset Register</h2>
            <p className="odin-card-description">
              Equipment, fixtures and fittings available for sale as the farm winds down.
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-1.5 rounded-md border border-input bg-white text-sm w-full sm:w-64 odin-focus"
          />
        </div>

        <div className="odin-card-content">
          <div role="tablist" className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-4">
            {(['all', 'available', 'reserved', 'sold'] as const).map((f) => {
              const count = f === 'all' ? listings.length : listings.filter((l) => l.status === f).length
              const isActive = filter === f
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium capitalize transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-foreground shadow-sm'
                      : 'hover:text-foreground'
                  }`}
                >
                  {f}
                  <span className="text-xs opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="odin-empty">
              <p className="odin-empty-description">No items match your filters.</p>
            </div>
          ) : (
            <div className="odin-table-container overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="odin-table-header">
                    <th className="odin-table-cell text-left w-20"></th>
                    <th className="odin-table-cell text-left">Item</th>
                    <th className="odin-table-cell text-left hidden md:table-cell">Category</th>
                    <th className="odin-table-cell text-right">Price</th>
                    <th className="odin-table-cell text-left w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const cover = l.asset_listing_images[0]
                    const isSold = l.status === 'sold'
                    return (
                      <tr
                        key={l.id}
                        onClick={() => setOpenListing(l)}
                        className={`odin-table-row cursor-pointer ${isSold ? 'opacity-70' : ''}`}
                      >
                        <td className="odin-table-cell">
                          <div className="w-12 h-12 bg-muted rounded overflow-hidden flex items-center justify-center">
                            {cover ? (
                              <img
                                src={`${imageBase}/${cover.storage_path}`}
                                alt={l.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">No photo</span>
                            )}
                          </div>
                        </td>
                        <td className="odin-table-cell font-medium text-foreground">
                          {l.name}
                          {l.category && (
                            <div className="text-xs text-muted-foreground mt-0.5 md:hidden">{l.category}</div>
                          )}
                        </td>
                        <td className="odin-table-cell text-muted-foreground hidden md:table-cell">
                          {l.category ?? '—'}
                        </td>
                        <td className="odin-table-cell text-right font-semibold whitespace-nowrap text-foreground">
                          {formatPrice(l.asking_price)}
                        </td>
                        <td className="odin-table-cell">
                          <span className={STATUS_BADGE[l.status]}>{l.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
              <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_PILL[listing.status]}`}>
                {listing.status}
              </span>
              {listing.category && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                  {listing.category}
                </span>
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
