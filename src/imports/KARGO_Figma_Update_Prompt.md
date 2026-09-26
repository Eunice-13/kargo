# Figma Prompt — KARGO Order Fulfillment Platform Updates

Paste everything below into Figma (Figma Make / First Draft). This describes changes to an **existing** pasabuy/order-fulfillment web app called KARGO. Keep the current design system — do not restyle what isn't mentioned here.

## Existing design system (keep consistent)
- Fonts: "Josefin Sans" (headings, bold labels, numbers) + "Inter" (body text).
- Primary color: Indigo `#191BA9`. Primary-tint background: `#EEF0FF`.
- Accent/brand pink-red (used for CTAs like "Claim this item"): magenta/crimson `#C81E62`-family.
- Neutrals: text `#111827` (headings), `#374151` (body), `#6B7280` (secondary), `#9CA3AF` (muted/placeholder).
- Warm background used on cards/callouts: cream `#FFFBF5` / `#FAFAFA`, borders `#E5E7EB`.
- Status colors: green success `#0B7A59` / `#D4F5EA`, amber warning `#92400E` / `#FFF7ED` / `#FCD34D`, red error `#EF4444` / `#FEE2E2`.
- Cards: white background, `1px solid #E5E7EB` border, radius ~8–9px, soft padding.
- Buttons: Primary = solid indigo/pink rounded-pill; Secondary = outline/gray rounded-pill.
- There's a fixed top navigation tab bar that stays pinned across all screens — every change below must keep this nav bar fixed at the top. (Its exact tab list changes per the updates below — see #3 and #10.)

---

## 1. "Search Seller" → convert from popup to a dedicated full-screen page

**Current state:** Clicking "Search Seller" opens a small centered modal listing sellers, and clicking "View Profile" opens another small modal showing a minimized/condensed seller profile with a horizontally-scrollable or truncated list of batches.

**New behavior:**
- Remove both modals. Replace with a **full-page seller directory + seller shop view**, occupying the entire content area below the fixed top nav (same as how Dashboard/Batches/etc. currently occupy that space) — not a floating dialog, not a drawer.
- **Step 1 — Seller Directory page:** full-width page with a search bar (search by shop name), filter chips (All / 4.5★+ / Has Active Batch), and a grid/list of seller cards (avatar, shop name, verified badge, rating, batch count, live-batch indicator). Clicking a seller opens their full shop page.
- **Step 2 — Seller Shop page (reference the attached screenshot for layout inspiration only — do not copy it exactly):**
  - Two-column full-page layout:
    - **Left (wider) column — "Available items":** a scrollable grid of ALL items across the seller's active batches, shown as full item cards (image placeholder, item name, price, reservation timer duration, "X left of Y" stock, prominent "Claim this item" button). This must NOT be a minimized/condensed view — every item is fully visible and claimable directly from this page, grouped by batch title as a section header above each batch's items.
    - **Right (narrower) column — Seller profile panel:** shop icon, shop name + verified badge, "Member since [date]", a linked social account callout (e.g., "Linked Facebook account — facebook.com/[handle]" with a disclaimer note that this is a credibility reference only, not a payment guarantee), and a trust stats row with 4 stat tiles: Completed, Cancelled, Incomplete, Disputes — plus a computed completion-rate sentence (e.g., "94% of this seller's tracked transactions reached Completed. These numbers come from recorded transactions, not self-reported ratings.").
  - Add a back button / breadcrumb ("← Back to Sellers") at the top of the shop page, below the fixed nav.
  - Page should scroll independently while the top nav bar stays fixed/sticky.

---

## 2. Base price + markup price per item when creating a batch → auto-computed selling price feeding a Batch Financial Summary (prediction)

**Current state:** "Create New Batch" modal has one price field per item (just "₱ price").

**New behavior:**
- In the "Create New Batch" form (and "Edit Batch" if it exists), replace the single price field per item row with **two input fields per item**:
  - **Base Price** (seller's cost per unit — what they paid/will pay abroad)
  - **Markup / Service Fee** (seller's added margin per unit — can be entered as a fixed ₱ amount or a % toggle)
  - Show a **read-only computed "Selling Price"** field next to them (Base Price + Markup), auto-updating live as the seller types.
- These per-item values roll up into a new **Batch Financial Summary** card/section (visible to the seller only — e.g., on the batch detail page or seller Dashboard), clearly labeled as a **prediction/estimate**, not a final figure. Example layout — a small summary card with 4 stacked rows:
  - Total amount ng orders: ₱15,000
  - Total expenses: ₱10,000
  - Estimated tax: ₱2,000
  - Estimated profit: ₱3,000
  - Below the numbers, add a small italic disclaimer: *"This is just a prediction/estimate based on current claims and item prices — actual results may change once all items are paid, shipped, and finalized."*
  - Add a second small note beneath it: *"Figures update automatically as buyers claim, cancel, or pay for items in this batch."*
- Total amount of orders = sum of (selling price × claimed qty) across the batch's items. Total expenses = sum of (base price × claimed qty, or × total qty — designer's choice, but should be labeled clearly). Estimated tax and estimated profit are computed values shown as separate line items, styled the same as the other financial rows (bold numbers, muted labels, right-aligned amounts).

---

## 3. Remove "Orders" tab → merge Fulfillment Board into Dashboard

**Current state:** Top nav has a separate "Orders" tab, and the seller's "Fulfillment Board" (a Kanban/board tracking orders across fulfillment stages) lives inside it.

**New behavior:**
- Remove "Orders" from the top nav tab bar entirely.
- Move the **Fulfillment Board** section (with its "Track all orders across fulfillment stages" board/columns) directly into the seller's **Dashboard** page, as a full-width section/card beneath the existing Dashboard stat tiles and panels.
- (See #10 below — "Settings" is also being removed from this nav bar, so after both changes the top nav tab bar becomes: **Dashboard, Batches, My Claims, Payments, Reports**.)

---

## 4. Remove seller manual "Reports on Your Orders" checking feature

**Current state:** Seller-side Reports page has a "Reports on Your Orders" panel where sellers manually file/track reports about buyer issues (separate from the buyer-facing "Filed Reports" list).

**New behavior:**
- Remove the "Reports on Your Orders" panel and its manual report-filing flow from the seller's Reports page entirely. The Reports page for sellers should no longer show this section (keep whatever buyer-facing dispute/report list already exists, if it's a separate flow — only remove the seller manual-check panel).

---

## 5. "Reply" (buyer request) and "Contact Buyer" (claims) → redirect to buyer's Facebook profile

**Current state:** In the seller Dashboard's "Buyer Requests" inbox, clicking **Reply** just marks the request as "Replied" in-app. In the seller's Claims view, clicking **Contact Buyer** opens an in-app "Contact Seller"-style message modal.

**New behavior:**
- Both **Reply** (on a buyer request card) and **Contact Buyer** (on a claim row) should redirect the seller directly to that buyer's linked Facebook profile (open in a new tab), instead of opening an in-app message modal.
- Show a small confirmation toast/tooltip before redirecting, e.g. "Opening [Buyer Name]'s Facebook profile…", and if a buyer has no linked Facebook account, show a fallback state (disabled button or small note: "Buyer hasn't linked a Facebook account yet").

---

## 6. Underpayment handling: notify buyer instead of auto-rejecting

**Current state:** Payment submissions are implied to be accepted or rejected outright; there's no partial/insufficient-amount handling shown.

**New behavior:**
- When a seller reviews a submitted payment and the amount paid is less than the item's price ("kulang" / insufficient), the system should **not auto-reject** the order.
- Instead, show a new status/state — e.g., **"Insufficient Payment"** (amber/warning styling, consistent with existing warning color `#92400E` / `#FFF7ED`) — and automatically send the **buyer** a notification, e.g.: *"Your payment for [item] is short by ₱[amount]. Please send the remaining balance to avoid your reservation expiring."*
- Add a small seller-side control on the payment review row: an input or auto-detected "Amount short: ₱[x]" tag, with actions **"Notify Buyer"** (sends the shortage notice) and **"Mark as Paid"** (once the balance is settled) — instead of a single Accept/Reject choice.
- Reflect this new "Insufficient Payment" status wherever order/claim statuses are shown (claim status badges, notifications list, fulfillment board column).

---

## 7. Flexible reservation timers (seller-defined, not fixed presets)

**Current state:** "Create New Batch" only offers a fixed dropdown of reservation periods (24 hours / 48 hours / 72 hours / 5 days / 7 days), and claimed items are hardcoded to a 48-hour timer regardless of selection.

**New behavior:**
- Replace the fixed dropdown with a flexible timer input: seller can set **any custom duration** (e.g., a number input + unit selector for hours/days), in addition to keeping the common presets as quick-select chips (24h / 48h / 72h / 5 days / 7 days / Custom).
- This should be settable **per batch**, and ideally also **overridable per item** within a batch (optional per-item override field, defaulting to the batch-level timer).
- The selected/custom duration should actually drive the countdown timer shown to buyers on claimed items (replacing the current hardcoded 48-hour default), and should be reflected in "Reserved for [X]" copy across item cards, claim rows, and the batch summary.

---

## 8. Collect buyer's phone number + amount paid at time of payment (for refund purposes)

**Current state:** "Submit Payment" (buyer) only asks for payment method, reference/transaction number, account name used for transfer, and a receipt upload. No phone number or explicit "amount paid" field exists, so there's no reliable way to process a refund later.

**New behavior:**
- In the **Submit Payment** modal/flow (buyer side), add two more required fields:
  - **Contact/Phone Number** (the buyer's actual mobile number — labeled clearly as "for refund and order updates").
  - **Amount Paid** (a numeric input where the buyer confirms the exact amount they sent — this should default to the item's price but remain editable, since it's how underpayment/overpayment is detected — ties into #6 from the earlier update, "Insufficient Payment" handling).
- On the **seller's Payment Verification/review screen**, show both of these new fields on each pending payment card (Phone Number, Amount Paid) alongside the existing reference number, account name, and receipt — so the seller has everything needed to process a refund without messaging the buyer separately.
- Also surface the phone number on **Payment History** / **Transaction Detail** views (both buyer and seller) so it's available after the fact if a refund is needed later.

---

## 9. Add a "Cancel" button in My Claims

**Current state:** My Claims rows only show actions like "Pay Now," "Extend," "Mark Shipped," or "View Order" depending on status — there's no way for a buyer to cancel a claim themselves.

**New behavior:**
- Add a **Cancel** button (secondary/outline style, red-tinted text to signal a destructive action) next to the existing action buttons on claims that are still **Pending** (or **Paid and Reserved** — see #10) — i.e., any claim not yet Expired or already Cancelled.
- Clicking Cancel opens a small confirmation modal ("Cancel this claim? This can't be undone.") before setting the claim's status to **Cancelled**.
- If the claim was already paid, the confirmation modal should mention that a refund will be processed using the phone number and amount paid on file (see #8).

---

## 10. Simplify My Claims statuses: drop "Reserved," rename "Paid" → "Paid and Reserved"

**Current state:** My Claims statuses are Pending, Reserved, Paid, Expired, Cancelled — shown as separate filter chips and status badges. "Pending" and "Reserved" currently behave almost identically (both count as active/unpaid claims with a countdown timer).

**New behavior:**
- Remove **"Reserved"** as a distinct status everywhere in My Claims (status filter chips, status badges, table rows, Dashboard "Recent Claims/Orders" widgets). Claims that would have been "Reserved" now simply show as **"Pending"** — one unified active/unpaid state with the countdown timer.
- Rename the **"Paid"** status label to **"Paid and Reserved"** wherever it's shown (status badge, filter chip, claim row) — communicating that payment has been received AND the item is secured for the buyer.
- Resulting status set for My Claims: **Pending, Paid and Reserved, Expired, Cancelled.**

---

## 11. Batches page: remove "Browse Sellers" button, fold its function into the top search bar

**Current state:** The Batches page (buyer view) has a separate "🔍 Browse Sellers" button that opens the seller directory. There's also an existing top-of-app search bar (in the fixed header) with placeholder text "Search batches, products, sellers…" that isn't yet doing this job.

**New behavior:**
- Remove the "Browse Sellers" button from the Batches page entirely.
- Wire up the existing **top header search bar** ("Search batches, products, sellers…") to be the single search entry point: typing a batch title, a product name, or a seller name should return matching results across all three (e.g., a small dropdown/results panel under the search bar, grouped by "Batches," "Products," and "Sellers").
- Selecting a seller result from this search takes the user to that seller's full Shop page (per #1 above). Selecting a batch or product result scrolls/filters to that batch on the Batches page.

---

## 12. Remove "Settings" from the top nav tab bar — keep it only under the profile icon

**Current state:** "Settings" exists both as its own tab in the fixed top nav bar AND as an item ("⚙️ Settings") inside the profile icon's dropdown menu (which also has "👤 View Profile" and "Log Out").

**New behavior:**
- Remove **Settings** from the top nav tab bar.
- Keep Settings accessible only through the **profile icon dropdown** (top-right), alongside "View Profile" and "Log Out" — no functional change needed there, just remove the redundant top-nav tab.

---

## 13. Sellers can view buyer profiles — ratings, linked social accounts, and rate the buyer

**Current state:** Buyers can view seller profiles (ratings, linked socials, trust stats — per #1). There's no equivalent for sellers to view a buyer's profile; sellers can only see a buyer's name/avatar inline on claim rows and buyer-request cards.

**New behavior:**
- Make the buyer's name/avatar (wherever it appears in the **Seller** view — Buyer Requests inbox, My Claims/"Orders Received" rows, Fulfillment Board cards) tappable, opening a **Buyer Profile** view (can be a full page consistent with #1's seller shop page, or a large side panel/modal — match whichever pattern reads better next to #1).
- Buyer Profile shows: avatar, name, "Member since [date]," a **buyer rating** (e.g., "⭐ 4.8 average from sellers"), linked social account(s) (e.g., Facebook, same style as the seller's linked-account callout in #1), and a trust stats row similar to the seller's (Completed, Cancelled, Incomplete, Disputes) — but scoped to that buyer's claim/order history.
- Add a **"Rate this Buyer"** action on the Buyer Profile (and/or directly on a completed order/claim row) that lets the seller leave a star rating (1–5) — reuse the existing rating-modal pattern used for buyers rating sellers on completed orders, mirrored for sellers rating buyers.

---

## 14. Tapping a batch opens a dedicated full Batch Page (not an inline expand)

**Current state:** On the Batches page, clicking "View Items →" on a batch card expands an **inline accordion panel** directly below the card grid (same page, no navigation) showing just the product list with claim buttons. There's no seller notes/description field, and no "Contact Seller" action from within a batch's detail view.

**New behavior:**
- Remove the inline accordion behavior. Tapping a batch card (or its "View Items →" button) now navigates to a **dedicated full-page Batch Detail view**, occupying the full content area below the fixed top nav — same full-page pattern as the Seller Shop page in #1, with a "← Back to Batches" breadcrumb at the top.
- The Batch Page includes:
  - **Header:** batch title, live/locked badge, category tag, trip dates, and reservation-period/timer info (from #7).
  - **Shop it came from:** a compact seller card (avatar, shop name, verified badge, rating) that's tappable and takes the buyer to that seller's full Shop page (#1).
  - **Details provided by the seller:** a description/notes section for anything the seller wrote about the batch (trip itinerary notes, sourcing notes, restrictions, etc.) — this is a **new field** the seller fills in when creating/editing a batch (add a "Batch Description / Notes" textarea to the "Create New Batch" form from update #2).
  - **Products included:** the full list of items in this batch (same info as today's panel — thumbnail, name, price, claimed/qty progress, "Sold Out"/"Only X left" tags, Claim Item button per item) — but laid out with more room since it's a full page now, not a cramped accordion.
  - **Contact Seller:** a prominent button (reuse the existing "Contact Seller" in-app modal/flow) so a buyer can message the seller directly about this specific batch, without needing to first open the seller's Shop page.
- Seller view of this same page (when role = Seller) keeps today's seller-only controls (lock/unlock batch, lock/unlock individual items, claimed/waitlisted counts) but in the same full-page layout instead of the accordion.
- Update the search results from #11 so that selecting a batch result now navigates straight to this full Batch Page (instead of scrolling to/expanding it inline on the Batches list).

---

## General notes for the Figma file
- Design both **Buyer** and **Seller** role views where a feature applies to both (the app has a Buyer/Seller role toggle).
- Keep all new screens/components consistent with the existing card, button, badge, and typography styles described above.
- Mark clearly which sections are **seller-only** (Financial Summary, Fulfillment Board on Dashboard, Buyer Requests, underpayment controls, timer settings, Buyer Profile view + "Rate this Buyer", Batch Description/Notes field + seller batch controls) vs. **buyer-facing** (Seller Directory/Shop page, Batch Page, item claiming, underpayment notification, Cancel claim, phone/amount-paid fields at checkout).
