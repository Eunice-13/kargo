# KARGO Mobile Responsiveness Fix

Fix mobile responsiveness across the KARGO app (React + Vite + Tailwind CSS, a pasabuy order fulfillment platform). Target breakpoints: **375px** (iPhone SE) and **390px** (iPhone 14), tested with dev tools device emulation. Goal: **zero horizontal scroll** on any page's main content at these widths, with every table-based view converted to a usable card layout.

## Ground rules (read first)

- These are **additive mobile overrides** — desktop layouts (≥620px) must remain pixel-identical to their current state. Don't refactor or restyle anything for desktop.
- Standard breakpoints to use throughout: `max-width: 620px` (general phone breakpoint) and `max-width: 480px` (very small phones, and specifically for modal width).
- Prefer Tailwind responsive prefixes (`max-sm:`, custom breakpoint if configured) for simple utility changes; use plain CSS media queries in `src/index.css` for structural changes (table→card swaps, grid restructuring) where JSX conditionals or Tailwind alone would get unwieldy.
- If a component needs to render fundamentally different markup on mobile vs desktop (e.g., table vs. cards), prefer a **CSS-only approach** (render both, toggle visibility with `hidden`/`block` at the breakpoint) over JS-based viewport detection, unless the component is complex enough that duplicating markup would be messy — then use a `useMediaQuery`-style hook if one already exists in the codebase, or create a minimal one.
- Every clickable/tappable element (buttons, icons, tab items, links, toggle switches) must have a minimum **44×44px** hit area — this can be achieved via padding even if the visible icon/text is smaller.
- Keep existing colors, fonts, border-radius, shadows, and general visual language exactly as-is — this is a responsive layout pass, not a redesign.
- Don't change any data-fetching, business logic, event handlers, or prop signatures — only markup structure and styling.

## File-by-file requirements

### 1. `src/components/layout/Header.tsx`

- Horizontal padding: `px-3` (12px) under 620px (down from whatever desktop uses).
- Gap between header items: `gap-2` (8px) under 620px.
- Hide the "KARGO" wordmark text under 620px — keep only the logo icon visible (use `hidden sm:inline` or equivalent, don't literally delete the text from markup in case desktop needs it back).
- Brand lockup container: change from a fixed `w-[160px]` (or whatever fixed width currently exists) to `w-auto` under 620px so it doesn't force overflow once the text is hidden.
- Notification bell icon and user menu avatar/button: ensure each has at least 44×44px tappable area (add padding around the icon if the icon itself is smaller — don't just enlarge the icon visually).
- Wrap these changes in a `max-width: 620px` media query (in CSS) or equivalent Tailwind breakpoint.

### 2. `src/components/layout/TabBar.tsx`

- Under 620px: each tab shows icon **above** label (flex-col, centered), not icon-only or side-by-side.
- Each tab: `min-width: ~80px` so all 4 tabs fit within 375px viewport without wrapping or overflow — calculate actual value based on total available width (375px minus any container padding) divided by 4, with small gaps.
- Icon size: 20px under 620px (down from desktop size).
- Tab label font size: keep readable, roughly 10–11px, don't let it wrap to two lines if avoidable (use `whitespace-nowrap` or shorten labels if they're long, and flag if any label doesn't fit even at small font size).
- Position: `sticky`, `top: 3.5rem` (56px, i.e. `top-14`), sitting directly below the header with no gap or overlap.
- Each tab button: `min-height: 48px` for the full tappable button (icon + label combined), not just the icon.
- Active tab indicator (underline or highlight) should still render correctly in the stacked icon+label layout — don't lose it.
- Wrap in `max-width: 620px` media query.

### 3. `src/components/layout/Footer.tsx`

- Under 620px: all column sections (About, Customer Service, Follow Us, etc.) stack vertically, full width, one after another.
- Text alignment: center-aligned under 620px (currently likely left-aligned per-column).
- Reduce top/bottom and side padding proportionally so the footer doesn't feel oversized relative to a phone screen.
- Preserve all links/icons and their existing functionality — only restack visually.

### 4. `src/features/dashboard/Dashboard.tsx`

*(Handle both buyer and seller dashboard variants if they're different components/sections within this file.)*

- **Stats grid:** 1 column under 480px (currently likely 2 or 4 columns). Each stat card: reduce internal padding, stack its icon/number/label vertically if not already, and ensure long numbers/labels wrap or truncate rather than overflowing the card edge.
- **Recent Claims/Orders table → cards under 620px:** For each row, render a card containing: product name (with thumbnail if one exists in the current table), seller name, amount, status badge (keep existing badge colors/styles), and deadline/countdown. Cards should be full-width, stacked vertically, with consistent spacing (e.g., `space-y-2` or `gap-2`).
- **Upcoming Deadlines sidebar:** on desktop this is presumably a side column — under 620px it must move to render **below** the main content area (not beside it), full width, in normal document flow. Verify this doesn't break if the sidebar currently uses absolute/fixed positioning — convert to normal flow with a media query if so.
- **Fulfillment Board (as embedded in Dashboard):** columns collapse to a single vertical column under 620px instead of horizontal scroll — see item 8 below for full detail, same logic applies here if the board is rendered inline on the dashboard.
- **Seller dashboard specifically:** every section (summary cards, tables, sidebars) stacks in a single vertical column under 620px, in the same logical top-to-bottom order as desktop; any tables in this view also convert to cards per the pattern above.

### 5. `src/features/batches/Batches.tsx`

- Grid: 3 columns (desktop) → 1 column under 620px.
- Batch card image: fixed height of 100px under 620px (down from whatever desktop uses) — use `object-cover` or equivalent to avoid distortion.
- Card text (title, seller, date, claimed progress): ensure `overflow: hidden` / `text-overflow: ellipsis` or wrapping as appropriate so nothing spills outside the card boundary.
- Filter bar: dropdowns/selects stack vertically (one per row) under 620px, each full-width.
- "Browse Sellers" (or equivalent CTA) button: full-width under 620px.

### 6. `src/features/claims/MyClaims.tsx`

*(This file apparently covers both the buyer's claims view and a seller-facing "Orders" section — handle both.)*

- **Buyer view:** table → cards under 620px. Each card shows: product, batch name, seller, amount, status, deadline, and the existing action buttons (pay/cancel/etc.).
- **Seller "Orders" section (same file):** table → cards under 620px. Each card shows: buyer, product, amount, status, and existing action buttons (confirm/reject/etc.).
- **Filter buttons/pills** (status filters like "All," "Pending," "Paid," etc.): under 620px, either make them full-width stacked, or wrap onto multiple lines with consistent spacing — pick whichever fits better given how many filter options currently exist (note which approach was used). For the seller-side filter pills specifically, horizontal scroll (with `overflow-x: auto` and `white-space: nowrap`) is preferred over wrapping if there are many pills, to save vertical space.
- **View mode toggle** (table/card switch, if one exists): hide entirely under 620px, and force the default render mode to card view regardless of the toggle's stored state on mobile.
- **Action buttons** on each card: full-width if there's only one action, or stacked/full-width if there are multiple (avoid cramming multiple small buttons side-by-side on a narrow card).

### 7. `src/features/payments/Payments.tsx`

- Table → cards under 620px for both payment history and any pending-payments view.
- Payment history card fields: product, payment method, amount, date, status badge.
- Pending payment cards: ensure they stack cleanly with no overlapping content, and any inline "pay now"/action buttons remain fully tappable (44×44px minimum) and readable.

### 8. `src/features/fulfillment/` (board components)

*(Likely a Kanban-style board used on the seller dashboard and/or its own page.)*

- Under 620px: columns (Pending Payment, Payment Confirmed, Preparing, Completed, Cancelled, etc.) render as a **single vertical list** instead of horizontally scrolling side-by-side columns.
- Each column becomes a **collapsible section** (e.g., a header with the column name + count that expands/collapses its cards on tap) — use a simple `useState`-driven collapse per section, defaulting to expanded unless there's an existing collapse pattern in the codebase to reuse.
- Reduce padding on the individual cards within each column under 620px so more fits without excessive scrolling.

### 9. `src/index.css`

Add a clearly-commented mobile section at the end of the file (e.g. `/* ===== Mobile Overrides ===== */`) containing:

- Modal width override: under 480px, all modals get `width: calc(100vw - 24px)` with appropriate centering, so they never touch the viewport edges or overflow.
- Font-size reduction for dense data displays (tables-turned-cards, stat numbers, etc.) under 620px — reduce moderately but **never below 12px** for any text node.
- A global rule enforcing minimum 44×44px on common interactive selectors (buttons, `a` tags used as buttons, icon-only controls) — scoped carefully so it doesn't distort unrelated inline elements.
- Safe-area padding using `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, etc. applied to the outermost app container or fixed/sticky elements (header, tab bar, bottom nav if any) so content isn't obscured by notches/home indicators on modern phones.

## Testing / verification checklist

Perform before finishing, and report results:

- Load every modified page at exactly **375px** and **390px** width and confirm:
  - No horizontal scrollbar appears on the page body or any inner container.
  - No text is clipped, overlapping, or overflowing its container.
  - Every table-based view now renders as cards with all the same data fields as before, nothing dropped.
  - All buttons/icons/tabs are comfortably tappable (visually confirm adequate spacing, not just technically 44px).
- Load the same pages at desktop width (≥1280px) and confirm they are **visually unchanged** from before this change — no accidental regressions.
- If any component structure made a clean table→card conversion difficult (e.g., deeply nested table logic, virtualization, etc.), stop and describe the difficulty rather than shipping a broken/partial conversion.
