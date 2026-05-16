/**
 * Postcode outward codes Glasgow Mushroom can deliver to directly.
 * Anyone outside this set is offered distributor / collection / courier.
 *
 * Future work: move to a DB-backed table editable from /portal/admin.
 */
export const SERVICE_AREA_OUTWARDS = new Set<string>([
  'G1', 'G2', 'G3', 'G4', 'G5',
  'G11', 'G12', 'G13', 'G14', 'G15',
  'G20', 'G21', 'G22', 'G23',
  'G31', 'G32', 'G33', 'G34',
  'G40', 'G41', 'G42', 'G43', 'G44', 'G45', 'G46',
  'G51', 'G52', 'G53',
])

export function extractOutward(postcode: string): string {
  return postcode.trim().toUpperCase().split(/\s+/)[0] ?? ''
}

export function isInServiceArea(postcode: string): boolean {
  if (!postcode) return false
  return SERVICE_AREA_OUTWARDS.has(extractOutward(postcode))
}

/** Loose UK postcode validation — accepts G12 8XY, g12 8xy, G128XY. */
export function isValidUkPostcode(postcode: string): boolean {
  const cleaned = postcode.trim().replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)
}
