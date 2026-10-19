# KARGO Prompt: Batch Reactions — Seller "Popular Batches" Card + Buyer-Facing Reaction Signals

## Context

This is a **refinement prompt** for the existing KARGO pasabuy / order-fulfillment app (React 19 + Vite + Tailwind v4). It surfaces the batch reaction data that already exists in the product but is used in exactly one place today (the heart on the buyer Home batch card), in two new places:

1. **Seller Dashboard** — a small rectangular card that ranks the seller's most-reacted batches, so a seller can see at a glance which batch is their best / most popular.
2. **Buyer-facing seller storefront** (`SellerShopPage`) — the reaction count becomes a live heart on each batch's cover image, and the shop-wide total reaction count moves into the **TRACK RECORD** card.

Nothing here is a redesign. No database changes. No new API calls. Every number comes from data the client already loads.

**Audience:** a coding agent working in this repository, not Figma Make. Paths below are real.

---

## DO NOT CHANGE (preserve exactly as-is)

- **Data layer, entirely.** `public.batch_reactions`, the `public.batch_reaction_counts` view, the `set_batch_reaction(p_batch_id uuid, p_reacted boolean)` RPC, and all RLS policies. This prompt adds **zero** migrations.
- **`kargoApi`.** `loadCatalog` already returns `reactionCount`, `reactedByCurrentUser`, and `createdAt` per batch; `setBatchReaction` already exists. Do not add loaders, joins, or new RPCs.
- **`Batches.tsx`'s `handleToggleReaction`.** It already handles in-flight guarding (`reactingBatchIds`), the optimistic update, the rollback-and-alert on failure, the `finally` cleanup, and demo mode (when `isSupabaseConfigured` is false it applies the optimistic update and skips the RPC — there is no else-branch, that is intentional). **Reuse it. Do not write a second toggle.**
- **`BuyerHome.tsx`.** Its heart, its `aria-label` strings, its sort, and its markup stay untouched. The storefront heart copies its _idiom_; it does not refactor it.
- **The storefront header stats strip.** It stays Products | Claim Rate | Batches. Reactions are **not** added to it (see the conflict log in §6).
- **Typography and palette per surface.** Seller Dashboard = `Quicksand` headings + `DM Sans` body (see `.seller-dashboard` in `src/index.css`); storefront = `Josefin Sans` for numerals/labels with inline styles already in that file. Do not introduce a new font, and do not migrate either surface to the other's stack.
- **Indigo `#191BA9`, Cream `#F7F3F3`, Cyan `#DEF3FA`, Sky `#5CC2F2`, Coral `#FF8A65`, Green `#3FBF8F`, Amber `#FFC24B`.** The one addition is the heart red already present in `src/index.css` as the reacted-heart colour: `#ef3559`.
- **`ARCHITECTURE.md` dependency direction.** No new shared components unless the piece is used by two or more features. Neither surface added here qualifies.

---

## 1. What already exists (read this before writing any code)

| Layer       | Fact                                                                                                                                                                                                                                                         | Where                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Table       | One heart per authenticated user per batch — PK `(batch_id, user_id)`                                                                                                                                                                                        | `supabase/migrations (to update profile database name)/202609280001_batch_reactions.sql` |
| View        | `batch_reaction_counts` is a `left join` over **all non-draft batches**, so every batch has a row and counts persist after a batch ends                                                                                                                      | same file                                                                                |
| View shape  | `batch_id`, `batch_created_at`, `reaction_count`                                                                                                                                                                                                             | same file                                                                                |
| RPC         | `set_batch_reaction` returns `(reacted boolean, reaction_count bigint)`; guards on auth + `is_active()` + batch exists and is not draft                                                                                                                      | `.../202609280003_set_batch_reaction_rpc.sql`                                            |
| RLS         | `batch_reactions` is **select-own** — an individual reactor is private. Only aggregates are readable. **Neither surface may show who reacted.**                                                                                                              | `.../202609280001_batch_reactions.sql`                                                   |
| Types       | `BatchItem.reactionCount?: number`, `reactedByCurrentUser?: boolean`, `createdAt?: string`, `id: number`                                                                                                                                                     | `src/types/index.ts`                                                                     |
| Loader      | `loadCatalog` reads the counts view ordered by `reaction_count desc` plus the viewer's own reactions; if the reaction schema is missing it logs `"Batch reaction tables are not migrated yet…"` and continues with `reactionCount: 0` and **no `createdAt`** | `src/services/kargoApi.ts`                                                               |
| Toggle      | `handleToggleReaction(batch)` — reused as-is                                                                                                                                                                                                                 | `src/features/batches/Batches.tsx`                                                       |
| Heart idiom | `.buyer-batch-card__favorite`: absolute `top:9 right:9`, `min-width:30px`, `height:30px`, pill, `rgba(255,255,255,.9)`, 9px/800 count, `.is-favorite { color:#ef3559 }`, `:disabled { opacity:.72; cursor:wait }`                                            | `src/index.css`                                                                          |
| E2E check   | Existing script that signs in as `grace@kargo.demo`, toggles a real reaction against Supabase, and restores the original state                                                                                                                               | `scripts/verify-reaction-toggle.mjs`                                                     |

**Consequence:** both surfaces must degrade quietly when the reaction schema is un-migrated. `reactionCount` may be `undefined`; treat it as `0`. Never render `NaN` or `undefined`.

---

## 2. Part 1 — Seller Dashboard: "Popular Batches" card

### 2.1 Placement and file

- New component: **`src/features/dashboard/PopularBatchesCard.tsx`**, default export. It is used by exactly one feature, so it lives beside `Dashboard.tsx` — **not** in `src/components/shared` (per `ARCHITECTURE.md`).
- Render it in `Dashboard.tsx` inside the existing **`<aside className="seller-dashboard-sidebar">`**, as a third child alongside `<section className="seller-pending-actions">` and `<SellerWaitlistCard groups={sellerWaitlist} />`. Placed **after** `Pending Actions` and **before** `SellerWaitlistCard` (actionable items first, informational signal second).
- Build it on the shared `Card` so it inherits the seller sidebar treatment (`.seller-side-card`, `.seller-dashboard-sidebar > .kargo-card` → the blue `#cadcf8` card with `22px` padding and the `0 4px 13px rgba(18,30,71,.18)` shadow). Do **not** hand-roll a background.
- Model the internal structure on `SellerWaitlistCard.tsx`: a `__header` row whose `h2` is `display:inline-flex; gap:7px` with a leading icon, then the body, then the empty copy in the `seller-waitlist-empty` style (12px, `#7f8998`).
- **This must stay a small rectangle.** Do **not** reuse `.seller-stat` — that is a 170px-min-height block with a coloured top rule and a `clamp(30px, 3vw, 43px)` numeral, and it is the wrong shape for the sidebar.
- Props: `batches: BatchType[]`, `sellerName: string`, `onOpenBatch: (batch: BatchType) => void`.

### 2.2 Ranking rule

Filter to the signed-in seller's own batches (`batch.seller === sellerName` — the same identity check `myLiveBatches` and `SellerShopPage` already use), then:

```ts
const mine = batches.filter((b) => b.seller === sellerName);
const reactionCount = (b: BatchType) => b.reactionCount ?? 0;

const ranked = mine
  .filter((b) => reactionCount(b) > 0)
  .sort((a, b) => reactionCount(b) - reactionCount(a) || b.id - a.id);

const top = ranked.slice(0, 3);
const totalReactions = mine.reduce((sum, b) => sum + reactionCount(b), 0);
```

- **Scope: all of the seller's batches, all-time.** Do **not** filter on `live`. A batch that ended is exactly what a seller wants to compare against a new one, and filtering to `live` would blank the card the moment a trip ends.
- **Tie-break: `id` descending.** `BatchType.createdAt` is optional and is only populated when the reaction view returns a row, so it is `undefined` across the board in the un-migrated build. `id` descending is the app's existing "Newest" convention (`SellerShopPage`'s sort select, `Batches.tsx`'s list order). Do not use `createdAt`, and do not add a third convention.
- **Total: the sum across every one of the seller's batches**, including batches that did not make the top three. It is the same figure the storefront shows (§3.2) — keep the two identical.

### 2.3 Card contents

- Header: heart icon + **"Popular Batches"**.
- Up to **three** rows, ranked, each showing:
  - the rank number (1–3),
  - the batch title, truncated with `text-overflow: ellipsis` (titles are long; the row must never wrap),
  - the reaction count as a pill on the right, heart icon + numeral.
- Footer line: **`{totalReactions} total reactions`**. This is the same number the storefront's Reactions tile shows.
- Rows are **interactive**: each is a `<button>` (not a clickable `<div>`) that calls `onOpenBatch(batch)`.
- `Dashboard.tsx` implements that callback as:

```ts
onOpenBatch={(batch) => {
  navIntent.batchId = batch.id
  setTab("Batches")
}}
```

This is the same `navIntent` mechanism `Dashboard` already uses for `orderFilter` and `openExtensionRequests`, and it is what `requestBatchOpen` writes to. Do not invent a new navigation path.

### 2.4 Empty states (both are quiet one-liners, no imagery, card stays in place)

- **Seller has batches, none have reactions:** `No reactions yet. Buyers tap the heart on your batches to show interest.`
- **Seller has no batches at all:** `Publish a batch to start collecting reactions.`
- Render both in the existing `seller-waitlist-empty` style. **Do not** render three rows of `0`, and do **not** hide the card (the sidebar is a stable grid at ≤1080px, so a vanishing card reflows its neighbours).

### 2.5 Accessibility and CSS

- The card is decorative data but the rows are controls: give each row button an accessible name that includes the batch title and the count, e.g. `aria-label="Open {title} — {n} reactions"`.
- Row buttons need a visible `:focus-visible` treatment consistent with the rest of the seller dashboard; the sidebar already uses `box-shadow` for elevation, so reuse an outline rather than inventing a new focus ring.
- New CSS goes in `src/index.css`, next to the `.seller-waitlist-*` block (around line 6742), using a `.seller-popular-batches*` prefix. Any responsive override belongs in the same file's existing `@media (max-width: 1080px)` and `@media (max-width: 760px)` blocks, or in `src/responsive.css` — do not add a new media query for this.
- Respect `prefers-reduced-motion: reduce` on any transition you add (the file already does this for `.seller-stat`).

---

## 3. Part 2 — Buyer-facing seller storefront (`SellerShopPage.tsx`)

### 3.1 Per-batch reaction heart on the cover image

Each batch card in the storefront grid gets the same heart control the buyer Home page uses, on the **upper part of the batch's picture**.

- **It is interactive, not a label.** A buyer browsing a seller's shop can react from there, and the heart **must reflect reactions already made from the Home page** — i.e. it reads `batch.reactedByCurrentUser` and renders filled + `#ef3559` when true, exactly as `BuyerHome` does.
- **It is always rendered, `0` included.** Hiding it at zero would delete the react affordance from the profile for every unreacted batch. Show `0`.
- **It appears on every card in the grid regardless of state** — live, sold out, locked, or past-trip. A sold-out batch is a demand signal; keep it visible.
- **Placement:** absolute top-right of the 120px cover area in `StorefrontBatchCard` (`src/features/batches/SellerShopPage.tsx`). The category pill occupies top-left and `SOLD OUT` occupies bottom-right; top-right is free and matches where buyers already expect this control.
- **Markup:** a `<button type="button">`, not a `<span>`. Inside: `<Heart size={22} strokeWidth={2.2} fill={reacted ? "currentColor" : "transparent"} />` and `<span>{count}</span>`.
- **Click must not open the batch.** Wrap with `event.stopPropagation()`, exactly as `BuyerHome`'s heart does, since the card itself is a click-to-open surface.
- **Styling:** reuse the `buyer-batch-card__favorite` idiom — `rgba(255,255,255,.9)` pill, `min-width:30px`, `height:30px`, `border-radius:999px`, count at 9px/800, `box-shadow:0 1px 4px rgba(0,0,0,.2)`. If the implementer prefers a local class (`.seller-shop-batch__reaction`) rather than reaching into a `buyer-*` class from the shop page, that is fine — **the values must match.** Reacted state uses `#ef3559`; disabled state uses `opacity:.72; cursor:wait`.
- **No local reaction state.** The count and the reacted flag come from the shared `batches` state, so the storefront, the Home page, and the dashboard cannot disagree. The component receives a callback and a pending set; it does not own the mutation.
- **Accessible name:** reuse `BuyerHome`'s strings **verbatim** — `Add {batch.title} to favorites` / `Remove {batch.title} to favorites` — plus `aria-pressed={reacted}`. Identical control, identical announcement. (The `favorites` vs `reactions` vocabulary mismatch is a pre-existing wart; fixing it is a follow-up, not part of this prompt — see §7.)
- **`:disabled` while the mutation is in flight**, driven by the pending set. Do not let a second click queue.

**Gating:** the heart renders only when `role !== "Seller"` (define `canReact = role !== "Seller" && Boolean(onToggleReaction)`, mirroring the existing `canClaim`). A seller previewing their own storefront — which `Batches.tsx` already makes possible via `profileData={shopPage === user.name ? user : undefined}` — sees the count as a **read-only** badge with no button.

### 3.2 TRACK RECORD card: Claim Rate out, Reactions in

In the `TRACK RECORD` `Card` (the `grid grid-cols-2 gap-2` tile list):

- **Remove** the tile `["Claim Rate", `${claimRate}%`, AMBER]`.
- **Add** `["Reactions", String(totalReactions), "#ef3559"]` in that slot.
- Final tile set and order: **Completed | Active Batches / Products | Reactions** — still `grid-cols-2`, still four tiles, no reflow, and the Reactions figure sits where the buyer's eye already goes for "how is this shop doing".
- **`totalReactions` is filter-independent:** sum `reactionCount` across **all** of `sellerBatches`, ignoring the active category tab and the `sortBy`/`visibleBatches` filtering. A shop-wide credential that drops when a buyer clicks "Beauty" reads as a bug, and it must equal the dashboard card's total.
- Keep the existing `These numbers come from recorded transactions.` note.
- Render `0` when there are none — this is a credential, so an absent tile would reflow the grid and read as a rendering fault.
- **Leave the header stats strip alone.** `claimRate` now has exactly one home (that strip, where it keeps its `accent: true` amber). Do not add Reactions there.
- **Do not use amber for Reactions.** Two adjacent amber numerals (Claim Rate above, Reactions below) read as one metric. Heart red `#ef3559` is already in the codebase and matches the heart the buyer just tapped.

### 3.3 Plumbing (the only structural change in this prompt)

`SellerShopPage` needs a callback and a pending set, and one of its two entry points does not pass them yet.

1. `SellerShopPage.tsx` — add two optional props: `onToggleReaction?: (batch: BatchType) => void` and `reactionPending?: Set<number>`. Add `canReact` per §3.1 and thread both into `StorefrontBatchCard`'s props.
2. `Batches.tsx` **line ~825** (direct storefront render) — pass `onToggleReaction={handleToggleReaction}` and `reactionPending={reactingBatchIds}`. Both are already in scope in that branch; `role` is already passed. This is a two-line change.
3. `Batches.tsx` **line ~1608** (`<SellerDirectoryPage …/>`) — pass the same two props, then in `SellerDirectoryPage.tsx` add them to its props type and **forward them into its own `<SellerShopPage …/>` call at line ~81**. `SellerDirectoryPage` is the one place that silently drops props today, and forgetting it means the Browse Sellers path renders a dead heart that looks identical to a live one.

No other call site renders `SellerShopPage`.

---

## 4. Decisions resolved during review

| #   | Decision                     | Resolution                                                                                           |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Deliverable                  | Improved prompt only. **No `src/` code changes in this pass.**                                       |
| 2   | Dashboard ranking scope      | **All** of the seller's batches, all-time. Not restricted to `live`.                                 |
| 3   | Dashboard card contents      | Top **3** ranked, plus a total.                                                                      |
| 4   | Dashboard card placement     | Right-hand sidebar, third card, between Pending Actions and Waitlisted Items.                        |
| 5   | Row interaction              | Rows deep-link to the batch via `navIntent.batchId` + `setTab("Batches")`.                           |
| 6   | Storefront per-batch control | **Interactive heart**, not a label, reflecting `reactedByCurrentUser`.                               |
| 7   | Storefront zero state        | Always render, `0` included.                                                                         |
| 8   | Storefront coverage          | Every card in the grid — live, sold out, locked, ended.                                              |
| 9   | Storefront heart gating      | Hidden for `role === "Seller"`; read-only count instead.                                             |
| 10  | Storefront total placement   | **TRACK RECORD** card, in the slot vacated by Claim Rate.                                            |
| 11  | TRACK RECORD Claim Rate tile | **Removed** (kept in the header stats strip only). The `Completed` tile stays.                       |
| 12  | Storefront total scope       | **Filter-independent**, all of `sellerBatches`.                                                      |
| 13  | Reactions numeral colour     | Heart red `#ef3559`, not amber.                                                                      |
| 14  | Reactions wording            | **"Reactions"**, not "Hearts" — it matches `batch_reactions`, `reactionCount`, `set_batch_reaction`. |
| 15  | Heart accessible name        | Reuse `BuyerHome`'s `Add/Remove {title} to favorites` strings verbatim.                              |
| 16  | Seller self-reaction         | Out of scope (no DB guard, no seller-side UI). Recorded as a follow-up.                              |
| 17  | Other surfaces               | Out of scope. See §7.                                                                                |
| 18  | Dashboard empty copy         | Both one-liners kept as drafted (§2.4).                                                              |

**Every decision in the table above is either your answer or a recommendation you explicitly accepted. There are no unanswered decisions left in this spec.**

**Small judgement calls made where the brief was silent** — surfaced here rather than buried in §2 and §3, because they are mine and not yours:

1. **Intra-sidebar order** — the card sits between Pending Actions and Waitlisted Items (actionable items first, informational signal second). Either neighbour is defensible; move it if you prefer the signal to sit last.
2. **Heart position inside the cover** — top-right. Your brief said "upper part of that batch's pic", which leaves the corner open; top-right is chosen because the category pill holds top-left, `SOLD OUT` holds bottom-right, and it matches where buyers already find the heart on the Home page.
3. **Showing the rank number (1–3)** in each dashboard row — it makes the ordering legible at a glance, but it is not load-bearing; drop the numeral if the row feels busy.
4. **Row accessible name** — `Open {title} — {n} reactions`. The count is included because a screen-reader user gets no cue from the pill otherwise.

---

## 5. Conflict log (superseded decisions — read this before editing)

Four decisions were revised mid-review. The final form is what §2 and §3 specify; the earlier forms must **not** appear in the implementation:

1. **Storefront zero state.** An earlier decision was "hide the pill when the count is 0." That was superseded once the control became interactive: hiding it deletes the react affordance for every unreacted batch and diverges from `BuyerHome`, which renders `0`. **Always render.**
2. **Storefront total placement.** An earlier decision put Reactions in the header stats strip ("right side of Claim Rate"). Superseded: it goes in **TRACK RECORD**, and Claim Rate is removed from TRACK RECORD instead. The stats strip is **unchanged** at Products | Claim Rate | Batches.
3. **Tie-break.** An earlier decision was `createdAt` newest-first. Superseded by `id` descending, because `createdAt` is optional and un-migrated-safe only for `id`.
4. **Mobile stat wrap.** A question about wrapping a four-tile header strip on mobile is **void** — nothing is added to that strip. Do not add a responsive rule for it.

---

## 6. Verification checklist

Run `npm run format` (oxfmt) before finishing, then confirm:

**Dashboard**

- [ ] A seller with 0 reactions sees one quiet line, not three rows of `0`, and not a missing card.
- [ ] A seller with no batches sees the "Publish a batch" line.
- [ ] The card lists at most three batches, ordered by reaction count then `id` descending.
- [ ] A batch that has ended still appears if it is among the seller's top three.
- [ ] Another seller's batches never appear.
- [ ] Clicking a row opens that exact batch on the Batches tab.
- [ ] The total equals the storefront's Reactions tile for the same seller.
- [ ] At ≤1080px the sidebar is 2-up without the card overflowing; at ≤760px it is 1-up.
- [ ] Keyboard: each row is reachable and activatable, with a visible focus ring.

**Storefront**

- [ ] Each card shows a heart at the top-right of the cover, `0` included, on live and sold-out cards alike.
- [ ] A batch the buyer already hearted on the Home page renders filled and `#ef3559` on the storefront, and vice versa after reacting on the storefront and returning Home.
- [ ] Tapping the heart does **not** open the batch; tapping the card still does.
- [ ] The heart is disabled while the request is in flight and cannot double-fire.
- [ ] A failed reaction rolls the count back and surfaces the error (inherited from `handleToggleReaction` — verify it still does).
- [ ] As a Seller previewing their own storefront, the count is visible with **no** button.
- [ ] TRACK RECORD shows Completed | Active Batches / Products | Reactions, with no Claim Rate tile.
- [ ] The Reactions number does **not** change when the buyer switches category tabs or the sort order.
- [ ] The header stats strip is still exactly Products | Claim Rate | Batches.
- [ ] The TRACK RECORD note still reads `These numbers come from recorded transactions.`
- [ ] With the reaction schema un-migrated (console shows `Batch reaction tables are not migrated yet…`), both surfaces render `0` / the empty line — never `NaN`, `undefined`, or a blank tile.

**Regression**

- [ ] `node scripts/verify-reaction-toggle.mjs` still passes end-to-end (it exercises the same RPC the new heart calls).
- [ ] The buyer Home page is visually and behaviourally unchanged.
- [ ] No new circular imports (`npx madge --circular --extensions ts,tsx src`).
- [ ] Both entry points to the storefront — Direct from `Batches.tsx` and via `SellerDirectoryPage` (Browse Sellers) — show a working heart.

---

## 7. Non-goals and recorded follow-ups

**Non-goals for this prompt — do not implement:**

- Any migration, policy, view, or RPC change.
- Any seller-facing reaction **control**. Sellers see counts as read-only text.
- A list of _who_ reacted. RLS makes it structurally impossible; do not design UI that implies it.
- Reaction labels on any other surface: the seller's own batch grid in `Batches.tsx` (the `role === "Seller"` branch), the Browse Sellers list in `SellerDirectoryPage.tsx`, the Orders/Claims tables, or `BatchPage`.
- Renaming `BuyerHome`'s `favorites` copy, or refactoring its heart into a shared component.
- Fixing the TRACK RECORD `Completed` tile, which today renders `totalClaimed` (claimed _items_) while labelled "Completed" — so it duplicates both Products and Claim Rate. It is mislabelled, it is out of scope, and changing a buyer-facing credential mid-prompt would hide the regression.

**Follow-ups worth logging separately:**

1. **Self-reaction integrity.** `set_batch_reaction` checks only `auth.uid()` and `is_active()` — there is **no role guard**, so a seller can inflate their own batch's "popularity" through the API even though no UI offers it. A DB guard rejecting an owner's reaction, or excluding the owner's own heart from the displayed popularity figure, would be a separate change.
2. **Vocabulary.** `BuyerHome`'s accessible name says "favorites" while the model says reactions. Unify, once.
3. **The `Completed` tile** described above.
