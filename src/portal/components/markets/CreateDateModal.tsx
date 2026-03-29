import { useState, useMemo, type FormEvent } from 'react'
import type { MarketLocation } from '../../lib/types'

interface CreateDateModalProps {
  locations: MarketLocation[]
  onSave: (events: { market_location_id: string; date: string; start_time: string; end_time: string }[]) => Promise<void>
  onClose: () => void
  isPending: boolean
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function generateRecurringDates(startDate: Date, dayOfWeek: number, occurrences: number): Date[] {
  const dates: Date[] = []
  const current = new Date(startDate)
  // Advance to the first occurrence of the target day
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1)
  }
  for (let i = 0; i < occurrences; i++) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 7)
  }
  return dates
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function CreateDateModal({ locations, onSave, onClose, isPending }: CreateDateModalProps) {
  const [step, setStep] = useState<'configure' | 'preview'>('configure')
  const [locationId, setLocationId] = useState(locations[0]?.id || '')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('15:00')
  const [repeat, setRepeat] = useState(false)
  const [dayOfWeek, setDayOfWeek] = useState(6) // Saturday
  const [occurrences, setOccurrences] = useState(4)
  const [checkedDates, setCheckedDates] = useState<Record<string, boolean>>({})

  const selectedLocation = locations.find(l => l.id === locationId)

  const generatedDates = useMemo(() => {
    if (!startDate) return []
    const base = new Date(startDate + 'T00:00:00')
    if (isNaN(base.getTime())) return []

    if (!repeat) return [base]
    return generateRecurringDates(base, dayOfWeek, occurrences)
  }, [startDate, repeat, dayOfWeek, occurrences])

  const handlePreview = (e: FormEvent) => {
    e.preventDefault()
    if (!generatedDates.length) return
    // Initialise all dates as checked
    const initial: Record<string, boolean> = {}
    for (const d of generatedDates) {
      initial[formatDate(d)] = true
    }
    setCheckedDates(initial)
    setStep('preview')
  }

  const toggleDate = (dateStr: string) => {
    setCheckedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }))
  }

  const selectedCount = Object.values(checkedDates).filter(Boolean).length

  const handleCreate = async () => {
    const events = Object.entries(checkedDates)
      .filter(([, checked]) => checked)
      .map(([date]) => ({
        market_location_id: locationId,
        date,
        start_time: startTime,
        end_time: endTime,
      }))
    await onSave(events)
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Add Market Dates</h2>
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

        {step === 'configure' ? (
          <form onSubmit={handlePreview} className="p-5 grid gap-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                required
                className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  required
                  className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  required
                  className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={repeat}
                onChange={e => setRepeat(e.target.checked)}
                className="rounded border-input"
              />
              <span className="font-medium">Repeat</span>
            </label>

            {repeat && (
              <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-border">
                <div>
                  <label className="block text-sm font-medium mb-1">Day</label>
                  <select
                    value={dayOfWeek}
                    onChange={e => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
                  >
                    {DAYS.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Occurrences</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={occurrences}
                    onChange={e => setOccurrences(Number(e.target.value))}
                    className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-white odin-focus"
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={!startDate || !locationId}
                className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm cursor-pointer font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Preview Dates
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 flex flex-col gap-4 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedLocation?.name}</span>
              {' '}— {generatedDates.length} date{generatedDates.length !== 1 ? 's' : ''} generated
            </p>

            <div className="grid gap-1">
              {generatedDates.map(d => {
                const key = formatDate(d)
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checkedDates[key] ?? false}
                      onChange={() => toggleDate(key)}
                      className="rounded border-input"
                    />
                    <span className="font-medium">{formatDateLabel(d)}</span>
                    <span className="text-muted-foreground ml-auto">{startTime} – {endTime}</span>
                  </label>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground">Uncheck any dates you want to skip.</p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('configure')}
                className="bg-transparent border border-border px-4 py-2 rounded-md text-sm cursor-pointer text-muted-foreground hover:bg-accent transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || selectedCount === 0}
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm cursor-pointer font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? 'Creating...' : `Create ${selectedCount} Date${selectedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
