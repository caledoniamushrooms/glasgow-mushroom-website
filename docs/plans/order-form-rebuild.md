# Plan: Portal Customer Order Form — Phase 1

## Context

The current `NewOrder.tsx` is a basic add-item form with no pricing engine, no multi-grade support, no fruiting blocks, and no recurring order integration. We're rebuilding it to match Odin's `CreateSaleModal.jsx` — a product table with all products pre-loaded, grade selectors, multi-grade lines, server-side pricing, fruiting blocks, and a "make recurring" checkbox.

Phase 2 (later): draft persistence, edit mode, order restrictions, consignment display.

---

## Scope — What's In Phase 1

| Feature | Source | Notes |
|---------|--------|-------|
| Product table (all products, qty=0 default) | Odin | Core form structure |
| Grade selector per row | Odin | Filtered by `visible_grades` module config |
| Multi-grade rows (add/remove) | Odin | "+" on primary, "×" on secondary |
| Quantity validation (round to 0.005) | Odin | Three-function pattern: change/focus/blur |
| Server-side pricing (`resolveSalePricing`) | Odin | Debounced 300ms, called on mount + qty/grade change |
| Price + discount note display | Odin | Purple text for promotions |
| Fruiting blocks line-builder | Odin | For eligible customers only |
| "Make recurring" checkbox + options | Odin | Replaces standalone recurring orders form |
| Branch selector, date picker | Existing | DatePicker with delivery day constraints |
| Customer notes | Existing | Textarea |
| Total display | Odin | Sum of all subtotals |

**Dropped (portal doesn't need):** customer selector only.

---

## Design Decisions

1. **No new DB columns** — store `final_price` in existing `estimated_price` on `portal_order_items`. Pricing metadata is display-only in component state.

2. **Grade filtering** — `getModuleConfig('ordering').visible_grades` → fallback `getModuleConfig('pricing').visible_grades` → all grades.

3. **Pricing on mount** — customer is always known, call immediately.

4. **Edge function auth** — uses `SUPABASE_SERVICE_ROLE_KEY` internally, any authenticated caller works.

5. **Fruiting blocks data** — `block_formats` and `block_prices` tables already have permissive RLS (`authenticated` can SELECT). Portal just needs queries added. `fruiting_blocks_eligible` on `customers` table already exists, just not queried by portal.

6. **Recurring orders** — the `recurring_order_items` table already has `product_id` + `product_type_id` + `quantity`. The portal hook (`useRecurringOrders.ts`) was only using `product_type_id` — we'll update it.

7. **RecurringOrderOptions** — Odin's version uses shadcn RadioGroup/Checkbox which the portal doesn't have. We'll rewrite it as a portal component using plain HTML + Tailwind (matching portal conventions).

---

## Files to Change

### 1. `src/portal/lib/supabase.ts` — add `resolveSalePricing` wrapper

Export function calling `supabase.functions.invoke('resolve-sale-pricing', { body })`. Mirrors Odin's `supabase-client.js:2522`. Includes `block_items` param for fruiting blocks.

```
Input:  { customerId, items: [{product_id, product_type_id, quantity}], blockItems?: [{product_id, block_format_id, quantity}], date? }
Output: { items: [{product_id, product_type_id, catalogue_price, final_price, discount_percent, discount_note, applied_price_tier_id}], block_items?: [...] }
```

### 2. `src/portal/components/ui/date-picker.tsx` — add `disabled` prop

Add `disabled?: (date: Date) => boolean` to `DatePickerProps`, forward to `<Calendar>`. Calendar already spreads `...props` to DayPicker which natively supports `disabled`.

### 3. `src/portal/lib/types.ts` — add block types + update Customer

- Add `BlockFormat` interface: `{ id, name, weight_kg, active }`
- Add `BlockPrice` interface: `{ product_id, price_tier_id, price_per_kg }`
- Add `fruiting_blocks_eligible?: boolean` to `Customer` interface

### 4. `src/portal/hooks/useCustomer.ts` — query `fruiting_blocks_eligible`

Add `fruiting_blocks_eligible` to the customer select query so the form knows whether to show the blocks section.

### 5. `src/portal/hooks/useOrders.ts` — add block data queries

Add TanStack Query hooks for:
- `block_formats` (active only)
- `block_prices`

These are needed by the fruiting blocks line-builder. Return from hook alongside existing products/productTypes.

### 6. `src/portal/hooks/useRecurringOrders.ts` — update create mutation

Update `createRecurring` to accept `product_id` + `product_type_id` per item (not just `product_type_id`). The DB table already has the `product_id` column.

### 7. `src/portal/components/RecurringOrderOptions.tsx` — new component

Port of Odin's `RecurringOrderOptions.jsx` rewritten with plain HTML + Tailwind:
- Day-of-week toggle buttons (same UI as Odin)
- End condition: radio inputs for indefinite / until date / after N occurrences
- Uses portal's `DatePicker` component for end date
- Plain `<input type="number">` for occurrences

Props: `{ selectedDays, onDaysChange, endType, onEndTypeChange, endDate, onEndDateChange, occurrences, onOccurrencesChange }`

### 8. `src/portal/pages/NewOrder.tsx` — full rewrite

**State:**
```
saleItems: SaleItem[]        // {_lineId, _isPrimary, product_id, productName, product_type_id, quantity, catalogue_price, final_price, subtotal, discount_note}
blockItems: BlockItem[]      // {_lineId, product_id, strain, block_format_id, format_name, format_weight_kg, quantity, price_per_kg, cost_per_block, subtotal}
blockDraft: {product_id, block_format_id, quantity}  // line-builder input state
branchId: string
requestedDate: Date | undefined
customerNotes: string
editingQuantities: Record<number, string>   // raw decimal input per lineId
pricingLoading: boolean
error: string | null
isRecurring: boolean
recurringDays: number[]
recurringEndType: 'indefinite' | 'until_date' | 'after_count'
recurringEndDate: Date | null
recurringOccurrences: number | null
```

**Init (on mount):**
1. Products, productTypes, blockFormats, blockPrices from `useOrders()`
2. Branches, deliverySchedules from `useCustomer()` — includes `fruiting_blocks_eligible`
3. Filter productTypes by `visible_grades` config
4. Build initial saleItems: one row per active product, default grade "A Class", qty=0
5. Auto-select branch if only one non-company branch
6. `useEffect` calls `resolveSalePricing` when customerId + products ready

**Product table handlers (ports from Odin):**
- Quantity: `handleQuantityInputChange` / `handleQuantityInputFocus` / `handleQuantityInputBlur` (Odin:708–729)
- Grade change: `handleProductTypeChange` (Odin:735–742)
- Add grade line: `handleAddGradeLine` (Odin:796–829)
- Remove grade line: `handleRemoveGradeLine` (Odin:831–833)
- Debounced pricing: `triggerPricingUpdate` / `fetchPricing` with 300ms debounce + `saleItemsRef` (Odin:447–516)

**Fruiting blocks handlers (ports from Odin):**
- `handleAddBlockLine`: validates draft, creates BlockItem, calls pricing (Odin:754–779)
- `handleDeleteBlockLine`: removes by lineId (Odin:781–783)
- `handleEditBlockLine`: moves item back to draft inputs (Odin:785–793)
- Block pricing: included in the `resolveSalePricing` call via `blockItems` param

**Date picker:**
`<DatePicker>` with `disabled` function: blocks dates before tomorrow + dates whose `getDay()` is not in delivery schedule.

**Recurring order section:**
- Checkbox "Make this a recurring order" (only shown for new orders)
- When checked, renders `<RecurringOrderOptions>` component
- On submit with `isRecurring`, creates both a portal_order AND a recurring_order

**Layout:**
```
<header> "New Order" + subtitle
<delivery days banner>
<form max-w-3xl>
  <error banner>
  <top row: branch selector | date picker>

  <product table>
    <thead: Product | Grade | Qty (kg) | Price (£/kg) | Subtotal | action>
    <tbody: saleItems rows>
      Primary: product name | grade <select> | qty input | £price + discount note | £subtotal | "+" button
      Secondary: "↳ name" | grade <select> | qty input | £price | £subtotal | "×" button
      Active (qty>0): bg-green-50/50 | Inactive: opacity-70

  <fruiting blocks section> (if customer eligible)
    <line-builder: strain select → format select → qty input → "+" button>
    <block items table: Strain | Format | Qty | Cost/Block | Subtotal | edit/delete>

  <recurring order checkbox + RecurringOrderOptions>

  <total> right-aligned bold
  <notes textarea>
  <submit + cancel buttons>
</form>
```

**Submit handler:**
1. Validate: ≥1 item with qty > 0, branch selected (if multiple), date on allowed day
2. Validate recurring: if isRecurring, ≥1 day selected, valid end condition
3. Filter items to qty > 0
4. Insert portal_order + portal_order_items (with `estimated_price` = `final_price`)
5. If isRecurring: also create recurring_order + recurring_order_items via `createRecurring`
6. Navigate to `/portal/orders`

### 9. `src/portal/pages/RecurringOrders.tsx` — remove create form

Remove the inline create form from RecurringOrders page. Keep the list/manage view (viewing active recurring orders, pause, cancel). Creating recurring orders now happens only via the "Make recurring" checkbox on the order form.

### 10. Portal navigation — remove standalone recurring create route (if separate)

Check if there's a separate route for recurring order creation. If the create form was inline in RecurringOrders.tsx (which it is), just removing the form section is sufficient.

---

## Implementation Order

1. `supabase.ts` — pricing wrapper (independent)
2. `date-picker.tsx` — disabled prop (independent)
3. `types.ts` — block types + customer update (independent)
4. `useCustomer.ts` — add `fruiting_blocks_eligible` to query (independent)
5. `useOrders.ts` — add block format/price queries (independent)
6. `useRecurringOrders.ts` — update create mutation for `product_id` (independent)
7. `RecurringOrderOptions.tsx` — new component (independent)
8. `NewOrder.tsx` — full rewrite (depends on all above)
9. `RecurringOrders.tsx` — remove create form (after 8)

Steps 1–7 are all independent and can be done in any order. Step 8 is the bulk of the work.

---

## Verification

1. `npm run dev` → `/portal/orders/new`
2. Product table loads with prices from edge function
3. Change qty → subtotal updates, price may adjust after debounce
4. Change grade → price updates
5. Multi-grade: "+" adds row, "×" removes, used grades disabled
6. Grade filtering: only `visible_grades` from module config shown
7. Fruiting blocks: section shows for eligible customers, line-builder works, pricing integrates
8. Recurring: checkbox + options appear, submit creates both portal_order and recurring_order
9. Date picker: only delivery days selectable
10. Submit: creates portal_order + portal_order_items with estimated_price
11. `npm run build` passes
