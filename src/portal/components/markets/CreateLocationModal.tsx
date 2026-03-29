import { useState, useRef, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!location

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setUploading(true)

    try {
      // Generate a unique filename
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const filename = `${crypto.randomUUID()}.${ext}`

      const { error } = await supabase.storage
        .from('market-logos')
        .upload(filename, file, { upsert: true })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('market-logos')
        .getPublicUrl(filename)

      setLogoUrl(urlData.publicUrl)
    } catch (err) {
      setUploadError((err as Error).message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = () => {
    setLogoUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
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

          {/* Logo section */}
          <div>
            <label className="block text-sm font-medium mb-2">Logo</label>
            <div className="border border-input rounded-md p-3">
              {logoUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-md border border-border bg-gray-50 flex items-center justify-center overflow-hidden">
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-full">{logoUrl.split('/').pop()}</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-xs text-red-500 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  <span className="text-sm font-medium">
                    {uploading ? 'Uploading...' : 'Choose logo image'}
                  </span>
                  <span className="text-xs">PNG, JPG, WebP or SVG (max 2MB)</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileChange}
                className="hidden"
              />
              {uploadError && (
                <p className="text-xs text-red-500 mt-2">{uploadError}</p>
              )}
            </div>
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
              disabled={isPending || uploading}
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
