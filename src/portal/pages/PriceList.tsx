import { useState, useCallback, useMemo, Fragment } from 'react'
import { useAuthContext } from '../components/AuthProvider'
import { useCustomer } from '../hooks/useCustomer'
import { useViewAs } from '../components/ViewAsProvider'
import { usePriceList } from '../hooks/usePriceList'
import type { PriceGroup, PriceTier } from '../lib/types'

const tierConfig: Record<string, { label: string; color: string; icon: string }> = {
  retail: { label: 'Retail', color: 'text-blue-600', icon: '🛒' },
  commercial: { label: 'Commercial', color: 'text-amber-600', icon: '🏪' },
  wholesale: { label: 'Wholesale', color: 'text-green-600', icon: '🏭' },
}

export function PriceList() {
  const { isSystemAdmin } = useAuthContext()
  const { isViewingAs } = useViewAs()
  const showAllTiers = isSystemAdmin && !isViewingAs
  const { customer } = useCustomer()
  const { grouped, tiers, wholesaleThresholds, volumeDiscounts, loading, error } = usePriceList()
  const [generating, setGenerating] = useState(false)

  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set())
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set())

  const allProducts = useMemo(() => {
    const names = new Set<string>()
    grouped.forEach(g => names.add(g.product_name))
    return Array.from(names).sort()
  }, [grouped])

  const allGrades = useMemo(() => {
    const names = new Set<string>()
    grouped.forEach(g => g.grades.forEach(gr => names.add(gr.grade_name)))
    return Array.from(names)
  }, [grouped])

  const customerTierName = tiers.find(t => t.id === customer?.price_tier_id)?.name || null
  const visibleTiers: PriceTier[] = useMemo(() => {
    if (!showAllTiers) {
      return tiers.filter(t => t.name === customerTierName)
    }
    if (selectedTiers.size > 0) {
      return tiers.filter(t => selectedTiers.has(t.name))
    }
    return tiers
  }, [isSystemAdmin, tiers, customerTierName, selectedTiers])

  const filteredGroups: PriceGroup[] = useMemo(() => {
    let groups = showAllTiers
      ? grouped
      : grouped.map(g => ({
          ...g,
          grades: g.grades.filter(gr => {
            const price = customerTierName ? gr.tiers[customerTierName] : undefined
            return price !== undefined && price > 0
          }),
        })).filter(g => g.grades.length > 0)

    if (selectedProducts.size > 0) {
      groups = groups.filter(g => selectedProducts.has(g.product_name))
    }

    if (selectedGrades.size > 0) {
      groups = groups
        .map(g => ({
          ...g,
          grades: g.grades.filter(gr => selectedGrades.has(gr.grade_name)),
        }))
        .filter(g => g.grades.length > 0)
    }

    return groups
  }, [grouped, showAllTiers, customerTierName, selectedProducts, selectedGrades])

  const toggle = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  const clearFilters = () => {
    setSelectedTiers(new Set())
    setSelectedProducts(new Set())
    setSelectedGrades(new Set())
  }

  const hasFilters = selectedTiers.size > 0 || selectedProducts.size > 0 || selectedGrades.size > 0

  const handleDownloadPdf = useCallback(async () => {
    if (filteredGroups.length === 0 || visibleTiers.length === 0) return
    setGenerating(true)
    try {
      const [{ pdf }, { PriceListPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../components/PriceListPdf'),
      ])

      const today = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

      const pdfTiers = visibleTiers.map(t => ({ key: t.name, displayName: t.display_name }))

      const pdfGroups = filteredGroups.map(g => ({
        ...g,
        grades: g.grades.filter(gr =>
          visibleTiers.some(t => (gr.tiers[t.name] || 0) > 0)
        ),
      })).filter(g => g.grades.length > 0)

      const blob = await pdf(
        PriceListPdf({
          grouped: pdfGroups,
          tiers: pdfTiers,
          generatedDate: today,
          wholesaleThresholds: visibleTiers.some(t => t.name === 'commercial') ? wholesaleThresholds : [],
          volumeDiscounts: visibleTiers.some(t => t.name === 'commercial') ? volumeDiscounts : [],
        })
      ).toBlob()

      const tierFileLabel = visibleTiers.length === 1
        ? visibleTiers[0].display_name
        : 'All-Tiers'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `GMC-Price-List-${tierFileLabel}-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }, [filteredGroups, visibleTiers])

  return (
    <div>
      <header className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Price List</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {showAllTiers
              ? (visibleTiers.length === tiers.length
                  ? 'All pricing tiers'
                  : visibleTiers.map(t => t.display_name).join(', ') + ' pricing')
              : `${tiers.find(t => t.name === customerTierName)?.display_name || ''} pricing`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDownloadPdf}
            disabled={generating || loading || filteredGroups.length === 0}
          >
            {generating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </header>

      {/* Filters */}
      {!loading && grouped.length > 0 && (
        <div className="flex items-start gap-4 px-4 py-3 bg-slate-50 border border-border rounded-lg mb-4 flex-wrap">
          <svg className="text-muted-foreground shrink-0 mt-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>

          {showAllTiers && tiers.length > 0 && (
            <div className="flex items-start gap-2">
              <label className="text-sm font-medium text-foreground whitespace-nowrap mt-1">Tier:</label>
              <div className="flex flex-wrap gap-1">
                {tiers.map(tier => (
                  <button
                    key={tier.id}
                    className={`px-2.5 py-0.5 border rounded-md text-[13px] cursor-pointer whitespace-nowrap transition-all ${
                      selectedTiers.has(tier.name)
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-white text-foreground border-border hover:bg-muted'
                    }`}
                    onClick={() => toggle(selectedTiers, tier.name, setSelectedTiers)}
                  >
                    {tier.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <label className="text-sm font-medium text-foreground whitespace-nowrap mt-1">Product:</label>
            <div className="flex flex-wrap gap-1">
              {allProducts.map(name => (
                <button
                  key={name}
                  className={`px-2.5 py-0.5 border rounded-md text-[13px] cursor-pointer whitespace-nowrap transition-all ${
                    selectedProducts.has(name)
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-white text-foreground border-border hover:bg-muted'
                  }`}
                  onClick={() => toggle(selectedProducts, name, setSelectedProducts)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <label className="text-sm font-medium text-foreground whitespace-nowrap mt-1">Grade:</label>
            <div className="flex flex-wrap gap-1">
              {allGrades.map(name => (
                <button
                  key={name}
                  className={`px-2.5 py-0.5 border rounded-md text-[13px] cursor-pointer whitespace-nowrap transition-all ${
                    selectedGrades.has(name)
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-white text-foreground border-border hover:bg-muted'
                  }`}
                  onClick={() => toggle(selectedGrades, name, setSelectedGrades)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button className="px-2.5 py-0.5 bg-transparent border-none text-muted-foreground text-[13px] cursor-pointer whitespace-nowrap mt-0.5 hover:text-foreground" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="odin-empty">Loading prices...</div>
      ) : error ? (
        <div className="odin-empty">Failed to load prices.</div>
      ) : filteredGroups.length === 0 ? (
        <div className="odin-empty">
          {hasFilters ? 'No products match the selected filters.' : 'No products available.'}
        </div>
      ) : (
        <div className="w-full overflow-x-auto border border-foreground rounded-md">
          <table className="w-full border-collapse text-sm leading-5 text-foreground">
            <thead>
              <tr className="border-b border-foreground">
                <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Product</th>
                <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Grade</th>
                {visibleTiers.map(tier => {
                  const cfg = tierConfig[tier.name]
                  return (
                    <th key={tier.id} className={`h-10 px-2 text-center align-middle font-medium whitespace-nowrap ${cfg?.color || ''}`}>
                      {cfg?.icon} {tier.display_name}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group, groupIdx) => {
                const prevGroup = groupIdx > 0 ? filteredGroups[groupIdx - 1] : null
                const showLimitedSeparator = group.limited_availability && (!prevGroup || !prevGroup.limited_availability)
                return (
                  <Fragment key={group.product_name}>
                    {showLimitedSeparator && (
                      <tr>
                        <td colSpan={2 + visibleTiers.length} className="px-2 py-1.5 text-xs font-medium text-amber-600 bg-amber-50/50 border-y border-foreground">
                          Limited Availability
                        </td>
                      </tr>
                    )}
                    {group.grades.map((grade, gi) => (
                  <tr
                    key={`${group.product_name}-${grade.grade_name}`}
                    className={`border-b border-foreground last:border-b-0 hover:bg-muted/50 transition-colors ${gi === 0 ? 'border-t border-t-foreground/20' : ''}`}
                  >
                    {gi === 0 && (
                      <td className="p-2 align-top font-medium whitespace-nowrap" rowSpan={group.grades.length}>
                        {group.product_name}
                        {group.limited_availability && (
                          <span className="block text-xs text-amber-600 font-normal mt-0.5">Limited Availability</span>
                        )}
                      </td>
                    )}
                    <td className="p-2 align-middle whitespace-nowrap">
                      {grade.grade_name}
                    </td>
                    {visibleTiers.map(tier => (
                      <td key={tier.id} className="p-1 text-center align-middle whitespace-nowrap tabular-nums">
                        £{(grade.tiers[tier.name] || 0).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Wholesale thresholds */}
      {wholesaleThresholds.length > 0 && visibleTiers.some(t => t.name === 'commercial') && (
        <div className="mt-8">
          <h2 className="text-base font-medium text-foreground mb-1">Wholesale Qualification</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Commercial customers ordering above these quantities automatically qualify for wholesale pricing on that product.
          </p>
          <div className="w-full overflow-x-auto border border-foreground rounded-md">
            <table className="w-full border-collapse text-sm leading-5 text-foreground">
              <thead>
                <tr className="border-b border-foreground">
                  <th className="h-10 px-2 text-left align-middle font-medium">Product</th>
                  <th className="h-10 px-2 text-left align-middle font-medium">Minimum Order</th>
                  <th className="h-10 px-2 text-left align-middle font-medium">Effect</th>
                </tr>
              </thead>
              <tbody>
                {wholesaleThresholds.map(t => (
                  <tr key={t.product_name} className="border-b border-foreground last:border-b-0 hover:bg-muted/50 transition-colors">
                    <td className="p-2 font-medium">{t.product_name}</td>
                    <td className="p-2">{t.min_quantity_kg}kg</td>
                    <td className="p-2 text-muted-foreground">Commercial → Wholesale pricing</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Volume discounts */}
      {volumeDiscounts.length > 0 && visibleTiers.some(t => t.name === 'commercial') && (
        <div className="mt-8">
          <h2 className="text-base font-medium text-foreground mb-1">Volume Discounts</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Additional percentage discounts applied when ordering above the specified quantity.
          </p>
          <div className="w-full overflow-x-auto border border-foreground rounded-md">
            <table className="w-full border-collapse text-sm leading-5 text-foreground">
              <thead>
                <tr className="border-b border-foreground">
                  <th className="h-10 px-2 text-left align-middle font-medium">Tier</th>
                  <th className="h-10 px-2 text-left align-middle font-medium">Product</th>
                  <th className="h-10 px-2 text-left align-middle font-medium">Minimum Quantity</th>
                  <th className="h-10 px-2 text-left align-middle font-medium">Discount</th>
                </tr>
              </thead>
              <tbody>
                {volumeDiscounts.map((d, i) => (
                  <tr key={i} className="border-b border-foreground last:border-b-0 hover:bg-muted/50 transition-colors">
                    <td className="p-2">{d.tier_display_name}</td>
                    <td className="p-2">{d.product_name || 'All products'}</td>
                    <td className="p-2">{d.min_quantity}kg</td>
                    <td className="p-2 font-medium">{d.discount_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Prices are estimates and may be adjusted at confirmation. Contact us for volume discounts.
      </p>
    </div>
  )
}
