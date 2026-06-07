export const VAT_RATE = 0.20

export function priceIncVat(exVatPrice: number, isZeroRated: boolean): number {
  if (isZeroRated) return exVatPrice
  return exVatPrice * (1 + VAT_RATE)
}
