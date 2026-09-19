# Figma Design Prompt: Pasabuy Order Reservation & Management System

## Context for the Designer / AI
We have an existing UI design for a web-based Pasabuy order reservation and management system. This prompt is meant to guide the **incorporation of specific functional features** into that existing design — not to redesign it from scratch. Please integrate the following features while preserving the current visual language, layout structure, and component styles already established in the file.

The system has **two primary user roles — Seller and Buyer** — plus a set of **shared/system-level features** used by both. Please treat each role as a distinct flow/dashboard, and clearly separate seller-facing screens from buyer-facing screens, while shared features should appear consistently across both experiences.

---

## 1. SELLER-SIDE FEATURES (Seller Dashboard/Flow)
Design or update screens to support:
- **Batch & Order Management:** Interface for creating, editing, and monitoring Pasabuy batches, with per-item and per-batch order views.
- **Linked Account Display:** A profile section where sellers can add/display linked social media accounts (Facebook, TikTok, Instagram) as reference badges/icons — informational only, not functional login.
- **Product & Pricing Entry:** Forms for adding product details, available quantities, and pricing within a batch.
- **Reservation Period Configuration:** Controls (e.g., time picker/dropdown) for sellers to set how long an item stays reserved before expiration.
- **Extension Approval Panel:** An interface (e.g., notification card with Approve/Deny buttons) for handling buyer-requested reservation extensions.
- **Payment Method Setup:** A settings screen where sellers define accepted payment methods (e.g., GCash, Maya, Bank Transfer, COD) and input corresponding payment details (account numbers/names/QR codes).
- **Payment Verification Screen:** A dedicated view for sellers to review submitted buyer receipts/screenshots side-by-side with transaction details, and manually mark payment status (e.g., "Verified," "Pending," "Rejected").
- **Product Lock/Unlock Toggle:** A visible switch or icon on each product/batch card to lock/unlock availability.
- **Buyer Request Form Management:** An inbox/list view where sellers can view and respond to buyer requests.

---

## 2. BUYER-SIDE FEATURES (Buyer Dashboard/Flow)
Design or update screens to support:
- **Item Claiming via Reservation Link:** A landing/claim screen accessed through an external link (simulating arrival from Facebook Live, FB post, IG, or Messenger), showing the specific product/batch being claimed.
- **Extension Request Button:** An option on the buyer's active reservation card to request more time, which triggers the seller's approval flow.
- **Payment Confirmation Submission:** An upload interface for buyers to attach a receipt/screenshot along with transaction detail fields (e.g., reference number, amount, date).
- **Off-Platform Payment Selection:** A simple selector for choosing COD or other off-platform payment methods (no payment fields required, just method selection for tracking).
- **Waitlist Join Indicator:** A UI state showing "You're on the waitlist" when an item is unavailable, with position/status indicator.
- **Buyer Request Form:** A form buyers can fill out to send a custom request to a seller (e.g., item not listed, quantity inquiry).

---

## 3. SHARED FEATURES (Both Roles)
Design or update elements that appear in both Seller and Buyer experiences:
- **User Profile Screens:** Consistent profile creation/edit UI, adaptable to show either seller-specific fields (linked accounts, payment methods) or buyer-specific fields.
- **Real-Time Inventory Status Indicators:** Visual cues (e.g., "3 left," "Reserved," "Sold Out") on product/batch cards, updating dynamically.
- **Reservation Expiration Indicators:** Countdown timers or expiration badges visible to both roles on active reservations.
- **Transaction Status Tracker:** A step-based or tag-based status system (e.g., Pending → Reserved → Paid → Fulfilled) visible on both seller and buyer transaction views.
- **Transaction History Screen:** A list/table view of past transactions, viewable from both role perspectives (filtered appropriately).
- **Rating System:** A star-rating or review component that appears after a completed transaction, usable by both buyer-to-seller and seller-to-buyer.
- **Issue Reporting Flow:** A "Report an Issue" button tied to a specific transaction, opening a form/modal, accessible to both roles.
- **Email Notification Indicators:** In-app notification bell/toast components reflecting automated email events (e.g., "Reservation expiring soon," "Payment verified").

---

## Design Instructions
1. **Do not alter the existing visual style** (colors, typography, spacing, components) — reuse existing design tokens and components wherever possible.
2. **Clearly separate Seller and Buyer flows** — consider using distinct navigation entry points, dashboard headers, or subtle color-coded tags/labels (e.g., "Seller View" / "Buyer View") to avoid confusion.
3. **Shared components should be built once and reused** across both flows to maintain consistency (e.g., the same transaction status tracker component should appear in both a seller's and a buyer's transaction detail screen, just contextualized).
4. For any new screen, **annotate directly in Figma** (using text layers or comments) indicating whether it belongs to: `[Seller Only]`, `[Buyer Only]`, or `[Shared]` — this will help during dev handoff.
5. Prioritize mobile-responsive layouts if the existing design is already responsive; otherwise, match the existing breakpoint strategy.

---

## Suggested Frame/Page Organization in Figma
- **Page: Seller Flow** → Batch management, payment verification, reservation config, product lock/unlock, buyer requests inbox
- **Page: Buyer Flow** → Item claim, reservation extension request, payment submission, waitlist, buyer request form
- **Page: Shared Components** → Profile, inventory badges, status tracker, transaction history, rating, issue report, notifications