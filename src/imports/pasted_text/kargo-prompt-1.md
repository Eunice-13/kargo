# Figma Make Prompt: KARGO — Role-Logic Fixes + Seller Profile Enhancements

## Context
This is a refinement prompt for the existing KARGO app. Do not change the established visual theme (colors, fonts, spacing, components). This prompt covers two things:
1. **Five specific bugs/discrepancies** found in the current build.
2. **Enhancements to the existing Seller Profile view** so buyers can properly vet a seller before claiming — bio, BIR seal badge with an explanation, real clickable social links, and reviews.

---

## DO NOT CHANGE (preserve exactly as-is)
- **Color palette:** Indigo `#191BA9`, Cream `#F7F3F3`, Cyan `#DEF3FA`, Sky `#5CC2F2`, Coral `#FF8A65`, Live Red `#E11D2E`, Green `#3FBF8F`, Amber `#FFC24B`
- **Typography:** "Plus Jakarta Sans" for headings/buttons, "Inter" for body text
- **Existing components:** Card, PrimaryBtn, SecondaryBtn, Toggle, StatusBadge, ReportBadge, Avatar, ProductThumb, Countdown, LiveBadge, BIRBadge, Modal
- **Existing tab structure and Buyer/Seller role toggle**

---

## PART 1 — Bug Fixes

### 1. Seller sees and can edit other sellers' batches
**Problem:** In the Batches tab, when role is Seller, "My Batches" renders the entire global batch list with no ownership filter — a seller can lock/unlock any batch, not just their own. Root cause: batches aren't tied to the logged-in user's identity; new batches are created with a hardcoded seller name instead of the actual signed-up user's name.
**Fix:**
- Filter "My Batches" to only batches where `batch.seller === user.name` (the actual logged-in seller).
- When creating a new batch, set `seller` to the logged-in user's real name, not a hardcoded placeholder.
- The lock/unlock control (on both the batch card and each product row) should only ever appear on batches the current seller actually owns.
- Buyers browsing via "Browse Sellers" or the main batch grid should continue to see all sellers' batches — this fix only applies to what a Seller sees as "their own."

### 2. Seller Dashboard still shows buyer-style pending payments
**Problem:** The Dashboard's stat cards already branch correctly by role, but the sections below them (Recent Claims, Upcoming Deadlines, "Pay All Pending") don't — a Seller still sees a "Pay All Pending" button, which makes no sense since sellers don't pay for their own batches.
**Fix:** Give the Seller dashboard its own version of these lower sections, reusing the same Card/table layout:
- Replace "Recent Claims" with a short preview of recent orders received (pulling from the same data source as the "Orders Received" tab).
- Replace "Upcoming Deadlines" / "Pay All Pending" with a preview of "Payments Awaiting Verification" and "Pending Extension Requests," each with a "View All" link to the relevant tab — no payment button, since sellers verify, they don't pay.

### 3. "My Claims" tab is mislabeled when viewed as Seller
**Problem:** The tab bar always displays the literal label "My Claims," even though the screen it opens is titled "Orders Received" for a Seller.
**Fix:** Make the tab bar label itself role-aware — show "My Claims" for Buyer, "Orders Received" for Seller — using the existing role state, same tab position and styling.

### 4. Reports tab has no role branching
**Problem:** Unlike every other tab, Reports shows identical content regardless of role: the header text, the "Select Order" dropdown (sourced from the buyer's own orders), and the issue-type list are all written only from a buyer's perspective. A Seller opening this tab sees an empty or irrelevant order list and no seller-appropriate issue types.
**Fix:**
- **Buyer** keeps the current version exactly.
- **Seller** sees a parallel version: header text adjusted (e.g., "Reports on Your Orders"), the order dropdown sourced from the seller's own fulfilled/received orders, and a seller-appropriate issue-type list (e.g., "Buyer unresponsive," "Non-payment after confirmation," "False payment claim," "Other"). Reuse the same modal, table, and detail view.

### 5. BIR badge always displays as verified, with no explanation
**Problem:** The BIR badge icon appears next to every seller's name unconditionally, with no indication of what it means or a way to learn more, and no handling for an unverified/pending state even though the registration flow tracks Pending/Verified/Rejected.
**Fix:** Covered in Part 2 below, along with the broader profile enhancement.

---

## PART 2 — Seller Profile Page Enhancements (Buyer-Facing)

The existing Seller Profile view (opened today from "Browse Sellers") already has the right bones — banner, name, rating, tabs for Active Batches / Reviews / About. Enhance it as follows, reusing its current layout and tabs:

### Shop View ("Active Batches" tab) — show the seller's entire shop, not just a batch list
Right now the "Active Batches" tab is a thin list of batch titles with a claimed count. When a buyer taps into a seller's profile, they should land on something that feels like browsing that seller's actual shop, not a summary list. Expand this tab as follows:
- **Shop-level overview strip at the top of the tab** (above the batch list): total number of active batches, total products currently available across all of them, and the shop's overall claimed-out rate (e.g., "4 active batches · 18 products available · 82% claimed this week"). Reuse the existing stat-card visual style from the Dashboard for this strip, scaled down to fit inside the modal.
- **Each batch renders as an expandable card**, matching the same visual treatment used in the main Batches grid (category gradient header, emoji, live/locked badge, progress bar) — not a plain text row. Tapping a batch card expands it in place to show its full product list (thumbnail, name, price, claimed/qty, waitlist count if any) — i.e., the same product-row layout already used in `BatchDetailPanel`, reused here read-only (no Claim/Lock controls in this buyer-facing profile view, since claiming happens from the main Batches tab, not from inside someone's profile).
- **A "Claim from this batch" shortcut** on each expanded batch card that closes the profile modal and opens that exact batch's detail panel in the main Batches tab (reusing the existing claim flow) — so a buyer who found a seller through search isn't stuck without a way to actually claim.
- **Filter/sort controls scoped to this seller only**, mirroring the same filter bar style used in the main Batches tab: filter by category, and sort by Newest / Most Claimed / Ending Soonest.
- If the seller has batches that are sold out, locked, or past their trip dates, still show them lower in the list under a collapsed "Past & Locked Batches" section, rather than hiding them entirely — this gives buyers a fuller sense of the shop's history and volume, not just what's live right now.
- Rename the tab itself from "Active Batches" to **"Shop"** to reflect that it now represents the seller's whole storefront, not just the currently-live ones.

### BIR Seal Badge — make it explain itself
- The BIR badge next to the seller's name should be tappable/clickable.
- Tapping it opens a small popover or modal titled **"What is the BIR Registration Seal Badge?"** containing:
  - "It is a digital badge with a QR code."
  - "It proves your business is registered with the Bureau of Internal Revenue (BIR)."
- Show an actual QR code graphic inside that popover (placeholder QR is fine), not just the small badge icon.
- Only show the badge in its "verified" state if the seller's BIR status is actually Verified — reflect Pending/Rejected states with a visibly different (greyed out or outlined) badge style, consistent with how other status states are styled elsewhere in the app (e.g., StatusBadge/ReportBadge color logic).

### Social Accounts — make them real, clickable redirects
- In the "About" tab, each linked platform (Facebook, TikTok, Instagram) should be a clickable row/button that opens the seller's actual linked profile URL in a new tab — not static display text.
- Use the same platform icon styling already established at signup (the colored circular Facebook/TikTok/Instagram icons).

### Bio — keep as-is
- The seller's bio/description text in the "About" tab stays exactly as currently structured; no changes needed there.

### Reviews — keep as-is, but make the profile reachable from more places
- The Reviews tab (star rating + comment list) stays exactly as currently structured.
- Currently this whole profile is only reachable through the "Browse Sellers" search flow. Make it reachable anywhere a buyer sees a seller's name or avatar — e.g., clicking the seller name/avatar inside a batch card, the Item Claim modal, or an Order row should open this same profile view, not just the search results list.

---

## General Instruction
Use the existing `role` state and existing components (Card, Modal, BIRBadge, Avatar, StatusBadge-style color logic) for all of the above — don't introduce new visual patterns. Every fix should make the app behave consistently with the role that's actually toggled on, and every profile enhancement should slot into the existing Seller Profile modal/tabs rather than creating a separate new screen.