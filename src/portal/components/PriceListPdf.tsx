import { Buffer } from 'buffer'
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { PriceGroup, WholesaleThreshold, VolumeDiscount } from '../lib/types'

Font.register({
  family: 'Abhaya Libre',
  src: 'https://fonts.gstatic.com/s/abhayalibre/v18/e3t5euGtX-Co5MNzeAOqinEYx2zyqg.ttf',
  fontWeight: 700,
})

/*
 * PDF styles — matching Odin's shadcn/ui table appearance
 *
 * Key values from Odin:
 * - Font: system-ui → Helvetica (closest PDF built-in)
 * - Text: 14px / 20px line-height → 10pt in PDF
 * - Border: 1px solid #e5e5e5
 * - Muted text: 12px #737373 → 7.5pt #737373
 * - Foreground: #0a0a0a
 * - TH: height 40px, padding 0 8px, font-weight 500, no background
 * - TD: padding 8px
 * - Price TD: padding 4px, text-center, font-weight 400
 * - No alternating row colours
 * - No coloured header bar
 */

const border = '#e5e5e5'
const muted = '#737373'
const foreground = '#0a0a0a'
const green = '#1a6b35'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    color: foreground,
  },
  // Header with logo
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottom: `2px solid ${green}`,
    paddingBottom: 14,
  },
  logo: { width: 150, height: 62 },
  headerRight: { alignItems: 'flex-end' },
  title: {
    fontFamily: 'Abhaya Libre',
    fontSize: 22,
    fontWeight: 700,
    color: green,
  },
  tierName: { fontSize: 12, color: '#555', marginTop: 8 },
  date: { fontSize: 8, color: muted, marginTop: 6 },

  // Table container — matches Odin's rounded-md border (1px solid #e5e5e5)
  tableWrap: {
    border: `1px solid ${border}`,
    borderRadius: 4,
    marginTop: 8,
  },

  // TH row — border-bottom matching Odin (1px solid #e5e5e5)
  tableHeader: {
    flexDirection: 'row',
    borderBottom: `1px solid ${border}`,
    paddingVertical: 0,
    minHeight: 28,
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: foreground,
    paddingHorizontal: 6,
  },

  // Product group — no extra styling, just rows
  productGroup: {},

  // TR — border-bottom matching Odin (1px solid #e5e5e5 on every row)
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1px solid ${border}`,
    minHeight: 24,
    alignItems: 'center',
  },
  tableRowLast: {
    borderBottom: 'none',
  },
  // Same weight between product groups (Odin uses consistent 1px throughout)
  productGroupBorder: {
    borderBottom: `1px solid ${border}`,
  },

  // Column widths
  colProduct: { width: '35%', paddingHorizontal: 6 },
  colGrade: { width: '30%', paddingHorizontal: 6 },
  colPrice: { width: '35%', paddingHorizontal: 4 },

  // Product name — font-medium
  productName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: foreground,
  },
  // Base price — text-xs text-muted-foreground mt-1
  productBase: {
    fontSize: 7.5,
    color: muted,
    marginTop: 2,
  },

  // Grade
  gradeName: {
    fontSize: 10,
    color: foreground,
  },
  gradeMultiplier: {
    fontSize: 7.5,
    color: muted,
  },

  // Price — text-center, regular weight
  priceText: {
    fontSize: 10,
    textAlign: 'right',
    color: foreground,
  },

  // Section headings
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: foreground,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 8,
    color: muted,
    marginBottom: 8,
  },
  section: {
    marginTop: 20,
  },
  // Simple table row for thresholds/discounts
  simpleRow: {
    flexDirection: 'row',
    borderBottom: `1px solid ${border}`,
    minHeight: 22,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  simpleCell: {
    fontSize: 9,
    color: foreground,
    paddingHorizontal: 4,
  },
  simpleCellMuted: {
    fontSize: 9,
    color: muted,
    paddingHorizontal: 4,
  },

  // Footer
  footer: {
    marginTop: 'auto',
    borderTop: `1px solid ${green}`,
    paddingTop: 10,
  },
  footerBold: {
    fontSize: 7,
    color: '#555',
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  footerText: {
    fontSize: 7,
    color: muted,
    textAlign: 'center',
    lineHeight: 1.6,
  },
})

interface TierInfo {
  key: string
  displayName: string
}

interface PriceListPdfProps {
  grouped: PriceGroup[]
  tiers: TierInfo[]
  generatedDate: string
  wholesaleThresholds?: WholesaleThreshold[]
  volumeDiscounts?: VolumeDiscount[]
}

export function PriceListPdf({ grouped, tiers, generatedDate, wholesaleThresholds = [], volumeDiscounts = [] }: PriceListPdfProps) {
  const logoUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/images/logo-full.png`
  const tierLabel = tiers.map(t => t.displayName).join(', ')
  const multiTier = tiers.length > 1

  // Dynamic column widths based on number of tiers
  const productWidth = multiTier ? '30%' : '35%'
  const gradeWidth = multiTier ? '20%' : '30%'
  const priceWidth = multiTier ? `${50 / tiers.length}%` : '35%'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image style={styles.logo} src={logoUrl} />
          <View style={styles.headerRight}>
            <Text style={styles.title}>Price List</Text>
            <Text style={styles.tierName}>{tierLabel} Pricing</Text>
            <Text style={styles.date}>{generatedDate}</Text>
          </View>
        </View>

        <View style={styles.tableWrap}>
          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { width: productWidth, paddingHorizontal: 6 }]}>Product</Text>
            <Text style={[styles.tableHeaderText, { width: gradeWidth, paddingHorizontal: 6 }]}>Grade</Text>
            {tiers.map(tier => (
              <Text key={tier.key} style={[styles.tableHeaderText, { width: priceWidth, paddingHorizontal: 4, textAlign: 'right' }]}>
                {multiTier ? tier.displayName : 'Price / kg'}
              </Text>
            ))}
          </View>

          {/* Rows */}
          {grouped.map((group, gi) => {
            const isLastGroup = gi === grouped.length - 1
            return (
              <View key={group.product_name} wrap={false} style={!isLastGroup ? styles.productGroupBorder : undefined}>
                {group.grades.map((grade, gradeIdx) => {
                  const isLastRow = isLastGroup && gradeIdx === group.grades.length - 1
                  return (
                    <View
                      key={`${group.product_name}-${grade.grade_name}`}
                      style={[styles.tableRow, isLastRow ? styles.tableRowLast : {}]}
                    >
                      <View style={{ width: productWidth, paddingHorizontal: 6 }}>
                        {gradeIdx === 0 ? (
                          <Text style={styles.productName}>{group.product_name}</Text>
                        ) : (
                          <Text> </Text>
                        )}
                      </View>
                      <View style={{ width: gradeWidth, paddingHorizontal: 6 }}>
                        <Text style={styles.gradeName}>{grade.grade_name}</Text>
                      </View>
                      {tiers.map(tier => (
                        <Text key={tier.key} style={[{ width: priceWidth, paddingHorizontal: 4 }, styles.priceText]}>
                          £{(grade.tiers[tier.key] || 0).toFixed(2)}
                        </Text>
                      ))}
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>

        {/* Wholesale thresholds */}
        {wholesaleThresholds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wholesale Qualification</Text>
            <Text style={styles.sectionDesc}>
              Commercial customers ordering above these quantities qualify for wholesale pricing.
            </Text>
            <View style={styles.tableWrap}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { width: '40%', paddingHorizontal: 6 }]}>Product</Text>
                <Text style={[styles.tableHeaderText, { width: '30%', paddingHorizontal: 6 }]}>Minimum Order</Text>
                <Text style={[styles.tableHeaderText, { width: '30%', paddingHorizontal: 6 }]}>Effect</Text>
              </View>
              {wholesaleThresholds.map((t, i) => (
                <View key={i} style={[styles.simpleRow, i === wholesaleThresholds.length - 1 ? { borderBottom: 'none' } : {}]}>
                  <Text style={[styles.simpleCell, { width: '40%', fontFamily: 'Helvetica-Bold' }]}>{t.product_name}</Text>
                  <Text style={[styles.simpleCell, { width: '30%' }]}>{t.min_quantity_kg}kg</Text>
                  <Text style={[styles.simpleCellMuted, { width: '30%' }]}>Commercial → Wholesale</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Volume discounts */}
        {volumeDiscounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Volume Discounts</Text>
            <Text style={styles.sectionDesc}>
              Additional percentage discounts applied when ordering above the specified quantity.
            </Text>
            <View style={styles.tableWrap}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { width: '25%', paddingHorizontal: 6 }]}>Tier</Text>
                <Text style={[styles.tableHeaderText, { width: '30%', paddingHorizontal: 6 }]}>Product</Text>
                <Text style={[styles.tableHeaderText, { width: '25%', paddingHorizontal: 6 }]}>Min Quantity</Text>
                <Text style={[styles.tableHeaderText, { width: '20%', paddingHorizontal: 6 }]}>Discount</Text>
              </View>
              {volumeDiscounts.map((d, i) => (
                <View key={i} style={[styles.simpleRow, i === volumeDiscounts.length - 1 ? { borderBottom: 'none' } : {}]}>
                  <Text style={[styles.simpleCell, { width: '25%' }]}>{d.tier_display_name}</Text>
                  <Text style={[styles.simpleCell, { width: '30%' }]}>{d.product_name || 'All products'}</Text>
                  <Text style={[styles.simpleCell, { width: '25%' }]}>{d.min_quantity}kg</Text>
                  <Text style={[styles.simpleCell, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>{d.discount_percent}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerBold}>Glasgow Mushroom Company</Text>
          <Text style={styles.footerText}>glasgowmushroomcompany.co.uk</Text>
          <Text style={styles.footerText}>
            Prices valid as of {generatedDate}. Prices are estimates and may be adjusted at confirmation. Contact us for volume discounts.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
