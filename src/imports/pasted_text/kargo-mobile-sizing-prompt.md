# KARGO Prompt: Mobile Proportionality Pass — Smaller Sizes, Shopee-Like Density, Desktop Untouched

## Context

This is a **correction pass**, not a first pass. `MOBILE_REPONSIVENESS.md` already shipped a mobile adaptation (375/390px, table→card conversions, no horizontal document scroll). That pass succeeded at its stated goal and **failed at proportion**: on a phone the app is simultaneously too large in places and too small in others, and one panel bleeds past the viewport edge.

This prompt fixes mobile **size and density only**:

1. **Nothing may render larger on a phone than it does today**, except where noted in §9 (four explicit 1–2px legibility exceptions).
2. The buyer Home gets Shopee-like density: a 2-up product grid, a static 5-across category grid, tighter cards.
3. The **only** horizontally slidable element on a phone is the batches carousel. Everything else wraps.
4. **Desktop is untouched.** Not "looks about the same" — byte-identical for every rule above `max-width: 620px`.

**Audience:** a coding agent working in this repository, not Figma Make. Paths and line numbers below are real and were verified against the working tree.

---

## §0 THE ONE HARD CONSTRAINT: desktop invariance

Every single change in this prompt is confined to existing `max-width` media queries. The acceptance rule is mechanical:

> **No added, removed, or changed declaration may sit outside a `@media (max-width: 620px)`, `@media (max-width: 480px)`, or `@media (max-width: 380px)` block.**
>
> The sole exception is the deliberate **deletion of whole rules** that already live inside a `max-width: 620px` block (the "hammers" in §2). Their deletion is desktop-safe by construction.

Two rules in the tree look mobile-only but are **not** — do not edit either of them:

| Rule | Why it is off-limits |
| --- | --- |
| `index.css:4883-4901` — `.kargo-original-app main .text-\[15px\|13px\|12px\|11px\|10px\]` | **Unlayered, no media query — applies to desktop.** This is why `Claim this item` computes to 11px. Beat it at `≤620` in `responsive.css` instead (§9). |
| `index.css:4903-4906` — `.kargo-original-app .kargo-primary, .kargo-original-app .kargo-secondary { min-height: 32px }` | Unlayered — applies to desktop. Override at `≤620`. |
| `responsive.css:191-195` — `@media (max-width: 1024px) and (pointer: coarse)` blanket `min-height: 44px` | Applies up to 1024px. Do **not** narrow it. If a specific component needs a smaller height, win on class specificity in a `≤620` block. |
| `index.css:4838-4901` — the `/* ─── Original KARGO compact scale ─── */` block | **The real typographic authority.** Unlayered, `!important`, no media query — it sets `main .p-6 → 22px` padding, `main .kargo-card → 18px` padding, `main h2 → 15px`, `main h3 → 14px`, `main table → 12px`, `main th → 10px`, `main .text-xl → 18px`, the `.text-[Npx]` shim, and the inline `fontSize: 22/26` shims — at **every** width. Do not edit it; outrank it. |

`src/main.tsx` imports `./index.css` then `./responsive.css`, so `responsive.css` wins source-order ties. Put overrides that must beat an equal-specificity desktop rule in `responsive.css`.

### The specificity floor for every mobile override

Because that compact scale is `!important` and unlayered, a rule in a `≤620` block only wins if it clears the specificity of the rule that owns the property. This table is the difference between this pass working and silently doing nothing:

| Property you are overriding | Rule that owns it | Specificity to beat | Write it as |
| --- | --- | --- | --- |
| any `h2` inside `main` | `.kargo-original-app main h2` (`index.css:4851`) | `0,1,2` | `.kargo-original-app main .buyer-home-section__heading h2` |
| any `h3` inside `main` | `.kargo-original-app main h3` (`index.css:4856`) | `0,1,2` | `.kargo-original-app main .buyer-batch-card__body h3` |
| card padding | `.kargo-original-app main .kargo-card` (`index.css:4847`) | `0,2,1` | `.kargo-original-app main .seller-dashboard-sidebar > .kargo-card` |
| page padding | `.kargo-original-app main .p-6` (`index.css:4843`) | `0,2,1` | already won — `responsive.css:304-310` ties on specificity and wins on source order |
| `.text-[12px]` buttons | `.kargo-original-app main .text-\[12px\]` (`index.css:4891`) | `0,2,1` | `0,2,1` + `!important`; `responsive.css` wins the tie |
| `.bdash-stat__value`, `.seller-stat strong` | `index.css:8128` / `6522-6525` — **top-level `clamp(30px, 3vw, 43px)`** | `0,1,0` / `0,1,1` | a `≤620` rule in `responsive.css` at the same specificity — it wins on file order. The `≤480` `font-size: 30px` at `5383-5388` is **dead** and must not be relied on. |

Carry `!important` on each. Nothing else in the tree needs the trick, but these six do.

### The desktop contract — hold these exact numbers

Captured from the live app at 1440×900. After your change these must be **identical**. Re-measure with the same selector list (§11.3).

| Element | 1440px value |
| --- | --- |
| `.kargo-header` | `1440×92` |
| `.kargo-tabbar` | `1440×64` |
| `.kargo-tab-label` | `display: none` (0×0 — desktop tab bar is icon-only) |
| `.kargo-footer` | `1440×275` |
| `.kargo-footer__grid` | `3 columns @ 210px`, height 154 |
| `.kargo-footer h2` / `a` | `19px` / `13px` |
| `.buyer-home` | `1444×1994` (the 4px pre-existing desktop bleed is **out of scope** — do not fix it) |
| `.buyer-home__content` | `1080` wide |
| `.buyer-home-filter select` | `190×32` |
| `.buyer-category-grid button` | `200×241`, span `13px` |
| `.buyer-batch-page` | `grid-template-columns: 200px 200px 200px 200px 200px` |
| `.buyer-batch-card` | `200×313` |
| `.buyer-batch-card__image-wrap` | `200×184` |
| `.buyer-batch-card__category` | `52×20`, `8px` |
| `.buyer-batch-card__favorite` | `41×30` |
| `.buyer-batch-card__body h3` | `14px` |
| `__seller` / `__date` / `__progress-label` | `9px` / `9px` / `8px` |
| `.buyer-carousel-controls button` | `36×36` |
| `.buyer-home-section__heading h2` | `15px` |
| `.seller-stats` | `4 columns @ 313px`, height 174 |
| `.seller-stat strong` | `clamp()` → `38.4px` @1280, `43px` @1440 |
| `.seller-dashboard-sidebar` | `310` wide |
| `.seller-side-card` | `310×291` |
| `.seller-board-preview` | height 290 |

---

## DO NOT CHANGE

- **Any base (un-media-queried) declaration.** Sections `§2`–`§8` all say where their override lives.
- **`index.css:4838-4901`** (the "Original KARGO compact scale") — verbatim. Outrank it from `responsive.css` (§0).
- **`index.css:4883-4901`** (the `.text-[Npx]` shim) — verbatim.
- **`index.css:4903-4906`** (`min-height: 32px` on the button pair) — verbatim.
- **`responsive.css:191-195`** (the `pointer: coarse` floor) — verbatim.
- **The desktop `.buyer-home { margin: -24px }`** (`index.css:7415-7420`) — verbatim. The mobile fix is a `≤620` override, never an edit to the base rule.
- **The batches carousel.** `.buyer-batch-grid` keeps `overflow-x: auto`, scroll-snap, and its drag handlers. It is the one exception to §8.
- **Palette, fonts, components, data layer, `kargoApi`, Supabase.** No migrations, no new loaders, no new fonts. Surfaces keep their incumbent stacks (seller Dashboard = `Quicksand`/`DM Sans`; storefront and buyer Home = `Josefin Sans` + `Quicksand`).
- **The batch-reactions feature, already committed as `16daae4 "Add batch reaction features"`.** That commit added `src/features/dashboard/PopularBatchesCard.tsx` and modified `Batches.tsx`, `SellerShopPage.tsx`, `SellerDirectoryPage.tsx`, `Dashboard.tsx` and `index.css`. **Do not revert or refactor any of it.** It obeys this pass like everything else — in particular `.seller-shop-batch__reaction` (§5.3) and the sidebar card (§5.2).
- **`scripts/verify-reaction-toggle.mjs`** and the reaction data path.

---

## §1 What already exists — and why it is disproportionate

### 1.1 Six competing font-size systems

The type on a phone is the output of six systems fighting, and the winner is decided by CSS specificity, not by design:

| # | System | Where | Behaviour |
| --- | --- | --- | --- |
| 1 | Tailwind arbitrary utilities in JSX | `text-[10px]`…`text-[22px]` | the author's intent |
| 2 | **Compact scale** — `!important`, unlayered, **no media query** | `index.css:4838-4901` | `main h2 → 15px`, `main h3 → 14px`, `main .kargo-card → 18px` padding, `main .p-6 → 22px` padding, `main table → 12px`, `main th → 10px` — **at every width, desktop included** |
| 3 | **Utility shim** | `index.css:4883-4901` | `[15]→14px`, `[13]→12px`, `[12]→11px`, `[11]→10px`, `[10]→9px`, all `!important`, **desktop-applying** |
| 4 | Component CSS | `.buyer-batch-card__category: 8px` (`index.css:7666`), `h3: 12px` (`7754-7759`), `__progress-label: 8px` (`7795`), `__seller/__date: 9px` (`7773`), `.bdash-stat__value: clamp(30px,3vw,43px)` (`8128`), `.seller-stat strong: clamp(...)` (`6522-6525`) | the real design values — and several of them are **already dead**, defeated by system 2 or 3 |
| 5 | **The `≤620` hammers** | `responsive.css:286-302` **and duplicated at `index.css:1001-1018`**; auth variant at `responsive.css:430-433` | forces `16px !important` onto every `p, span, small, label, a, button, input, select, textarea, td, th, dt, dd` in `main`/`.si`/`.kargo-footer`, **and** onto any inline `font-size: 8px`…`15px` |
| 6 | Ad-hoc `≤480`/`≤760` blocks | `index.css:7844-7854`, `7919-7931`, `5362-5396`, `8367-8379`, `8436-8448` | per-component sizes |

The hammers' `:is()` list omits **`strong`, `h1`–`h6`, and `div`**. So a row containing a `strong` and a `span` renders at two different sizes, and a `div` label escapes entirely.

Two consequences that will bite you if you skip §0:

- **`main h2` is 15px and `main h3` is 14px everywhere.** The component-level `.buyer-home-section__heading h2 { font-size: 18px }` (`index.css:7849`) and `.buyer-batch-card__body h3 { font-size: 12px }` (`index.css:7759`) are both **already dead** — `index.css:4851/4856` outrank them. So the buyer card title has always rendered at 14px, not 12px, and the section heading has never been 18px.
- **`.p-6` padding is 22px on desktop and 16px on a phone** only because `responsive.css` loads after `index.css` and ties on specificity. That is the mechanism you are extending; it is not a coincidence.


### 1.2 Measured proof of the collision (one buyer Home card, 390px)

| Element | Declared | Computed | Why |
| --- | --- | --- | --- |
| `.buyer-batch-card__progress-label` | `8px` (`index.css:7795`) | **8px** | a `div` — not in the hammer's list |
| `…__progress-label strong` | inherits | **8px** | `strong` — not in the list |
| `.buyer-batch-card__seller` | `9px` (`7773`) | **9px** | a `div` |
| `…__seller span` | inherits | **16px** | `span` — *is* in the list |
| `.buyer-batch-card__category` | `8px` (`7666`) | **16px** | a `span` — *is* in the list |
| `.kargo-primary` ("Claim this item") | `text-[12px]` | **11px** | the shim (specificity `0,2,1`) outranks the hammer (`0,1,2`) |

That is the whole complaint in one row: 8px, 9px, 11px, 14px and 16px inside a single 152px card body.

### 1.3 Measured defects to fix (390px, buyer shell)

| Defect | Measured | Cause |
| --- | --- | --- |
| Panel bleeds past the viewport | `.buyer-home` is **406px wide in a 390px viewport** at `x = -8` (8px each side) | `.buyer-home{margin:-24px}` (`index.css:7416`) cancels a desktop `p-6` of 24px; on a phone `p-6` is **16px** (`responsive.css:304-310`, `index.css:1020-1026`), so the negative margin overshoots by 8px per side |
| Category tiles enormous and sliding | `.buyer-category-grid button` **272×319**, track `scrollWidth 1449` vs `clientWidth 386` | `flex-basis: 72%` at `≤480` (`index.css:7852`) |
| Batch cards enormous, one per row | card **378×372**, image **220px**, page `9,543px` tall | `.buyer-batch-page{1fr}` at `≤620` (`responsive.css:342-345` `!important`, `index.css:1070-1073`) and `≤480` (`index.css:7851`); image `220px` at `index.css:7853` |
| Category pill dominating the cover | pill **88×31** | its `span` is inflated to 16px (§1.2) |
| Heart numeral squeezed | heart pill `43×30`, its `span` collapses to **6px wide** | its `span` is inflated to 16px in a 30px pill |
| Footer is a whole screen | `.kargo-footer` **767px tall** (91% of an 844px viewport); `__grid` locked to a **220px single column** | `index.css:7965-7969` (`≤480`) and `8427` (`≤620` `!important`), plus the 16px footer hammer (`responsive.css:288`) |
| Seller stats stacked | `.seller-stats` 1 column at `≤480` → 4 × `.seller-stat` at 124–149px ≈ **600px**, numerals 30px | `index.css:8437-8440` and `5372-5381` |
| Buyer dashboard stats | `.bdash-stats` 1 column, `.bdash-stat{min-height:150px}`, numerals 30px | `index.css:8376-8377`, `8128` |

### 1.4 Two things that are **not** defects

- **`overflowCount = 740` on buyer Home is a false alarm.** 738 of those are the off-screen carousel pages of `.buyer-batch-grid` (cards at `left: 1196`, etc.). Horizontal carousel content is *supposed* to sit outside the viewport. Only the 8px bleed in §1.3 is real.
- **Tap-target sizes measured in the emulator are unreliable.** `responsive.css:191-195` gives bare `button`, `a[href]`, `select`, and checkboxes a `min-height: 44px` under `(pointer: coarse)`, which a headless emulator does not report. Class-based heights (`height: 30px` on the hearts, `32px` on the arrows) win on specificity and are what you should reason about. Do not "fix" a target-height number taken from an emulator run.

---

## §2 Kill the hammers; install one phone type scale

**Delete these rules outright** — all three live inside `@media (max-width: 620px)` blocks, so removing them cannot touch desktop:

1. `responsive.css:286-291` — the `main`/`.si`/`.kargo-footer` → `16px !important` triple selector.
2. `responsive.css:293-302` — the `[style*="font-size: 8px"] … [style*="font-size: 15px"]` → `16px !important` block.
3. `responsive.css:430-433` — the `.auth-page :is(...)` → `16px !important` block.
4. `index.css:1001-1007` — the duplicate of (1).
5. `index.css:1009-1018` — the duplicate of (2).

**Then add exactly one scale.** Put it in `src/responsive.css` inside the existing `@media (max-width: 620px)` block that starts at line 236. One commented table, no `!important` except where §9 says a desktop rule must be beaten.

| Role | Size | Weight | Line-height | Who uses it |
| --- | --- | --- | --- | --- |
| Badge / pill | **10px** | 700–800 | 1.2 | `.buyer-batch-card__category`, `SOLD OUT` badge |
| Meta / caption | **11px** | 600 | 1.3 | `__seller`, `__date`, `__progress-label` (and its `strong`), `.bdash-stat__sub` |
| Tab label | **11px** | 600 | 1.1 | `.kargo-tab-label` (already correct — do not change) |
| Small control | **12px** | 700 | 1.2 | `PrimaryBtn size="sm"`, `SecondaryBtn`, chips, `View All` |
| Card title | **12px** | 700 | 1.3 | `.kargo-original-app main .buyer-batch-card__body h3` — computes **14px** today (`main h3`, §1.1), so this is a 2px drop |
| Body / CTA | **13px** | 500–700 | 1.45 | plain paragraph copy needs **no rule at all** — the app root is already 13px (`.kargo-original-app`, `index.css:4839-4841`); once the hammers are gone it simply falls back to 13px |
| Section heading | **14px** | 700 | 1.25 | `.kargo-original-app main .buyer-home-section__heading h2` — computes **15px** today, not 18px (§1.1) |
| Page title | **20px** | 700 | 1.2 | batch page `h1`; `.auth-heading h1` → **26px** (from 32px, `responsive.css:428`) |
| Metric numeral | **22px** | 600–700 | 1.1 | `.seller-stat strong`, `.bdash-stat__value` |
| **Form control** | **16px** | 500 | 1.4 | `input`, `select`, `textarea` |

**The form-control row is the one part of the hammers worth keeping.** `input`, `select`, `textarea` stay at **16px** at every phone width, or iOS Safari zooms the page on focus. Write it as a deliberate, commented rule:

```css
/* 16px on form controls is a platform requirement (iOS focus-zoom), not styling. */
.kargo-original-app main :is(input, select, textarea) { font-size: 16px !important; }
```

**Deleting the hammers is the single largest win in this pass.** They are what forces 16px onto body copy that is otherwise 13px. Everything else in the table is a further **reduction** against today's *computed* values.

**Every row must be written to the specificity floor in §0.** A rule that loses the cascade is worse than no rule: it reads as done and does nothing. When you finish, spot-check the computed value of each role at 390px rather than trusting the stylesheet.

---

## §3 Fix the 8px bleed

In the `≤620` block of `responsive.css` (do **not** edit the base rule):

```css
.kargo-original-app main .p-6,
.fi > .p-6 { padding: 16px; }        /* already true at ≤620 — leave as is */

/* `.buyer-home` cancels the desktop 24px padding with a -24px margin.
   On a phone that padding is 16px, so the cancel must be -16px. */
.buyer-home {
  margin: -16px;
  padding-bottom: 40px;              /* was 84px — see §4 */
}
```

Acceptance: `.buyer-home` measures **390 × N at `x = 0`** at a 390px viewport, and `document.documentElement.scrollWidth === innerWidth`. `.buyer-home__content` stays `min(100% - 28px, 1080px)` (`index.css:7845`), giving 14px gutters.

---

## §4 Buyer Home — Shopee-like density

All of this lives in the `≤620` block of `responsive.css` — every authoritative declaration, in one place. Where an existing `≤480` rule in `index.css` would contradict a new rule (the card image height, the single-column grid, the 72% category basis), fix that stale rule in place as well so the tree does not carry two competing answers. Both files' `≤480`/`≤620` blocks are media-scoped, so neither edit can reach desktop.

### 4.1 Two-up batch grid

```css
.buyer-batch-page {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 14px 10px;
}
```

You must also neutralise the two rules that force a single column:

- `responsive.css:342-345` — currently `minmax(0, 1fr) !important` → `repeat(2, minmax(0, 1fr)) !important`
- `index.css:1070-1073` — same change
- `index.css:7851` (`≤480`) — `1fr` → `repeat(2, minmax(0, 1fr))`

At 390px each card is ~175px wide. `.buyer-batch-grid` keeps its scroll-snap carousel; each page now shows four batches (2×2) instead of one column.

### 4.2 Card geometry

Edit `index.css:7853` (the `≤480` block) in place:

```css
.buyer-batch-card__image-wrap { aspect-ratio: 1 / 1; height: auto; }   /* was height: 220px */
```

Add to the `≤620` block: `.buyer-batch-card__body { padding: 9px 9px 10px; }` (from `12px 11px 13px`, `index.css:7751`).

### 4.3 Card typography

Add to the same `≤620` block in `responsive.css` — one place for all the type, so it cannot be split across two files:

```css
/* Must outrank `main h3 { font-size: 14px !important }` (index.css:4856) — see §0. */
.kargo-original-app main .buyer-batch-card__body h3 {
  font-size: 12px;                 /* computes 14px today (§1.1) */
  margin: 0 0 6px;
  white-space: normal;             /* was nowrap + ellipsis (index.css:7763) */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;                /* required for the clamp to actually cut */
}
.buyer-batch-card__seller,
.buyer-batch-card__date { font-size: 11px; gap: 5px; }        /* from 9px */
.buyer-batch-card__date { margin-top: 6px; }                    /* from 8px */
.buyer-batch-card__progress-label { font-size: 10px; margin-top: 9px; }   /* from 8px / 13px */
.buyer-batch-card__progress-label strong { font-size: 10px; }
.buyer-batch-card__category {
  font-size: 10px;                 /* from 8px; it currently *computes* to 16px — §1.2 */
  padding: 3px 7px;
  top: 8px;
  left: 8px;
  max-width: calc(100% - 46px);
}
.buyer-batch-card__favorite { top: 8px; right: 8px; }
.buyer-batch-card__favorite span { font-size: 11px; }           /* from 9px */
```

Two lines of title beats one truncated line: the 2-up card is narrow, and Shopee clamps too.

### 4.4 Category grid — 5 across, no sliding

The category section is `<section class="buyer-home-section buyer-category-section">` (`BuyerHome.tsx:423`) and it renders **no** carousel controls — `CarouselControls` belongs to the batch sections only. So there is nothing to hide; the grid simply stops scrolling and wraps.

`.buyer-category-grid` also carries `.buyer-carousel-track` (`BuyerHome.tsx:429`), which is what makes it scroll. Override it by section (higher specificity than the base class) in the `≤620` block:

```css
.buyer-category-section .buyer-category-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px 8px;
  overflow: visible;
  scroll-snap-type: none;
}
.buyer-category-section .buyer-category-grid button { width: 100%; flex-basis: auto; }
.buyer-category-section .buyer-category-grid img { aspect-ratio: 1 / 1; border-radius: 8px; }
.buyer-category-section .buyer-category-grid span {
  margin-top: 6px;
  font-size: 11px;                 /* 13px on desktop, 16px on a phone today (§1.2) */
  line-height: 1.15;
  white-space: normal;             /* allow 2 short lines instead of ellipsis */
}
```

Five across at 390px gives ~66px tiles. Also neutralise `index.css:7852` (`flex-basis: 72%`) and `index.css:7833` (`calc((100% - 60px) / 4)` at `≤1050`) for this section — the grid override above wins on specificity, but confirm it does.

### 4.5 Filter bar and section rhythm

In the same `≤620` block:

```css
.buyer-home-filter { margin: 20px 14px 0; padding: 10px 12px; gap: 8px; border-radius: 8px; }
.buyer-home-filter select { min-height: 32px; }      /* unchanged height, 16px text via §2 */
.buyer-home-filter__request { min-height: 32px; font-size: 12px; }
.buyer-home-section { margin-top: 28px; }            /* from 52px, index.css:7848 */
.kargo-original-app main .buyer-home-section__heading h2 { font-size: 14px; }  /* computes 15px today; the 18px at index.css:7849 is dead — §1.1 */
.buyer-batch-card__track { height: 3px; margin-top: 5px; }
```

---

## §5 Seller Dashboard

### 5.1 Stat cards: 2-up, smaller numerals

Several `≤480`/`≤560`/`≤760` blocks currently stack them. Edit in place, all media-scoped:

| File:line | From | To |
| --- | --- | --- |
| `index.css:8437-8440` (`≤480`) | `.seller-stats, .bdash-stats { grid-template-columns: minmax(0, 1fr) !important }` | `repeat(2, minmax(0, 1fr)) !important` |
| `index.css:8442-8447` (`≤480`) | `.seller-stat, .bdash-stat { min-width: 0; min-height: 124px !important; padding: 38px 18px 16px !important }` | `min-height: 88px !important; padding: 24px 12px 12px !important` |
| `index.css:5372-5381` (`≤480`) | the same `.seller-stats`/`.seller-stat` pair, without the `min-width` | mirror the two rows above |
| `index.css:7948-7955` (`≤480`) | `.seller-stats { 1fr }`, `.seller-stat { min-height: 130px }` | already beaten by `8437`/`8442` (later in file, `!important`) — update for hygiene, not for effect |
| `index.css:7924-7927` (`≤760`) | `.seller-stat { min-height: 145px; padding: 40px 18px 18px }` | `min-height: 108px; padding: 30px 14px 14px` |
| `index.css:8376-8377` (`≤560`) | `.bdash-stats { 1fr }`, `.bdash-stat { min-height: 150px }` | `repeat(2, minmax(0, 1fr))`, `110px` |

**The numerals need a different tactic — as written they will not change.** `.seller-stat strong` (`index.css:6522-6525`) and `.bdash-stat__value` (`index.css:8128`) are **top-level** `clamp(30px, 3vw, 43px)` rules, and they come *after* the `≤480` declarations in source order. So the `font-size: 30px` at `index.css:5383-5388` is **dead** on a phone: editing it changes nothing. Set the 22px in the `≤620` block of `responsive.css`, where file order wins the tie:

```css
.kargo-original-app .seller-stat strong,
.kargo-original-app .bdash-stat__value { font-size: 22px !important; }
```

Leave (or delete) `index.css:5383-5388`; it is decoration.

Also in the `≤620` block: `.bdash-stat__label { font-size: 12px }` (from 15px, `index.css:8136`), `.bdash-stat__sub { font-size: 11px }` (from 14px, `8143`), `.bdash-stat__icon { top: 16px; right: 14px }` (from `21px/20px`, `8119-8121`).

Desktop keeps its 4-up row and its `clamp()` numerals.

### 5.2 Sidebar cards, including the new Popular Batches card

The sidebar cards carry `padding: 22px` via `.seller-side-card` / `.seller-dashboard-sidebar > .kargo-card`. Tighten it in the `≤620` block — **not** by editing the Tailwind `p-5` on `PopularBatchesCard.tsx`, which would change desktop:

```css
/* Must outrank `main .kargo-card { padding: 18px !important }` (index.css:4847) — see §0. */
.kargo-original-app main .seller-dashboard-sidebar > .kargo-card,
.kargo-original-app main .seller-side-card { padding: 14px !important; }
.seller-popular-batches { /* nothing structural — it inherits the above */ }
```

The new card measured `362×102` at 390px with its empty state, built on `Card` + `p-5 seller-popular-batches` on the blue `#cadcf8` treatment. Do not restyle it; just let it take the tighter padding. Its row numerals and labels follow §2 (12px/11px), and its rows must remain ≥44px tall tap targets via padding, not by inflating text.

### 5.3 The storefront heart is in the same blast radius

`.seller-shop-batch__reaction` (`index.css:7707-7748`) is the storefront counterpart of the buyer heart, added by the reactions work. It has the same shape (`height: 30px`, `span { font-size: 9px }`) and therefore the same 16px inflation of its `span`. Apply the identical treatment as §4.3's favourite, in the same `≤620` block:

```css
.seller-shop-batch__reaction { top: 8px; right: 8px; }
.seller-shop-batch__reaction span { font-size: 11px; }
```

---

## §6 Buyer Dashboard, Cart, Batches and Batch detail

- **Stat numerals** — covered by §5.1 (`22px`, `min-height: 88px`, 2-up).
- **`.bdash` padding** — `index.css:8375` sets `30px 16px 48px` at `≤560`; reduce to `20px 14px 32px` in the `≤620` block.
- **`.seller-dashboard`, `.bdash`, `.seller-orders-page`, `.seller-batches-page`** — `index.css:5076-5083` sets `28px 14px 44px !important`; reduce to `18px 12px 28px !important`.
- **Buttons** — see §9.
- **The `SOLD OUT` / status badges** on batch covers follow the badge role (10px) via §2.
- Nothing else changes: the tables are already card-ified at `≤1024` (`responsive.css:83-189`) and the boards are already single-column grids (`index.css:8410-8419`, `9201-9216`).

---

## §7 Global chrome

### 7.1 Footer — 2-up, ~330px

The footer is 767px tall on every phone page. Three rules conspire; change all of them, all media-scoped:

| File:line | Change |
| --- | --- |
| `index.css:8427` (`≤620`, `!important`) | `minmax(0, 1fr) !important` → `repeat(2, minmax(0, 1fr)) !important` |
| `index.css:7965-7969` (`≤480`) | drop `max-width: 220px; margin: 0 auto`; use 2 columns |
| `index.css:7943-7945` (`≤760`) | `minmax(130px, 1fr)` → `minmax(0, 1fr)` |

Then in the `≤620` block:

```css
.kargo-footer { padding: 24px 16px 18px; }
.kargo-footer__grid { gap: 18px 14px; }
.kargo-footer h2 { margin-bottom: 10px; font-size: 14px; }   /* from 19px */
.kargo-footer nav { gap: 7px; }                              /* from 10px */
.kargo-footer a { font-size: 12px; }                         /* from 13px */
.kargo-footer > p { margin-top: 16px; font-size: 11px; }     /* from 36px / 12px */
```

Acceptance: `.kargo-footer` height ≤ **340px** at 390px, down from 767px.

### 7.2 Header and tab bar — leave both at 56px

Explicitly unchanged, and this is a deliberate exception to "make everything smaller". `.kargo-header` and `.icon-tabbar`/`.seller-tabbar` are `56px` at `≤620` (`index.css:8383-8399`), already at the compact end of the platform range. Shrinking the bottom bar changes where the thumb rests; it is not worth the 4px. Say so in the commit, so nobody "fixes" it later.

`.kargo-tab-label` is already `11px` (`index.css:5070`) — keep it. The `≤380` override to `10px` (`index.css:1199-1201`, `responsive.css:472`) also stays.

### 7.3 Auth

`responsive.css:428` `.auth-heading h1 { font-size: 32px }` → `26px`. `responsive.css:435` `.auth-input-shell input { min-height: 56px }` → `48px`. Login/signup otherwise untouched.

---

## §8 The horizontal-scroll ban

> On a phone, the **only** element allowed to slide horizontally is `.buyer-batch-grid`.

Make that the acceptance test. For every surface in §11.2, at 320/360/390/414px, no element may satisfy `scrollWidth > clientWidth + 4` except `.buyer-batch-grid`.

The audit's `hScrollers` list before this pass, at 390px on buyer Home:

```
kargo-original-app      398 / 390    → fixed by §3
MAIN                    398 / 390    → fixed by §3
.fi                     398 / 390    → fixed by §3
.p-6                    398 / 390    → fixed by §3
.buyer-category-grid   1449 / 386    → fixed by §4.4
.buyer-batch-grid      1580 / 386    → KEEP
```

After the pass that list must contain exactly one entry. Check `document.documentElement.scrollWidth === innerWidth` on every surface too.

---

## §9 Size exceptions — the only places things get *bigger*

Four deliberate 1–2px increases, and nothing else. Everything else in this prompt reduces or holds size. Record these in the commit message: they are the only exceptions the "smaller" rule allows.

1. **Card meta 9px → 11px** — `.buyer-batch-card__seller`, `.buyer-batch-card__date`. 9px is not readable on a phone, and this text carries real information (seller, date).
2. **Progress label 8px → 10px** — `.buyer-batch-card__progress-label` and its `strong` (`.buyer-batch-card__progress-label strong`). The smallest text in the app, and the only progress affordance.
3. **Heart numerals 9px → 11px** — `.buyer-batch-card__favorite span` and `.seller-shop-batch__reaction span`. A 9px digit inside a 30px pill was collapsing to ~6px of glyph width (§1.3).
4. **CTA text 11px → 12px** — `Claim this item`, `Contact Seller`, `View Order` render at **11px** today via the shim (§1.2). Their `min-height: 32px` stays.

Note which side of the line the rest falls on: the **category-grid labels** are 13px on desktop and compute **16px on a phone today** (§1.2), so §4.4's 11px is a *drop*, not an exception — as is the **10px pill on a batch cover** (`.buyer-batch-card__category`, §4.3), which is a different element from the tile label.

### Tap targets: keep the visual small, extend the hit area

Q4's answer was "keep the arrows, but smaller". Two overlay controls are small by design, so give them a hit area rather than a bigger box:

```css
/* Batch carousel arrows: 28px visual (from 32px), 44px hit area. */
.buyer-carousel-controls button { width: 28px; height: 28px; position: relative; }
.buyer-carousel-controls button::after { content: ""; position: absolute; inset: -8px; }

/* Overlay hearts: keep the 30px pill, extend the hit area.
   Both sit inside `__image-wrap`/cover which is `overflow: hidden`, so -8px stays clipped-safe at top/right 8px. */
.buyer-batch-card__favorite::after,
.seller-shop-batch__reaction::after { content: ""; position: absolute; inset: -8px; }
```

Do **not** touch `responsive.css:191-195`. On real hardware it already gives bare controls a 44px floor; the class-based heights above win, which is the intent.

---

## §10 Decisions resolved

| Question | Decision |
| --- | --- |
| Body/small text model | Advisor's per-role phone scale, §2. Body/CTA **13px** (the app root, reverting from a forced 16px), meta 11px, badge 10px, section heading 14px, page title 20px, numerals 22px, **form controls pinned at 16px** for iOS. |
| The `.text-[Npx]` shim (`index.css:4883-4901`) | **Leave it verbatim** and win at `≤620` in `responsive.css`. Deleting it would grow desktop text by ~1px, which the desktop constraint forbids. |
| Category row | **5 across, static grid**, ~66px tiles, no sliding, no arrows (there are none). |
| Batch carousel affordance | **Keep the arrows**, smaller: **28px visual**, 44px hit area. Swipe stays. |
| Seller stat cards | **2-up**, numerals **22px**, `min-height: 88px` (from 1-up at 124–149px with 30px numerals). |
| Footer | **2-up columns**, same content, ~330px (from 767px, single 220px column). |
| "No horizontal sliding" scope | **All page surfaces and in-app modals.** The `@media print` receipt sheet is exempt. |

The overall goal, in one line: **make everything on a phone smaller and denser, without moving a single desktop pixel.**

---

## §11 Verification

### 11.1 Typecheck and format first

```
npx tsc --noEmit
npm run format:all
```

### 11.2 Mobile pass — the audit that produced §1

A dev server runs on `8443`; a headless Chrome with CDP on `9338`. `scripts/responsive-audit.mjs` already drives this at 320/390 on `/?preview=original`. Extend it to all four widths and every surface.

- Seller shell: `http://127.0.0.1:8443/?preview=original` boots straight into the app as the demo Seller (`Alex Jordan`, `sellerEnabled: true` → `role === "Seller"`). Tabs: `.icon-tabbar button` by label (`Dashboard`, `Batches`, `My Claims`, `Payments`); Settings via `.kargo-header-actions > div:last-child > button` then a button whose text is exactly `Settings`; the board dialog via a button containing `Expand`.
- Buyer shell: sign in with `grace@kargo.demo` / `KargoDemo123!` (`scripts/verify-reaction-toggle.mjs` uses the same account). Buyer tabs render as `Home`, `Cart`, `Dashboard`, `History` — **`clickTab("Payments")` silently no-ops for a buyer and returns the Dashboard a second time.** Use `History`.
- Buyer batch detail: click `.buyer-batch-card`.

Assert, per surface per width:

```
docScrollWidth === innerWidth
every element: scrollWidth <= clientWidth + 4  … EXCEPT .buyer-batch-grid
buyer Home: .buyer-home rect.left === 0 and rect.width === innerWidth
buyer Home: .buyer-batch-page has 2 columns; .buyer-category-grid does not scroll
footer height <= 340
```

### 11.3 Desktop invariance — the gate

Measure **before** you start and **after** you finish, at 1280×900 and 1440×900, on buyer Home and seller Dashboard, using the selector list in §0. Assert equality on `rect[2]`, `rect[3]`, and `fontSize` for every entry:

```js
const SELECTORS = [
  ".kargo-header", ".kargo-tabbar", ".kargo-tab-label", ".kargo-footer", ".kargo-footer__grid",
  ".kargo-footer h2", ".kargo-footer a", ".buyer-home", ".buyer-home__content",
  ".buyer-home-filter select", ".buyer-category-grid button", ".buyer-category-grid span",
  ".buyer-batch-page", ".buyer-batch-card", ".buyer-batch-card__image-wrap",
  ".buyer-batch-card__category", ".buyer-batch-card__favorite", ".buyer-batch-card__body h3",
  ".buyer-batch-card__seller", ".buyer-batch-card__date", ".buyer-batch-card__progress-label",
  ".buyer-carousel-controls button", ".buyer-home-section__heading h2",
  ".seller-stats", ".seller-stat", ".seller-stat strong", ".seller-dashboard-sidebar",
  ".seller-side-card", ".seller-board-preview", ".bdash-stats", ".bdash-stat", ".bdash-stat__value",
]
```

`setDeviceMetricsOverride` with `mobile: false` for these. Any diff is a failure — find the rule that leaked out of a media query.

### 11.4 Structural gate

```
git diff -- src/index.css src/responsive.css
```

Every hunk must fall inside `@media (max-width: 620px)`, `(max-width: 480px)`, or `(max-width: 380px)` — except hunks that **delete** the five hammer rules named in §2, which already live inside `≤620`. Confirm `index.css:4883-4901`, `index.css:4903-4906`, and `responsive.css:191-195` are byte-identical.

### 11.5 Regression

```
node scripts/verify-reaction-toggle.mjs
npm run test:expiry
npm run test:emails
```

The reactions E2E must still pass — §5.3 touches the storefront heart's box, not its behaviour.

### 11.6 Type floor and the auth screens

The hammer deletion is what makes this pass work, but it also removes the accidental 16px floor from every surface it used to cover. Two checks:

- **Nothing falls below 11px except the two roles that are meant to be 10px** (batch-cover badge/pill, progress label). Walk every surface in §11.2 at 390px and read the computed `font-size` of each text node. Any value under 11px that is not one of those two roles is a regression to fix in this pass, not a follow-up.
- **Auth screens get a dedicated look.** They had their own hammer (`responsive.css:430-433`, deleted in §2) and no other phone type scale. After deletion, `.auth-page` headings/inputs/labels fall back to their base desktop values. Confirm `.auth-heading h1` is **26px** (§2) and that no label, link, or button on the login/signup/forgot screens computes below **12px** — the base values were tuned for desktop and a form is the last place to have illegible text.

---

## §12 Non-goals and follow-ups

**Not in this pass:**

- Any layout re-architecture beyond the 2-up grid and the 5-across category grid.
- The desktop 4px `.buyer-home` bleed (pre-existing at 1440, see §0).
- Any change to `.buyer-home-filter`'s two `<select>` elements' behaviour or option lists.
- Dark mode, motion, or new components.
- The seller browse-sellers list, the printable receipt, email templates, auth screens beyond §7.3.
- No new media queries. Use the three that exist. There are already **11** `@media (max-width: 620px)` blocks in `index.css` plus one in `responsive.css`; adding a twelfth is how this got into trouble.

**Follow-ups to log, not fix here:**

1. **Consolidate the mobile cascade.** `index.css` has four banner-marked mobile sections (`4978`, `8006`, `8381`) plus 11 `≤620` blocks, and `responsive.css` duplicates several of them. That duplication is why the hammers appeared twice. One file, one block per breakpoint.
2. **The "Original KARGO compact scale" (`index.css:4838-4901`) is unlayered and `!important`, so it outranks component CSS at every width.** That is why `.buyer-batch-card__body h3 { 12px }` (`7759`) and `.buyer-home-section__heading h2 { 18px }` (`7849`) have never applied. Those dead declarations should be deleted or the compact scale should be wrapped in a layer, in a desktop-approved pass.
3. **The `.text-[Npx]` shim (`index.css:4883-4901`) shifts every arbitrary Tailwind text utility down 1px on desktop too.** It is preserved here only because of the desktop constraint. It should be deleted deliberately in a desktop-approved pass, and the JSX utilities retargeted to the intended sizes.
4. **`index.css:4981-4983` `.kargo-tab-label { display: none }` is unlayered**, so it applies to desktop — the desktop tab bar is icon-only by that rule, not by design intent. Worth confirming that is intentional.
5. **`.kargo-footer` is 275px tall on desktop and 767px on a phone** — a 3× inversion. After §7.1 it is ~330px; the desktop footer's `grid-template-columns: repeat(3, minmax(160px, 210px))` is worth revisiting on its own desktop-approved pass.
6. **`responsive.css:351-473` (the `≤380` block) is nearly empty** and overlaps `index.css:1184-1206`. Merge.
