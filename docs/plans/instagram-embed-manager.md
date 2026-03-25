# Instagram Embed Manager — Implementation Plan

## Context

The Glasgow Mushroom Company website needs an Instagram feed section at the bottom of the home page. Rather than using a third-party widget (costly, view-limited) or the Instagram Graph API (token maintenance, no curation control), we'll let admin users manually paste Instagram embed URLs via the portal. Posts appear immediately on the website as a horizontally scrollable slider.

---

## How It Works

1. Admin logs into the customer portal (`/portal/login`)
2. Navigates to an "Instagram Feed" management section (admin-only)
3. Pastes an Instagram post URL (e.g. `https://www.instagram.com/p/ABC123/`)
4. Post is saved to Supabase and immediately appears in the slider on `/home`
5. Below the input, admin sees all saved posts — can drag to reorder or delete
6. The website fetches posts from Supabase on each page load (SSR or client-side)

---

## Database

### New table: `instagram_embeds`

```sql
CREATE TABLE public.instagram_embeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,               -- Instagram post URL
    sort_order INTEGER NOT NULL,     -- Display order (lower = first)
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_instagram_embeds_order ON instagram_embeds(sort_order) WHERE active = true;
```

No RLS needed initially — the website reads these publicly, only staff/admin can write.

---

## Portal Changes (gmc-website)

### New page: `/portal/instagram` (admin-only)

**Components:**
- **URL input field** — paste Instagram post URL, click "Add Post"
- **Post list** — shows all active posts in current order with:
  - Thumbnail preview (rendered from Instagram oEmbed)
  - Drag handle for reordering
  - Delete button
- **Save order** button (or auto-save on drag)

**Files to create:**
- `src/portal/pages/InstagramManager.tsx` — the admin page
- `src/portal/hooks/useInstagramEmbeds.ts` — Supabase queries + mutations

**Route:** Add to `App.tsx` as admin-only route:
```tsx
<Route path="/portal/instagram" element={<ProtectedRoute requireAdmin><InstagramManager /></ProtectedRoute>} />
```

**Sidebar nav:** Add "Instagram" link (admin-only visibility)

### How embeds render

Instagram provides an oEmbed endpoint:
```
GET https://graph.facebook.com/v21.0/instagram_oembed?url={POST_URL}&access_token={APP_TOKEN}
```

This returns embed HTML. However, for simplicity we can use Instagram's client-side embed script (`//www.instagram.com/embed.js`) which auto-renders any `<blockquote class="instagram-media">` elements. No API token needed for this approach.

**Simpler alternative:** Just store the URL, render an `<iframe>` pointing to `https://www.instagram.com/p/{POST_ID}/embed/` — no script injection, works immediately, and is what Instagram's own embed code does under the hood.

---

## Home Page Changes (gmc-website)

### Replace the placeholder in the Instagram section

Currently:
```html
<section class="instagram-feed">
  <h2>Follow Us</h2>
  <p>Follow us on @glasgowmushroomco</p>
</section>
```

Replace with a horizontally scrollable slider that:
1. Fetches active posts from `instagram_embeds` ordered by `sort_order`
2. Renders each as an `<iframe>` embed
3. Horizontally scrollable on mobile (CSS `overflow-x: auto`, snap scrolling)
4. Shows 3-4 posts on desktop, 1.5 on mobile (peek effect)

**Approach:** Since the home page is Astro (not React), fetch from Supabase at request time using Astro's server-side capabilities, or use a small inline `<script>` that fetches and renders client-side.

**Recommended: Client-side fetch** — keeps the page statically cacheable, the Instagram section loads async after the main content.

```html
<section class="instagram-feed">
  <h2>Follow Us</h2>
  <div class="instagram-slider" id="instagram-slider">
    <!-- Populated by JS -->
  </div>
  <p><a href="https://www.instagram.com/glasgowmushroomco/">@glasgowmushroomco</a></p>
</section>

<script>
  // Fetch from Supabase, render iframes
</script>
```

### Slider CSS

```css
.instagram-slider {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding: 0 1.5rem;
}

.instagram-slider__item {
  flex: 0 0 280px;
  scroll-snap-align: start;
  border-radius: 8px;
  overflow: hidden;
}

.instagram-slider__item iframe {
  width: 280px;
  height: 350px;
  border: none;
}

@media (min-width: 768px) {
  .instagram-slider__item {
    flex: 0 0 320px;
  }
  .instagram-slider__item iframe {
    width: 320px;
    height: 400px;
  }
}
```

---

## Implementation Steps

### Step 1: Database
- Create `instagram_embeds` table in Supabase
- Add to Odin's `schema.sql`
- Seed with 3-4 initial posts for testing

### Step 2: Portal admin page
- Create `InstagramManager.tsx` with URL input + post list
- Create `useInstagramEmbeds.ts` hook (fetch, add, reorder, delete)
- Add route to `App.tsx` (admin-only)
- Add "Instagram" to sidebar nav (visible to admin role only)

### Step 3: Home page slider
- Update `home.astro` Instagram section with slider container
- Add inline script to fetch from Supabase and render `<iframe>` embeds
- Style the horizontal scroll slider with snap points
- Fallback: if no posts, show the existing "Follow us on @glasgowmushroomco" text

### Step 4: Polish
- Drag-to-reorder in the admin (use a lightweight sortable library or manual up/down buttons)
- Loading skeleton while iframes load
- Limit to max 8 posts (oldest auto-hidden if exceeded, or warn admin)

---

## Supabase Client Usage on Home Page

The home page is public Astro (no auth), so it reads from Supabase using the anon key. The `instagram_embeds` table needs a public SELECT policy:

```sql
CREATE POLICY "public_read_instagram_embeds" ON public.instagram_embeds
    FOR SELECT TO anon
    USING (active = true);
```

The portal admin writes using the authenticated user's session (staff role via JWT claims).

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/architecture/schema-history/044-instagram-embeds.sql` | Create | Migration for instagram_embeds table |
| `src/portal/pages/InstagramManager.tsx` | Create | Admin page for managing embeds |
| `src/portal/hooks/useInstagramEmbeds.ts` | Create | Supabase queries and mutations |
| `src/portal/App.tsx` | Modify | Add admin-only route |
| `src/portal/components/PortalLayout.tsx` | Modify | Add nav item (admin only) |
| `src/pages/home.astro` | Modify | Replace placeholder with slider |

---

## Verification

1. Admin logs into portal → sees "Instagram" in sidebar
2. Pastes a valid Instagram URL → post appears in the list
3. Refreshes `/home` → new post appears in the slider as an iframe embed
4. Reorders posts in admin → slider order updates on next page load
5. Deletes a post → disappears from slider
6. Non-admin portal users do not see the Instagram management section
