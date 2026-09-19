Here's the full addition — organized by tab so you can paste it as one block:

---

**General rule for all interactions:**
"Every clickable element must behave like it would on a real, functioning website — not a static click-to-next-frame prototype. Where an action changes data (claiming an item, paying, updating a profile, toggling a setting), that change must be reflected everywhere else in the app that displays that data, immediately, without needing to reload or re-open the screen."

**Dashboard:**
- "'View all' next to Recent Claims navigates to the My Claims tab, pre-filtered to show the same data."
- "'Pay All Pending' opens a payment confirmation modal listing every pending payment with a total, and a 'Confirm Payment' button."
- "After confirming, the Pending Payments stat card, the 'Pay All Pending' list, and the Payments tab's 'To Pay' list must all update to reflect the reduced (or zero) pending amount — driven by one shared variable, not independent hardcoded values."

**Batches:**
- "When a user clicks 'Claim' on an item inside a batch's expanded view, that item must immediately appear as a new row in the My Claims tab with status 'Pending,' without needing to navigate away or refresh."

**My Claims:**
- "The claims table must update in real time as new items are claimed from the Batches tab — bind the table to a shared claims list variable, not static rows."

**Payments:**
- "'Pay Now' opens a payment modal — payment method selection (GCash / Bank Transfer / Maya / Cash on Meetup), amount due, and a 'Confirm Payment' button."
- "On confirming, that item moves from the 'To Pay' list into the Payment History table below it, with status 'Paid' and today's date, in the same session — no refresh."

**Orders:**
- "Orders must reflect claims that have been paid — once an item is marked Paid in Payments, it should appear in the Orders tab as a new order card at step 'Paid,' not require separate setup."
- "'Track Order' opens a modal or side panel showing the status stepper (Claimed → Reserved → Paid → Ordered → Delivered) with the order's real current step highlighted, not a static image."
- "'Contact Seller' opens a simple message modal or links to a chat panel with the seller's name pre-filled."

**Reports:**
- "'File a Report' must add the new report as a real row in the Reports table immediately after submitting, with status 'Open.'"
- "'View' on an existing report opens a detail modal or panel showing that specific report's full information (order, reason, status, timestamps) — not a dead click."

**Settings:**
- "Profile: editing Full Name, Email, or Bio and clicking 'Save Changes' must update those values everywhere else they appear in the app (header avatar, Settings summary, order/report author fields) — bind to shared variables."
- "Linked Accounts: the Facebook/Instagram 'Connect' flow should open a mock confirmation step where the user enters a username, and once confirmed, the card should update from 'Not connected' to 'Connected as [username]' using what they actually entered."
- "Government ID upload: clicking the upload zone should open a file-picker style interaction requiring an actual image to be attached before the status changes to 'ID Submitted' — it should not auto-complete on click alone. Show an intermediate 'Uploading...' state, then 'Submitted, pending review.'"
- "Notifications: each toggle must be a true on/off switch that changes state and persists when you leave and return to the tab. 'Mark all as read' must actually change every notification's visual state (e.g. remove the unread dot/bold styling) immediately."

**Seller mode:**
- "'+ New Batch' opens a form modal (batch title, category, trip dates, cover image upload, add-item rows) with a 'Create Batch' button. On submit, the new batch must appear as a real card in the Batches grid."

**LIVE badges:**
- "Every 'LIVE' badge across the entire app — Dashboard, Batches grid, batch detail view — must use the exact same red (`#E11D2E` or whatever red is finalized) and the same pulsing dot animation. Audit all instances so none are left in a different or muted shade."

**Tab bar spacing:**
- "Space the seven main tabs (Dashboard, Batches, My Claims, Payments, Orders, Reports, Settings) with equal, generous gaps between each label — increase horizontal padding per tab so the group reads as evenly distributed, not clustered together. Keep the Buyer/Seller toggle and '+ New Batch' button visually separated from the tabs with clear whitespace on the right, not crowded against the last tab."

---

Being straightforward with you: most of what you listed under Dashboard, Batches, My Claims, Payments, Orders, Reports, and Settings isn't really a Figma *prompting* problem — it's asking for genuine cross-screen data state (claim an item here, it shows up there, forms actually save). Figma prototypes can fake pieces of this with variables and conditional logic, but true real-time sync across many tables the way you're describing is the edge of what Figma's prototyping engine does reliably, even with a very precise prompt. It's common to get Figma AI to build a version of this and then hit a wall trying to wire it all up by hand.

Given that — we actually already built a real, coded version of this exact app earlier in this conversation (the HTML file), and that one runs actual JavaScript, so all of this (claim → shows in My Claims, pay → moves to history, save profile → updates everywhere, notifications toggle and persist, etc.) is genuinely buildable and would really work, not just simulate working. Want me to go implement this full list of fixes directly in that HTML file instead? It'd get you an actual working prototype rather than a Figma mockup that only look like it works.