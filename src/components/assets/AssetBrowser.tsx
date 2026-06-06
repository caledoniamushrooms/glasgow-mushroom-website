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

const STATUS_PILL: Record<Status, string> = {
  available: 'bg-stone-100 text-stone-700 ring-1 ring-stone-200',
  reserved: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  sold: 'bg-stone-100 text-stone-400 ring-1 ring-stone-200 line-through',
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
      {/* Filters */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <nav className="flex gap-5 flex-wrap" aria-label="Filter by status">
          {(['all', 'available', 'reserved', 'sold'] as const).map((f) => {
            const count = f === 'all' ? listings.length : listings.filter((l) => l.status === f).length
            const isActive = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`relative pb-1 text-sm capitalize cursor-pointer transition-colors ${
                  isActive
                    ? 'text-stone-900 font-medium'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {f}
                <span className="ml-1 text-stone-400 text-xs">({count})</span>
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-stone-900" />
                )}
              </button>
            )
          })}
        </nav>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full pl-9 pr-3 py-2 rounded-full bg-white border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
          </svg>
        </label>
      </div>

      {/* Odin-style report card */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h2 className="text-base font-semibold text-zinc-900">Asset Register</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-5">
          Equipment, fixtures and fittings available for sale as the farm winds down.
        </p>

        {filtered.length === 0 ? (
          <div className="border border-zinc-200 rounded-lg bg-white py-12 text-center">
            <p className="text-zinc-500 text-sm">No items match your filters.</p>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 text-zinc-700">
                  <th className="px-5 py-3 text-left text-sm font-normal w-20"></th>
                  <th className="px-5 py-3 text-left text-sm font-normal">Item</th>
                  <th className="px-5 py-3 text-left text-sm font-normal hidden md:table-cell">Category</th>
                  <th className="px-5 py-3 text-right text-sm font-normal">Price</th>
                  <th className="px-5 py-3 text-left text-sm font-normal w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, idx) => {
                  const cover = l.asset_listing_images[0]
                  const isSold = l.status === 'sold'
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setOpenListing(l)}
                      className={`cursor-pointer transition-colors ${
                        idx > 0 ? 'border-t border-zinc-100' : ''
                      } ${isSold ? 'bg-zinc-50/40' : 'hover:bg-slate-50/60'}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className={`w-14 h-14 bg-zinc-100 rounded-md overflow-hidden flex items-center justify-center ${isSold ? 'opacity-60' : ''}`}>
                          {cover ? (
                            <img
                              src={`${imageBase}/${cover.storage_path}`}
                              alt={l.name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-zinc-400">No photo</span>
                          )}
                        </div>
                      </td>
                      <td className={`px-5 py-3.5 text-sm ${isSold ? 'text-zinc-500' : 'text-zinc-900'}`}>
                        <div className="font-medium">{l.name}</div>
                        {l.category && (
                          <div className="text-xs text-zinc-500 mt-0.5 md:hidden">{l.category}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-zinc-600 hidden md:table-cell">{l.category ?? '—'}</td>
                      <td className={`px-5 py-3.5 text-sm text-right font-semibold whitespace-nowrap ${isSold ? 'text-zinc-400' : 'text-zinc-900'}`}>
                        {formatPrice(l.asking_price)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block text-[10px] font-medium uppercase tracking-[0.1em] px-2 py-1 rounded ${STATUS_PILL[l.status]}`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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
