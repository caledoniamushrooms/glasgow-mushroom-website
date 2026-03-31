# Trade Portal — Customer Onboarding

## Overview

The Trade Portal provides wholesale customers with self-service access to order management, account history, pricing, and promotions. This document describes the onboarding flows for both existing and new customers.

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Manager** | Full portal access + invite/manage team members |
| **Team Member** | Full portal access — cannot invite others |

Managers can promote team members to manager status if needed.

---

## Onboarding Flow: Existing Customers

Existing GMC customers are onboarded by invitation.

```
1. GMC admin sends invite email with unique login link
2. Customer clicks link → lands on password creation page
3. Customer creates password (passkey option available)
4. Account active → customer can use the portal
```

### Steps

1. **Receive Invitation**  
   Customer receives email with a secure, time-limited link.

2. **Create Password**  
   First login prompts password creation. Passkey authentication is offered as an alternative.

3. **Start Using**  
   Account is immediately active. Customer can place orders, view history, check prices, etc.

---

## Onboarding Flow: New Customers

New customers self-register and require GMC approval before gaining access.

```
1. Customer requests login via public registration form
2. GMC reviews registration in admin portal
3. GMC clicks "Confirm & Create Account"
4. Customer receives email with login link
5. Customer creates password (same as existing customer flow)
6. Account active → customer can use the portal
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

4. **Account Creation Email**  
   Customer receives an email with their login link.

5. **Create Password**  
   Customer clicks the link and creates their password (passkey option available) — identical to the existing customer flow.

6. **Start Using**  
   Account is active. Customer rejoins the standard portal experience.

---

## Order Flow (Post-Onboarding)

Once onboarded, customers follow this order lifecycle:

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

## Portal Features (Customer)

- Place new orders (one-off or recurring)
- Amend pending orders
- Manage recurring orders
- Report stockouts (urgent restock requests)
- View order history
- View payment history
- View account history
- Access delivery notes
- Check wholesale prices and discounts
- View active promotions

---

## Admin Portal Features (GMC)

- Customer overview and management
- Review and approve new registrations
- Track customer activity and usage
- Create, amend, and remove promotions
- Manage pending and recurring orders
- Confirm or adjust orders based on production capacity
