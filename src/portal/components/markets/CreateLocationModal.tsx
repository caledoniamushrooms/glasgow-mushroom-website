import { useState, type FormEvent } from 'react'
import type { MarketLocation } from '../../lib/types'

interface CreateLocationModalProps {
  location?: MarketLocation | null
  onSave: (data: Omit<MarketLocation, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onClose: () => void
  isPending: boolean
}

export function CreateLocationModal({ location, onSave, onClose, isPending }: CreateLocationModalProps) {
  const [name, setName] = useState(location?.name || '')
  const [address, setAddress] = useState(location?.address || '')
  const [googleMapsUrl, setGoogleMapsUrl] = useState(location?.google_maps_url || '')
  const [logoUrl, setLogoUrl] = useState(location?.logo_url || '')
  const [type, setType] = useState(location?.type || 'market')

  const isEdit = !!location

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await onSave({
      name,
      address,
      google_maps_url: googleMapsUrl || null,
      logo_url: logoUrl || null,
      type,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? 'Edit Market Location' : 'New Market Location'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 grid gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. The Railyard"
              required
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. S Woodside Rd, Glasgow G4 9HF"
              required
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Google Maps URL</label>
            <input
              value={googleMapsUrl}
              onChange={e => setGoogleMapsUrl(e.target.value)}
              placeholder="https://www.google.com/maps/..."
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Logo URL</label>
            <input
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="/images/markets/logo.png"
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
            >
              <option value="market">Market</option>
              <option value="event">Event</option>
              <option value="pop-up">Pop-up</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm cursor-pointer font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Location'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border border-border px-4 py-2 rounded-md text-sm cursor-pointer text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
