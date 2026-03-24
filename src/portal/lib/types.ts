/** Portal user linked to a customer account */
export interface PortalUser {
  id: string
  auth_user_id: string
  customer_id: string
  role: 'admin' | 'member'
  display_name: string
  email: string
  status: 'pending' | 'active' | 'suspended'
  last_login_at: string | null
  created_at: string
}

/** Customer record (subset visible to portal users) */
export interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  payment_terms: string | null
  payment_method: string | null
  transmission: string | null
  price_tier_id: string | null
  gocardless_mandate_status: string | null
}

/** Customer branch / delivery location */
export interface Branch {
  id: string
  customer_id: string
  name: string
  branch_type: string
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  postcode: string | null
  phone: string | null
  email: string | null
}

/** Invoice with calculated balance */
export interface Invoice {
  id: string
  invoice_no: string
  customer_id: string
  date: string
  total: number
  status: string
  pdf_url: string | null
  online_payment_url: string | null
  amount_due?: number
  total_paid?: number
}

/** Payment record */
export interface Payment {
  id: string
  customer_id: string
  invoice_id: string | null
  date: string
  amount: number
  method: string
  source: string
  status: string
  notes: string | null
}

/** Portal order (before becoming a sale) */
export interface PortalOrder {
  id: string
  customer_id: string
  branch_id: string | null
  portal_user_id: string
  requested_date: string
  actual_date: string | null
  status: 'submitted' | 'confirmed' | 'modified' | 'cancelled' | 'fulfilled'
  sale_id: string | null
  operator_notes: string | null
  customer_notes: string | null
  cancelled_by: 'customer' | 'operator' | null
  cancelled_reason: string | null
  modification_summary: string | null
  created_at: string
  items?: PortalOrderItem[]
}

/** Portal order line item */
export interface PortalOrderItem {
  id: string
  portal_order_id: string
  product_id: string
  product_type_id: string
  quantity: number
  estimated_price: number | null
  confirmed_price: number | null
}

/** Product for catalogue display */
export interface Product {
  id: string
  name: string
  strain: string | null
  active: boolean
}

/** Product type (quality grade) */
export interface ProductType {
  id: string
  name: string
  price_multiplier: number
}

/** Customer delivery schedule entry */
export interface DeliverySchedule {
  id: string
  customer_id: string
  branch_id: string | null
  day_of_week: number
  active: boolean
}
