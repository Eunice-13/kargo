# KARGO — Signup, Batch Gallery, Pricing & Invoice

**Implementation prompt for an AI coding agent (Claude Code / Cursor).**
Repo: `KARGO_Order_Fulfillment_Platform`. Written 2026-11-16. Line numbers drift — re-grep if a cited line no longer matches.

How to use: hand this whole file to the agent. Work the sections in **§5 Implementation order**. Do not start with the UI; the username migration is the only irreversible change and everything else layers on top.

---

## 0. Ground rules

**Read before writing code**

- Stack: React 19, Vite 8, Tailwind CSS v4 (`@import 'tailwindcss'` in `src/index.css`), TypeScript strict. Formatting: oxfmt. No Tailwind config file.
- Conventions (`AGENTS.md`): double quotes for strings, default exports for components, `@/` alias for cross-folder imports, relative `./` for siblings. Feature folders may only import each other through their `index.ts`.
- Dependency direction: `types, constants, data, state` → `components/shared` → `features/*` → `components/layout` → `App.tsx`. Do not create cycles.
- Auth is **email + password only**. There is no username login and there will not be one.
- Profile rows are created by the `handle_new_auth_user()` trigger from `auth.signUp` metadata; the client **cannot** insert into `user_profiles` at signup (`supabase/migrations/202611110001_signup_required_address_payment.sql:15-88`). Any new signup field must travel in auth metadata and be persisted by that trigger.
- Admin power is `public.is_admin()` only: an `admin_members` row with `revoked_at is null` **and** `accepted_at is not null`, plus `account_status = 'active'` (`supabase/migrations/202611030001_admin_invite_acceptance.sql:58-74`). Nothing else grants admin.
- Do not weaken RLS, do not add client-side role checks in place of `is_admin()`, do not log invite codes or tokens.

**Do not touch**

- `src/features/auth/Login.tsx` (except adding the role card if you decide the split belongs there — you should not; see §1.3).
- Any existing `admin_*` RLS policy or `admin_assert()`.
- The email pipeline's rendering (`supabase/functions/process-pending-emails/email/*`) except the money-parity note in §3.
- Buyer invoice modal in `src/features/claims/MyClaims.tsx:3105-3135` — out of scope by decision (see §4).

**Definition of done for every section**

```bash
npm run typecheck
npm run build
node --test tests/paymentInvoice.test.ts
npm run format:check
```

---

## 1. Account creation

### 1.1 Replace one `Full Name` with three name fields

Today `src/features/auth/SignUp.tsx:222-229` has a single `Full Name` input, validated only as "at least 2 words" (`SignUp.tsx:59-60`).

Replace it with a single row of three inputs, in this order:

| Field          | Required | Max | Rule                                                                     |
| -------------- | -------- | --- | ------------------------------------------------------------------------ |
| First name     | yes      | 40  | letters (any script, incl. `ñ`, `é`), spaces, hyphen, apostrophe, period |
| Middle initial | no       | 1   | a single letter, auto-uppercased, rendered with a trailing period        |
| Last name      | yes      | 40  | same rule as first name                                                  |

- Validation regex for first/last: `/^\p{L}[\p{L}\s'.-]*$/u` after `.trim()` and collapsing inner whitespace. This deliberately accepts `Maria Clara`, `O'Brien`, `Dela Cruz-Javier`, `Ñoño` and rejects every digit, emoji, `@`, `/`.
- Where a name field fails, show the specific field error, not a generic one: `"Remove numbers and symbols from your first name."` / `"…last name."`
- Do **not** require `middleName` to differ from the first name, and do not add a "middle initial must not equal first initial" rule. That requirement was withdrawn in favour of a unique username (§1.2).
- Compose one display name for `user_profiles.display_name`:
  `[first, mi ? mi.toUpperCase() + "." : "", last].filter(Boolean).join(" ")`
  → `"Maria C. Dela Cruz"`. Never store the three parts separately; no schema change for names.
- Keep `display_name` as the single name every other surface reads (headers, tables, invoices). Do not thread three name fields through the app.
- `kargoApi.signUp` (`src/services/kargoApi.ts:287-373`) takes `name: string`; pass the composed string. Extend that input type with `username`.

### 1.2 Add a unique username

There is no `username` anywhere in the system today — only `display_name`. This is a **display handle**, not a login credential.

**Format** (put it in `src/lib/username.ts` so signup and Settings share one implementation and it is unit-testable):

```ts
// 3–20 chars, starts with a letter, lowercase letters/digits/dot/underscore,
// no consecutive dots, no trailing dot, stored lowercase.
const USERNAME_RE = /^[a-z][a-z0-9._]{2,19}$/;
export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "kargo",
  "support",
  "seller",
  "buyer",
  "root",
  "help",
  "system",
  "official",
];
export function normalizeUsername(v: string) {
  return v.trim().toLowerCase();
}
export function validateUsername(v: string): string | null;
```

Rules the error copy must state plainly: `"3–20 characters, start with a letter, letters/numbers/dot/underscore only."` and `"That username is reserved."`

**Database** — new migration `supabase/migrations/202611160001_username_and_admin_signup_requests.sql` (after `202611120004_*`):

```sql
alter table public.user_profiles add column if not exists username text;

alter table public.user_profiles
  add constraint user_profiles_username_format
  check (
    username is null
    or (username ~ '^[a-z][a-z0-9._]{2,19}$' and username !~ '\.\.' and username !~ '\.$')
  );

create unique index if not exists user_profiles_username_key
  on public.user_profiles (username);
```

Unique index stays `nulls distinct` so existing/seeded accounts without a username are legal. Case is already handled because everything is stored lowercase.

**Signup wiring**

- Add a `Username` input to `SignUp.tsx`, placed after the name row, with an `@` prefix affix and helper text `"Your public handle. You'll sign in with your email."`
- Live availability check on blur and on 400 ms debounce: `kargoApi.isUsernameAvailable(username)` → `select exists(select 1 from user_profiles where username = $1)`. Show `"Available"` / `"That username is taken."`
- The check is advisory. The unique index is the authority: catch `23505` on signup and map it to `errs.username = "That username was just taken. Try another."` Do not surface a raw Postgres message.
- Pass `username` in auth metadata (`data: { …, username }`) and persist it in `handle_new_auth_user()`: add `username` to the `insert into public.user_profiles` column list, `coalesce(nullif(meta ->> 'username',''), null)`. Trim + lowercase inside the trigger too, so a client bug cannot create a mixed-case handle.
- Add `username: string | null` to the profile select string (`kargoApi.ts:201`), to the mapped `UserInfo` (`kargoApi.ts:232-255`), and to `UserInfo` in `src/types/index.ts`.
- `kargoApi.updateProfile` (`kargoApi.ts:2465-2494`): accept `username`, `payload.username = normalizeUsername(...)`, catch `23505` → throw a friendly `Error("That username is taken.")`.
- Settings: add a `Username` field to `src/features/settings/ProfileSection.tsx` with the same validation, live availability, and an `@` affix. Editable at any time; no cooldown.
- Show it as `@handle` on the profile surface and on the seller shop page header (`src/features/batches/SellerShopPage.tsx`). **Not** on invoices, **not** in tables, **not** as a replacement for `display_name`, **not** on login.
- Existing accounts: `username` is null → show nothing, or fall back to `@` + slug of `display_name` **for display only** (never write the fallback to the DB).

### 1.3 "Sign up as Admin" — request now, approve later

Today `SignUpRole = Exclude<Role, "Admin">` (`SignUp.tsx:6`) and admin is granted out-of-band by an existing admin (`admin_grant_admin`). A client-side invite code was rejected: it would produce an "admin" account that `is_admin()` still refuses.

**Behaviour**

- Add a third role card, `Admin`, with the copy `"Admin access requires approval."` Admin is an approval request, not a self-service role.
- Field matrix when `Admin` is selected: **first name, middle initial, last name, username, email, password only.** Hide and skip delivery address, shop name, payment method, terms-for-sellers, and social accounts. This is a hard requirement — the trigger currently rejects any app signup with no social links (`202611110001_signup_required_address_payment.sql:64-67`), so it must be exempted for admin requests.
- Metadata: send `requested_role: "admin"` alongside `signup_flow: "kargo_app"`, `display_name`, `username`. Do **not** send `can_sell: true`.
- Client-side `submit()` guards must be role-scoped: the social-account check in `SignUp.tsx:63-64` becomes `if (role !== "Admin" && …)`.
- After a successful admin signup, show a distinct notice instead of the buyer/seller confirmation: `"Admin request submitted. An existing admin must approve it before you can access the console."` Do not send them into onboarding.

**Database** — same migration as §1.2:

```sql
create table if not exists public.admin_signup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reason text
);

alter table public.admin_signup_requests enable row level security;

create policy admin_signup_requests_select_own on public.admin_signup_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

grant select on public.admin_signup_requests to authenticated;
-- No insert/update/delete grants: rows are written by the trigger and the RPCs only.
```

**Trigger changes** in `public.handle_new_auth_user()` (recreate the whole function; keep every existing branch):

1. `requested_admin boolean := (meta ->> 'requested_role') = 'admin';`
2. Exempt admin requests from the social-links exception:
   `if via_app and not requested_admin and socials = '{}'::jsonb then raise exception …`
3. Force `can_sell := false` when `requested_admin`.
4. Persist `username` (see §1.2).
5. `if requested_admin then insert into public.admin_signup_requests (user_id) values (new.id); end if;`
6. Any admin-request account is a plain non-seller account until approval: no `admin_members` row is created here.

**RPCs** — new migration, `security definer`, `set search_path = ''`, `revoke all … from public, anon`, `grant execute … to authenticated`, and `admin_assert()` at the top of each (mirror `202611010004`):

- `admin_list_signup_requests()` → jsonb array of pending rows joined to `user_profiles` + `auth.users.email` (`id`, `userId`, `displayName`, `username`, `email`, `requestedAt`). Pending only.
- `admin_approve_signup_request(p_request_id uuid, p_reason text)` → resolve `user_id`; `perform public.admin_grant_admin(p_user_id => v_user_id, p_reason => coalesce(nullif(trim(p_reason), ''), 'Approved admin signup request'))`; set `status='approved'`, `reviewed_by=auth.uid()`, `reviewed_at=now()`. Must be atomic and must not double-grant an already-approved request (return `changed: false`).
- `admin_reject_signup_request(p_request_id uuid, p_reason text)` → `status='rejected'`, `reviewed_by`, `reviewed_at`, `reason` required and non-blank.

Approval reuses the existing invitation semantics: `admin_grant_admin` creates an `admin_members` row with `accepted_at = null`, so the new admin must still accept the invite before `is_admin()` turns on. Say so in the UI: `"Approved — awaiting their acceptance."` Do not set `accepted_at` in the approval path, and do not bypass the accept step.

**UI**

- Surface pending requests in `src/features/admin/AdminSecurity.tsx` next to the team directory (`listTeam` at line 73, add-admin modal at 254). Use the existing `useAdminResource` hook, `AdminPanelHeader`, and `AdminConfirmModal` — do not invent a new admin visual language.
- `src/services/adminApi.ts`: add `listSignupRequests`, `approveSignupRequest`, `rejectSignupRequest` following the `callAdmin` pattern, each with a `demoMode` branch.
- `src/data/admin.ts`: add `demoListSignupRequests`, `demoApproveSignupRequest`, `demoRejectSignupRequest` seeded with two pending rows so the demo has something to show without a real Supabase grant.
- Reuse the existing admin notification route (`src/features/notifications/notificationRoute.ts:123`); do not add a new notification type.

---

## 2. Batch gallery — remove dead space, fixed 4:5 frames

Scope: the **batch gallery only** — `BatchPage.tsx:759-860` and the upload previews in `NewBatchModal.tsx:643-675`. Not product cards elsewhere, not the seller directory.

Target: no empty band, no gutter around the image, photo as large as the frame allows. Frame is **4:5 portrait** with `object-fit: cover`.

`src/index.css` — replace the relevant blocks (start at the cited lines):

```css
/* was padding: 20px; gap: 24px; */
.batch-gallery {
  padding: 0;
  gap: 0;
  overflow: hidden; /* let the photo clip to the card radius */
}

/* was aspect-ratio: 1 / 1; background: gradient; box-shadow: inset … */
.batch-gallery__main {
  aspect-ratio: 4 / 5;
  border-radius: 0; /* the card owns the radius now */
  background: #f4f6fb;
  box-shadow: none;
}

.batch-gallery__main > img,
.batch-gallery__zoom-trigger img {
  object-fit: cover; /* unchanged — keep the fill behaviour */
}

/* the text column inherits the padding the container gave up */
.batch-gallery__side {
  padding: 20px 20px 20px 24px;
}
```

Thumbnails — square, no chrome, no inner padding:

```css
.batch-gallery__thumbnails {
  grid-template-columns: repeat(4, minmax(0, 1fr)); /* was 3 */
  gap: 4px;
}

.batch-gallery__thumbnail {
  padding: 0;
  border: 1px solid transparent; /* keep 1px so selection never shifts layout */
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 1 / 1;
}

.batch-gallery__thumbnail img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

Upload previews (`NewBatchModal.tsx:663-670` + `.batch-gallery-upload__preview` at `index.css:15845`): `padding: 0`, `aspect-ratio: 1 / 1`, `overflow: hidden`, image `object-fit: cover`, radius 8px, `gap: 4px`. Same visual grammar as the gallery thumbnails.

Responsive: at ≤ 900 px the gallery stacks (image above text). With `padding: 0` the stacked image needs rounded top corners only — `border-radius: 16px 16px 0 0`. Keep the text column's padding in the stacked layout.

Single-image batches: keep the same `minmax(0, min(480px, 45%))` column, not a full-width hero. Multi-image and single-image grids must look identical in size.

Do not change: the zoom trigger, arrows, keyboard focus rings, `aria-label`s, or the `is-selected` state logic. Only geometry and chrome.

Acceptance is measurable, not "looks better":

- The `<img>` bounding box equals the `.batch-gallery__main` box to within 0 px on all four sides (no inset).
- No letterbox band from `1 / 1` or padding remains; frame reports `aspect-ratio: 4 / 5`.
- A 1×1 image and a 4×5 image both fill the frame with no visible border; a 16×9 image crops horizontally, centered.
- Thumbnail boxes are square within 1 px.

---

## 3. Money — `₱0.00` everywhere, two decimals always

### 3.1 One formatter

New file `src/lib/format.ts`:

```ts
export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₱0.00";
  return `₱${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

- Never returns a blank, a dash, or `₱NaN`. Missing/zero/invalid → `₱0.00`.
- No space between `₱` and the digits. `en-PH` gives `₱1,234.50`.
- Rounding is whatever `toLocaleString` does (half-up on the formatted digits). Do not hand-roll rounding.

### 3.2 Sweep every money render

```bash
grep -rn "toLocaleString()" src --include=*.tsx --include=*.ts
grep -rn '₱\${\|₱{' src --include=*.tsx --include=*.ts
```

Replace **every** user-visible amount with `formatMoney(...)`: batch cards and detail, `NewBatchModal` selling price, orders, order details, claims, payments list, payment submit/review/verify, insufficient-payment notices, transaction detail, dashboard and admin tables, combined delivery, financial summary. Where a cell currently renders `"—"` for a missing amount, render `₱0.00` instead (decision: the floor is always a peso amount).

Server parity: `supabase/functions/process-pending-emails/email/format.ts` already produces `₱1,240.00`. Edge Functions cannot import `src/`, so leave it and add a parity case to `tests/emailTemplates.test.ts` asserting the same shape for the same input. Do not fork the currency style.

### 3.3 Price inputs start at `₱0.00`

`NewBatchModal.tsx:1071-1123` — Base Price, Markup, and the computed Selling Price.

- Default value of a new item row is `"0.00"`, not `""` and not `"0"`.
- Rendering the value: when the field is not focused, display `0.00` (two decimals). While editing, let the user type freely — do not reformat mid-keystroke.
- On focus, `select()` the whole value so typing replaces `0.00` instead of yielding `0.00250`.
- On blur, normalize to two decimals (`Number(v || 0).toFixed(2)`). Empty → `0.00`.
- Selling Price readout: `formatMoney(selling)` always, never `—`. `selling = base + markup`, clamped at 0.
- Keep `type="number"`, `inputMode="decimal"`, `step="0.01"`, `min="0"`. Do not switch to `type="text"` (the mobile keypad is the reason).
- Apply the same prefill/normalize behaviour to the money inputs in `FinancialSummaryModal.tsx:250,293,369`.

### 3.4 Zero is not publishable

- ₱0.00 is the **starting** value, not a valid price. Publishing a batch or item with a selling price of 0 must be blocked with a field-level error: `"Set a selling price above ₱0.00."`
- This applies to the batch/item publish action, not to the input itself — the user must be able to clear the field and type.
- Shipping fee and other additive charges may be 0. Only the item price has the floor.

---

## 4. Printable invoice — seller logo + Kargo mark

Scope decision: **only** the printable invoice (`src/features/payments/paymentInvoice.ts`). The on-screen buyer invoice in `MyClaims.tsx:3105` stays as-is. Seller "logo" = the existing `avatarUrl` from the `profile-avatars` bucket — do not add a shop-logo column or a new upload.

### 4.1 Signature

```ts
// src/features/payments/paymentInvoice.ts:29
export type InvoiceBranding = { shopName: string; shopLogoUrl?: string | null };
export function buildPaymentInvoiceHtml(item: VerifyItem, branding: InvoiceBranding);
export function printPaymentInvoice(item: VerifyItem, branding: InvoiceBranding);
```

Update all call sites — `ReviewSubmissionModal.tsx:375` and the three calls in `tests/paymentInvoice.test.ts:23,35,46`. In the modal, pass the signed-in seller's own avatar: `{ shopName: sellerName, shopLogoUrl: user.avatarUrl }`. (The seller is the current user there; if the shared state lacks it, read `user.avatarUrl` from the same source the header uses — do not fetch a profile just for this.)

### 4.2 Layout

Header band, two columns:

- **Left:** seller logo (`56×56`, `object-fit: contain`, `border-radius: 8px`) with the shop name beneath it as the existing `.shop` heading. If `shopLogoUrl` is empty, render a monogram circle instead: `48px`, navy `#2e3192`, white initial from `shopName`, same box size so nothing reflows.
- **Right:** Kargo mark, `height: 32px`, `object-fit: contain`, above the existing `INVOICE` title.
- Divider stays where it is. No other layout changes.

```css
.brandbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}
.brand-seller {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.brand-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
}
.brand-kargo {
  height: 32px;
  width: auto;
  object-fit: contain;
}
.monogram {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  background: #2e3192;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 22px;
}
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

### 4.3 Asset URLs that print

The printable sheet is an `about:blank` iframe/popup (`paymentInvoice.ts:197-210`), so a relative path renders a broken image.

- Kargo mark: `${location.origin}/kargo-logo-head.png` — `public/kargo-logo-head.png` exists and already serves the email pipeline. Escape it like every other interpolated value.
- Seller logo: pass the absolute public URL from `avatarUrl`; if it is already absolute, use it unchanged.
- Both must be `alt=""`-decorated decorative images with explicit `width`/`height` attributes, and must survive `window.print()` with no broken-image icon. Add a test asserting the Kargo `src` is absolute (`/^https?:/`) and that the monogram branch contains no `<img>` for the seller.
- Fail soft: if `shopLogoUrl` is malformed, render the monogram — never a broken `<img>`.

### 4.4 Tests

Extend `tests/paymentInvoice.test.ts`:

- Existing assertions still pass; `₱950` becomes `₱950.00` (update the regex deliberately).
- Absolute Kargo logo URL present.
- Seller logo `<img>` with absolute `src` when provided.
- Monogram fallback when `shopLogoUrl` is null/empty.
- Logo strings are HTML-escaped (`shopName` containing `<script>` must not escape the attribute).

---

## 5. Implementation order

Do not reorder §1 and §3; the rest can move.

1. **Migration + trigger + RPCs** (`202611160001_username_and_admin_signup_requests.sql`). Verify with a local Supabase signup for each role before touching UI.
2. **`src/lib/username.ts` + `src/lib/format.ts`** and their tests.
3. **`kargoApi` plumbing**: `signUp` metadata, profile select/map, `updateProfile`, `isUsernameAvailable`.
4. **Signup UI**: name row (§1.1), username (§1.2), Admin card + field matrix + pending notice (§1.3).
5. **Settings**: username field (§1.2).
6. **Admin console**: requests panel + `adminApi` + demo stubs (§1.3).
7. **Money sweep**: `formatMoney` across every surface, then the price inputs (§3.2 → §3.3 → §3.4).
8. **Batch gallery CSS** (§2) — isolated, do it last so a broken layout can be reverted without losing logic.
9. **Invoice branding** (§4) and tests.

Commit boundaries: 1–3 (backend + contracts), 4–6 (accounts), 7 (money), 8 (gallery), 9 (invoice). Do not mix the CSS-only commit with anything else.

---

## 6. Acceptance checklist

**Account — names**

- ☐ Signup shows First name, Middle initial, Last name — no `Full Name`.
- ☐ Typing `Juan2` in a name field blocks submit with a field-specific message.
- ☐ `O'Brien`, `Dela Cruz-Javier`, `Ñoño` submit successfully.
- ☐ Empty middle initial is allowed and the display name has no stray double space or dangling period.
- ☐ `display_name` is `"Maria C. Dela Cruz"` and every existing surface shows that single string.
- ☐ The old "middle initial must differ" rule does not exist anywhere.

**Account — username**

- ☐ Username is required at signup for Buyer, Seller and Admin.
- ☐ `ab` and `-abc` and `abc..d` and `admin` are rejected with the stated copy.
- ☐ `Abc123` is accepted and stored as `abc123`.
- ☐ A taken username shows "taken" before submit (blur) and still cannot be forced through (DB `23505` mapped to friendly copy).
- ☐ Reloading the profile keeps the username (`UserInfo.username` populated).
- ☐ Username is editable in Settings and remains unique.
- ☐ `@handle` appears on the profile and seller shop header, and nowhere on invoices, tables, or login.
- ☐ Signing in with a username is impossible; email login is unchanged.

**Account — Admin**

- ☐ Admin is the third role card with "requires approval" copy.
- ☐ Selecting Admin hides address, shop name, payment method, socials, and seller terms.
- ☐ Admin signup succeeds in the database (no social-links trigger exception) and creates exactly one `admin_signup_requests` row with `status='pending'`.
- ☐ A pending admin is **not** admin: `is_admin()` false, console unreachable.
- ☐ Signup shows the "request submitted, pending approval" notice, not onboarding.
- ☐ Admin console lists pending requests with name, `@username`, email, timestamp.
- ☐ Approve creates an `admin_members` row with `accepted_at` null and marks the request approved; the account still needs to accept the invite.
- ☐ Approving twice does not double-grant.
- ☐ Reject requires a reason and grants nothing.
- ☐ Non-admins cannot read or write `admin_signup_requests`.

**Batch gallery**

- ☐ Image box and frame box match on all four sides (0 px inset).
- ☐ Frame is 4:5; a wide photo crops instead of letterboxing.
- ☐ No padding/gutter band inside the gallery card; text column keeps its breathing room.
- ☐ Thumbnails are square, gap 4px, selected state does not shift layout.
- ☐ Upload previews match thumbnail geometry.
- ☐ Single-image batch renders at the same size as a grid cell, not full-width.
- ☐ Zoom, arrows, and keyboard focus still work.

**Money**

- ☐ `formatMoney(0)` → `₱0.00`, `formatMoney("950")` → `₱950.00`, `formatMoney(null)` → `₱0.00`, `formatMoney("abc")` → `₱0.00`.
- ☐ Every visible amount in the app has two decimals; no `—` placeholders remain for money.
- ☐ New item price fields open with `0.00`; focusing selects the value so typing replaces it.
- ☐ Blur normalizes `5` to `5.00` and empty to `0.00`.
- ☐ Publishing with selling price 0 is blocked with "Set a selling price above ₱0.00."
- ☐ Email templates still render `₱1,240.00` and a parity test covers it.

**Invoice**

- ☐ Seller avatar renders top-left at 56px with the shop name beneath.
- ☐ Kargo mark renders top-right at 32px from an absolute URL.
- ☐ Seller with no avatar gets a navy monogram, not a broken image, and the header does not reflow.
- ☐ Printing produces no broken-image icon and no missing background color.
- ☐ `shopName` containing `<` cannot break out of the HTML.
- ☐ Buyer on-screen invoice is unchanged.

---

## 7. Out of scope

- Login by username, magic links, social login.
- Separating middle name from middle initial in the schema.
- A dedicated shop-logo upload (avatar is the logo).
- Logo changes on the on-screen buyer invoice.
- Any change to admin RLS policies, `admin_assert()`, or existing grant/revoke semantics.
- Redesigning product cards outside the batch gallery.
- Reformatting non-money numbers (quantities, counts) to two decimals.
- A full design-system pass on the gallery.

---

## 8. Assumptions made where the spec deferred to the implementer

Flag these in the PR description; flip any that are wrong.

1. Middle initial is **optional**, not required.
2. Name order is First / Middle initial / Last (as recommended), not Last / First / Middle initial as originally listed.
3. Username is required for all three roles, nullable in the DB for pre-existing accounts, and editable with no cooldown.
4. Reserved usernames are app-level only (not a DB constraint) so the list stays editable without a migration.
5. Approving an admin request uses the existing `admin_grant_admin` path, so approval ≠ instant admin — the invite must still be accepted.
6. Price inputs use `type="number"` and select-on-focus, not formatted text inputs.
7. Gallery frame is 4:5 for both the main image and (square) thumbnails; the batch card keeps its 16px radius and border.
8. The invoice logo block sits above the existing header content, with no other print layout changes.
