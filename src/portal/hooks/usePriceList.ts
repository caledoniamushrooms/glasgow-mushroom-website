import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PriceGroup, PriceTier, WholesaleThreshold, VolumeDiscount } from '../lib/types'

/** Fetch all product prices across all tiers, grouped by product */
export function usePriceList() {
  const tiersQuery = usePriceTiers()
  const tiers = tiersQuery.data || []

  const pricesQuery = useQuery({
    queryKey: ['price-list-all'],
    queryFn: async (): Promise<PriceGroup[]> => {
      const { data, error } = await supabase
        .from('product_prices')
        .select(`
          price_per_kg,
          products!inner(strain, base_price_per_kg, active),
          product_types!inner(name, price_multiplier),
          price_tiers!inner(name)
        `)
        .eq('products.active', true)

      if (error) throw error

      // Group by product → grade → tier
      const productMap = new Map<string, PriceGroup>()

      for (const row of data || []) {
        const productName = (row as any).products.strain
        const basePrice = (row as any).products.base_price_per_kg
        const gradeName = (row as any).product_types.name
        const multiplier = (row as any).product_types.price_multiplier
        const tierName = (row as any).price_tiers.name
        const price = (row as any).price_per_kg

        let group = productMap.get(productName)
        if (!group) {
          group = { product_name: productName, base_price: basePrice, grades: [] }
          productMap.set(productName, group)
        }

        let grade = group.grades.find(g => g.grade_name === gradeName)
        if (!grade) {
          grade = { grade_name: gradeName, multiplier, tiers: {} }
          group.grades.push(grade)
        }

        grade.tiers[tierName] = price
      }

      // Sort products alphabetically, grades by multiplier descending (A+ first), free items last
      const groups = Array.from(productMap.values()).sort((a, b) =>
        a.product_name.localeCompare(b.product_name)
      )
      for (const group of groups) {
        group.grades.sort((a, b) => {
          const aFree = Object.values(a.tiers).every(p => p === 0)
          const bFree = Object.values(b.tiers).every(p => p === 0)
          if (aFree && !bFree) return 1
          if (!aFree && bFree) return -1
          return b.multiplier - a.multiplier
        })
      }

      return groups
    },
  })

  const thresholdsQuery = useQuery({
    queryKey: ['wholesale-thresholds'],
    queryFn: async (): Promise<WholesaleThreshold[]> => {
      const { data, error } = await supabase
        .from('wholesale_thresholds')
        .select('min_quantity_kg, products(strain)')

      if (error) throw error
      return (data || []).map((row: any) => ({
        product_name: row.products.strain,
        min_quantity_kg: row.min_quantity_kg,
      })).sort((a: WholesaleThreshold, b: WholesaleThreshold) =>
        a.product_name.localeCompare(b.product_name)
      )
    },
  })

  const volumeDiscountsQuery = useQuery({
    queryKey: ['volume-discounts'],
    queryFn: async (): Promise<VolumeDiscount[]> => {
      const { data, error } = await supabase
        .from('volume_discounts')
        .select('min_quantity, discount_percent, products(strain), price_tiers(name, display_name)')
        .eq('active', true)

      if (error) throw error
      return (data || []).map((row: any) => ({
        product_name: row.products?.strain || null,
        tier_name: row.price_tiers.name,
        tier_display_name: row.price_tiers.display_name,
        min_quantity: row.min_quantity,
        discount_percent: row.discount_percent,
      })).sort((a: VolumeDiscount, b: VolumeDiscount) =>
        a.min_quantity - b.min_quantity
      )
    },
  })

  return {
    grouped: pricesQuery.data || [],
    tiers,
    wholesaleThresholds: thresholdsQuery.data || [],
    volumeDiscounts: volumeDiscountsQuery.data || [],
    loading: pricesQuery.isLoading || tiersQuery.isLoading,
    error: pricesQuery.error || tiersQuery.error,
  }
}

export function usePriceTiers() {
  return useQuery({
    queryKey: ['price-tiers'],
    queryFn: async (): Promise<PriceTier[]> => {
      const { data, error } = await supabase
        .from('price_tiers')
        .select('id, name, display_name, multiplier')
        .order('sort_order')

      if (error) throw error
      return data || []
    },
  })
}
