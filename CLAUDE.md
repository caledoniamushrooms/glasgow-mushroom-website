# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:4321
npm run build      # Production build (outputs to dist/)
npm run preview    # Preview production build locally
```

No linting or test suite is configured.

## Architecture

This is an **Astro 6 static site** — a pixel-faithful clone of [glasgowmushroom.co](https://www.glasgowmushroom.co) (Webflow original), deployed on Vercel.

### Page routing

Astro uses file-based routing from `src/pages/`. The site has a two-level entry:

- `/` (`index.astro`) — splash screen with hero image and "Enter" link; no nav/footer
- `/home` (`home.astro`) — actual home page with hero, CTA banners, and Google Maps embed

All other pages (`/products`, `/recipes`, `/where-to-find-us`, `/direct-sales`, `/wholesale`, `/contact`, `/privacy-policy`) are standalone `.astro` files.

### Layout

`BaseLayout.astro` wraps every page. It injects `Header` and `Footer` (both toggleable via props), loads `global.css`, and pulls in the `Abhaya Libre` Google Font (used for all headings and nav links). The splash page disables both.

### Styling approach

All global design tokens (colours, fonts, spacing) live in CSS custom properties in `src/styles/global.css`. Component styles are scoped inside each `.astro` file's `<style>` block. There is no CSS framework or preprocessor.

Key tokens:
- `--color-bg: #040404` (near-black background throughout)
- `--font-heading: 'Abhaya Libre', serif`
- `--font-body: Arial, sans-serif`

### Data

Static content is plain JS arrays exported from `src/data/`:
- `products.js` — mushroom varieties with descriptions and tasting profiles
- `recipes.js` — recipe entries
- `stockists.js` — retail stockist locations
- `navigation.js` — nav items (supports nested `children` for the "Where to find us" dropdown)

### Google Maps

`home.astro` embeds a Google Maps JS API map with a dark custom style. The API key is a placeholder string `GOOGLE_MAPS_API_KEY` — replace with a real key before deploying.

### Trade Portal

The portal is a React SPA mounted at `/portal` using React Router, TanStack Query, Supabase, and Tailwind CSS. Source lives in `src/portal/`.

- **Spec:** `docs/trade-portal-onboarding.md` — onboarding flows, module definitions, rollout phases
- **Roadmap:** `docs/trade-portal-roadmap.md` — living document tracking build status of every component and module
- **Modules:** Portal features are organised into toggleable modules that admins enable per customer. See the spec for the full module list.
- **Implementation process:** Every module must start in plan mode. Produce a detailed implementation plan, get alignment, then build. Update the roadmap as work progresses.

### Visual reference

When making visual changes, compare against the live Webflow site at **glasgowmushroom.co** using Chrome DevTools MCP screenshots. Target breakpoints: 320px, 768px, 1024px, 1440px.

## Database Safety Rules

This project shares a Supabase database with the main Odin application. Changes to RLS policies, triggers, and FK constraints can break production for all users.

### RLS Helper Functions
- Any function used in RLS policies that queries an RLS-protected table MUST be `SECURITY DEFINER` with `SET search_path = public`
- Without SECURITY DEFINER, the function runs as the calling role, RLS policies on the queried table fire, and if any of those policies call the same function → infinite recursion (PostgreSQL error 54001:
stack depth limit exceeded)
- Example: `is_system_admin()` queries `portal_users`. The `portal_users` table has an RLS policy that calls `is_system_admin()`. Without SECURITY DEFINER this recurses infinitely and crashes ALL queries
across the entire app — not just portal queries
- `is_staff()` is safe because it only reads `auth.jwt()` (no table access)

### Pre-Push Migration Checklist
1. Does any new function query an RLS-protected table? → Must be SECURITY DEFINER
2. Does any new RLS policy call a function that queries the same table? → Recursion risk
3. Does any new FK create a cycle (A → B → C → A)? → Can break PostgREST
4. Test with `SET ROLE authenticated` before pushing to production
