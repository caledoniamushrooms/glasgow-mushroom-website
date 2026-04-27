# Trade Portal — Customer Onboarding

## Overview

The Trade Portal provides wholesale customers with self-service access to a modular set of features. Each customer's portal experience is configured by GMC admins, who enable or disable individual modules per customer. This document describes the module system, onboarding flows, and admin capabilities.

---

## Modules

Portal features are organised into modules. Admins toggle modules per customer from the admin dashboard. Customers only see navigation and functionality for their enabled modules.

| Module | Key | Description |
|--------|-----|-------------|
| **Dashboard** | `dashboard` | Overview widgets — adapts to show only widgets for other enabled modules |
| **Pricing** | `pricing` | Wholesale prices, volume discounts, price list PDF download |
| **Ordering** | `ordering` | Place, amend, and cancel one-off orders; view order history |
| **Recurring Orders** | `recurring_orders` | Manage standing orders, pause/resume, view upcoming schedule |
| **Accounts** | `accounts` | Invoices, outstanding balances, payment history, online payments |
| **Delivery Notes** | `delivery_notes` | Access delivery notes |
| **Promotions** | `promotions` | View active promotions and offers |
| **Team** | `team` | Invite and manage team members, assign roles |
| **Stockouts** | `stockouts` | Report urgent restock requests |

### Always-on (not modules)

- **Profile** — every customer can view and update their business details and delivery address
- **Markets** — system_admin only; manages market locations and events

### Admin customer view

The admin dashboard includes a customer management screen with a row per customer and a column per module. Admins toggle modules on/off via checkboxes. Changes take effect immediately.

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Manager** | Access to enabled modules + invite/manage team members |
| **Team Member** | Access to enabled modules — cannot invite others |

Managers can promote team members to manager status if needed.

---

## Onboarding Flow: Existing Customers

Existing GMC customers are onboarded by invitation.

```
1. GMC admin sends invite email with unique login link
2. Customer clicks link → lands on password creation page
3. Customer creates password (passkey option available)
4. Admin enables modules for the customer
5. Account active → customer can use enabled modules
```

### Steps

1. **Receive Invitation**
   Customer receives email with a secure, time-limited link.

2. **Create Password**
   First login prompts password creation. Passkey authentication is offered as an alternative.

3. **Module Configuration**
   Admin enables the appropriate modules for the customer from the admin dashboard.

4. **Start Using**
   Account is immediately active. Customer sees only their enabled modules.

---

## Onboarding Flow: New Customers

New customers self-register and require GMC approval before gaining access.

```
1. Customer requests login via public registration form
2. GMC reviews registration in admin portal
3. GMC clicks "Confirm & Create Account"
4. Admin enables modules for the customer
5. Customer receives email with login link
6. Customer creates password (same as existing customer flow)
7. Account active → customer can use enabled modules
```

### Steps

1. **Request Login**
   New customer visits the Trade Portal and submits a registration request.

2. **Review Onboarding Information**
   During registration, the customer is informed of:
   - Account registration process
   - **Fulfilment options:**
     - Delivery (if within delivery zone)
     - Collection
     - Courier
   - Free sample request option
   - Wholesale price list access
   - Order process overview
   - Weekly invoicing terms

3. **GMC Approval**
   Registration appears in the Admin Portal. A GMC operator reviews the request and clicks **"Confirm & Create Account"**.

4. **Module Configuration**
   Admin enables the appropriate modules for the new customer.

5. **Account Creation Email**
   Customer receives an email with their login link.

6. **Create Password**
   Customer clicks the link and creates their password (passkey option available) — identical to the existing customer flow.

7. **Start Using**
   Account is active. Customer sees only their enabled modules.

---

## Order Flow (Post-Onboarding)

Once onboarded (and with the `ordering` module enabled), customers follow this order lifecycle:

```
requested → pending → confirmed → dispatched → delivered
```

| Status | Description |
|--------|-------------|
| **Requested** | Customer submits order via Trade Portal |
| **Pending** | Order appears in Odin for GMC review |
| **Confirmed** | GMC commits to fulfilling the order |
| **Dispatched** | Order out for delivery/ready for collection |
| **Delivered** | Complete |

---

## Development Rollout

The portal is built in three phases:

### Phase 1 — Admin Dashboard
- Customer management screen (list customers, toggle modules)
- Review and approve new registration requests
- Invite existing customers

### Phase 2 — Customer Dashboard
- Module-aware navigation (only show enabled modules)
- Profile (always-on)
- Dashboard module (widgets adapt to enabled modules)

### Phase 3 — Customer Modules
Build each module independently:
1. `pricing` — price list, volume discounts, PDF download
2. `ordering` — new orders, order management, history
3. `recurring_orders` — standing orders, schedule
4. `accounts` — invoices, payments, balances
5. `delivery_notes` — delivery note access
6. `promotions` — active offers
7. `team` — team member management
8. `stockouts` — restock requests

---

## Admin Portal Features (GMC)

- Customer overview with per-module toggles
- Review and approve new registrations
- Invite existing customers
- Track customer activity and usage
- Create, amend, and remove promotions
- Manage pending and recurring orders
- Confirm or adjust orders based on production capacity
