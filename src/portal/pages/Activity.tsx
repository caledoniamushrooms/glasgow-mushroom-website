import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authedFetch } from '../lib/authedFetch'
import { useAuthContext } from '../components/AuthProvider'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

type Granularity = 'hour' | 'day'

interface TimePoint {
  bucket: string
  page: number
  listing: number
}
interface RankItem {
  id: string
  name: string
  views: number
}
interface ActivityData {
  granularity: Granularity
  timeseries: TimePoint[]
  ranking: RankItem[]
}

const PAGE_COLOR = '#009689' // brand teal — page (traffic)
const LISTING_COLOR = '#6366f1' // indigo — listing (engagement)
const RANK_LIMIT = 15

// Buckets are London-local naive timestamps. Axis ticks are short
// (time when hourly, date when daily); the tooltip shows the full label.
function formatBucket(iso: string, granularity: Granularity) {
  const d = new Date(iso)
  return granularity === 'hour'
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatBucketFull(iso: string, granularity: Granularity) {
  const d = new Date(iso)
  return granularity === 'hour'
    ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
}

function truncate(s: string, n = 16) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function Activity() {
  const { isSystemAdmin } = useAuthContext()
  const [mode, setMode] = useState<'nominal' | 'cumulative'>('nominal')

  const query = useQuery({
    queryKey: ['admin-asset-activity'],
    enabled: isSystemAdmin,
    queryFn: async (): Promise<ActivityData> => {
      const res = await authedFetch('/api/asset-activity')
      if (!res.ok) {
        const r = await res.json().catch(() => ({}))
        throw new Error(r.error || 'Failed to load activity.')
      }
      return res.json()
    },
  })

  const timeseries = query.data?.timeseries ?? []
  const ranking = query.data?.ranking ?? []
  const granularity: Granularity = query.data?.granularity ?? 'day'

  // Cumulative mode = running total of each series.
  const lineData = useMemo(() => {
    if (mode === 'nominal') return timeseries
    let page = 0
    let listing = 0
    return timeseries.map((p) => {
      page += p.page
      listing += p.listing
      return { bucket: p.bucket, page, listing }
    })
  }, [timeseries, mode])

  const rankData = useMemo(() => ranking.slice(0, RANK_LIMIT), [ranking])

  const totals = useMemo(
    () => ({
      page: timeseries.reduce((s, p) => s + p.page, 0),
      listing: timeseries.reduce((s, p) => s + p.listing, 0),
    }),
    [timeseries],
  )

  const hasData = timeseries.length > 0 || ranking.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          How visitors are engaging with the equipment sale page.
        </p>
      </div>

      {query.isError ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-red-700">
            {(query.error as Error).message || 'Failed to load activity.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.isLoading ? (
        <div className="space-y-6">
          <div className="h-80 bg-gray-100 animate-pulse rounded-xl" />
          <div className="h-80 bg-gray-100 animate-pulse rounded-xl" />
        </div>
      ) : !hasData ? (
        <div className="text-center text-gray-500 py-16">
          No activity yet — views will appear here as people browse the equipment sale page.
        </div>
      ) : (
        <>
          {/* Views over time */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Views over time</CardTitle>
                <CardDescription>
                  {totals.page} page view{totals.page === 1 ? '' : 's'} ·{' '}
                  {totals.listing} listing view{totals.listing === 1 ? '' : 's'}
                </CardDescription>
              </div>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'nominal' | 'cumulative')}>
                <TabsList>
                  <TabsTrigger value="nominal">Nominal</TabsTrigger>
                  <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={lineData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => formatBucket(v as string, granularity)}
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip labelFormatter={(l) => formatBucketFull(l as string, granularity)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="page"
                    name="Page views"
                    stroke={PAGE_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="listing"
                    name="Listing views"
                    stroke={LISTING_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Most-viewed items */}
          <Card>
            <CardHeader>
              <CardTitle>Most-viewed items</CardTitle>
              <CardDescription>
                {ranking.length > RANK_LIMIT
                  ? `Top ${RANK_LIMIT} of ${ranking.length} listings by view count`
                  : 'Listings ranked by view count'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rankData.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No item views yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={rankData} margin={{ top: 8, right: 16, bottom: 72, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickFormatter={(v) => truncate(v as string)}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={72}
                      tick={{ fontSize: 11 }}
                      stroke="#9ca3af"
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="views" name="Views" fill={PAGE_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
