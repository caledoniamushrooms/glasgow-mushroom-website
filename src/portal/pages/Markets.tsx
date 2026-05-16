import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import { useMarkets } from '../hooks/useMarkets'
import { CreateLocationModal } from '../components/markets/CreateLocationModal'
import { CreateDateModal } from '../components/markets/CreateDateModal'
import type { MarketLocation } from '../lib/types'

type Tab = 'events' | 'locations'

export function Markets() {
  const { isSystemAdmin } = useAuthContext()
  const {
    locationsQuery,
    eventsQuery,
    createLocation,
    updateLocation,
    deleteLocation,
    createEvents,
    deleteEvent,
  } = useMarkets()

  const [activeTab, setActiveTab] = useState<Tab>('events')
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDateModal, setShowDateModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<MarketLocation | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isSystemAdmin) return <Navigate to="/portal/home" replace />

  const locations = locationsQuery.data || []
  const events = eventsQuery.data || []

  const handleCreateLocation = async (data: Omit<MarketLocation, 'id' | 'created_at' | 'updated_at'>) => {
    setError(null)
    try {
      await createLocation.mutateAsync(data)
      setShowLocationModal(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleUpdateLocation = async (data: Omit<MarketLocation, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editingLocation) return
    setError(null)
    try {
      await updateLocation.mutateAsync({ id: editingLocation.id, ...data })
      setEditingLocation(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Delete this location and all its events?')) return
    setError(null)
    try {
      await deleteLocation.mutateAsync(id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleCreateEvents = async (eventData: { market_location_id: string; date: string; start_time: string; end_time: string }[]) => {
    setError(null)
    try {
      await createEvents.mutateAsync(eventData)
      setShowDateModal(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Delete this market date?')) return
    setError(null)
    try {
      await deleteEvent.mutateAsync(id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const isLoading = locationsQuery.isLoading || eventsQuery.isLoading

  if (isLoading) return <div className="text-muted-foreground">Loading markets...</div>

  return (
    <div>
      <header className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Markets</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage market locations and upcoming dates</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLocationModal(true)}
            className="bg-transparent border border-border px-3 py-2 rounded-md text-sm cursor-pointer font-medium text-foreground hover:bg-accent transition-colors"
          >
            New Location
          </button>
          <button
            onClick={() => setShowDateModal(true)}
            disabled={locations.length === 0}
            className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm cursor-pointer font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Add Dates
          </button>
        </div>
      </header>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-4">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'events'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Events ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'locations'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Locations ({locations.length})
        </button>
      </div>

      {/* Events tab */}
      {activeTab === 'events' && (
        <div className="odin-table-container overflow-x-auto">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No market dates yet. Click "Add Dates" to create some.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="odin-table-header">
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Date</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Location</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Time</th>
                  <th className="odin-table-cell text-right text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => {
                  const d = new Date(event.date + 'T00:00:00')
                  const isPast = d < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
                  return (
                    <tr key={event.id} className={`odin-table-row ${isPast ? 'opacity-50' : ''}`}>
                      <td className="odin-table-cell font-semibold">
                        {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {isPast && <span className="ml-2 text-xs text-muted-foreground">(past)</span>}
                      </td>
                      <td className="odin-table-cell text-muted-foreground">{event.market_locations.name}</td>
                      <td className="odin-table-cell text-muted-foreground">
                        {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)}
                      </td>
                      <td className="odin-table-cell text-right">
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-muted-foreground hover:text-red-600 transition-colors p-1 cursor-pointer"
                          title="Delete event"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Locations tab */}
      {activeTab === 'locations' && (
        <div className="odin-table-container overflow-x-auto">
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No locations yet. Click "New Location" to add one.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="odin-table-header">
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Name</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Address</th>
                  <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Type</th>
                  <th className="odin-table-cell text-right text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => (
                  <tr key={loc.id} className="odin-table-row">
                    <td className="odin-table-cell font-semibold">{loc.name}</td>
                    <td className="odin-table-cell text-muted-foreground">{loc.address}</td>
                    <td className="odin-table-cell">
                      <span className="badge badge-draft">{loc.type}</span>
                    </td>
                    <td className="odin-table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingLocation(loc)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                          title="Edit location"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc.id)}
                          className="text-muted-foreground hover:text-red-600 transition-colors p-1 cursor-pointer"
                          title="Delete location"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {showLocationModal && (
        <CreateLocationModal
          onSave={handleCreateLocation}
          onClose={() => setShowLocationModal(false)}
          isPending={createLocation.isPending}
        />
      )}

      {editingLocation && (
        <CreateLocationModal
          location={editingLocation}
          onSave={handleUpdateLocation}
          onClose={() => setEditingLocation(null)}
          isPending={updateLocation.isPending}
        />
      )}

      {showDateModal && (
        <CreateDateModal
          locations={locations}
          onSave={handleCreateEvents}
          onClose={() => setShowDateModal(false)}
          isPending={createEvents.isPending}
        />
      )}
    </div>
  )
}
