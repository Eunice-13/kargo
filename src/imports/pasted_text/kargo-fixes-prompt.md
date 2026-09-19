# Figma Make Prompt: KARGO — Consistency & Functionality Fixes

## Context
This is a **refinement prompt** for the existing KARGO app, not a redesign. The visual theme, color palette, typography, and existing component library are final — do not touch them except where explicitly instructed below. This prompt only fixes the specific bugs and gaps listed.

## DO NOT CHANGE (preserve exactly as-is)
- Color palette: Indigo `#191BA9` (primary/brand), Cream `#F7F3F3` (background), Cyan `#DEF3FA`, Sky `#5CC2F2`, Coral/Pink `#C81E62` (claim CTA), Live Red `#E11D2E`, Green `#3FBF8F`, Amber `#FFC24B`
- Typography: headings/buttons in "Plus Jakarta Sans", body text in "Inter"
- Existing components: Card, PrimaryBtn, SecondaryBtn, Toggle, StatusBadge, Avatar, ProductThumb, Countdown
- The existing Buyer/Seller role toggle

Reuse existing components for every fix below rather than inventing new visual styles.

---

## 1. Remove the Reports tab **[Shared]**
- Remove "Reports" from the main tab bar for **both Buyer and Seller** roles.
- Remove the Reports screen/route entirely.
- Do NOT remove the per-transaction "Report this Shop/Buyer" modal (the one used from Seller Profile / Orders) — that stays. Only the standalone **Reports tab and its list screen** are removed.
- Double-check nothing else still links into the Reports tab (e.g. any "View All" or notification shortcut) — repoint or remove those references.

## 2. Payment Verification — inconsistent action buttons **[Seller]**
**Problem:** In the Payment Verification screen's "Actions" column, the buttons mix different styles and sizes — a standard SecondaryBtn ("Review"), a small PrimaryBtn ("Confirm"), a plain text-only link button ("Reject"), and a custom pill button with its own padding ("Insufficient" / "Notify Buyer"). They don't align, aren't the same height, and aren't evenly spaced.

**Fix:**
- Rebuild the Actions column so every button in that row (Review, Confirm, Reject, Mark Insufficient, Notify Buyer) uses the **same button component, same height, same border-radius, and same font size**, laid out with equal gaps (flex row, equal gap, no button relying on its own custom padding).
- Keep the same semantic colors (Confirm = brand indigo fill, Reject = red/outline, Insufficient/Notify = amber), just standardize size/shape/spacing so it reads as one consistent button group, not four different button types.
- Apply the same fix to the buttons inside the "Payment Submission Details" modal (Confirm Payment / Reject) — these should also match this same consistent button treatment.

## 3. Remove all LIVE tags **[Shared]**
Remove the "LIVE" badge (red pill with pulsing dot) everywhere it currently appears, including:
- Dashboard → Recent Claims table (batch column)
- Batches grid cards (top-left and top-right corner overlays, both Buyer and Seller view)
- Batch detail page hero header
- Seller Search results
- Seller Profile modal → Active Batches cards
Audit the whole app for this badge and delete every instance — don't leave it partially removed in only some screens.

## 4. Make the search bar functional **[Shared]**
**Problem:** The header search box currently only shows two fake canned suggestions ("{query} batch" / "{query} product") and a static note, "Full search coming soon — use Browse Sellers for sellers."
**Fix:**
- Wire the search input to actually filter and return real results from: batch titles, product names, and seller/shop names.
- Show results grouped by type (Batches / Products / Sellers) in the dropdown, live-updating as the user types.
- Clicking a result navigates to the correct screen (batch → its detail page, product → the batch it belongs to, seller → Seller Profile).
- Remove the "coming soon" placeholder copy entirely once this is wired up.

## 5. Batch item claim card — make it consistent everywhere **[Buyer]**
**Reference:** the attached screenshot ("Items in this Batch") is the canonical style: each item is its own row/card with thumbnail, name, "X/Y claimed" (+ "Sold Out" / "Only N left!" status pill), price on the right, and a full-width action button — filled pink/coral "Claim this Item" when available, filled indigo "Join Waitlist" when sold out.

**Problem:** This exact row style exists in the main Batches tab batch-detail page, but a second, different implementation is used when a buyer reaches a batch through **Find Sellers → Seller Profile → View Products**: there, the expanded product rows show only the price and an availability label — there is **no Claim / Join Waitlist button on the item row at all**. There is also a third, older/unused item-row style with an outline-style "Join Waitlist" button that doesn't match either.

**Fix:**
- Make the Seller Profile "View Products" expanded rows use the **exact same item-row component** as the main Batches tab (same thumbnail/name/status-pill layout, same "Claim this Item" / "Join Waitlist" buttons, same colors and sizing).
- Retire the old outline-button item-row variant so there is only **one** item-row component used across the whole app, regardless of entry point (Batches tab or Find Sellers).

## 6. Batch items should stay hidden until the batch is tapped **[Shared]**
Confirm and enforce everywhere: a batch card (in the Batches grid, in Seller Profile's Active Batches list, anywhere a batch is shown as a summary card) shows only summary info (thumbnail/emoji, title, seller, claimed/total, % progress) — never the individual item list inline. The item list only appears after the user explicitly taps into the batch ("View Items" / "View Products →"). Audit all batch card instances so none pre-expand or leak the item list before that tap.

## 7. My Claims (Buyer) and Payments (Seller) — even, consistent buttons **[Shared]**
**Problem:** Row/card actions in both My Claims (Buyer) and Payments (Seller side) mix standard PrimaryBtn/SecondaryBtn components with one-off custom `<button>` elements (e.g. "Cancel", the "···" overflow button) that use different padding, height, and font size than the rest of the row — so buttons in the same row don't line up or match visually.

**Fix:**
- In every row (table row and card view) across My Claims and Payments, use one consistent button size/height/shape for all actions in that row, with equal spacing between them (equal flex-gap, not ad-hoc margins).
- This includes: Pay Now, Request Extension, View Order, Cancel, and the overflow "···" control in My Claims; and Confirm, Reject, Insufficient, Notify Buyer, Mark Shipped, Contact Buyer in Payments/Orders Received.
- Same rule for card view (grid) as for table view — actions row should look identical in structure between the two view modes.

## 8. Fulfillment Board — make it tappable/expandable, not a dead board **[Seller]**
**Problem:** The Fulfillment Board (shown both on the Seller Dashboard and as its own standalone screen) is a static Kanban of order cards — nothing on it is clickable.

**Fix:**
- Each order card inside the Fulfillment Board should be tappable to **expand in place** (accordion/inline expand, or a lightweight popover/modal anchored to the card) showing the order's full details — buyer, item, qty, amount, and a status-change control.
- **Important distinction from other Dashboard cards:** the Dashboard's other cards/rows (e.g. "Recent Claims" rows, "Payments to Verify" / "Extension Requests" in Pending Actions) correctly **navigate to their connected tab** on click (My Claims, Payments) — keep that behavior unchanged. The Fulfillment Board is different: it's a standalone card with no single tab it belongs to, so its cards should **expand in place** rather than redirect anywhere.

## 9. Batch creation — dates should be set, not typed **[Seller]**
**Problem:** The "Trip Dates" field in the New Batch form is a free-text input (placeholder "e.g. Oct 5–15, 2026") that the seller has to type manually.
**Fix:** Replace it with a real date picker (calendar popover, start date + end date) so the seller selects the dates rather than typing a string. Store/display the resulting range in the same "Oct 5–15, 2026" style format used elsewhere in the app.

## 10. Base Price + Markup → system-computed Selling Price **[Seller]**
Confirm/preserve this existing behavior (do not change): in the New Batch item table, the seller enters **Base Price (₱)** and **Markup (₱)** per item; the **Selling Price** column is read-only and computed automatically as `Base Price + Markup`. This is already correct — just make sure it isn't affected by the changes in section 11 below.

## 11. Batch Financial Summary — dedupe, relocate, and make it a mixed input/computed panel **[Seller]**
**Problem:** The New Batch form currently renders **two separate, fully-duplicated** "Batch Financial Summary" blocks (one conditional, one always-visible), and in both, every figure (Total Orders Amount, Total Expenses, Estimated Tax, Estimated Profit) is fully auto-computed from the item table — the seller has no way to enter their own expense or tax figures.

**Fix:**
- **Remove the duplicate** — there should be only one Financial Summary panel.
- **Move it out of the New Batch creation form.** Instead, add a **"📊 Batch Financial Summary" button** in the Batches tab (Seller view) — per batch — that opens this summary as its own panel/modal.
- Rebuild the panel with these four rows, split into computed vs. editable exactly as follows:
  - **Total Orders Amount (₱)** — *system-computed, read-only* = `Selling Price (Base Price + Markup) × Qty`, summed across all items in the batch.
  - **Total Expenses (₱)** — *editable input field*, seller types this number in directly.
  - **Estimated Tax (12%) (₱)** — *editable input field*, seller types this number in directly (no longer auto-calculated as 12% of orders).
  - **Estimated Profit (₱)** — *system-computed, read-only* = `Total Orders Amount − Total Expenses − Estimated Tax`, recalculating live as the seller edits the two input fields above.
- Keep the small italic disclaimer text underneath ("This is just a prediction/estimate… actual results may change once all items are paid, shipped, and finalized.").

---

## General Instruction
Every fix above should reuse existing components (Card, PrimaryBtn, SecondaryBtn, StatusBadge, Toggle, Modal) with only layout, wiring, and visibility logic changed — nothing here should shift the app's established visual language.