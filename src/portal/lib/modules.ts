export const MODULE_KEYS = [
  'dashboard',
  'pricing',
  'ordering',
  'recurring_orders',
  'accounts',
  'delivery_notes',
  'promotions',
  'team',
  'stockouts',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

/** Maps module keys to their display labels */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  pricing: 'Price List',
  ordering: 'Orders',
  recurring_orders: 'Recurring Orders',
  accounts: 'Accounts',
  delivery_notes: 'Delivery Notes',
  promotions: 'Promotions',
  team: 'Team',
  stockouts: 'Stockouts',
}
