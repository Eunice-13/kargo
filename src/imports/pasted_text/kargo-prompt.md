# Figma Make Prompt: KARGO — Full Screen Spec + Role-Logic Fixes

## Context
This is a **refinement prompt** for the existing KARGO app, not a redesign. The visual theme is final — do not touch colors, fonts, spacing, component styles, or layout structure. This prompt does two things:
1. **Fixes existing role-logic bugs** where Buyer-only and Seller-only actions show up regardless of who's viewing.
2. **Adds the full set of screens/modals** below, each with its required elements, tagged by who it's for so nothing gets built with the wrong role's controls on it.

Every element below is tagged:
- **[Seller]** — only a Seller should see/use this
- **[Buyer]** — only a Buyer should see/use this
- **[Shared]** — both roles see this, though the data shown may differ per role
- **[Public]** — visible to anyone, including logged-out visitors arriving via a reservation link

---

## DO NOT CHANGE (preserve exactly as-is)
- **Color palette:** Indigo `#191BA9` (primary/brand), Cream `#F7F3F3` (background), Cyan `#DEF3FA`, Sky `#5CC2F2`, Coral `#FF8A65`, Live Red `#E11D2E`, Green `#3FBF8F`, Amber `#FFC24B`
- **Typography:** Headings/buttons in "Josefin Sans", body text in "Inter"
- **Existing components:** Card, PrimaryBtn, SecondaryBtn, Toggle, StatusBadge, ReportBadge, Avatar, ProductThumb, Countdown, LiveBadge
- **Existing tab structure:** Dashboard, Batches, My Claims, Payments, Orders, Reports, Settings
- **Existing Buyer/Seller role toggle** in the tab bar

Reuse these existing components for every new screen below rather than inventing new visual styles.

---

## PART 1 — Role-Logic Fixes to Existing Screens

### Dashboard **[Shared, role-conditional data]**
**Problem:** Stat cards (Active Claims, Pending Payments, Waitlist Position, Completed Orders) show identically regardless of role — "Waitlist Position" makes no sense for a Seller.
**Fix:**
- **[Buyer]** keep current cards as-is: Active Claims, Pending Payments, Waitlist Position, Completed Orders.
- **[Seller]** swap to: Active Batches (live + scheduled), Payments Awaiting Verification, Pending Extension Requests, Completed Orders (Fulfilled). Same stat-card component, different data/labels.

### Batches **[Shared, role-conditional actions]**
**Problem:** `BatchDetailPanel` always shows "Claim Item" / "Join Waitlist" — Buyer-only actions — even to the Seller viewing their own batch.
**Fix:**
- **[Buyer]** keep current behavior (Claim Item / Fully Claimed / Join Waitlist / Queue position / Locked state).
- **[Seller]**, on their own batch: remove Claim/Waitlist buttons entirely. Replace the action column with **Edit** and **Lock/Unlock** controls. Claimed/waitlist counts still display as read-only data (e.g., "6/6 claimed · 2 on waitlist").
- If a Seller browses another seller's batch as a customer, that view behaves like the Buyer view — the fix only applies to a Seller's **own** batches.

### My Claims **[Buyer]** → repurposed for Seller
**Fix:** Hide this tab for Sellers, or repurpose it as **"Orders Received"** (claims made by buyers against the seller's own batches), reusing the same table component.

### Payments **[Shared, different flow per role]**
**Fix:**
- **[Buyer]** keep as-is: Pay Now, submit payment confirmation, Payment History.
- **[Seller]** replace with the **Payment Verification** screen (see Part 2, Screen 11) instead of a Buyer-style "Pay Now" flow.

### Orders **[Shared]**
Confirm labels swap correctly by role (e.g., Seller sees "Contact Buyer" where Buyer sees "Contact Seller"), reusing the same modal.

### Reports **[Shared]**
No structural change — confirm the list filters to the current role's own transactions.

### Settings **[Shared, role-conditional sections]**
- **[Seller only]** Linked Accounts, Payment Methods setup, BIR badge status (see Screen 1) — hide for Buyers.
- **[Shared]** Profile, Notifications, Security.

---

## PART 2 — Full Screen / Modal Spec

### 1. Seller Registration Screen **[Seller]**
- Full name / shop name field
- Contact number & email
- Password / confirm password
- Social media account linking (required): dropdown/toggle per platform (Facebook, TikTok, Instagram), URL input per platform, "Add another platform" button
- BIR badge seal upload (required): file upload, label "Upload BIR Certificate for Verification Badge," status indicator (Pending Review / Verified / Rejected)
- Terms & conditions checkbox
- "Create Shop" submit button
- Disclaimer text: linked accounts and BIR badge are reference indicators only, not automatically verified

### 2. Buyer Registration Screen **[Buyer]**
- Full name field
- Contact number & email
- Password / confirm password
- Optional profile photo upload
- "Create Account" submit button

### 3. Seller Search Screen **[Buyer]**
- Search bar (by shop name)
- Filter chips/dropdowns: category, BIR-verified only, rating (4★+), currently live/active batch
- Sort dropdown: Most Relevant, Highest Rated, Newest Shop
- Results as compact shop cards: shop photo/logo, shop name, BIR badge icon (if verified), star rating + review count, "X active batches" tag
- Tapping a card opens the Seller Profile Page

### 4. Seller Profile Page **[Public-facing]**
**Top section (always visible):**
- Shop banner/cover photo, logo, shop name
- BIR Badge Seal icon (only if approved)
- Overall rating (stars + review count)
- Linked social media icons (clickable, external)
- "Message on [platform]" quick-link button

**Tabbed content:**
- Tab: Active Batches — thumbnail, batch name, cutoff date, "X items available"
- Tab: Reviews — star ratings + comments
- Tab: About — shop description, linked accounts list, BIR status detail

**Persistent placement:**
- "Report this Shop" — small text link in the top section, not a prominent button

### 5. Batch Creation Screen **[Seller]**
- Batch name/title field
- Batch description/notes field
- Order-out / cutoff date picker
- Reservation period setting (e.g., "24 hours after claim")
- "Add Product" button → opens Product Entry form
- Table of added products (name, price, qty, thumbnail, edit/delete icons)
- "Generate Reservation Link" button + generated link display + "Copy Link"
- "Publish Batch" toggle (Draft / Live)

### 6. Product Entry Form **[Seller]**
- Product photo upload, name, description, price, available quantity
- Variant options (size/color) — optional
- Lock/Unlock toggle (for live-selling control)

### 7. Item Claim Pop-up **[Buyer]**
- Product photo + name, price & quantity selector
- Shop badge seal (BIR-verified icon) + seller name
- Reservation time limit — live countdown (e.g., "23:59:12 remaining to pay")
- Accepted payment methods — list/icons
- Reminders section (expandable): payment-before-timer-ends warning, COD-tracking-only note, extensions-subject-to-approval note
- "Confirm Claim" button, "Cancel"/close (X)

### 8. Reservation Status / Countdown Card **[Buyer]**
- Item thumbnail + name, live countdown timer
- Status label (Reserved / Payment Pending / Expired)
- "Request Extension" button → opens Extension Request modal
- "Submit Payment Proof" button (if online transfer)

### 9. Extension Request Modal **[Buyer]** submits → **[Seller]** approves
- Current time remaining (display only)
- Requested additional time (dropdown/input, e.g., "+2 hours," "+1 day")
- Optional reason/message field
- "Send Request" button
- Status after sending: Pending Seller Approval / Approved / Denied
- *(Seller side needs a corresponding Approve/Deny panel — see Dashboard fix in Part 1.)*

### 10. Payment Submission Screen (Online Transfer) **[Buyer]**
- Selected payment method display (e.g., "GCash")
- Seller's payment details (account name/number, partially masked)
- Upload field for receipt/screenshot
- Reference number input, account name used for transfer
- "Submit Payment" button
- Status badge: Pending / Confirmed / Rejected

### 11. Payment Verification Screen **[Seller]**
- List of pending payment submissions (buyer name, item, amount, timestamp)
- Thumbnail of uploaded receipt (click to expand)
- Reference number & account name shown beside seller's own records field
- "Confirm Payment" button, "Reject Payment" button (with optional reason field)

### 12. Order/Fulfillment Status Board **[Seller]**
Kanban-style, grouped by status:
- Columns: Claimed | Reserved | Payment Pending | Payment Confirmed | Preparing | Completed | Cancelled | Incomplete
- Order cards (buyer name, item, qty, thumbnail) under each column
- Drag-and-drop or dropdown to change status
- Filter/search bar (by batch, buyer name, item)

### 13. Waitlist Module **[Shared, role-specific views]**
- **[Buyer]** "Join Waitlist" button (sold-out items only), position indicator ("You are #3 in line"), auto-notification banner when a slot opens
- **[Seller]** ordered list of waitlisted buyers per item — read-only, no join action (ties directly to the Batches fix in Part 1)

### 14. Product Lock/Unlock Control **[Seller]** sets → **[Buyer]** sees indicator
- **[Seller]** toggle switch per product: Locked 🔒 / Unlocked 🔓
- **[Buyer]** visual indicator: "This item is currently locked by the seller"
- **[Shared]** small live-session banner: "Live selling in progress"

### 15. Notifications Panel **[Shared, role-specific content]**
- **[Seller]** examples: "New claim on [item]," "Payment proof submitted by [buyer]," "Reservation expiring in 1 hour," "Waitlist slot opened for [item]"
- **[Buyer]** examples: claim confirmations, payment status updates, extension approval/denial, waitlist movement
- **[Shared]** mark as read / clear all, email notification settings toggle

### 16. Buyer Request Form **[Buyer]** submits → **[Seller]** reviews
- Product name/description (free text), desired quantity
- Optional reference photo upload, optional budget/price range
- "Submit Request" button
- Status: Pending Review / Approved / Declined
- *(Seller side needs the inbox/list view already noted in Part 1/earlier spec.)*

### 17. Transaction History Screen **[Shared, filtered per role]**
- List/table: item, date, amount, status, counterpart name
- Filter by date range / status
- "View Details" per row → full transaction record

### 18. Rating Modal **[Shared — buyer rates seller, seller rates buyer]**
- Star rating input (1–5), optional comment/review text
- Transaction reference shown for context
- "Submit Rating" button

### 19. Report Modal **[Shared]**
- Transaction reference (auto-filled, non-editable)
- Reason dropdown (e.g., "Item not as described," "Non-payment," "Non-delivery," "Other")
- Description/details text field, optional evidence upload
- "Submit Report" button
- Disclaimer: reports are recorded for reference and don't auto-confirm misconduct

---

## Recurring Trust/Verification Elements
Keep visually identical everywhere they appear (Seller Profile, Item Claim Pop-up, Order confirmation, etc.) so buyers recognize the same trust cues at every touchpoint:
- BIR Badge Seal icon
- Verified/linked social media icons
- Star rating + review count

---

## General Instruction
Use the **existing `role` state/toggle already in the app** for every role check above — do not introduce a new role system. Every new screen should reuse existing components (Card, PrimaryBtn, SecondaryBtn, StatusBadge, Toggle, Modal) with only content and role-based visibility changed. Nothing here should shift the app's established visual language.