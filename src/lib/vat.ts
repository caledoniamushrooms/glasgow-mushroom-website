export const VAT_RATE = 0.20

export function priceIncVat(exVatPrice: number, isZeroRated: boolean): number {
  if (isZeroRated) return exVatPrice
  return Math.round(exVatPrice * (1 + VAT_RATE) * 100) / 100
}

export function formatGBP(n: number): string {
  const opts = Number.isInteger(n)
    ? undefined
    : ({ minimumFractionDigits: 2, maximumFractionDigits: 2 } as const)
  return `£${n.toLocaleString('en-GB', opts)}`
}
