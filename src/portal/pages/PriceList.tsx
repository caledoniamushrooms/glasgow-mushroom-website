import { useState, useCallback, useMemo } from 'react'
import { useAuthContext } from '../components/AuthProvider'
import { useCustomer } from '../hooks/useCustomer'
import { usePriceList } from '../hooks/usePriceList'
import type { PriceGroup, PriceTier } from '../lib/types'
import './PriceList.css'

/** Tier display config matching Odin's colour scheme */
const tierConfig: Record<string, { label: string; color: string; icon: string }> = {
  retail: { label: 'Retail', color: 'var(--tier-retail, #2563eb)', icon: '🛒' },
  commercial: { label: 'Commercial', color: 'var(--tier-commercial, #d97706)', icon: '🏪' },
  wholesale: { label: 'Wholesale', color: 'var(--tier-wholesale, #16a34a)', icon: '🏭' },
}

export function PriceList() {
  const { isSystemAdmin } = useAuthContext()
  const { customer } = useCustomer()
  const { grouped, tiers, wholesaleThresholds, volumeDiscounts, loading, error } = usePriceList()
  const [generating, setGenerating] = useState(false)

  // Filters — all multi-select toggle
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set())
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set())

  // Derive available products and grades from data
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

  // Customer sees only their tier; system admin sees all (or filtered)
  const customerTierName = tiers.find(t => t.id === customer?.price_tier_id)?.name || null
  const visibleTiers: PriceTier[] = useMemo(() => {
    if (!isSystemAdmin) {
      return tiers.filter(t => t.name === customerTierName)
    }
    if (selectedTiers.size > 0) {
      return tiers.filter(t => selectedTiers.has(t.name))
    }
    return tiers
  }, [isSystemAdmin, tiers, customerTierName, selectedTiers])

  // Apply all filters
  const filteredGroups: PriceGroup[] = useMemo(() => {
    let groups = isSystemAdmin
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
  }, [grouped, isSystemAdmin, customerTierName, selectedProducts, selectedGrades])

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

      // Filter to grades that have non-zero prices in at least one visible tier
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
      <header className="price-list-header">
        <div>
          <h1>Price List</h1>
          <p>
            {isSystemAdmin
              ? (visibleTiers.length === tiers.length
                  ? 'All pricing tiers'
                  : visibleTiers.map(t => t.display_name).join(', ') + ' pricing')
              : `${tiers.find(t => t.name === customerTierName)?.display_name || ''} pricing`}
          </p>
        </div>

        <div className="price-list-controls">
          <button
            className="price-list-download-btn"
            onClick={handleDownloadPdf}
            disabled={generating || loading || filteredGroups.length === 0}
          >
            {generating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </header>

      {/* Filters */}
      {!loading && grouped.length > 0 && (
        <div className="price-list-filters">
          <svg className="filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>

          {isSystemAdmin && tiers.length > 0 && (
            <div className="filter-group">
              <label className="filter-label">Tier:</label>
              <div className="filter-chips">
                {tiers.map(tier => (
                  <button
                    key={tier.id}
                    className={`filter-chip ${selectedTiers.has(tier.name) ? 'filter-chip--active' : ''}`}
                    onClick={() => toggle(selectedTiers, tier.name, setSelectedTiers)}
                  >
                    {tier.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-group">
            <label className="filter-label">Product:</label>
            <div className="filter-chips">
              {allProducts.map(name => (
                <button
                  key={name}
                  className={`filter-chip ${selectedProducts.has(name) ? 'filter-chip--active' : ''}`}
                  onClick={() => toggle(selectedProducts, name, setSelectedProducts)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Grade:</label>
            <div className="filter-chips">
              {allGrades.map(name => (
                <button
                  key={name}
                  className={`filter-chip ${selectedGrades.has(name) ? 'filter-chip--active' : ''}`}
                  onClick={() => toggle(selectedGrades, name, setSelectedGrades)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button className="filter-clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="price-list-empty">Loading prices...</div>
      ) : error ? (
        <div className="price-list-empty">Failed to load prices.</div>
      ) : filteredGroups.length === 0 ? (
        <div className="price-list-empty">
          {hasFilters ? 'No products match the selected filters.' : 'No products available.'}
        </div>
      ) : (
        <div className="price-list-table-wrap">
          <table className="price-list-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Grade</th>
                {visibleTiers.map(tier => {
                  const cfg = tierConfig[tier.name]
                  return (
                    <th key={tier.id} className="text-center tier-header" style={{ color: cfg?.color }}>
                      {cfg?.icon} {tier.display_name}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) =>
                group.grades.map((grade, gi) => (
                  <tr
                    key={`${group.product_name}-${grade.grade_name}`}
                    className={gi === 0 ? 'product-first-row' : ''}
                  >
                    {gi === 0 && (
                      <td className="product-name-cell" rowSpan={group.grades.length}>
                        <div className="product-name">{group.product_name}</div>
                      </td>
                    )}
                    <td className="grade-cell">
                      <div className="grade-name">{grade.grade_name}</div>
                    </td>
                    {visibleTiers.map(tier => (
                      <td key={tier.id} className="text-center price-cell">
                        £{(grade.tiers[tier.name] || 0).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Wholesale thresholds — only relevant when commercial tier is visible */}
      {wholesaleThresholds.length > 0 && visibleTiers.some(t => t.name === 'commercial') && (
        <div className="price-list-section">
          <h2>Wholesale Qualification</h2>
          <p className="price-list-section-desc">
            Commercial customers ordering above these quantities automatically qualify for wholesale pricing on that product.
          </p>
          <div className="price-list-table-wrap">
            <table className="price-list-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Minimum Order</th>
                  <th>Effect</th>
                </tr>
              </thead>
              <tbody>
                {wholesaleThresholds.map(t => (
                  <tr key={t.product_name}>
                    <td className="product-name">{t.product_name}</td>
                    <td>{t.min_quantity_kg}kg</td>
                    <td style={{ color: '#737373' }}>Commercial → Wholesale pricing</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Volume discounts — only relevant when commercial tier is visible */}
      {volumeDiscounts.length > 0 && visibleTiers.some(t => t.name === 'commercial') && (
        <div className="price-list-section">
          <h2>Volume Discounts</h2>
          <p className="price-list-section-desc">
            Additional percentage discounts applied when ordering above the specified quantity.
          </p>
          <div className="price-list-table-wrap">
            <table className="price-list-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Product</th>
                  <th>Minimum Quantity</th>
                  <th>Discount</th>
                </tr>
              </thead>
              <tbody>
                {volumeDiscounts.map((d, i) => (
                  <tr key={i}>
                    <td>{d.tier_display_name}</td>
                    <td>{d.product_name || 'All products'}</td>
                    <td>{d.min_quantity}kg</td>
                    <td className="product-name">{d.discount_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="price-list-disclaimer">
        Prices are estimates and may be adjusted at confirmation. Contact us for volume discounts.
      </p>
    </div>
  )
}
