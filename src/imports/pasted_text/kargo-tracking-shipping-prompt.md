# KARGO Prompt: Order Tracking + Buyer-Shouldered Shipping Fee

## Context

This is a **refinement prompt** for the existing KARGO pasabuy / order-fulfillment app (React 19 + Vite + Tailwind CSS v4, Supabase backend). It adds **two connected features**. It is not a redesign.

- **Part A — Order Tracking.** When the buyer taps **View Order**, they see who the courier is (**rider and company**), the **tracking number**, the **ETA** and other important details, together with a **preview of the delivery process**. Clicking the preview redirects them to the courier's tracking page (Lalamove, J&T, LBC, etc.).
- **Part B — Buyer-shouldered shipping fee.** For orders where the buyer's chosen payment method implies delivery, the buyer is told **at reservation** that the shipping fee is shouldered by them, and must **accept it before the reservation can be made**. Only then does the reservation go through, and the countdown **pauses** until the **seller sets the shipping fee** (or declines). While paused the buyer sees a **"Waiting for seller"** label and cannot submit payment.

Keep the existing design system, component library, auth screens, seller flows, and claim lifecycle. Reuse existing components (`Modal`, `PrimaryBtn`, `SecondaryBtn`, `Card`, `StatusBadge`, `Countdown`, `Avatar`, `ProductThumb`, `PaymentIcon`, `ContactModal`) — do not invent new visual styles, colors, fonts, or button styles.

**Ordering rule:** Reservation → (shipping fee, paused) → Payment → Shipment → Tracking.

---

## 1. DO NOT CHANGE (preserve exactly as-is)

- The entire visual design system (`DESIGN.md`): Indigo `#191BA9`, cream background, Josefin Sans + Inter, existing card/button/status styles.
- The `?preview=original` demo bypass (`App.tsx`): demo mode must keep booting straight into `stage === "app"` with seed data and no gate. The new flows must also work in demo mode.
- The auth screens (`src/features/auth/*`) and the seller payment-method configuration (`SellerPaymentVerification.tsx` → **Payment Methods** section, the `seller_payment_methods` table and the `seller_receive_methods` RPC).
- The existing claim lifecycle and statuses — `Pending`, `Awaiting Verification`, `Paid and Reserved`, `Expired`, `Cancelled`, `Insufficient Payment` — and the `claimIsPayable` rule in `features/claims/claimExpiry.ts`.
- The `?batch=<id>` shared-link behavior (`buildBatchLink()` / `navIntent`).
- The existing payment-proof flow in `PaymentSubmitModal.tsx`, **except** for the one change in §4.5 (pre-select the method chosen at reservation).
- The existing `orders.tracking_number`, `orders.eta`, `orders.fulfillment_stage` columns and the `set_fulfillment_status()` RPC — **extend** them, do not replace them.
- The `pending_emails` queue + Nylas worker (`process-pending-emails`) + the `wants_email` opt-in gate — only **add** templates.

---

## 2. Current behavior (verify, then change only what is listed)

- **Reservation**: `features/batches/ItemClaimModal.tsx` → "Yes, confirm claim" → `kargoApi.claimProduct` → the `claim_batch_product` RPC creates an order with `reservation_expires_at`.
- The buyer already **sees** the seller's active payment methods in `ItemClaimModal` ("Accepted Payments", loaded via `seller_receive_methods`), but does **not select** one there. The method is selected later, in `PaymentSubmitModal`.
- **Buyer side**: the "Pending Payments" block at the top of `features/claims/MyClaims.tsx` shows payable claims with a `Countdown`; `Pay Now` is gated by `claimIsPayable`. "View Order" (card and table, status `Paid and Reserved`) opens `features/orders/OrderDetailsModal.tsx`, which currently shows Order ID / Product / Batch / Seller / Total + payment records only.
- **Seller side**: the `MyClaims.tsx` seller branch is **Orders Received**. The Fulfillment Board (`features/fulfillment/*`, rendered in Dashboard + Orders) drives `set_fulfillment_status` (`preparing` / `shipped` / `in_transit` / `delivered`), which already writes an in-app notification and queues a buyer email via `queue_fulfillment_email`.
- **Emails**: the `pending_emails` table + Nylas worker (edge function `process-pending-emails`, drained by pg_cron each minute). Each row carries `template` / `subject` / `body` / `context` / `dedupe_key` and is gated by `wants_email(recipient_id, category)`.
- **No address capture exists**: the `addresses` table was dropped in `202609300002_remove_unused_features.sql`. Delivery coordination happens **outside** the app — the only in-app locator will be the buyer's **location pin** (Part B).
- **No courier/rider/shipping-fee data exists** anywhere in the schema or UI.

---

## 3. Part A — Order Tracking

### 3.1 Entry points

- **Buyer → My Claims → "View Order"** (both the card view and the table view). This button already exists; keep its trigger.
- **Buyer → Orders tab** (`features/orders/Orders.tsx`). Add a **"Track order"** action on each order card that opens the same modal.
- **Seller** — read and edit from the Fulfillment Board and Orders Received (see 3.3).

### 3.2 Tracking details (stored per order, read-only to the buyer)

| Detail | Notes |
|---|---|
| **Courier company** | Fixed list + `Others` (free text). See 3.5. |
| **Rider name** | Free text. |
| **Rider contact** | Free text. **Shown to the buyer as well.** |
| **Tracking number** | Reuse `orders.tracking_number`. |
| **ETA** | Reuse `orders.eta`. |
| **Optional tracking URL** | Seller-pasted link. When present, it **overrides** the per-courier URL map. |

Plus the order's own details (item, quantity, seller, amount, current fulfillment status) — the "important details" shown alongside the tracking.

### 3.3 Seller entry — "Add tracking details"

- A new modal, `features/fulfillment/TrackingDetailsModal.tsx` (the `fulfillment` feature is already shared by Dashboard **and** Orders, so this is its correct home).
- Triggered when the seller moves an order to **Shipped** in the Fulfillment Board, and editable afterwards from `FulfillmentDetails.tsx` (the expanded card) and from the Orders Received row.
- Fields: courier company, rider name, rider contact, tracking number, ETA, optional tracking URL.
- Saving persists the values and keeps the existing `set_fulfillment_status` notification + email behavior intact (do not double-send).

### 3.4 Buyer view — "Delivery tracking" section in Order Details

Extend `orders/OrderDetailsModal.tsx` with a **"Delivery tracking"** section below the existing details:

- The **preview card** (3.5) first, then the details list: courier company, rider name, rider contact, tracking number, ETA, the optional link, and the current status (from `fulfillment_stage`).
- **Not shipped yet**: a neutral state — "Tracking appears here once your order ships." — with no preview card.
- **Shipped**: the preview card + full details.

### 3.5 The delivery-process preview (the "Google-Sheets-style" preview)

- A compact **map card** — a small preview that shows the delivery route — built with **Leaflet + OpenStreetMap tiles** (keyless, no vendor account).
- It plots the buyer's **location pin** (the destination — see 4.2) and a **mock rider marker** that moves along a short scripted path in **demo mode**. The card is the click target: **clicking the preview opens the courier's tracking page** in a new tab.
- Click target resolution, in order: (1) the seller's **optional tracking URL**, else (2) `courierTrackUrl(company, trackingNumber)`, else (3) a **copy-tracking-number** affordance with a short note that the courier has no public tracking link.
- **Live rider GPS is explicitly out of scope.** Courier companies expose no public rider-location API and their tracking pages generally block being embedded in an iframe. The moving marker is a demo affordance only; the prompt must say so rather than imply live tracking.
- `components/shared/courierTrackUrl.ts` (new) holds the per-courier URL template map:

| Courier | URL template | Fallback |
|---|---|---|
| Lalamove | *(no public deep link — share links only)* | custom URL / copy number |
| J&T Express | official tracking query page with the number | custom URL / copy number |
| LBC | official tracking query page with the number | custom URL / copy number |
| Grab Express | *(no public deep link)* | custom URL / copy number |
| 2GO | official tracking query page with the number | custom URL / copy number |
| Ninja Van | `https://www.ninjavan.co/en-ph/tracking?id={tracking}` | custom URL / copy number |
| Others | *(none)* | custom URL / copy number |

  The exact template for each carrier **must be verified against the carrier's current site** before shipping; any carrier without a stable deep link returns `null` and relies on the custom URL / copy fallback.

### 3.6 Roles and mobile

- Buyer: read-only. Seller: read + edit.
- Mobile: the preview card is full-width and stacked **above** the courier/rider details; if the map is opened larger it goes full-screen. The single tap target is **"Open tracking"**.

---

## 4. Part B — Buyer-shouldered shipping fee

### 4.1 Applicability rule (settled)

- The buyer **chooses a payment method at reservation** (required) from the seller's configured active methods.
- **Shipping applies to every method EXCEPT `Cash on Meetup`** — with meetup, the seller hands the item over personally, so no shipping fee applies.
- There is **no new seller configuration**: no per-method flag, no per-batch toggle. Applicability is derived from the buyer's chosen method and recorded on the order at reservation.

### 4.2 Reservation changes (`features/batches/ItemClaimModal.tsx`)

For a claim where shipping applies:

1. **Method picker (required)** — the buyer selects one of the seller's active methods before confirming. (Today these are only *listed*; make them selectable.)
2. **Location pin (required)** — a Leaflet/OSM map picker, `components/shared/LocationPinPicker.tsx` (shared because it is used by reservation, by the seller's review, and by the buyer's correction). The buyer **drops a pin or pastes a Google Maps share link**. Address details are coordinated **outside** the app; the pin is the in-app locator and becomes the destination marker on the preview card (3.5).
3. **Shipping note + acceptance (blocking)** — a note: *"The shipping fee is shouldered by the buyer and will be set by the seller before you can pay."* plus a **required checkbox** ("I understand and accept"). **"Yes, confirm claim" stays disabled until it is ticked.**
4. On confirm → the order is created with the chosen method, `shipping_applies = true`, the pin, and the acceptance flag + timestamp.

If the buyer picks `Cash on Meetup`: **no pin, no note, no acceptance, no pause** — today's flow.

### 4.3 Paused deadline ("waiting for seller")

- On a shipping order, the reservation deadline **pauses immediately** (`deadline_paused_at`) until the seller acts. The remaining time is **preserved**: when the seller confirms, the deadline resumes as `now + remaining` — it is never reset and never extended beyond the original.
- The existing expiry sweep (`expire_claim` / the expiry cron) and the 1-hour `queue_payment_deadline_reminders` cron **must skip paused orders**.
- `components/shared/Countdown.tsx` gains a **paused state** reading **"Paused — waiting for seller"** instead of counting down.
- `features/claims/claimExpiry.ts` (`deadlineHasPassed`, `claimIsPayable`, and the expiry sweep helper) must treat paused claims as **not yet expired and not yet payable**.
- A **location-correction request keeps the timer paused** until the seller confirms, even after the buyer resubmits.

### 4.4 Seller actions

On **Orders Received** (`MyClaims.tsx` seller branch), a pending shipping order's row action **"Set shipping fee"** opens a review showing the buyer's pin/map, the item, the amount, and the paused timer, with three actions:

1. **Set shipping fee** — a ₱ amount (`0` = free shipping allowed). Saving **implicitly accepts the pin**, records the fee, **resumes** the deadline, and notifies + emails the buyer. Editable until the buyer submits payment, then locked.
2. **Request location correction** — sends the buyer back to edit the pin; the timer **stays paused**; repeatable.
3. **Decline order** — requires a **reason** (required). Terminal: no reopen (the buyer must re-reserve), the quantity is **released**, and there is nothing to refund because payment cannot occur while paused. The modal **reuses the existing contact mechanism** — `components/shared/ContactModal.tsx` / `contactLink.ts` and the `buyerFb` → confirmation toast → `window.open` pattern used by "Contact Buyer" in `MyClaims.tsx` — so the seller can reach the buyer on their social profile to sort it out outside the app. The buyer is notified in-app **and** by email.

- The seller "**must** set the shipping fee within the reservation deadline" — which is exactly why the deadline is paused.
- The **seller Dashboard** surfaces the same queue under "Pending Actions" and **deep-links to Orders Received** (reuse the existing `navIntent.orderFilter` pattern) rather than opening a second copy of these modals.

### 4.5 Buyer states

- **Pending Payments card**: the chosen **method** + a **"Waiting for seller"** pill, the item amount only, **`Pay Now` disabled**, and the countdown reading **"Paused — waiting for seller"**.
- **After the fee is set**: the countdown resumes with the remaining time; the card shows `item + shipping = total`; `Pay Now` enables; `Amount Paid` defaults to the total.
- **`PaymentSubmitModal`**: the method chosen at reservation is **pre-selected and locked**; the amount reflects item + shipping.

### 4.6 Emails and notifications

Add to the existing `pending_emails` queue via new triggers/RPCs (all gated by `wants_email`, all dedupe-keyed), plus the equivalent in-app notification:

1. **→ Seller**: "A delivery order needs a shipping fee" — sent when a shipping order is reserved (mentions the deadline is paused).
2. **→ Buyer**: "Shipping fee added" — the new total and the resumed deadline.
3. **→ Buyer**: "Seller requested a location correction" — the deadline stays paused.
4. **→ Buyer**: "Order declined by seller" — including the seller's reason.

Use the appropriate existing notification/email `category` for each (payments/claims); if the seller has that category opted out of email, the in-app notification still fires.

---

## 5. Data model and migration (required backend work — describe in the prompt, deliver via a new migration file)

### 5.1 `orders` additions

- `reserved_payment_method text`
- `shipping_applies boolean not null default false`
- `buyer_accepted_shipping_fee boolean not null default false`, `buyer_accepted_shipping_fee_at timestamptz`
- `shipping_state text` — check in (`waiting_for_seller`, `fee_set`, `correction_requested`, `declined`)
- `shipping_fee numeric(12,2)`, `shipping_fee_set_at timestamptz`, `shipping_fee_set_by uuid`
- `delivery_pin_lat double precision`, `delivery_pin_lng double precision`, `delivery_pin_url text`, `delivery_pin_updated_at timestamptz`
- `deadline_paused_at timestamptz` (null = running)
- `courier_company text`, `rider_name text`, `rider_contact text`, `tracking_url text`, `tracking_set_at timestamptz`
- `decline_reason text`, `declined_at timestamptz`, `declined_by uuid`
- Reuse `tracking_number`, `eta`, `fulfillment_stage`.

### 5.2 RPCs

- Extend `claim_batch_product(p_batch_product_id, p_quantity, p_payment_method, p_pin_lat, p_pin_lng, p_pin_url, p_accept_shipping)`: writes the new columns; when shipping applies, sets `shipping_state = 'waiting_for_seller'` and `deadline_paused_at = now()`; otherwise keeps today's deadline.
- `set_order_shipping_fee(p_order_id, p_fee)` — set fee, accept pin, resume deadline, notify + email buyer.
- `request_location_correction(p_order_id)` — `shipping_state = 'correction_requested'`, keep paused, notify + email buyer.
- `decline_delivery_order(p_order_id, p_reason)` — cancel, release quantity, notify + email buyer.
- `update_order_delivery_pin(p_order_id, p_lat, p_lng, p_url)` — buyer edits the pin; the timer stays paused until the seller confirms.
- `set_order_tracking(p_order_id, p_courier, p_rider_name, p_rider_contact, p_tracking_number, p_eta, p_tracking_url)` — or extend `set_fulfillment_status`.
- Update the expiry sweep and `queue_payment_deadline_reminders` to **ignore paused orders**.

### 5.3 RLS

Buyers may update only their **own** pin / acceptance while `shipping_state = 'waiting_for_seller'` (and the pin while `correction_requested`). Sellers may act only on **their own** orders. Everything else stays read-only.

### 5.4 Demo parity

Extend `data/orders.ts` (and `data/batches.ts` where needed) so `?preview=original` demonstrates both flows without Supabase: one **shipped** order with courier/rider/tracking/ETA + a preview card with a mock rider marker, and one **waiting-for-seller** shipping order with a paused timer and a location pin.

### 5.5 Dependency note

This is the **one deliberate new dependency**: `leaflet` (with OpenStreetMap tiles, no API key). Avoid `react-leaflet` if it is not React-19 compatible — wrap Leaflet in a small component instead. Import `leaflet/dist/leaflet.css` where the map components are used. Every other change reuses existing packages.

---

## 6. Files expected to change

| File | Change |
|---|---|
| `src/features/batches/ItemClaimModal.tsx` | Method picker (required), location pin (required), shipping note + blocking acceptance |
| `src/components/shared/LocationPinPicker.tsx` | **New** — Leaflet/OSM pin picker + paste-a-link |
| `src/components/shared/courierTrackUrl.ts` | **New** — per-courier tracking URL map + fallbacks |
| `src/components/shared/DeliveryPreviewCard.tsx` | **New** — the map preview card / click-through |
| `src/components/shared/Countdown.tsx` | Paused state ("Paused — waiting for seller") |
| `src/components/shared/index.ts` | Export the new shared pieces |
| `src/features/orders/OrderDetailsModal.tsx` | "Delivery tracking" section + preview card |
| `src/features/orders/Orders.tsx` | "Track order" action on buyer order cards |
| `src/features/claims/MyClaims.tsx` | Pending Payments states; Orders Received "Set shipping fee"; modal wiring |
| `src/features/claims/SetShippingFeeModal.tsx` | **New** — set fee / accept pin / resume deadline |
| `src/features/claims/RequestLocationCorrectionModal.tsx` | **New** — request a pin correction |
| `src/features/claims/DeclineDeliveryOrderModal.tsx` | **New** — reason (required) + contact-through-social |
| `src/features/claims/claimExpiry.ts` | Paused-aware `deadlineHasPassed` / `claimIsPayable` / sweep |
| `src/features/fulfillment/TrackingDetailsModal.tsx` | **New** — seller "Add tracking details" |
| `src/features/fulfillment/FulfillmentDetails.tsx` | Show/edit tracking on the expanded board card |
| `src/features/payments/PaymentSubmitModal.tsx` | Pre-select + lock the reservation method; total incl. shipping |
| `src/services/kargoApi.ts` | New API calls + map the new order columns |
| `src/types/index.ts` | `OrderRow` / `ClaimRow` additions (shipping + tracking fields) |
| `src/data/orders.ts` | Demo seed: shipped-with-tracking + waiting-for-seller |
| `src/index.css` | Only if Leaflet's stylesheet needs global wiring |
| `package.json` | Add `leaflet` |
| `supabase/migrations/…` | **New migration** — columns, RPCs, RLS, email triggers |

No changes to `src/state/navIntent.ts`, `src/components/shared/shareLink.ts`, or the auth screens.

---

## 7. Acceptance criteria

- [ ] Reserving an item with a non-meetup method shows the shipping note + a checkbox, and **"Yes, confirm claim" stays disabled until it is ticked**.
- [ ] The buyer must **select a method** and **drop/paste a location pin** before confirming a shipping claim.
- [ ] Reserving with **`Cash on Meetup`** shows **no** pin, note, or acceptance — today's flow.
- [ ] A shipping order's countdown shows **"Paused — waiting for seller"** and the pending payment shows a **"Waiting for seller"** pill with **`Pay Now` disabled**.
- [ ] Paused orders do **not** expire while paused (the expiry sweep and the 1-hour reminder skip them).
- [ ] The seller can **set the fee** → the timer **resumes with the remaining time**, the buyer sees `item + shipping`, and `Pay Now` enables.
- [ ] The seller can **request a location correction** → the buyer edits the pin, the timer **stays paused**, and it resumes only after the seller confirms.
- [ ] The seller can **decline** with a **required reason** → the order is cancelled, the quantity is released, and the buyer is notified in-app + by email; the decline modal offers the **social-contact** redirect.
- [ ] Setting the fee is **editable until payment is submitted**, then locked.
- [ ] All four emails are queued on `pending_emails` and respect `wants_email`.
- [ ] On a **shipped** order, View Order shows courier company, rider name + contact, tracking number, ETA, the optional link, and the **preview map card**.
- [ ] Clicking the preview opens the courier link (custom URL → courier URL map → copy fallback) in a new tab.
- [ ] The buyer's Orders tab offers the same "Track order" entry point.
- [ ] The seller's "Add tracking details" is reachable from the Fulfillment Board at **Shipped** and editable from Orders Received.
- [ ] `?preview=original` demonstrates both flows end-to-end with seed data and no Supabase.
- [ ] Kept: the SellerPaymentVerification Payment Methods editor, the existing claim statuses, and `set_fulfillment_status` behavior (no duplicate notifications/emails).

---

## 8. Manual test script (for the demo)

1. As a buyer, open a batch and claim an item, choosing a **non-meetup** method (e.g. GCash). Confirm the shipping note + checkbox blocks "Yes, confirm claim" until ticked, and that the pin is required.
2. Confirm the pending payment shows **"Waiting for seller"**, the countdown reads **"Paused — waiting for seller"**, and `Pay Now` is disabled.
3. As the seller, open Orders Received → **Set shipping fee** → enter a fee. Confirm the buyer's timer **resumes**, the card shows `item + shipping = total`, and `Pay Now` enables.
4. Repeat, but this time the seller taps **Request location correction**; as the buyer, edit the pin and confirm the timer **stayed paused** until the seller confirmed.
5. Repeat, but the seller **declines** with a reason; confirm the order is cancelled, the quantity returns, and the buyer is notified (in-app + email).
6. Claim another item with **`Cash on Meetup`** and confirm none of the shipping steps appear.
7. As the seller, move a paid order to **Shipped** and fill in the tracking details.
8. As the buyer, open **View Order** → confirm the courier, rider, tracking number, ETA and the **preview map card**, and that clicking it opens the courier link.
9. Repeat step 8 from the buyer's **Orders** tab ("Track order").
10. Boot `?preview=original` and confirm the shipped + waiting-for-seller demo data renders the full experience.

---

## 9. Resolved decisions

These are settled — implement them as written.

1. **Prompt scope — settled.** This prompt describes the **whole** tracking + shipping-fee feature (client, backend migration described in-prompt, emails, demo data). The database migration is **described inside this prompt**, not delivered as a standalone file.
2. **Shipping applicability — settled.** Shipping applies to the buyer's chosen payment method **always, except `Cash on Meetup`** (meetup = the seller delivers in person). No per-method seller flag, no per-batch toggle, no change to the seller Payment Methods editor.
3. **Method selection — settled.** The method is **required at reservation**, pre-filled, and **locked** at `PaymentSubmitModal`.
4. **Location pin — settled.** The pin is captured **at reservation**, via a Leaflet/OSM picker that accepts a **dropped pin or a pasted Google Maps share link**, and is **required** for shipping orders. Address details are coordinated outside the app.
5. **Acceptance gate — settled.** A **blocking** checkbox ("shipping fee is shouldered by the buyer"); the claim cannot be confirmed until it is accepted. Acceptance is stored on the order.
6. **Deadline — settled.** The countdown **pauses** on reservation and **resumes with the remaining time** once the seller acts; the pause/resume is **kept inside the deadline mechanism** (expiry sweep and reminders must skip paused orders).
7. **Correction — settled.** A correction request keeps the timer **paused until the seller confirms**, even after the buyer resubmits.
8. **Seller actions — settled.** **Set shipping fee**, **Request location correction**, and **Decline order**; setting the fee implicitly accepts the pin; the fee is editable until payment, then locked.
9. **Decline — settled.** **Reason is required**; decline is **terminal** (no reopen, re-reserve to try again); the quantity is released; the modal **reuses the social-contact redirect** mechanism.
10. **Seller entry point — settled.** Orders Received is the primary surface; Dashboard "Pending Actions" deep-links to it.
11. **Tracking — settled.** **Seller-driven**, entered at the **Shipped** transition; fields are courier company, rider name, rider contact, tracking number, ETA, and an **optional tracking URL**; the **rider contact is shown to the buyer**.
12. **Preview — settled.** A **map preview card** (the "Google-Sheets-style" preview) showing the buyer's pin + a **mock** rider marker; clicking it opens the courier link. **Live rider GPS is out of scope** (no public courier location API).
13. **Courier links — settled.** `courierTrackUrl()` web links (verified per carrier) + the seller's **optional custom tracking URL** (which overrides) + a **copy-number** fallback. Native app-scheme deep links are out of scope.
14. **Couriers — settled.** Lalamove, J&T Express, LBC, Grab Express, 2GO, Ninja Van, Others (free text).
15. **Emails — settled.** All four templates on the existing `pending_emails` queue, gated by `wants_email`, with in-app notification equivalents.
16. **Mobile — settled.** The pin picker and map preview go **full-width / full-screen** on mobile; the tracking preview card stacks above the courier/rider details with a single "Open tracking" tap target.
