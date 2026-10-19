# KARGO Prompt: Mobile Dashboard + Cart — Compact Tables, Desktop Placement, Smaller Everything

## Context

This is the **second mobile pass**. The first (`kargo-mobile-sizing-prompt.md`) fixed the buyer Home and the global chrome. This one covers the three screens it deliberately left alone:

1. **Buyer Dashboard** — `Dashboard.tsx:816` (`.bdash`): stat tiles → `Recent Claims` table → `Upcoming Deadlines` aside → Fulfillment Board.
2. **Cart** — the buyer-facing label for the `My Claims` tab (`TabBar.tsx:48` → `TabContent.tsx:36` → `MyClaims.tsx`), buyer branch only.
3. **Seller Dashboard** — `Dashboard.tsx:514-812` (`.seller-dashboard`): stat tiles → `Recent Orders` table → sidebar (`Pending Actions`, `Waiting List`, `Popular Batches`).

Two goals, in this priority order:

1. **Make these three screens smaller on a phone**, at the same density as the first pass.
2. **Keep the desktop layout's placement on mobile** — same reading order, single column, everything proportionally smaller. No re-ordering.

### It supersedes

Where this file and `kargo-mobile-sizing-prompt.md` disagree about the **Dashboard** or the **Cart**, this file wins. Specifically it overrides:

- `kargo-mobile-sizing-prompt.md` §5.1's stat-card metric values for these three screens. The phone stat grid stays 2-up; only the numerals and box metrics are re-confirmed here (§4.2).
- `kargo-mobile-sizing-prompt.md` §6's line *"the tables are already card-ified at `≤1024` … Nothing else changes."* For the three tables named in §2 below, they are **no longer** card-ified on a phone.
- Everything else in the first prompt stands, including its §0 desktop-invariance contract, its §0 specificity floor, its §2 phone type scale, and its §9 exceptions. **Reuse the §2 scale; do not invent a second one.**

### Relationship to the first pass's "CSS only" promise

The first pass required every edit to live inside an existing media query. **That promise cannot deliver this pass**, for two reasons that §3 documents in full:

- On a phone the Cart renders **no `<table>` at all** — `MyClaims.tsx:1924` renders `{isMobile || viewMode === "card" ? <card divs> : <table>}`, and `isMobile` is `matchMedia("(max-width: 620px)")` (`MyClaims.tsx:249`). CSS cannot create a table that is not in the DOM.
- "The three most urgent deadlines" is an **ordering**, and CSS cannot sort.

So this pass permits a **small, enumerated, desktop-gated set of JSX changes**. §3 lists every one of them and nothing outside that list may be touched. Every CSS edit still lives inside `max-width: 620px`.

**Audience:** a coding agent working in this repository. Every path, line number and class below was verified against the working tree. Read `kargo-mobile-sizing-prompt.md` §0 and §2 first — this file builds on them and does not repeat the mechanism.

> **Line numbers are anchored to commit `9b4483b`.** The first pass has since landed (`b2356e9`, `9b4483b`) and `src/responsive.css` is under active edit, so its numbers drift. When a citation does not point at the selector it names, **find the rule by selector** — the class names and selectors in this file are stable; the line numbers are only hints.

---

## §0 Hard constraints

### The desktop-invariance contract (inherited, restated)

> After this change, at 1280px and 1440px, **every** layout box, every computed `font-size`, and every `display` value on the three screens must be identical to what it is today.

The first pass's mechanism carries over:

- **CSS:** every added or changed declaration lives inside `@media (max-width: 620px)`, `(max-width: 480px)`, or `(max-width: 380px)`.
- **JSX:** only the changes enumerated in §3, and every one of them is gated on a phone-width check so desktop renders exactly as before.
- **The specificity floor still applies.** `kargo-mobile-sizing-prompt.md` §0 lists the unlayered `!important` rules that outrank component CSS at every width. The two that bite here:
  - `index.css:4828-4831` — `.kargo-original-app main h2 { font-size: 15px !important }`. **Every `h2` inside `main` is 15px, on desktop too.** That includes `.bdash-section-head h2` (`index.css:8154-8161`, which declares `clamp(22px,2.1vw,30px)` and is therefore **dead**) and `.bdash-side h2` (`index.css:8266-8272`, declaring 20px, also **dead**). To set a mobile size you must beat `0,1,2` — write `.kargo-original-app main .bdash-side h2` (`0,2,2`) with `!important`.
  - `index.css:4842-4844` — `.kargo-original-app main th { font-size: 10px !important }`. Table headers are already 10px everywhere unless a higher-specificity rule overrides them; `.seller-orders-table thead th` (`index.css:6140-6145`, `18px`) ties it at `0,1,2` and wins on source order. Don't guess which one a header resolves to — measure it (§7). Sibling rules in the same block: `main h3` 14px (`4833-4836`) and `main table` 12px (`4838-4840`) — the latter is why 12px cells (§2.3) need no fight.

### Files

| File | Role |
| --- | --- |
| `src/responsive.css` | **Where the new `≤620` rules go.** Loads after `index.css` (`main.tsx:4-5`), so it wins equal-specificity ties — that is how you beat `responsive.css`'s own `≤1024` table conversion and `index.css`'s `≤620` block. |
| `src/index.css` | `≤620` rules at `4962-5342` duplicate the table conversion a third time. Only edit here for hygiene if a rule contradicts a new one. |
| `src/features/dashboard/Dashboard.tsx` | Buyer + seller dashboards. Two JSX changes (§3). |
| `src/features/claims/MyClaims.tsx` | The Cart. One JSX change (§3). |

### DO NOT CHANGE

- **The `≤1024` table→card conversion itself** — `responsive.css:84-147` (inside the `@media (max-width: 1024px)` block that opens at `responsive.css:6`) and its duplicate at `index.css:795-858`. It stays exactly as-is for every other table in the app. This pass **undoes** it for three specific tables, at `≤620` only, from `responsive.css`. A tablet at 768-1024 keeps seeing cards — that is intended (§4).
- **Palette, fonts, components, data layer, `kargoApi`, Supabase.** No migrations, no new fonts, no new components unless §2 calls for one.
- **`StatusBadge`** — reused verbatim, rendered smaller. Never re-implemented.
- **`Countdown`** (`src/components/shared/Countdown.tsx`) — reused verbatim.
- **`ProductThumb`, `Avatar`** — reused verbatim.
- **The existing "View All" affordances** — `.bdash-viewall` (`Dashboard.tsx:1091-1097`) and the seller's `View All` button (`Dashboard.tsx:573-575`). Both already call `setTab("My Claims")`. **Do not add a new one**; reuse these.
- **The `(pointer: coarse)` 44px floor** — `responsive.css:191-195`, verbatim.
- **`MyClaims`' seller branch** (`MyClaims.tsx:713-1536`) — untouched.

---

## §1 What is wrong today (verified)

### 1.1 On a phone, none of these tables is a table

`responsive.css:84-147` (at `≤1024`) converts every table inside `:is(.mobile-data-page, .seller-dashboard, .bdash)` into stacked label/value cards:

```css
/* responsive.css, inside the @media (max-width: 1024px) block that opens at line 6.
   "S" stands for the literal prefix
   :is(.mobile-data-page, .seller-dashboard, .bdash)                        */
88:  S table, S tbody { display: block !important; width: 100% !important; min-width: 0 !important }
95:  S thead { display: none !important }
99:  S tbody { display: grid !important; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px }
105: S tbody tr { display: grid !important; min-width: 0; gap: 8px; padding: 14px; border: 1px solid #e5e7eb !important; border-radius: 10px; background: #fff !important; box-shadow: 0 3px 10px rgba(18,30,71,.1) }
116: S tbody td { display: flex !important; min-width: 0; align-items: center; justify-content: space-between; gap: 12px; padding: 0 !important; overflow: visible !important; text-align: right; white-space: normal !important }
128: S tbody td::before { min-width: 82px; flex: 0 0 auto; color: #6b7280; font-weight: 700; text-align: left }
```

`S` puts every one of these at `(0,1,1)`-`(0,1,3)` specificity. The undo selectors in §2.3 are written `.bdash-table …` inside a `:is(.bdash, .seller-dashboard)` scope, i.e. `(0,2,2)` and up — enough to win outright, with `!important` on both sides. Confirm it anyway (`§7.3`) rather than trusting the arithmetic.

`index.css:5079-5145` repeats it at `≤620` (and `index.css:5090-5093` drops `tbody` to one column). `index.css:1009-1011` does the same. The per-column labels come from `::before` rules at `responsive.css:136-147` (`.bdash-table`) and `responsive.css:164-171` (`.claims-history-table`).

Consequence: a 6-column table becomes a card with six right-aligned label/value rows. On a 390px turned-out phone that is **tall, and still doesn't say what the buyer needs** — the product, whether it needs paying, and when.

### 1.2 The Cart has no table on a phone whatsoever

```jsx
// MyClaims.tsx:1924
{isMobile || viewMode === "card" ? (   /* card grid, :1941-2111 */
  ...
) : (                                   /* the real table, :2113-2331 */
```

`MyClaims.tsx:249`:

```js
const query = window.matchMedia("(max-width: 620px)")
```

So at ≤620px `isMobile` is `true`, the branch at `1924` always takes the card path, and the table at `:2113-2331` is never mounted. The table/card toggle that would let a user opt in is itself hidden at `≤620` (`index.css:5213-5219` / `.claims-view-toggle { display: none !important }`).

### 1.3 Two blocks on the buyer Dashboard were never touched by the first pass

The buyer dashboard's **Upcoming Deadlines** panel and every size inside it still render at desktop values on a phone — the first pass's `≤620` work covers only `.bdash-stat*` (`responsive.css:547-575`) and the table conversion:

| Element | Base rule | Still at, on a phone |
| --- | --- | --- |
| `.bdash-side` | `index.css:8256-8264` | `padding: 22px` |
| `.bdash-side h2` | `index.css:8266-8272` (dead — see §0) | 15px |
| `.bdash-deadline` | `index.css:8274-8286` | `min-height: 90px; margin-bottom: 14px; padding: 16px` |
| `.bdash-deadline__name` | `index.css:8288-8293` | 16px |
| `.bdash-deadline__seller` | `index.css:8295-8299` | 10px |
| `.bdash-deadline__amount` | `index.css:8301-8308` | 13px |
| `.bdash-deadline__time` | `index.css:8310-8316` | 10px |
| `.bdash-payall` | `index.css:8320-8335` | `padding: 10px 0; font-size: 14px` |
| `.bdash-cleared` | `index.css:8337-8345` | `padding: 12px 14px; font-size: 12px` |

Each `.bdash-deadline` is `min-height: 90px` and there can be four of them (`Dashboard.tsx:400-411`, `.slice(0, 4)`) — that is ~400px of panel on a phone, at desktop type sizes.

### 1.4 Ordering is already correct — do not "fix" it

Verified: there is no `order:` anywhere for these selectors; `.bdash` is `flex-direction: column` at every width (`index.css:8049-8053`); `.bdash-main` collapses from `minmax(0,1fr) 310px` (`index.css:8133-8138`) to one column at `≤900` (`index.css:8354`) and `≤620` (`index.css:5065`); the seller `.seller-orders-layout` collapses the same way (`index.css:5062-5067`). So **mobile order already equals desktop DOM order** — Recent Claims before Upcoming Deadlines, main column before sidebar.

The "retain desktop placement" requirement is therefore satisfied by *leaving the order alone* and shrinking. If a previous edit or a new component appears to reorder these sections, that is a bug to fix, not a layout to preserve.

---

## §2 The compact table — one spec, three tables

Replace the card conversion on a phone with a **real, rectangular, three-column table**: a header row, one line per item, hairline row separators.

### 2.1 Kept columns

Columns are identified by **DOM index**, because both the header and the body are generated from arrays:

| Surface | Table | DOM columns | Keep | Hide |
| --- | --- | --- | --- | --- |
| Buyer Dashboard "Recent Claims" | `.bdash-table` (`Dashboard.tsx:1100`) | Products, Batch, Seller, Amount, Status, Deadline (`:1103-1115`) | 1, 5, 6 | 2, 3, 4 |
| Seller Dashboard "Recent Orders" | `.seller-dashboard .seller-orders-table` (`Dashboard.tsx:578`) | Products, Batch, Buyer, Amount, Status, Deadline (`:581-595`) | 1, 5, 6 | 2, 3, 4 |
| Buyer Cart | `.claims-history-table` (`MyClaims.tsx:2114`) | Product, Batch, Seller, Qty, Amount, Status, Deadline, Actions (`:2119-2135`) | 1, 6, 7 | 2, 3, 4, 5, 8 |

All three keep the same three fields: **Product, Status, Deadline.**

### 2.2 Displayed order — Product · Status · Deadline

The three kept fields are Product, Status and Deadline. They render in **DOM order** — Status before Deadline — in all three tables:

| | Column 1 | Column 2 | Column 3 |
| --- | --- | --- | --- |
| Buyer Dashboard (`.bdash-table`) | Product | Status | Deadline |
| Seller Dashboard (`.seller-orders-table`) | Product | Status | Deadline |
| Cart (`.claims-history-table`) | Product | Status | Deadline |

**This supersedes the earlier agreement, which had Deadline before Status.** Reordering cells inside a `<table>` is the one thing CSS cannot do — `order` does not apply to `display: table-cell` — so Deadline-before-Status would mean either per-breakpoint cell arrays in the shared row markup (the markup desktop renders) or a duplicated table per dashboard. Neither is worth swapping two adjacent columns. Status-before-Deadline also reads better: *is it paid?* then *when is it due?*

The consequence is a simplification, not a cost: **no `<td>` and no `<th>` moves anywhere.** The work is purely to hide three cells per row (§2.3). The header labels stay in place too — `nth-child(5)` already reads `"Status"` and `nth-child(6)` already reads `"Deadline"`, and both stay exactly where they are.

For the Cart the point is moot — its phone table is new (§3.3) — but it renders the same order, so all three screens agree.

### 2.3 The three-cell table anatomy

```css
/* responsive.css, inside the existing @media (max-width: 620px) block (opens at line 236) */

/* 1. Undo the ≤1024 card conversion for these three tables only. */
:is(.bdash, .seller-dashboard) .bdash-table-wrap,
:is(.bdash, .seller-dashboard) .bdash-table,
:is(.bdash, .seller-dashboard) .seller-orders-table-wrap,
:is(.bdash, .seller-dashboard) .seller-orders-table,
.mobile-data-page .claims-history-table,
.mobile-data-page .claims-history-table table {
  display: revert !important;
  overflow: hidden !important;
  min-width: 0 !important;
  border-radius: 9px !important;
  box-shadow: 0 1px 4px rgba(18, 30, 71, .12) !important;
}

:is(.bdash, .seller-dashboard) .bdash-table,
:is(.bdash, .seller-dashboard) .seller-orders-table,
.mobile-data-page .claims-history-table table {
  width: 100% !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
  font-size: 12px !important;
}

/* 2. Restore the header and the row/cell boxes. */
:is(.bdash, .seller-dashboard) .bdash-table thead,
:is(.bdash, .seller-dashboard) .seller-orders-table thead,
.mobile-data-page .claims-history-table thead { display: table-header-group !important; }

:is(.bdash, .seller-dashboard) .bdash-table tbody,
:is(.bdash, .seller-dashboard) .seller-orders-table tbody,
.mobile-data-page .claims-history-table tbody { display: table-row-group !important; }

:is(.bdash, .seller-dashboard) .bdash-table tbody tr,
:is(.bdash, .seller-dashboard) .seller-orders-table tbody tr,
.mobile-data-page .claims-history-table tbody tr {
  display: table-row !important;
  height: 44px;                     /* the row is the tap target — see §2.5 */
  border: 0 !important;
  border-bottom: 1px solid #eef1f5 !important;
  border-radius: 0 !important;
  background: #fff !important;
  box-shadow: none !important;
  padding: 0 !important;
}

:is(.bdash, .seller-dashboard) .bdash-table tbody td,
:is(.bdash, .seller-dashboard) .seller-orders-table tbody td,
.mobile-data-page .claims-history-table tbody td {
  display: table-cell !important;
  padding: 8px 10px !important;
  overflow: hidden !important;
  color: #374151 !important;
  font-size: 12px !important;
  text-align: left !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

/* 3. Kill the card-mode label pseudo-elements. */
:is(.bdash, .seller-dashboard) .bdash-table tbody td::before,
:is(.bdash, .seller-dashboard) .seller-orders-table tbody td::before,
.mobile-data-page .claims-history-table tbody td::before { content: none !important; display: none !important; }

/* 4. Hide the dropped columns, in both the header and the body. */
:is(.bdash, .seller-dashboard) .bdash-table :is(th, td):nth-child(2),
:is(.bdash, .seller-dashboard) .bdash-table :is(th, td):nth-child(3),
:is(.bdash, .seller-dashboard) .bdash-table :is(th, td):nth-child(4),
:is(.bdash, .seller-dashboard) .seller-orders-table :is(th, td):nth-child(2),
:is(.bdash, .seller-dashboard) .seller-orders-table :is(th, td):nth-child(3),
:is(.bdash, .seller-dashboard) .seller-orders-table :is(th, td):nth-child(4),
.mobile-data-page .claims-history-table :is(th, td):nth-child(2),
.mobile-data-page .claims-history-table :is(th, td):nth-child(3),
.mobile-data-page .claims-history-table :is(th, td):nth-child(4),
.mobile-data-page .claims-history-table :is(th, td):nth-child(5),
.mobile-data-page .claims-history-table :is(th, td):nth-child(8) { display: none !important; }
```

Column widths — Product flexes, the other two are fixed so the header and body agree under `table-layout: fixed`:

```css
:is(.bdash, .seller-dashboard) .bdash-table :is(th, td):nth-child(1),
:is(.bdash, .seller-dashboard) .seller-orders-table :is(th, td):nth-child(1),
.mobile-data-page .claims-history-table :is(th, td):nth-child(1) { width: auto; }

:is(.bdash, .seller-dashboard) .bdash-table :is(th, td):nth-child(5),
:is(.bdash, .seller-dashboard) .seller-orders-table :is(th, td):nth-child(5),
.mobile-data-page .claims-history-table :is(th, td):nth-child(6) { width: 72px; }

:is(.bdash, .seller-dashboard) .bdash-table :is(th, td):nth-child(6),
:is(.bdash, .seller-dashboard) .seller-orders-table :is(th, td):nth-child(6),
.mobile-data-page .claims-history-table :is(th, td):nth-child(7) { width: 84px; }
```

> No cell moves (§2.2), so these `:nth-child()` numbers are stable: `1` is Product everywhere, `5`/`6` are Status/Deadline on the two dashboards, `6`/`7` are Status/Deadline on the Cart. Re-derive them only if §2.2's order ever changes — and measure anyway (§7).

### 2.4 The header row

```css
:is(.bdash, .seller-dashboard) .bdash-table thead th,
:is(.bdash, .seller-dashboard) .seller-orders-table thead th,
.mobile-data-page .claims-history-table thead th {
  padding: 8px 10px !important;
  background: #6995d7 !important;   /* the incumbent header blue */
  color: #fff !important;
  font-size: 10px !important;       /* the §2 "badge" role, uppercase */
  font-weight: 700 !important;
  letter-spacing: .02em !important;
  text-align: left !important;
  text-transform: uppercase !important;
  white-space: nowrap !important;
}
```

`PRODUCT` / `STATUS` / `DEADLINE` — the same words the desktop table uses, in the §2.2 order, uppercased. **Do not rename them.**

### 2.5 Rows are the tap target

Two of the three tables already have a row handler — **preserve its destination exactly**:

| Table | Row handler today | On mobile |
| --- | --- | --- |
| Buyer Dashboard | `onClick={() => setTab("My Claims")}` (`Dashboard.tsx:1125`, with `cursor-pointer`) | keep |
| Seller Dashboard | `onClick={() => setTab("My Claims")}` (`Dashboard.tsx:603`) | keep |
| Cart | **none** — `cursor-pointer` and a hover style, but no handler (`MyClaims.tsx:2159-2167`) | **add one** |

The Cart is the exception, and it matters. Its row actions live in the **Actions column** (`MyClaims.tsx:2233-2309` — `Pay Now`, `Request Extension`, `View Order`), which §2.1 hides. With that column gone and no row handler, those actions become unreachable from this table. Add a row `onClick` that calls the same **order-detail** handler the `View Order` cell already calls. Keep the row's `cursor-pointer` honest: a row that looks tappable must be tappable.

Two consequences to state up front rather than discover later:

- **`Pay Now` is deliberately not on the phone table.** The rows this table lists come from `filtered` → `nonPayableClaims` — claims that are *not* in the buyer's pending payments. The payable ones live in the `Pending Payments` cards at the top of the Cart (`MyClaims.tsx:1694-1820`), which this pass keeps and only shrinks. So a phone buyer still reaches `Pay Now`; it is one section up, not in a row.
- **Extension requests move into the detail modal.** If `Request Extension` mattered on a row, it is reached through the order detail a row tap opens, not from the table. **Verify that path** (§7.3). If it turns out to be a dead end, report it before shipping instead of leaving the row handler pointing at nothing.

Whatever the destination, the row must be **≥44px** tall — hence `height: 44px` above, and why the `(pointer: coarse)` floor at `responsive.css:191-195` must not be narrowed.

### 2.6 Cells

| Cell | Content | Mobile treatment |
| --- | --- | --- |
| Product | `ProductThumb` + product name | reuse as-is; name `12px/600`, `overflow: hidden; text-overflow: ellipsis` |
| Status | `<StatusBadge status={…} />` | **reused verbatim**, rendered at the badge role (10px). Do not restyle the badge's internals. |
| Deadline | `<Countdown …>` when `status === "Pending" && hours > 0`, else `—` | reuse as-is; `11px`. The `—` fallback must survive |

The generic `td` rule in §2.3 sets `color: #374151`, which would flatten the incumbent dark product name (`.bdash-cell-product`, `index.css:8221-8227`, is `#171717/700`). Restore it:

```css
:is(.bdash, .seller-dashboard) .bdash-cell-product,
:is(.bdash, .seller-dashboard) .bdash-cell-product span,
.mobile-data-page .claims-history-table tbody td:first-child span {
  color: #171717 !important;
  font-weight: 700 !important;
  font-size: 12px !important;
}
```

Empty state: keep the existing `No recent claims.` (`.bdash-empty`, `index.css:8249-8254`) and the Cart's empty blocks, at the §2 sizes. A one-row table with an em-dash in every column and no header is not an acceptable empty state.

---

## §3 The permitted JSX changes — the complete list

Nothing outside this list. Each is gated on a phone-width check so desktop renders unchanged.

### 3.1 A phone-width flag on the buyer/seller Dashboard

`Dashboard.tsx` has no `isMobile`. Add one, mirroring `MyClaims.tsx:249` exactly (so the two screens agree on what "phone" means):

```jsx
const [isPhone, setIsPhone] = useState(false)
useEffect(() => {
  const query = window.matchMedia("(max-width: 620px)")
  const sync = () => setIsPhone(query.matches)
  sync()
  query.addEventListener("change", sync)
  return () => query.removeEventListener("change", sync)
}, [])
```

Use `isPhone` for the row selection (§3.2). It is **not** needed for column order any more (§2.2) — no markup reordering is permitted.

### 3.2 The three most urgent rows, and only three

Today:

```jsx
// Dashboard.tsx:192-200 — buyer
const RECENT_CLAIMS_PREVIEW = 7
const recentClaims = claims
  .slice()
  .sort((a, b) => Number(b.id) - Number(a.id))   // newest first
  .slice(0, RECENT_CLAIMS_PREVIEW)
```

```jsx
// Dashboard.tsx:220 — seller, unsorted
const mySellerOrders = claims.filter((claim) => claim.seller === user.name)
// Dashboard.tsx:599 — renders seven
{mySellerOrders.slice(0, 7).map((claim, index) => {
```

Add a phone-only derivation **beside** the existing one. Do not modify `recentClaims` or `mySellerOrders` — desktop depends on them:

```jsx
const URGENT_PREVIEW = 3
const urgentOnPhone = (rows) => {
  const withDeadline = rows
    .filter((r) => r.status === "Pending" && r.hours > 0)
    .sort((a, b) => a.hours - b.hours)          // soonest deadline first
  const withoutDeadline = rows.filter((r) => !(r.status === "Pending" && r.hours > 0))
  return [...withDeadline, ...withoutDeadline].slice(0, URGENT_PREVIEW)
}
const visibleRecentClaims = isPhone ? urgentOnPhone(recentClaims) : recentClaims
const visibleSellerOrders = isPhone ? urgentOnPhone(mySellerOrders) : mySellerOrders
```

Two rules that make this honest:

- **Payable rows sort by soonest deadline.** That is the "three most urgent deadlines" decision. It matches how `upcoming` is already built (`Dashboard.tsx:400-411`: `claimIsPayable` then `a.hours - b.hours`).
- **Rows with no deadline follow**, so a dashboard with fewer than three payable claims still fills its three rows instead of showing one. They keep their incoming order, which for `recentClaims` is newest-first.

Swap the render call sites only: `recentClaims.map` → `visibleRecentClaims.map` (`Dashboard.tsx:1121`) and `mySellerOrders.slice(0, 7).map` → `visibleSellerOrders.map` (`Dashboard.tsx:599`). The `slice(0, 7)` at `:599` is replaced by the helper.

**The Cart is not capped.** It shows every row (§4.3 of the decisions table).

### 3.3 The Cart renders its table on a phone

`MyClaims.tsx:1924` currently makes the card grid the only mobile presentation. Add a compact-table branch ahead of it, and leave the card grid reachable only by the desktop toggle:

```jsx
{isMobile ? (
  /* NEW: the compact three-column table — Product · Status · Deadline, all rows */
) : viewMode === "card" ? (
  /* existing card grid, :1941-2111 — desktop only now */
) : (
  /* existing 8-column table, :2113-2331 — desktop only now */
)}
```

The new mobile block iterates `filtered` (the same array the desktop table maps at `:2158`, so the filter chips at `:1823-1869` keep working) and renders exactly one `<table>` carrying the classes `claims-history-table mobile-claims-table`. Three columns in the §2.2 order — Product, Status, Deadline — all rows, with the header row from §2.4. Reuse `ProductThumb`, `StatusBadge` and `Countdown`, and add the row `onClick` from §2.5 that calls the existing `View Order` handler — the Cart table has no row handler today, and hiding its Actions column would otherwise strand the buyer.

Two consequences to accept explicitly:

- The toggle at `:1870-1921` stays hidden at `≤620` (`index.css:5213-5219`) — on a phone there is now exactly one presentation, which is the point.
- `viewMode` becomes desktop-only state. Do not delete it; the desktop toggle still uses it.

---

## §4 Sizes — reuse the first pass's scale

**Do not invent a type scale.** `kargo-mobile-sizing-prompt.md` §2 defines it: badge 10 · meta 11 · tab label 11 · small control 12 · body 13 · card title 12 · section heading 14 · page title 20 · numeral 22 · form controls 16.

What is new here is the surfaces. Add to the `≤620` block of `responsive.css`:

### 4.1 Buyer Dashboard — the Upcoming Deadlines panel

```css
.bdash-side { padding: 14px !important; border-radius: 9px !important; }
.kargo-original-app main .bdash-side h2 { font-size: 14px !important; margin: 0 0 12px !important; }

.bdash-deadline {
  min-height: 56px !important;     /* from 90px */
  margin-bottom: 8px !important;   /* from 14px */
  padding: 10px !important;        /* from 16px */
  border-radius: 8px !important;
}
.bdash-deadline__name   { font-size: 12px !important; }   /* from 16px */
.bdash-deadline__seller { font-size: 11px !important; }   /* from 10px — §5 exception */
.bdash-deadline__amount { font-size: 12px !important; }   /* from 13px */
.bdash-deadline__time   { font-size: 11px !important; }   /* from 10px — §5 exception */

.bdash-payall  { padding: 11px 0 !important; font-size: 13px !important; }  /* 14px → 13px, height for the tap target */
.bdash-cleared { padding: 10px 12px !important; font-size: 11px !important; }
```

The panel must stay **after** the Recent Claims card (§1.4) — do not move it above the table, and do not turn it into a collapsible.

Also compact the gutter and heading spacing:

```css
.bdash { gap: 26px !important; }                       /* from 48px desktop / 34px at ≤900 */
.bdash-main { gap: 16px !important; }
.bdash-section-head { margin-bottom: 12px !important; }
.bdash-viewall { padding: 6px 12px !important; font-size: 12px !important; }
.bdash-empty { padding: 18px 0 !important; font-size: 12px !important; }
```

### 4.2 Stat tiles (both dashboards)

The first pass already set these; confirm rather than redefine — `.seller-stats` / `.bdash-stats` at `repeat(2, minmax(0,1fr)) !important`, `.seller-stat` / `.bdash-stat` at `min-height: 88px !important; padding: 24px 12px 12px !important`, numerals 22px (`responsive.css:547-575`). If any of those have drifted, restore them. Nothing in this file changes desktop's 4-up row.

### 4.3 Seller Dashboard sidebar

The card padding is **already done** — `responsive.css:577-578` sets both `.seller-dashboard-sidebar > .kargo-card` and `.seller-side-card` to `padding: 14px !important`. Confirm it; do not duplicate it. What is still missing on a phone is the sidebar's rhythm and its headings:

```css
.kargo-original-app main .seller-dashboard-sidebar { gap: 14px !important; }
.kargo-original-app main .seller-side-card { border-radius: 9px !important; }
.kargo-original-app main .seller-section-heading h2 { font-size: 14px !important; }
.seller-orders-layout { gap: 16px !important; }
```

Carry `!important` and the `.kargo-original-app main …` prefix on each — the compact scale (§0) owns `main h2` and card padding.

---

## §5 Size exceptions — the only places anything gets *bigger*

Same discipline as the first pass: everything else reduces or holds.

1. **`.bdash-deadline__seller` 10px → 11px** and **`.bdash-deadline__time` 10px → 11px.** A countdown and a seller name at 10px are the two least readable things on this screen, and the countdown is the whole point of the panel.
2. Nothing else. In particular the table cells, the status badges and the product names are all reductions.

---

## §6 Horizontal scroll

The first pass's ban stands, unchanged:

> On a phone, the **only** element allowed to slide horizontally is `.buyer-batch-grid`.

The compact table must not reintroduce a scroller. Two specific traps:

- `.bdash-table` declares `min-width: 790px` (`index.css:8183-8188`) and `.seller-dashboard .seller-orders-table` declares `min-width: 950px` (`index.css:5650-5668`). Both **must** be neutralised to `min-width: 0 !important` in the `≤620` block (the `table-layout: fixed` rule in §2.3 covers it, but verify it wins).
- The wrapping `.bdash-table-wrap` / `.seller-orders-table-wrap` must go `overflow: hidden` (not `auto`) so a mis-measured column cannot produce a slide.

Verify with the first pass's audit script, `scripts/responsive-audit.mjs` — it already drives CDP at `http://127.0.0.1:9338` against `http://127.0.0.1:8443/?preview=original`, at 320 and 390. Extend it to 360 and 414.

---

## §7 Verification

### 7.1 Static gates

```
npx tsc --noEmit
npm run format:all
git diff --stat -- src/
```

The diff must touch **only**: `src/responsive.css`, `src/index.css` (hygiene only), `src/features/dashboard/Dashboard.tsx`, `src/features/claims/MyClaims.tsx`. Any other file is a failure.

### 7.2 Desktop invariance — the hard gate

Capture `rect` (`x`, `y`, `width`, `height`), computed `font-size`, and computed `display` **before** the change and **after**, at 1280×900 and 1440×900, on all three screens, for:

```
.bdash                        .seller-dashboard           .bdash-table
.bdash-table thead th         .bdash-table tbody tr       .bdash-table tbody td
.bdash-main                   .bdash-card                 .bdash-side
.bdash-side h2                .bdash-deadline             .bdash-deadline__name
.bdash-deadline__seller       .bdash-deadline__amount     .bdash-deadline__time
.bdash-payall                 .bdash-cleared              .bdash-viewall
.bdash-stats                  .bdash-stat                 .bdash-stat__value
.seller-dashboard             .seller-orders-layout       .seller-recent-orders
.seller-orders-table          .seller-orders-table thead th
.seller-dashboard-sidebar     .seller-side-card           .seller-stat
.claims-history-table         .claims-history-table thead th
.claims-history-table tbody tr
```

Two entries deserve special attention because they are `display`-sensitive:

- `.bdash-table tbody tr` and `.claims-history-table tbody tr` must still be **`table-row`** (or the browser's default) at desktop, and `.claims-history-table` must still contain its 8-column table on desktop.
- `.contain`/`display` on `.kargo-tab-label` (desktop: `display: none`) must not change.

**Also verify the seller/Cart early-return paths are unaffected:** log in as a seller and confirm `.seller-dashboard` renders identically; the dead `role === "Seller"` block inside `.bdash` (`Dashboard.tsx:866-1085`) must stay dead.

### 7.3 Mobile acceptance

At 320 / 360 / 390 / 414px, on each of the three screens:

```
buyer Dashboard:  tbody tr count === 3 (or fewer if the buyer has fewer claims)
buyer Dashboard:  every visible th/td is display: table-cell (not flex)
buyer Dashboard:  hidden columns 2,3,4 have display: none in BOTH thead and tbody
buyer Dashboard:  .bdash-side offsetTop > .bdash-card offsetTop   (panel stays below the table)
seller Dashboard: same three assertions on .seller-orders-table
Cart:             tbody tr count === filtered.length              (no cap)
Cart:             exactly one table in the DOM; no .claims-card-grid present
Cart:             hidden columns are 2,3,4,5,8
Cart:             tapping a row opens the order-detail modal (same as "View Order")
Cart:             the Pending Payments cards above still expose "Pay Now"
all:              document.documentElement.scrollWidth === innerWidth
all:              no element satisfies scrollWidth > clientWidth + 4
all:              every tbody tr height >= 44
all:              no computed font-size below 11px, except the 10px badge and table header roles
```

Also confirm the three screens still work with **zero** claims / zero orders (every empty state), and with exactly one and two rows (the three-row rule must degrade gracefully, not blank out).

Also confirm the **desktop** Cart still shows all eight columns of its table, and the desktop dashboards still show all six — this pass hides columns only at `≤620` (§7.2).

### 7.4 Regressions

```
node scripts/verify-reaction-toggle.mjs
npm run test:expiry
npm run test:emails
```

The reaction work (`16daae4`) touched `SellerShopPage.tsx` and `PopularBatchesCard.tsx`; §4.3 resizes the sidebar cards that contain the latter, so re-run the toggle test.

---

## §8 Decisions resolved

| Question | Decision |
| --- | --- |
| Which screens | **Buyer Dashboard + Cart + seller Dashboard.** |
| Where the compact table goes | **All three tables** named in §2.1. |
| Which rows survive | **The three most urgent deadlines** on both Dashboards; **every row** on the Cart. |
| The remainder | The existing **"View All"** affordance (`Dashboard.tsx:1091` buyer, `:573` seller → `setTab("My Claims")`). No new control. |
| Columns | **Product · Status · Deadline** — DOM order, so no cell is moved anywhere (§2.2). |
| Cart's two lists | Only the **lower claims table** becomes the compact table. `Pending Payments` (`MyClaims.tsx:1694-1820`) keeps its cards — they carry `Pay Now` — but shrinks with the §2 scale. Filter chips stay, smaller. |
| Cart row cap | **None.** The Cart *is* the full list; a "View all" there would point at itself. |
| Placement | **Desktop order, single column, smaller.** `§1.4` proves the order already matches, so the work is sizing. |
| Mechanism | **CSS inside `max-width: 620px`**, plus the three enumerated JSX changes in §3. |
| Breakpoints | `≤620` only. A 621-1024px tablet keeps the existing card conversion. |
| Type scale | **Reused** from `kargo-mobile-sizing-prompt.md` §2. No second scale. |

In one line: **the three dashboard/cart tables become real three-column tables on a phone, the dashboards show their three most urgent rows, and everything else on those screens shrinks — with desktop byte-identical.**

---

## §9 Non-goals and follow-ups

**Not in this pass:**

- The tablet band (621-1024px). It keeps cards.
- The `≤1024` conversion rules themselves, and every other table in the app (`Payments`, seller `My Claims`, settings).
- The seller `My Claims` branch (`MyClaims.tsx:713-1536`).
- Any change to sorts, filters, or data beyond the phone-only ordering in §3.2.
- New components, colours, fonts, icons, or motion.
- Extract the three-cell table into a shared component. Three call sites do not justify an abstraction yet — but see follow-up 2.

**Follow-ups to log, not fix here:**

1. **The Cart's `isMobile` + `viewMode` pair is now lopsided.** After §3.3, `viewMode` only affects desktop, while `isMobile` gates the mobile table. A single `useBreakpoint()` hook returning `"phone" | "tablet" | "desktop"` would replace both, and the same hook could serve `Dashboard.tsx`'s new `isPhone`. Worth one consolidating pass.
2. **`claims-history-table` carries eight `td::before` labels** (`responsive.css:164-171`) that this pass makes dead at `≤620` but keeps alive for the tablet band. If the tablet band ever stops card-ifying, those and the sibling label blocks at `responsive.css:136-188` become fully dead.
3. **`index.css:4962-5342` is a third copy of the table conversion.** `responsive.css:84-147` is a second. Removing the duplicate would have prevented the §2 undo from needing three selectors per table.
4. **The dead `role === "Seller"` blocks** inside the `.bdash` return (`Dashboard.tsx:866-1085`) contain a five-column Recent Orders table that this pass does not address because it never renders. Delete it in a cleanup pass, or confirm it is a deliberate fallback.
