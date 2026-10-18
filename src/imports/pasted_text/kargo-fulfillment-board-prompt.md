# KARGO Prompt: Fulfillment Board Rework, Buyer Tracking Board, and a Visual Pass on Every Card + Modal Form

## Context

This is a **refinement prompt** for the existing KARGO pasabuy / order-fulfillment app (React 19 + Vite + Tailwind v4 + Supabase). It is **not** a redesign and it does **not** add a new product area. It does three things, in priority order:

1. **Fix the Fulfillment Board's columns** so both the seller board and the buyer board show only the stages that actually matter. Drop the dead stages.
2. **Give the buyer the same Fulfillment Board the seller already has** — placed in the same position on the buyer Dashboard — driven by **real per-buyer order rows** so a seller's move on an order shows up on that one buyer's board. No invented data, no hardcoded names, no cross-buyer leakage.
3. **One visual-quality pass across every card and every modal form** in the app: fix the oversized buttons, and apply one consistent visual vocabulary (stage progress, stage chips, summary blocks, empty/loading states) to all of them — including the reservation gate, the payment flow, and the order-viewing flow.

The seller-side fulfillment mechanics (set status, add tracking, the `set_fulfillment_status` / `set_order_tracking` RPCs, the email triggers) **already exist and work**. This prompt does not re-implement them. It corrects the column vocabulary, extends the same board to buyers, and raises the visual quality floor.

**This prompt describes changes only. Do not invent a migration, a schema change, or a new table.** Everything it needs already exists in `orders` and the row mapper.

---

## 1. DO NOT CHANGE (preserve exactly as-is)

- **The design tokens.** Colors come from `src/constants/theme.ts` (`INDIGO` `#191BA9`, `CREAM`, `GREEN`, `CYAN_L`, …). Do not add new colors, gradients, or a second accent.
- **The font stack.** Only the four families already loaded in `src/index.css` line 1: **Josefin Sans, DM Sans, Manrope, Quicksand**. Do not add a new font, font file, or `@font-face`. (See §3.10 — the docs disagree with the code; the code wins.)
- **`src/components/shared/Modal.tsx`** — the portal, focus trap, Escape handling, body-scroll lock, header offset, and close animation. Extend with presentational props only if needed; do not rework its behaviour.
- **The existing order/claim status vocabulary in the database** — the `order_status` enum values, `fulfillment_stage` values (`preparing` / `shipped` / `in_transit` / `delivered`), and both RPCs. **No migration.** The UI maps those values onto fewer columns; it never asks the database to forget them.
- **The auth flow** (`Login`, `SignUp`, `AuthInput`, `AuthLayout`, `Onboarding`, `ReservationGate` logic) and `src/components/shared/shareLink.ts`. Presentation may be polished; fields, validation, and control flow stay.
- **The shipping-fee + acceptance flow** described in `kargo-tracking-shipping-prompt.md`: the blocking acceptance checkbox, the location pin picker, the paused-timer rules, the seller's "Set shipping fee / Request location correction / Decline order" actions, and the `pending_emails` queue. Do not alter logic.
- **The `?preview=original` demo bypass** in `src/App.tsx` (line 66) — it must keep booting straight into the demo `app` stage with seed data.
- **The real-time refresh channel** that watches `orders` — reuse it, do not add a second subscription.
- **Every modal's field set, validation, copy meaning, and submit handler.** This pass is visual and structural only.

---

## 2. Current behavior (verified — change only what is listed)

| Fact | Where |
|---|---|
| 8 board columns; `statusToColumn()` maps `preparing`→"Preparing", `in_transit`→"In Transit" | `src/constants/fulfillment.ts:4-13`, `src/services/kargoApi.ts:125-147` |
| **Two disagreeing column lists** for the same board: Dashboard's `SELLER_BOARD_COLUMNS` (no "Claimed", folds it into "Pending Payment") vs `KANBAN_COLS` used by the Orders tab | `src/features/dashboard/Dashboard.tsx:48-56`, `src/constants/fulfillment.ts` |
| The seller board is rendered **twice from the same function**: preview `renderBoardColumns(false)`, expanded `renderBoardColumns(true)` | `src/features/dashboard/Dashboard.tsx:327-491`, used at `681`, `705`, `1023`, `1106` |
| `fulfillment` is built **only in the seller branch** of the row mapper (`else { … fulfillment.push(…) }`), so a buyer's `fulfillment` array is always empty | `src/services/kargoApi.ts:534-694` (buyer branch `593-643`, seller branch `644-694`) |
| `isBuyer` is evaluated **per row**, so a dual-role user's single `fulfillment` array would mix their purchases and their sales | `src/services/kargoApi.ts:543` |
| Buttons get their size from CSS, not from the modals: modal controls `min-height:40px`; **all** buttons/links `min-height:44px` at ≤1024px (including pointer-fine devices); `.auth-content .kargo-primary` `min-height:67px; font-size:18px`; modal footers stretched with inline `style={{flex:1}}` | `src/index.css:5482-5485`, `656-658`, `280-281`, `1038-1042` |
| No shared progress/stepper primitive exists | (grep for `StageProgress` → no matches) |
| Mojibake (wrong-encoding) strings shipped to users | `Countdown.tsx:71`, `OrderDetailsModal.tsx:88-91,96`, `SetShippingFeeModal.tsx:35,37,53,67` |

---

## 3. Detailed requirements

### 3.1 One canonical column vocabulary (both roles)

Replace the two disagreeing lists with a single source of truth in `src/constants/fulfillment.ts`:

```ts
export const SELLER_COLUMNS = [
  "Payment Confirmed",
  "Preparing",
  "Shipped",
  "Delivered",
  "Cancelled",
] as const

export const BUYER_COLUMNS = [
  "Pending Payment",
  "Payment Confirmed",
  "Preparing",
  "Shipped",
  "Delivered",
] as const
```

- **Seller board — remove three columns:** `Pending Payment`, `Claimed`, and `In Transit`. Unpaid/claimed orders are the seller's *verification* work, and they already live in **Orders Received**; they must not clutter the fulfillment board.
- **Buyer board — the five above.** No `Claimed` (that is what My Claims is for) and no `Cancelled` (cancelled/expired orders belong in My Claims / Payment History, not on a progress board).
- Delete `SELLER_BOARD_COLUMNS` from `Dashboard.tsx` and delete `KANBAN_COLS` **or** repoint every consumer at `SELLER_COLUMNS`. `KanbanCol` becomes the union of the two lists (or two unions, `SellerCol` / `BuyerCol`).
- Add **one** `STAGE_COLORS` map for every column name, and delete the duplicated `colColors` object inside `Dashboard.tsx:329-338` and `KANBAN_COL_BG`. Both boards, every chip, and the stage progress read from this one map.
- Delete `PRIOR_FULFILLED` (constant + barrel export) — it is unused dead weight.

### 3.2 Mapping and row scoping

`statusToColumn()` must become role-aware — `statusToColumn(status, fulfillmentStage, role)`:

| DB status / stage | Seller column | Buyer column |
|---|---|---|
| `payment_pending`, `payment_submitted`, `insufficient_payment` | *(excluded from the seller board)* | `Pending Payment` |
| `payment_confirmed` | `Payment Confirmed` | `Payment Confirmed` |
| `preparing` | `Preparing` | `Preparing` |
| `shipped`, `in_transit` | `Shipped` | `Shipped` |
| `completed`, stage `delivered` | `Delivered` | `Delivered` |
| `cancelled`, `expired`, `incomplete` | `Cancelled` | *(excluded from the buyer board)* |

- `in_transit` is **never produced again** by the UI: remove it from the seller's status `<select>`, from the move-map in `useFulfillmentBoard.ts:25-34`, from the column backgrounds, and delete the "Mark this order as in transit?" confirm modal in `FulfillmentDetails.tsx:189-213`. `Shipped` now covers shipped-and-on-the-way, because the seller already attaches courier + tracking at that step.
- The seller board must **silently skip** pre-payment rows rather than showing an empty bucket. Render one small footnote under the board when such rows exist: `N orders awaiting payment — open Orders Received`, wired through the existing `navIntent.orderFilter = "Pending"` mechanism (`Dashboard.tsx:648-655` shows the pattern). This footnote is not a column.

### 3.3 The buyer Fulfillment Board

**Data — real, scoped, no placeholders.**

- In `src/services/kargoApi.ts`, build fulfillment rows for the **buyer branch too** (inside the existing `if (isBuyer) { … }` block, next to `orders.push(...)`), reusing the same `deliveryFields` spread.
- Add a `perspective: "seller" | "buyer"` field to `FulfillmentOrder` (`src/types/index.ts`) and set it in each branch. The board filters `fulfillment.filter(o => o.perspective === role)` — this is what keeps a dual-role user's own purchases out of their shop's board and vice-versa (`isBuyer` is per-row; see §2).
- Buyer cards need the **seller's** name: add an optional `seller?: string` (and `sellerFb?: string`) to `FulfillmentOrder` and populate it from `sellerName` / `participantLinks.get(row.seller_id)` in the buyer branch. Keep `buyer` as the seller branch has it.
- Scoping is already enforced by the `orders` query + RLS: a buyer is only ever handed rows where `buyer_id = auth.uid()`. Do not widen the query. **The buyer board must never render a name, product, or amount that did not come from one of that buyer's own rows.**
- Do **not** invent a second state array. Reuse the existing `fulfillment` / `setFulfillment` in `SharedState` so the existing real-time refresh (which re-pulls on any `orders` change) updates the buyer's board automatically.

**Placement.**

- The board goes on the **buyer Dashboard**, in the **same position** as the seller's board sits on the seller Dashboard — after the stat row and the recent-claims / upcoming-deadline content, as the last section of the page. (Seller side: `Dashboard.tsx:667-685`; buyer side renders through the `.bdash` branch from `Dashboard.tsx:731` onward.)
- Give it the same section heading treatment: **"Fulfillment Board"**, with an **Expand** affordance that opens the same full-screen expanded overlay pattern the seller has (preview → expanded).

**Behavior.**

- **Read-only.** No status `<select>`, no move handler, no cancel/deliver confirms. Do not wire `board.move` for the buyer.
- Clicking a card **expands it in place** (same interaction as the seller's `FulfillmentDetails`): a tracking block (courier, rider name, rider contact, tracking number, ETA, tracking link) plus a **View Order** button that opens the existing `OrderDetailsModal`. When tracking has not been set yet, show the stage and a "Tracking details will appear here once your seller ships" line instead of empty rows.
- Card content: product name + thumbnail, **seller** avatar + name, `×qty`, amount, **stage chip**, and a **stage-progress indicator**. Once `Shipped`, surface courier + tracking number on the card itself as a tap target.
- Reuse `safeTrackingUrl()` from `src/components/shared` for the tracking link, exactly as `OrderDetailsModal` does — never open a raw seller-supplied URL.

**Parity requirement (explicit).** The **preview** board on the Dashboard and the **expanded** board must use the *same* column list and the *same* card component — only the density changes (`visibleOrders = expanded ? all : first 3`, wider columns when expanded). This must hold for **both** roles. A column that appears in one and not the other is a bug.

**States.**

- Per-column **empty state** (icon + one short line), replacing the bare `—` in `Dashboard.tsx:476-487`.
- A **loading/skeleton** state while the buyer's `fulfillment` is still empty on first load, so the board never flashes "no orders" for a buyer who has orders.
- A page-level **empty state** when the buyer genuinely has no orders: icon + "No orders in progress yet" + a "Browse batches" action that switches to the Batches tab.
- `aria-live` announcement of the summary when the board refreshes (reuse `FulfillmentLiveRegion`).

### 3.4 Seller board cleanup

- Columns per §3.1; delete `In Transit` everywhere (select options, move-map, `colColors`, `KANBAN_COL_BG`, confirm modal, and any copy that names it).
- Keep the `Shipped` step as the one place tracking is required (Payment Confirmed → Preparing → Shipped → Delivered is now a single jump from Preparing to Shipped, with the existing "Add tracking details" confirm flow).
- Keep the seller's mobile collapse toggle, the `+N more` overflow, the count badge, and the drag-free select-based move.
- `Delivered` still counts toward the seller's "Orders Fulfilled" stat (`Dashboard.tsx:161`) — unchanged.

### 3.5 Oversized buttons (the "unusually big" fix)

The cause is central CSS plus inline `flex: 1` footers. Fix it centrally so every modal shrinks together, and do not hand-tune each modal.

In `src/index.css`:

1. **Modal action buttons → ~36px.** `.kargo-modal__body :is(.kargo-primary, .kargo-secondary)` `min-height: 40px` → `36px`. Modal inputs/selects `min-height: 40px` → `38px`.
2. **Stop inflating buttons on pointer-fine devices.** The `:is(button, a[href], [role="button"], select, …) { min-height: 44px }` rule at ≤1024px (`index.css:656-658`) must apply only to touch: wrap it in `@media (max-width: 1024px) and (pointer: coarse)`. Touch targets stay 44px; mouse users stop getting thumb-sized controls on a laptop.
3. **Scope the full-width stretch to small screens.** `.si .flex.gap-3 > button { min-width: 100%; flex: 1 1 100% }` (`index.css:1038-1042`) stays only inside the existing `@media (max-width: 620px)` block. Do not let it leak to desktop.
4. **Auth submit.** `.auth-content .kargo-primary` `min-height: 67px; font-size: 18px` → align to the shared control height (`44px`, label `14–15px`) without changing the auth layout or its spacing rhythm.
5. **Retire inline stretched footers.** Remove `style={{ flex: 1, … }}` from the action rows in: `SocialConnectModal.tsx:74-86`, `SalesReportModal.tsx:357-367`, `NewBatchModal.tsx:895-907`, `FinancialSummaryModal.tsx:412-427` and `623-631`, `JoinWaitlistModal.tsx:128-139`, `ItemClaimModal.tsx:561-597`, `PaymentSubmitModal.tsx:681-743`, `ApplyToSellModal.tsx:19-36`, `InsufficientPaymentModal.tsx:177-203`, `ReviewSubmissionModal.tsx`, `TransactionDetailModal.tsx:107-112`, `TrackingDetailsModal.tsx:148-175`, `SetShippingFeeModal.tsx:70-94`, `DeclineDeliveryOrderModal.tsx`, `RequestLocationCorrectionModal.tsx`, `ContactModal.tsx`, `ExtensionRequestModal.tsx`, `BuyerProfileModal.tsx`, `RejectPaymentModal.tsx`, `BatchCheckoutModal.tsx`.
   - Target: **right-aligned, side-by-side buttons sized to their content**, primary last. A single-action modal (like the confirm dialogs inside `FulfillmentDetails.tsx`) may keep one full-width button.
   - On `≤620px`, stack full-width and reverse the order so the primary sits at the bottom, as `SetShippingFeeModal.tsx:70-76` already does — make that the shared convention.
6. Add a short comment block in `index.css` naming this as **the** modal geometry contract so the next modal cannot drift.

### 3.6 The visual vocabulary (applies to every card and every modal form)

Build the visuals once, in `src/components/shared/`, and use them everywhere. No bespoke one-off styling per screen.

**New shared primitives.**

| Component | Purpose |
|---|---|
| `StageProgress.tsx` | Segmented horizontal stepper. Props: `stages: string[]`, `current: string`, `tone?`. Completed segments filled with the stage color, current segment emphasised with a label, remaining muted. Horizontal and compact enough for a board card; expands into a labelled stepper in detail views. |
| `StageChip.tsx` | Status pill: leading dot/icon + label, colored from the single `STAGE_COLORS` map. Replaces ad-hoc status text and any remaining `StatusBadge` variants that don't match. |
| `SummaryBlock.tsx` | The modal lead block: product thumbnail (or avatar/icon) + headline + a compact key/value grid (qty, amount, shipping fee, total, deadline). Used at the top of the reservation, payment, shipping-fee, tracking, and order-viewing modals so they stop being walls of labels. |
| `EmptyState.tsx` | Icon + one line + optional action. Used by every empty column, list, and table. |
| `Skeleton.tsx` (`CardSkeleton`, `RowSkeleton`) | Loading placeholders for cards, lists, and board columns. |

**Rules — every card.**

- One leading visual (thumbnail, avatar, or lucide icon), one headline, one meta line, one trailing value/status/affordance.
- 10–12px internal padding, 4/8/12 rhythm between blocks, `border-radius` 8–12, hairline border, soft shadow (`offset` + `blur`, never a zero-offset colored halo).
- Hover = subtle lift + border emphasis; `focus-visible` ring using the existing focus token. Keep the existing `.bp` / `.fi` / `.si` motion classes — do not add new animations.
- Icons: **`lucide-react` only** (already a dependency). No stock photos added, no illustration, no gradient fills.

**Rules — every modal form.**

1. Header: title (Josefin Sans) + optional leading icon; existing close button.
2. A `SummaryBlock` lead when the modal is about a specific item/order/payment.
3. Fields: label above, helper/validation text below, 38px controls, one column on mobile, two columns only when the pair is genuinely related (`SetShippingFeeModal.tsx:70` two-column action grid is the existing precedent).
4. Inline, non-shifting error text; no `alert()` for validation.
5. Footer: right-aligned actions, one primary, side-by-side, `≤620px` full-width stacked (per §3.5).
6. Consistent vertical rhythm: more space above a heading than below it; body measure 65–75ch;
7. Contrast: body and placeholder text ≥ 4.5:1, large text ≥ 3:1. On a tinted surface, tint secondary text from that hue rather than defaulting to gray.

**Surfaces this pass must cover — all of them.**

- **Modals (24):** `ReservationGate`, `ApplyToSellModal`, `ItemClaimModal`, `NewBatchModal`, `JoinWaitlistModal`, `WaitlistModal`, `FinancialSummaryModal`, `SalesReportModal`, `SocialConnectModal`, `ContactModal`, `BuyerProfileModal`, `ExtensionRequestModal`, `SetShippingFeeModal`, `RequestLocationCorrectionModal`, `DeclineDeliveryOrderModal`, `PaymentSubmitModal`, `BatchCheckoutModal`, `ReviewSubmissionModal`, `RejectPaymentModal`, `InsufficientPaymentModal`, `TransactionDetailModal`, `OrderDetailsModal`, `TrackingDetailsModal`, and the inline expanded details panel `FulfillmentDetails`.
- **Cards and rows:** batch catalog cards and product cards, claim cards, order cards, payment-history rows, dashboard stat cards (both roles), Recent Claims table, waitlist cards (buyer + seller), seller profile/shop cards, settings cards, the delivery preview card, board cards (both roles), and every empty/loading state in those surfaces.

Nothing in this list may be skipped for being "not part of the feature".

### 3.7 Mobile

- Board: horizontally scrolling columns with scroll-snap, collapsible column headers (reuse `seller-board-column__mobile-toggle`), full-width cards; the expanded view is full-screen with a "Back to Dashboard" affordance on both roles.
- Pin picker and tracking/map preview stay full-width (already the case — do not regress them).
- Buyer and seller boards must scroll identically; one responsive implementation, not two.
- Verify against `MOBILE_REPONSIVENESS.md` at 360 / 390 / 768 / 1024 / 1440 widths.

### 3.8 Accessibility

- The board keeps its `aria-live` region, `role="button"` cards with `aria-expanded`, and Enter/Space activation.
- `StageProgress` exposes `role="img"` with an `aria-label` like `"Stage 3 of 5: Preparing"` and never relies on color alone (label + fill).
- Stage chips include their label in text, not color only.
- Every action still reachable by keyboard; no icon-only control without an `aria-label`.

### 3.9 Encoding defect — mojibake (must fix)

**Not a styling issue, and not a file-encoding issue.** Ten strings in three files were written through a Windows-1252 round-trip and then saved as UTF-8, so the files now hold **valid UTF-8 text for the wrong characters** (`â€”` where `—` was meant). All three files are already **UTF-8 without BOM** (verified), and `₱` is correct in ~30 other files — so this is a **local, character-level defect**.

Do **not** run an encoding conversion, do **not** add or strip a BOM, and do **not** re-save the files through a different codec. Replace the exact characters in place.

**Match what already works.** `₱` is already correct in `MyClaims.tsx`, `Dashboard.tsx`, `FinancialSummaryModal.tsx`, `PaymentSubmitModal.tsx`, `InsufficientPaymentModal.tsx` and others; `×` and `·` are correct in `FulfillmentDetails.tsx:38`; `—` is correct in `NewBatchModal.tsx:799`. Use the same literal characters — no HTML entities, no symbol font, and no ASCII fallback (`PHP`, `x`, `-`).

**Complete inventory — verified exhaustive. Nothing else in the repo (src, supabase, docs) matches.**

| # | File | Line | Currently contains | Must become | Character fix |
|---|---|---|---|---|---|
| 1 | `src/components/shared/Countdown.tsx` | 71 | `Paused â€” waiting for seller` | `Paused — waiting for seller` | `â€”` → `—` (U+2014) |
| 2 | `src/features/orders/OrderDetailsModal.tsx` | 88 | `["Courier", … \|\| "â€”"]` | `["Courier", … \|\| "—"]` | `â€”` → `—` |
| 3 | `src/features/orders/OrderDetailsModal.tsx` | 89 | `["Rider", … \|\| "â€”"]` | `["Rider", … \|\| "—"]` | `â€”` → `—` |
| 4 | `src/features/orders/OrderDetailsModal.tsx` | 90 | `["Rider contact", … \|\| "â€”"]` | `["Rider contact", … \|\| "—"]` | `â€”` → `—` |
| 5 | `src/features/orders/OrderDetailsModal.tsx` | 91 | `["Tracking number", … \|\| "â€”"]` | `["Tracking number", … \|\| "—"]` | `â€”` → `—` |
| 6 | `src/features/orders/OrderDetailsModal.tsx` | 96 | `: "â€”",` | `: "—",` | `â€”` → `—` |
| 7 | `src/features/claims/SetShippingFeeModal.tsx` | 35 | `<strong>{claim.product}</strong> Ã—{claim.qty}` | `<strong>{claim.product}</strong> ×{claim.qty}` | `Ã—` → `×` (U+00D7) |
| 8 | `src/features/claims/SetShippingFeeModal.tsx` | 37 | `Item amount: â‚±{…}` | `Item amount: ₱{…}` | `â‚±` → `₱` (U+20B1) |
| 9 | `src/features/claims/SetShippingFeeModal.tsx` | 53 | `Shipping fee (â‚±)` | `Shipping fee (₱)` | `â‚±` → `₱` |
| 10 | `src/features/claims/SetShippingFeeModal.tsx` | 67 | `<strong>â‚±{…}</strong>` | `<strong>₱{…}</strong>` | `â‚±` → `₱` |

**Procedure.**

1. Read each affected line **in full** before editing. The snippets above are fragments — a mojibake run can extend past the matched part — and confirm nothing else on the line is mangled.
2. Replace only the mangled characters, typing the real `—` / `×` / `₱`. Keep the rest of the line byte-identical. This is **not** a reformat: do not let the formatter rewrite unrelated lines in the same commit, or the diff becomes unreviewable.
3. Do not work around it with a helper constant or an interpolation — use the literal character.
4. Confirm the three files are still UTF-8 **without BOM** afterwards (first three bytes must not be `EF BB BF`).
5. Re-check each of the ten lines in the browser (see §6, step 14).

**Guard — run before committing.**

```bash
# A Latin-1-misread UTF-8 lead byte means mojibake is back.
rg -n "[ÃÂâð]" src/ supabase/ -g '!src/imports/pasted_text/**'
```

Expect **zero** matches. `src/imports/pasted_text/` is excluded only because this prompt file quotes the broken samples as documentation.

**Ongoing rule for the whole task.** The §3.6 visual pass touches many of these same files. Type `₱`, `—`, `×`, `·`, `≥`, `≤` and `→` directly, and never paste them from a source that re-encodes — that round-trip is exactly what produced these ten defects.

### 3.10 Code quality and documentation drift

- Follow `AGENTS.md`: default exports, double quotes, `@/` alias for cross-folder imports, relative `./` for siblings; respect the dependency direction in `ARCHITECTURE.md` (`constants` → `components/shared` → `features/*` → `components/layout` → `App.tsx`). A feature may import another feature only through its `index.ts`.
- Export new shared primitives through `src/components/shared/index.ts`; export new board exports through `src/features/fulfillment/index.ts`.
- Use the `@/` alias; do not deep-import across features.
- **No new dependency.** `leaflet` and `lucide-react` are already present.
- **Flag, do not fix, these doc drifts** (report them in the PR description instead of silently editing):
  - `DESIGN.md` specifies **Manrope + DM Sans** and still references a **Reports** tab that no longer exists in `TABS` (`src/components/layout/TabBar.tsx:14`); the shipped app is **Josefin Sans**-based with DM Sans / Manrope / Quicksand already loaded.
  - `AGENTS.md` and `kargo-reservation-gate-prompt.md` refer to **Inter**, which is **not loaded** anywhere in `src/index.css`.
- The shipped code is the authoritative design system for this pass.

---

## 4. Acceptance criteria

**Board columns**

- [ ] `src/constants/fulfillment.ts` exposes exactly one `SELLER_COLUMNS` (5) and one `BUYER_COLUMNS` (5); `KANBAN_COLS`, `SELLER_BOARD_COLUMNS`, `PRIOR_FULFILLED`, and the duplicated `colColors` / `KANBAN_COL_BG` maps are gone.
- [ ] Seller board shows: **Payment Confirmed · Preparing · Shipped · Delivered · Cancelled**.
- [ ] Buyer board shows: **Pending Payment · Payment Confirmed · Preparing · Shipped · Delivered**.
- [ ] "In Transit" appears nowhere in the UI (no column, no select option, no confirm modal, no color entry).
- [ ] An order in `in_transit` renders in **Shipped**; a `preparing` order renders in **Preparing**; a `cancelled`/`expired` order renders in the seller's **Cancelled** and is absent from the buyer board.
- [ ] The seller's status `<select>` offers exactly the seller columns.
- [ ] A seller with unpaid orders sees the "awaiting payment — open Orders Received" footnote, and tapping it lands on Orders Received filtered to Pending.

**Buyer board**

- [ ] The buyer Dashboard renders a **Fulfillment Board** in the same position the seller's occupies on the seller Dashboard.
- [ ] A seller moving an order to `Shipped` (with tracking) makes it appear in **Shipped** on that buyer's board, with the courier and tracking number, **without a page reload**.
- [ ] A second buyer's board never shows the first buyer's order, product, amount, or name.
- [ ] A seller account's board never shows rows for orders where that user was the buyer.
- [ ] The buyer board has no status control and cannot move a card.
- [ ] Expanding a card shows courier, rider, rider contact, tracking number, ETA, the tracking link (via `safeTrackingUrl`), and a **View Order** button that opens `OrderDetailsModal`.
- [ ] Zero hardcoded order/buyer/product/amount strings are introduced anywhere in the buyer board path.
- [ ] First load shows a skeleton, not an empty state, while rows are still arriving.
- [ ] Preview columns === expanded columns, for both roles.

**Buttons and visuals**

- [ ] Modal action buttons measure ~36px tall and are right-aligned, side-by-side, sized to content on desktop; full-width stacked ≤620px.
- [ ] At 1440px with a mouse, no button is 44px+ tall because of the old blanket min-height rule.
- [ ] The auth submit button is no longer 67px / 18px.
- [ ] No modal footer uses an inline `flex: 1` stretch any more.
- [ ] `StageProgress`, `StageChip`, `SummaryBlock`, `EmptyState`, `Skeleton` exist in `src/components/shared/` and are used on the board, in `OrderDetailsModal`, `TrackingDetailsModal`, `ItemClaimModal`, `PaymentSubmitModal`, `SetShippingFeeModal`, and the reservation gate.
- [ ] Every empty list/column/table has an `EmptyState`; no bare `—` placeholders remain.
- [ ] No new color, font, gradient, image asset, or animation was introduced; only theme tokens, the four loaded families, and lucide icons.
- [ ] Body/placeholder contrast passes ≥4.5:1 (≥3:1 for large text).
- [ ] All ten inventoried strings (§3.9) render correctly: `—`, `×`, `₱`.
- [ ] The §3.9 guard returns zero matches: `rg -n "[ÃÂâð]" src/ supabase/ -g '!src/imports/pasted_text/**'`.
- [ ] `Countdown.tsx`, `OrderDetailsModal.tsx`, and `SetShippingFeeModal.tsx` are still UTF-8 **without BOM** after the fix.

**Regressions**

- [ ] `?preview=original` still boots into demo mode with seed data and no errors.
- [ ] The seller set-status, add-tracking, and email-notification flows behave exactly as before.
- [ ] The shipping-fee / acceptance / paused-timer flow behaves exactly as before.
- [ ] The reservation gate still shows only for `?batch=` + logged-out + booted + not-preview.
- [ ] No database migration was created or applied.

---

## 5. Files expected to change

| File | Change |
|---|---|
| `src/constants/fulfillment.ts` | `SELLER_COLUMNS`, `BUYER_COLUMNS`, single `STAGE_COLORS` + `STAGE_ICONS`; drop `KANBAN_COLS`, `KANBAN_COL_BG`, `PRIOR_FULFILLED` |
| `src/types/index.ts` | `FulfillmentOrder`: add `perspective`, `seller?`, `sellerFb?`; update the column union |
| `src/services/kargoApi.ts` | `statusToColumn(status, stage, role)`; push buyer fulfillment rows in the `isBuyer` branch with `perspective` + seller identity |
| `src/features/fulfillment/index.ts` | Export the new board primitives / components |
| `src/features/fulfillment/FulfillmentBoard.tsx` | **New if extracted** — the single role-aware board (columns + cards + preview/expanded switch) |
| `src/features/fulfillment/FulfillmentCard.tsx` | **New if extracted** — the shared card (seller + buyer variants) with `StageProgress` + `StageChip` |
| `src/features/fulfillment/FulfillmentDetails.tsx` | Drop the In Transit confirm; new columns; un-stretch footer; add `SummaryBlock` + `StageProgress` |
| `src/features/fulfillment/TrackingDetailsModal.tsx` | `SummaryBlock`, `StageProgress`, footer un-stretched |
| `src/features/fulfillment/useFulfillmentBoard.ts` | New move-map (no In Transit / Pending Payment); seller-only `move`; optional buyer read-only mode |
| `src/features/fulfillment/fulfillmentData.ts` | Seed parity only if `?preview=original` needs it; no new hardcoded buyer arrays |
| `src/features/dashboard/Dashboard.tsx` | Delete `SELLER_BOARD_COLUMNS` + `colColors`; render the buyer board; one board renderer for preview + expanded; new `EmptyState`/skeleton |
| `src/features/orders/Orders.tsx` | Consume the shared board/columns |
| `src/features/orders/OrderDetailsModal.tsx` | `SummaryBlock` + `StageProgress`; mojibake fix (§3.9) — lines 88-91, 96 |
| `src/components/shared/StageProgress.tsx` | **New** |
| `src/components/shared/StageChip.tsx` | **New** |
| `src/components/shared/SummaryBlock.tsx` | **New** |
| `src/components/shared/EmptyState.tsx` | **New** |
| `src/components/shared/Skeleton.tsx` | **New** |
| `src/components/shared/index.ts` | Export the new primitives |
| `src/components/shared/Countdown.tsx` | Mojibake fix (§3.9) — line 71 |
| `src/features/claims/SetShippingFeeModal.tsx` | Mojibake fix (§3.9) — lines 35, 37, 53, 67; `SummaryBlock`; footer un-stretched |
| `src/features/claims/RequestLocationCorrectionModal.tsx` | `SummaryBlock`; footer un-stretched |
| `src/features/claims/DeclineDeliveryOrderModal.tsx` | `SummaryBlock`; footer un-stretched |
| `src/features/batches/ItemClaimModal.tsx` | `SummaryBlock`; `StageProgress`; footer un-stretched |
| `src/features/payments/PaymentSubmitModal.tsx` | `SummaryBlock`; footer un-stretched |
| `src/features/payments/*.tsx` (BatchCheckout, ReviewSubmission, RejectPayment, InsufficientPayment, TransactionDetail) | Visual pass + footer un-stretched |
| `src/features/batches/*.tsx`, `src/features/dashboard/*.tsx`, `src/features/settings/SocialConnectModal.tsx`, `src/features/auth/{ReservationGate,ApplyToSellModal}.tsx`, `src/components/shared/{ContactModal,BuyerProfileModal,ExtensionRequestModal}.tsx` | Visual pass + footer un-stretched |
| `src/index.css` | Button/control geometry contract (§3.5); touch-only 44px rule; shared modal footer convention |

No changes to: `src/lib/supabase.ts`, the `supabase/migrations/` tree, `shareLink.ts`, the `orders`/`payments` tables, or either RPC signature.

---

## 6. Manual test script (for the demo)

1. **Seller columns.** Sign in as a seller with orders. Confirm the board shows exactly `Payment Confirmed · Preparing · Shipped · Delivered · Cancelled` — no Pending Payment, no Claimed, no In Transit.
2. **In-transit folding.** Take an order whose `fulfillment_stage` is `in_transit` (or set it) and confirm it renders under **Shipped**, not a missing bucket.
3. **Seller preview === expanded.** Expand the board; confirm the columns are identical to the preview and only the density changed.
4. **Move + tracking.** Move an order to **Shipped**, add courier + rider + tracking number + ETA. Confirm it lands in Shipped with the tracking shown on the card.
5. **Buyer receives it.** In a second browser profile, sign in as **that order's buyer**. Open the Dashboard and confirm the board shows the order in **Shipped** with the same courier and tracking number — and that it appears **without a manual reload** after the seller's move.
6. **Buyer scope.** Confirm the buyer board shows only that buyer's own orders; confirm no other buyer's name or product appears.
7. **Dual-role.** Sign in as a user who is both a buyer and a seller; confirm their own purchase does not appear on their shop's board and vice versa.
8. **Read-only.** Confirm the buyer card has no status dropdown and clicking it only expands the tracking detail + **View Order**.
9. **Preview === expanded (buyer).** Expand the buyer board; same columns, same cards.
10. **Empty + loading.** As a buyer with zero orders, confirm the page-level empty state; on a slow/throttled first load, confirm a skeleton instead of a flash of "no orders".
11. **Buttons.** Open `SetShippingFeeModal`, `PaymentSubmitModal`, `ItemClaimModal`, `TrackingDetailsModal`, `ContactModal`, `OrderDetailsModal`, `ReservationGate`, `NewBatchModal`, `FinancialSummaryModal`. Confirm every action button is compact, right-aligned, and side-by-side on desktop; and full-width stacked on a 390px viewport.
12. **Auth size.** Confirm the login/signup submit is no longer 67px tall.
13. **Visuals everywhere.** Confirm a stage/progress or summary visual is present in the reservation gate, the payment flow, and the order-viewing modal — not only on the board.
14. **Encoding.** Confirm all ten §3.9 strings render correctly: the countdown paused label shows `—`, the Order Details fallbacks (courier / rider / rider contact / tracking number) show `—`, and the shipping-fee modal shows `×{qty}` and `₱` amounts. Then run the §3.9 guard and confirm zero matches.
15. **Regressions.** `?preview=original` boots to demo with no popup; a `?batch=` link while logged out still shows the reservation gate; the shipping-fee acceptance + pause flow is unchanged; no DB migration exists.
16. **Mobile.** At 360 / 390 / 768 / 1024 px, confirm the boards scroll horizontally with snap, columns collapse, and no modal overflows.

---

## 7. Resolved decisions

These are settled — implement them as written.

1. **Columns — settled, and different per role.** Seller: `Payment Confirmed, Preparing, Shipped, Delivered, Cancelled`. Buyer: `Pending Payment, Payment Confirmed, Preparing, Shipped, Delivered`. `In Transit` is removed for **both**; `Pending Payment` and `Claimed` are removed for the **seller** only. These are the only two column lists — one source of truth, no per-screen variants.
2. **Pre-payment is not a fulfillment stage.** For the seller it is verification work and lives in Orders Received (reached via the existing `navIntent.orderFilter = "Pending"`); for the buyer it is a board column because it is the buyer's next action.
3. **Cancelled is seller-only.** Cancelled/expired orders stay off the buyer's progress board; the buyer finds them in My Claims / Payment History.
4. **`in_transit` is mapped, not deleted.** The database keeps its values and the RPCs are unchanged; the UI folds `in_transit` into `Shipped` and never emits it again. **No migration.**
5. **One board component, two roles.** A single role-aware board (columns + cards + preview/expanded) serves the seller Dashboard, the Orders tab, and the new buyer Dashboard section. Preview and expanded must show identical columns.
6. **Buyer board is real and scoped.** Rows come from the buyer's own `orders` rows via the existing mapper + RLS, tagged `perspective: "buyer"`. No seed array, no placeholder names, no hardcoded products or amounts. The single `fulfillment` state is reused so the existing `orders` real-time channel keeps the buyer current.
7. **Dual-role safety.** `isBuyer` is evaluated per row, so `perspective` is required to keep a user's purchases and their sales in separate boards.
8. **Buyer board is read-only.** Expand a card for tracking details + **View Order**; no status controls for buyers.
9. **Tracking entry stays at `Shipped`.** With Preparing and Shipped adjacent, the seller still attaches courier + rider + tracking at the Shipped transition, which is what the buyer's board and `OrderDetailsModal` read from.
10. **The visual pass is app-wide, not board-only.** Every card and every modal form listed in §3.6 gets the same vocabulary — reservation gate, payment, shipping, tracking, viewing, auth, settings, waitlists, reports.
11. **Visuals are system-driven.** New shared primitives (`StageProgress`, `StageChip`, `SummaryBlock`, `EmptyState`, `Skeleton`) plus one stage-color map — not per-screen styling. `lucide-react` icons only; no imagery, gradients, or new animation.
12. **The design system of record is the shipped code.** `INDIGO #191BA9` + `src/constants/theme.ts`, and the four fonts already loaded. The `Manrope + DM Sans` and `Inter` references in `DESIGN.md` / `AGENTS.md` are stale and are **reported, not edited**, in this pass.
13. **Buttons: ~36px in modals, right-aligned, side-by-side; full-width stacked only ≤620px.** Fixed centrally in `index.css` with a documented contract, plus removal of the inline `flex: 1` stretchers. The blanket 44px rule becomes touch-only.
14. **No new dependency, no schema change, no migration.** `leaflet` and `lucide-react` already exist.
15. **Mojibake is fixed by character replacement — not by re-encoding.** All ten strings inventoried in §3.9 are corrected in `Countdown.tsx`, `OrderDetailsModal.tsx`, and `SetShippingFeeModal.tsx`. Those files are already UTF-8 without BOM and stay that way: no encoding conversion, no BOM change, no codec re-save, no helper constant. The repo guard `rg -n "[ÃÂâð]" src/ supabase/ -g '!src/imports/pasted_text/**'` must return zero.
16. **Finished screenshots.** Verify the finished UI in one batched pass — seller board, buyer board, expanded views, and every modal listed in §3.6, desktop **and** 390px mobile — fix everything it shows in a single batch, confirm once, and stop.
