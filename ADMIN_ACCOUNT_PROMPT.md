# KARGO Admin Account — Complete Implementation Prompt

You are implementing the **Admin account** for the existing KARGO pasabuy / order-fulfillment app (React 19 + Vite + Tailwind v4 + Supabase). This is an **internal operations back office**, not a third marketplace persona. It must feel like it was built by the same team, in the same codebase, with the same components and visual language as the Buyer and Seller workspaces.

Do not redesign the app. Do not create a second design system. Do not invent a separate admin login. Do not put the Supabase service-role key in the browser.

---

## 1. What the admin account is

KARGO already has two primary users:

- **Buyer** — discovers batches, claims items, pays, tracks orders.
- **Seller** — publishes batches, verifies payments, fulfills orders.

The **Admin** is a governance and support capability layered on top of those accounts. An admin:

- verifies sellers and their BIR documents,
- can suspend or restore accounts,
- moderates batches that are flagged or unsafe,
- audits orders, payments, and combined payments,
- manages the admin team and reads an immutable audit trail.

The admin does **not**:

- claim items, create batches, or pay sellers,
- edit seller prices, products, expenses, or shop copy,
- process refunds or hold money,
- impersonate a buyer or seller,
- adjudicate buyer/seller disputes (there is no dispute system in KARGO),
- hard-delete accounts.

Admin is a **capability**, not a signup option. There is no "Admin" choice on the signup screen and no admin invite link. An existing account is promoted to admin by a trusted operator (SQL / server tooling) or by an existing admin inside the console.

**There is exactly one admin role.** No super-admin, moderator, or support tiers. Every active admin has full console access. See §6.1 for the consequences of that choice.

---

## 2. Composition at a glance

### Top-level tabs (5)

| # | Tab | Purpose | Primary actions |
|---|---|---|---|
| 1 | **Dashboard** | Daily command center: what needs attention, platform pulse, recent admin activity | Review queue, open a queue item, refresh |
| 2 | **Users** | Buyer, seller, and admin directory; seller verification; suspensions | View, suspend/restore, approve/reject BIR, grant/revoke seller access |
| 3 | **Batches** | Moderation of seller batches and products | View, lock/unlock, flag, hide/restore, close |
| 4 | **Transactions** | Orders, payments, and combined payments | View details, cancel order, verify/reject payment |
| 5 | **Settings** | Admin profile, security, team, audit log | Edit profile, change password, manage admins, read audit |

### Sub-tabs

- **Users**: `All accounts` · `Seller verification` · `Suspended`
- **Transactions**: `Orders` · `Payments` · `Combined payments`
- **Settings**: `Profile` · `Security` · `Team` · `Audit log`

### Deliberate non-tabs

- No separate "Reports" tab: reporting lives on **Dashboard** (KPIs, trend, top sellers) and as CSV export on **Transactions** / **Audit log**.
- No separate "Notifications" tab in the top bar: the existing bell remains. Admin notifications route into the relevant admin tab.
- No "Moderation" catch-all: seller verification belongs to **Users**; batch moderation belongs to **Batches**.
- No "Disputes" tab: buyer/seller case management is explicitly out of scope for this pass. KARGO has no dispute table, and the console does not adjudicate buyer/seller problems. Do not add a placeholder tab or stub table for it.

---

## 3. Read these files before changing anything

- `AGENTS.md`, `ARCHITECTURE.md`, `PRODUCT.md`, `DESIGN.md`
- `src/App.tsx` — stage switch, role derivation, shell
- `src/types/index.ts` — `Role`, `Tab`, `UserInfo`, `SharedState`
- `src/components/layout/TabBar.tsx`, `TabContent.tsx`, `Header.tsx`, `UserMenu.tsx`, `Footer.tsx`
- `src/services/kargoApi.ts` — `profileFor`, `loadCurrentAppData`, `updateProfile`, `signUp`
- `src/features/auth/*` — Login, SignUp, AuthLayout, Security patterns
- `src/features/settings/*` — Profile/Security/Notifications sections and sidebar pattern
- `src/features/payments/Payments.tsx`, `SellerPaymentVerification.tsx` — table + filter + verification patterns
- `src/features/claims/MyClaims.tsx`, `OrderDetailsModal.tsx` — detail modal patterns
- `src/components/shared/*` — `Card`, `SH`, `PrimaryBtn`, `SecondaryBtn`, `Modal`, `EmptyState`, `Skeleton`, `Avatar`, `StatusBadge`, `StageProgress`
- `src/constants/theme.ts`, `src/constants/fulfillment.ts`
- `src/state/navIntent.ts`, `src/state/routeScroll.ts`
- `supabase/migrations (to update profile database name)/202609200001_initial_kargo_schema.sql`
- `supabase/migrations (to update profile database name)/202609230001_profile_reviews.sql`
- `supabase/migrations (to update profile database name)/202610010007_rename_profiles_to_user_profiles.sql`
- Latest `batch_catalog` definition: `202610200002_batch_gallery_images.sql` and `202610270001_group_formation_expiration.sql`
- `supabase/tests/combined_delivery_*.sql` — SQL test style and fixtures

---

## 4. Verified current state (do not re-derive incorrectly)

These facts are true in the repository as it stands. Treat them as constraints, not suggestions.

1. **Role is binary today.** `Role = "Buyer" | "Seller"` in `src/types/index.ts`. `src/App.tsx` derives `role` from `user.sellerEnabled` (backed by `user_profiles.can_sell`). There is no in-app role switch.
2. **Tabs are role-branched.** `TABS` in `TabBar.tsx` is the 4 buyer/seller tabs. Buyers get a re-labeled list (`Home`, `Claims`, `Dashboard`, `History`); sellers get the literal list. `TabContent.tsx` maps every `Tab` to a component and uses `TABS` for slide direction.
3. **The profile mapper is the source of app identity.** `profileFor()` in `kargoApi.ts` selects `id, display_name, bio, social_links, social_visibility, avatar_path, can_sell, notification_preferences, created_at` from `user_profiles` and maps `role` from `can_sell`.
4. **Admin cannot read other users' data today.** RLS policies are participant-scoped (`profiles_select_own`, `orders_select_participant`, `payments_select_participant`, etc.). An authenticated user cannot list other accounts, all orders, all payments, or all batches.
5. **BIR completion is service-role only.** `public.complete_bir_verification(...)` is revoked from `public, anon, authenticated` and granted only to `service_role`. It expects `bir_status = 'pending'` and the exact document path, and accepts only `verified` / `none` in the newer definition.
6. **BIR documents are private.** Bucket `bir-certificates` is private; storage policy `bir_owner_read` only lets the owner read their own file. Payment receipts are also private (`payment-receipts`), participant-scoped.
7. **Seller gating is inconsistent and must be fixed.** The app treats `user_profiles.can_sell` as the seller role, while `public.can_sell()` (used by RLS) checks `bir_status = 'verified'`. A seller can be a Seller in the UI but blocked by RLS (or vice versa). Reconcile this in the admin foundation migration.
8. **`can_sell` is self-updatable today.** `authenticated` has `update` on `user_profiles`, and `can_sell` was **not** included in the column-level revoke list. A buyer can PATCH their own `can_sell` to `true` through PostgREST. This must be closed in the same migration.
9. **There is no admin concept in the schema.** No `is_admin`, no `admin_members`, no audit table, no batch moderation columns.
10. **Notifications are role-branched in the client only.** `NotificationsProvider` uses `role === "Seller" ? NOTIF_SELLER : NOTIF_BUYER`; an Admin would incorrectly see buyer notifications unless a third branch is added.
11. **`batch_catalog` is the live read model.** It has been redefined several times. Use the **latest** definition, not the initial schema. It currently does not have a moderation/hidden concept.
12. **Seller private expenses must stay private.** Do not grant admins access to `batch_expenses`. Do not grant access to buyer `addresses` or `delivery_destinations`; use the delivery fields already stored on `orders`.
13. **The demo bypass is `?preview=original`.** It boots straight into the seeded app as a seller. Keep it working. Add a separate `?preview=admin` for the admin console.
14. **`Modal` owns accessibility.** Portal, focus trap, Escape, scroll lock, and close animation are already correct. Reuse it; do not reimplement dialog behavior.
15. **Responsive breakpoints are 620px and 480px.** Tables become cards at ≤620px. Every tap target is at least 44×44px.

---

## 5. Role, auth, and account lifecycle

### 5.1 Extend the shared types

In `src/types/index.ts`:

```ts
export type Role = "Buyer" | "Seller" | "Admin"

export type AdminTab =
  | "Dashboard"
  | "Users"
  | "Batches"
  | "Transactions"
  | "Settings"

export type Tab =
  | "Dashboard"
  | "Batches"
  | "My Claims"
  | "Payments"
  | "Orders"
  | "Settings"
  | "Notifications"
  | "Users"
  | "Transactions"
```

Extend `UserInfo`:

```ts
adminEnabled?: boolean
accountStatus?: "active" | "suspended"
accountStatusReason?: string
```

Keep `sellerEnabled` as-is. A dual-role account (seller + admin) is shown as **Admin** in the app; do not add a "view as seller" mode in v1.

There is no `AdminRole` type. Do not add one.

### 5.2 Resolve the role in one place

In `src/App.tsx`:

```ts
const role: Role = user.adminEnabled
  ? "Admin"
  : user.sellerEnabled
    ? "Seller"
    : "Buyer"
```

- `landingTab(user)` returns `"Dashboard"` for admins and sellers, `"Batches"` for buyers.
- Add an allowed-tabs guard:
  - Admin: `Dashboard`, `Users`, `Batches`, `Transactions`, `Settings`, `Notifications`
  - Buyer/Seller: existing tabs + `Orders`, `Settings`, `Notifications`
  - If the current `tab` is not allowed for the role, reset it to `landingTab(user)`.
- Extend `TAB_DEEP_LINKS` with admin aliases: `dashboard`, `overview`, `admin`, `users`, `verifications`, `transactions`, `payments`, `audit`.
- `useScrollToTopOnRouteChange` key should include the role: `` `${stage}:${role}:${tab}` ``.

### 5.3 Update `profileFor` and `loadCurrentAppData`

- Add `account_status`, `account_status_reason` to the `DbProfile` select and `UserInfo` mapping.
- Read the admin row with a second query: `.from("admin_members").select("granted_at").eq("user_id", id).is("revoked_at", null).maybeSingle()`. Add an RLS policy so a user can read their own admin row.
- Map `adminEnabled = Boolean(adminRow)`. Membership is binary; there is no role field to read.
- In `loadCurrentAppData`, after `profileFor`, if the user is an admin, return a lightweight snapshot with empty buyer/seller arrays and `profileIdByName: {}`. Admin pages load their own data through `adminApi`. Do not keep buyer/seller loaders running for admins.
- `signUp` must never accept `role: "Admin"`. Narrow the input type to `"Buyer" | "Seller"`.

### 5.4 Admin provisioning and login

- Admin accounts are ordinary Supabase auth users with an active row in `admin_members`.
- Use the normal `Login` screen. There is no separate admin login URL.
- Bootstrap the first admin with SQL (document it in the migration header):
  ```sql
  insert into public.admin_members (user_id)
  select u.id
  from auth.users u
  where lower(u.email) = lower('admin@kargo.ph')
  on conflict (user_id) do update
    set revoked_at = null, revoked_by = null;
  ```
- If an account is suspended (`account_status = 'suspended'`), render an `AccountSuspended` screen for **all** roles instead of the app shell. It must show the reason (if present), a support contact, and a Log out action. Do not let a suspended admin mount the console; `is_admin()` also checks active status.

---

## 6. Data and security foundation (Supabase)

Create new migrations under `supabase/migrations/`, after the latest applied timestamp (`202610280001`). Suggested files:

1. `202611010001_admin_foundation.sql`
2. `202611010002_admin_moderation.sql`
3. `202611010003_admin_team_and_audit.sql`

Do not rewrite applied migrations. Keep each migration idempotent where practical (`if not exists`, `create or replace`, guarded `do $$` blocks).

### 6.1 Admin membership and `is_admin()`

```sql
create table if not exists public.admin_members (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  granted_by uuid references public.user_profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.user_profiles(id) on delete set null
);

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_members m
    join public.user_profiles p on p.id = m.user_id
    where m.user_id = p_user_id
      and m.revoked_at is null
      and p.account_status = 'active'
  );
$$;
```

- Grant execute on `is_admin` to `authenticated`.
- Add `admin_members_select_own` (`user_id = auth.uid()`) and `admin_members_select_admin` (`public.is_admin()`).
- No insert/update/delete policies. All mutations go through security-definer RPCs.

**Single-role consequence — read this before writing any RPC.** There is no `admin_role` enum and no `admin_role_for()`. Every active row is a full admin: it can suspend accounts, approve BIR, moderate batches, cancel orders, override payments, and add or revoke other admins. That is intentional and it is the riskiest property of this design.

Because there is no tiering, the remaining safeguards are load-bearing. Do not weaken them, and do not add a "read-only admin" flag later without revisiting this section:

- every destructive action requires a written reason,
- suspend/revoke/cancel/override require typing the target's name or reference,
- every mutation writes an audit row in the same transaction,
- an admin cannot suspend or revoke themselves,
- the last active admin cannot be revoked.

### 6.2 Reconcile seller gating and close the self-update hole

In the foundation migration:

1. Redefine `public.can_sell()` to read the canonical column:
   ```sql
   create or replace function public.can_sell(p_user_id uuid default auth.uid())
   returns boolean
   language sql
   stable
   security definer
   set search_path = ''
   as $$
     select exists (
       select 1 from public.user_profiles p
       where p.id = p_user_id
         and p.account_status = 'active'
         and p.can_sell = true
     );
   $$;
   ```
   Rationale: the app already treats `user_profiles.can_sell` as the seller role. BIR verification becomes a **trust status**, not a second hidden gate. Document this behavior change in the migration comment.

2. Revoke column-level update so users cannot self-grant seller/admin access:
   ```sql
   revoke update (can_sell) on public.user_profiles from authenticated;
   ```
   Also revoke any new admin-only columns (including `account_status`, `account_status_reason`, `account_status_changed_at`, `account_status_changed_by`, `bir_review_note`).

3. Replace the client's `updateProfile({ canSell: true })` path with a self-service RPC:
   ```sql
   create or replace function public.enable_seller_access()
   returns void
   language plpgsql
   security definer
   set search_path = ''
   as $$
   begin
     if auth.uid() is null then
       raise exception 'Authentication required' using errcode = '42501';
     end if;
     if not public.is_active(auth.uid()) then
       raise exception 'Active account required' using errcode = '42501';
     end if;
     update public.user_profiles set can_sell = true where id = auth.uid();
   end;
   $$;
   ```
   Grant execute to `authenticated`. Keep the existing "Start Selling" flow, but call this RPC. Add a comment that this is the only self-service path and admin grant/revoke also uses `can_sell`.

4. Add `bir_review_note text` and expand `bir_flag_reason` if needed:
   ```sql
   alter table public.user_profiles
     add column if not exists bir_review_note text;
   ```
   Prefer a free-text `bir_review_note` for the seller-facing rejection reason; keep `bir_flag_reason` for the coarse category (`unreadable`, `bad_domain`, plus `mismatch`, `expired`, `other` if the existing check allows it). If the check constraint blocks new values, add a new constraint in the migration.

5. Add suspension metadata:
   ```sql
   alter table public.user_profiles
     add column if not exists account_status_reason text,
     add column if not exists account_status_changed_at timestamptz,
     add column if not exists account_status_changed_by uuid
       references public.user_profiles(id) on delete set null;
   ```
   These columns are read-only to users; only admin RPCs write them.

### 6.3 Admin audit log

```sql
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id) on delete set null,
  actor_name text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null,
  target_label text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log (actor_id, created_at desc);
```

- Enable RLS.
- `select` policy: `public.is_admin()`.
- **No** insert/update/delete policies and no grants to `authenticated`. Inserts happen inside security-definer RPCs.
- Never store passwords, tokens, receipt URLs, BIR document URLs, or document contents in `before_state` / `after_state`. Store IDs, statuses, reasons, and display-safe fields.
- Provide an internal helper (not executable by clients) such as `public.admin_audit(...)` that inserts the row; call it from every admin RPC in the same transaction. `revoke execute ... from public`.

### 6.4 Batch moderation

```sql
create type public.batch_moderation as enum ('visible', 'flagged', 'hidden');

alter table public.batches
  add column if not exists moderation_status public.batch_moderation not null default 'visible',
  add column if not exists moderation_reason text,
  add column if not exists moderated_by uuid references public.user_profiles(id) on delete set null,
  add column if not exists moderated_at timestamptz;

create index if not exists batches_moderation_status_idx
  on public.batches (moderation_status);
```

- Update the **latest** `batch_catalog` definition, not the initial one:
  - include `moderation_status` and `moderation_reason`,
  - filter `(b.moderation_status <> 'hidden' or b.seller_id = auth.uid())` so the seller still sees their hidden batch with a notice,
  - keep existing columns and joins intact.
- Add admin `select` policies on `batches` and `batch_products`.
- A hidden batch must not be claimable. The catalog exclusion handles new browsing; also add a guard in `claim_batch_product` (or rely on the existing batch visibility check) so a direct product ID cannot bypass it. Test this.
- `flagged` remains visible to buyers but is marked internally for admin follow-up. `hidden` is removed from the buyer catalog.
- Notify the seller when a batch is flagged, hidden, or restored.

### 6.5 Admin read access (RLS)

Add admin `select` policies on the tables the console needs. Keep them **select-only**; every mutation goes through an RPC.

At minimum:

- `user_profiles` — admin select. Do **not** expose `auth.users` directly; join email in a security-definer RPC.
- `batches`, `batch_products` — admin select.
- `orders` — admin select.
- `payments` — admin select.
- `seller_payment_methods` — admin select (read-only; never expose account numbers in CSV).
- `reviews` — admin select.
- `buyer_requests` — admin select.
- `waitlist_entries` — admin select.
- `combined_delivery_groups`, `combined_delivery_payment_accounts`, `combined_delivery_payment_reservations`, `combined_delivery_payment_context` — admin select for the Combined payments audit view.
- `admin_members`, `admin_audit_log` — admin select.

Do **not** add admin select to:

- `batch_expenses` (seller-private bookkeeping),
- `addresses` / `delivery_destinations` (use `orders.delivery_pin_address` and related order fields),
- `notifications` for other users (admins only read their own; `notify_admins` writes rows for them).

Storage admin read policies:

```sql
create policy bir_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'bir-certificates' and public.is_admin());

create policy receipts_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and public.is_admin());
```

Only generate signed URLs on demand. Never cache them, never put them in CSV, never log them.

### 6.6 Admin RPC surface

Implement these as `security definer`, `set search_path = ''`, fully qualified, with an explicit `is_admin()` check and an audit insert. Revoke from `public`/`anon`; grant execute to `authenticated`.

Read:

- `admin_dashboard() returns jsonb`
- `admin_list_users(p_search text, p_role text, p_status text, p_verification text, p_limit int, p_offset int) returns jsonb`
- `admin_get_user(p_user_id uuid) returns jsonb`
- `admin_search_users(p_query text, p_limit int default 10) returns jsonb`
- `admin_list_batches(p_search text, p_status text, p_moderation text, p_category text, p_limit int, p_offset int) returns jsonb`
- `admin_get_batch(p_batch_id uuid) returns jsonb`
- `admin_list_orders(p_search text, p_status text, p_days int, p_limit int, p_offset int) returns jsonb`
- `admin_get_order(p_order_id uuid) returns jsonb`
- `admin_list_payments(p_search text, p_status text, p_days int, p_limit int, p_offset int) returns jsonb`
- `admin_get_payment(p_payment_id uuid) returns jsonb`
- `admin_list_combined_payments(p_search text, p_status text, p_limit int, p_offset int) returns jsonb`
- `admin_get_combined_payment(p_payment_id uuid) returns jsonb`
- `admin_list_team() returns jsonb`
- `admin_list_audit(p_search text, p_action text, p_days int, p_limit int, p_offset int) returns jsonb`
- `admin_global_search(p_query text) returns jsonb` (optional; use if the header search is kept)

Write:

- `admin_set_account_status(p_user_id uuid, p_status public.account_status, p_reason text)`
- `admin_set_seller_access(p_user_id uuid, p_enabled boolean, p_reason text)`
- `admin_review_seller_verification(p_user_id uuid, p_decision text, p_flag_reason text, p_note text)`
  - decisions: `approve`, `reject`, `request_new`
  - `approve`: `bir_status='verified'`, `bir_review_note=null`, `bir_checked_at=now()`, `can_sell=true`
  - `reject`: `bir_status='flagged'`, `bir_flag_reason=<category>`, `bir_review_note=<note>`, optionally `can_sell=false` if the admin checked "Also revoke seller access"
  - `request_new`: `bir_status='none'`, `bir_document_path=null`, `bir_review_note=<note>`
- `admin_moderate_batch(p_batch_id uuid, p_action text, p_reason text)`
  - actions: `lock`, `unlock`, `flag`, `hide`, `restore`, `close`
  - `close` sets `status='closed'`; it does not cancel existing orders
  - `hide` sets `moderation_status='hidden'`; `restore` sets `visible`
  - `flag` sets `flagged`
- `admin_cancel_order(p_order_id uuid, p_reason text)`
- `admin_review_payment(p_payment_id uuid, p_decision text, p_reason text)` — decisions `verified` / `rejected`
- `admin_grant_admin(p_user_id uuid, p_reason text)`
- `admin_revoke_admin(p_user_id uuid, p_reason text)`

Rules common to every write RPC:

- `auth.uid()` is not null and `public.is_admin()` is true; otherwise `raise exception ... using errcode='42501'`.
- Destructive actions require a non-empty reason (minimum ~8 characters).
- Lock the target row `for update` before deciding, to prevent double approvals.
- If the target is already in the requested state, return a clear no-op result instead of writing a duplicate audit row.
- Insert an `admin_audit_log` row in the same transaction.
- Notify affected users through `public.notifications`; never email passwords or private document links.
- Never allow an admin to suspend or revoke themselves.
- Never allow the last active admin to be revoked. Count active admins under lock.

### 6.7 Notifications for admins

Add `public.notify_admins(p_category text, p_message text, p_target_path text, p_context jsonb, p_dedupe_key text)`:

- inserts one row per active admin except the actor,
- uses `dedupe_key` to avoid duplicate alerts,
- is called by BIR submission and any escalation path.

Add a trigger or modify `submit_bir_badge` so a seller moving to `bir_status='pending'` notifies admins. Do not notify on every profile update.

### 6.8 Demo mode

Keep `?preview=original` exactly as-is. Add `?preview=admin`:

- boots straight into the app as an admin user (e.g. "KARGO Admin", `admin@kargo.demo`),
- uses seeded admin data, not Supabase,
- supports in-memory actions so a reviewer can test suspend/restore, verification, moderation, order cancel, and team changes,
- resets on reload.

Put demo rows in `src/data/admin.ts` or a feature-local `adminDemo.ts`. Do not pollute the buyer/seller seed data.

---

## 7. Frontend plumbing

### 7.1 Tab bar and content

- Export a role-aware helper from `TabBar.tsx`:
  ```ts
  export function tabsForRole(role: Role): Tab[]
  ```
  - Admin: `["Dashboard", "Users", "Batches", "Transactions", "Settings"]`
  - Seller: existing 4
  - Buyer: existing 4 (the UI re-labels Batches → Home, My Claims → Claims, Payments → History)
- Reuse `LayoutGrid` for Dashboard, and add `Users`, `Package`, `ReceiptText`, `Settings` icons.
- `role === "Admin"` gets an `admin-tabbar` class and the same sticky/height behavior as the buyer bar. On ≤620px, show icon above label, minimum 44px targets, and allow horizontal scroll instead of squashing five tabs.
- `TabContent.tsx`:
  - import `AdminDashboard`, `AdminUsers`, `AdminBatches`, `AdminTransactions`, `AdminSettings` from `@/features/admin`
  - map `Users` and `Transactions` to the admin components
  - branch on `role` for shared tab names:
    - `Dashboard`: Admin → `AdminDashboard`; Buyer/Seller → existing `Dashboard`
    - `Batches`: Admin → `AdminBatches`; Buyer/Seller → existing `Batches`
    - `Settings`: Admin → `AdminSettings`; Buyer/Seller → existing `Settings`
  - use `tabsForRole(role)` for slide direction.

### 7.2 Header, user menu, footer

- `Header`:
  - For Admin, hide the buyer/seller `SearchBox` and render a quiet "Admin console" chip with `ShieldCheck`.
  - Keep the notification bell.
  - Pass `displayLabel={role === "Admin" ? "Admin" : "User"}`.
  - Do not pass `onApplyToSell` for admins.
- `UserMenu`:
  - For Admin, show a single "Administrator" row with a shield icon instead of the seller status block. Do not show a role tier.
  - Hide "Start Selling".
  - "View Profile" and "Settings" navigate to Admin Settings → Profile.
  - Keep Log out.
- `Footer`:
  - For Admin, hide the marketing `Footer` and render a slim internal footer: `KARGO Admin · Internal use only` plus the support email. Match the existing footer typography and quiet border.

### 7.3 Notifications

- Add `NOTIF_ADMIN` to `src/data/notifications.ts` with realistic seeded items:
  - "New seller verification from …"
  - "Payment proof has been waiting 26 hours"
  - "Batch … was flagged for review"
  - "A new admin was added to the team"
- `NotificationsProvider` must branch three ways: Admin → `NOTIF_ADMIN`, Seller → `NOTIF_SELLER`, Buyer → `NOTIF_BUYER`.
- `destination()` must accept admin tab names and map legacy paths. Admin notifications should never route to `My Claims` or `Dashboard`.
- Admin notification targets: `Users`, `Batches`, `Transactions`, `Settings`.

### 7.4 Navigation intent

Extend `src/state/navIntent.ts`:

```ts
adminTab: AdminTab | null
adminSubtab: string | null
adminFilter: string | null
adminTargetId: string | null
```

Add `requestAdminSection({ tab, subtab?, filter?, targetId? })`. The Admin shell consumes the intent once, sets the local sub-tab/filter, opens the target modal if provided, then clears the intent. Follow the existing consume-on-mount pattern used by Batches.

Use this for:

- Dashboard queue cards → exact sub-tab/filter,
- "View seller" from a batch or payment → Users detail,
- "View order" from a payment → Transactions order detail,
- admin notification clicks.

### 7.5 Data loading

Create `src/services/adminApi.ts` and export `adminApi` from `src/services/index.ts`.

- Use `requireSupabase()`; never import a service-role client.
- Wrap RPC calls in a typed `callAdmin<T>()` that converts `42501` / `Admin access required` into an `AdminAccessError`.
- List functions return `{ rows, total, nextOffset }`.
- Use server-side pagination (25 rows). "Load more" appends; filter changes reset to offset 0.
- Create `src/features/admin/useAdminResource.ts`:
  - `data`, `loading`, `error`, `refresh`,
  - abort/ignore stale responses when filters change,
  - a shared `refreshKey` from the admin shell for realtime invalidation.
- Realtime: one subscription in the admin shell to `user_profiles`, `batches`, `orders`, `payments`, `admin_audit_log`; debounce 300ms and bump `refreshKey`. Do not create a channel per tab.
- No polling. No `localStorage` caching of admin data.

---

## 8. Tab specifications

### 8.1 Dashboard

**Purpose:** answer "what needs attention right now?" in under 10 seconds.

Layout, top to bottom:

1. **Page header**
   - `Dashboard`
   - Subtitle: "What needs attention across KARGO right now."
   - Right side: "Updated {time}" + a secondary Refresh button.

2. **KPI row** (5 cards; 3+2 desktop, 2 per row tablet, 1 column mobile):
   - GMV (30d) — confirmed payments in the last 30 days, using `payment_confirmed_at` (an approval today counts today, even for an older order)
   - Orders (30d) — orders whose payment was confirmed in the same 30-day window
   - Active sellers
   - Pending seller verifications
   - Payments awaiting review
   Use the seller dashboard stat-card treatment: white `Card`, small tinted icon square, 11px uppercase muted label, 22–24px Josefin value, small delta/sub-label.

3. **Needs attention** (two columns on desktop, stacked mobile):
   - Left: action queue rows, each with icon, title, count, severity tone, one-line description, and a chevron. Whole row is a button.
     - Pending seller verifications → Users / Seller verification
     - Payments awaiting review > 24h → Transactions / Payments
     - Flagged or hidden batches → Batches / Flagged
     - Suspended accounts → Users / Suspended
     - Paid orders not shipped in 7+ days → Transactions / Orders
   - If a count is 0: "All clear" with a green check, not a red zero.
   - Right: 14-day GMV bar chart. Inline CSS/SVG only; no chart library. Include an `sr-only` table of dates and values. Bars use `INDIGO` at low opacity with the current day solid; hover/focus shows the value. GMV and order counts land on the payment-confirmed date, not the order-created date.

4. **Bottom row**:
   - Recent admin activity (last 8 audit rows): actor, action, target, relative time. Link to Settings / Audit log.
   - Top sellers (30d): avatar, shop, verified badge, GMV, order count. Link to Users filtered to sellers.

States:

- loading: `CardSkeleton` grid, not a spinner-only page.
- error: inline error card with Retry; do not blank the page.
- empty queues: warm, calm copy; no alarmist red.

### 8.2 Users

**Purpose:** find any account, verify sellers, and control access.

Sub-tabs (horizontal segmented control under the title, scrollable on mobile):

- **All accounts**
- **Seller verification** — show a count badge when > 0
- **Suspended**

**All accounts**

- Search by name, email, shop, or user ID.
- Filters: type (All / Buyers / Sellers / Admins), status (All / Active / Suspended), verification (All / Not submitted / Pending / Verified / Rejected), sort (Newest, Name, Most orders, Highest GMV, Last active).
- Desktop table columns: Account (avatar, name, email), Type, Seller status, Joined, Orders, 30d GMV, Account status, chevron.
- Mobile: card per account with the same information in a compact stack.
- Row click opens `AdminUserDetailModal` (Modal, width ~720, scrollable):
  - Identity: avatar, name, email, user ID, joined, last active.
  - Roles: Buyer/Seller/Admin badges; seller capability; BIR status.
  - Seller summary: shop name, rating, live batches, orders, 30d GMV.
  - Recent activity: last 5 orders/payments (links open the relevant admin detail).
  - Moderation history: recent audit entries for this user.
  - Actions:
    - Suspend account / Restore account
    - Grant seller access / Revoke seller access
    - Approve/Reject BIR (links to the verification review)
    - Grant/revoke admin (handled in Settings → Team; link there rather than duplicating the control)
  - Every destructive action opens `AdminConfirmModal` with a required reason. Suspend/revoke/cancel/override also require typing the target's name.
- Pagination: 25 rows, "Load more".

**Seller verification**

- Queue of `bir_status = 'pending'`, oldest first.
- Columns: Seller (avatar, name, shop), Submitted, Document, Age, Action.
- Row opens `VerificationReviewModal`:
  - Seller summary and current status.
  - Document preview via a 60-second signed URL (image/PDF). Show a skeleton while loading; show a clear "Document unavailable" state with Retry.
  - Checklist (UI-only): readable, name/shop matches, BIR details valid, not expired.
  - Decision:
    - **Approve seller** — optional note; sets verified + `can_sell=true`.
    - **Reject document** — required reason + category (`unreadable`, `bad_domain`, `mismatch`, `expired`, `other`); sets `flagged` + `bir_review_note`; optional "Also revoke seller access".
    - **Request new document** — required note; clears `bir_document_path`, sets status `none`.
  - Show previous decisions from the audit log.
- Empty state: "No seller verifications waiting." / "New BIR submissions will appear here."
- Do not auto-approve. Admin promotion is handled only in Settings → Team.

**Suspended**

- List suspended accounts with reason, changed at, changed by, and Restore action.
- Empty state: "No suspended accounts."
- Restoring requires a reason.

### 8.3 Batches

**Purpose:** moderate supply without editing the seller's business.

- Search by title, seller, batch ID.
- Filters: status (All / Live / Locked / Draft / Closed), moderation (All / Visible / Flagged / Hidden), category.
- Desktop table: Batch (cover thumb + title), Seller, Category, Window, Products, Claimed/Total, Status, Moderation, Actions.
- Mobile: card with cover thumb, title, seller, dates, claimed progress, status/moderation pills.
- Row actions: View, Flag/Hide, Lock/Unlock.
- `AdminBatchDetailModal`:
  - Cover (use `batchCoverSrc` from `constants/theme`), title, seller, category, dates, status, moderation state + reason.
  - Stats: products, total quantity, claimed, waitlist count, order count, confirmed GMV.
  - Products table: name, price, total, claimed, waitlist, locked.
  - Seller summary with a link to the user detail.
  - Recent orders summary (counts by status).
  - Moderation history from the audit log.
  - Actions:
    - Lock / Unlock batch
    - Flag for review (reason required)
    - Hide from catalog / Restore to catalog (reason required)
    - Close batch (reason required)
  - Copy must make the consequences explicit: hiding removes it from the buyer catalog; closing blocks new claims but does not cancel existing orders; locking prevents new claims/edits according to existing seller lock behavior.
- When a batch is hidden, the seller must still see it in their Batches tab with an amber moderation notice and the reason. Add `moderationStatus` / `moderationReason` to `BatchType` and map from `batch_catalog`. Keep this change minimal.

### 8.4 Transactions

**Purpose:** audit money and order state; help when a seller cannot act.

Sub-tabs:

- **Orders**
- **Payments**
- **Combined payments**

**Orders**

- Search by order number, buyer, seller, product.
- Filters: status, date range (7/30/90/all), seller, buyer.
- Desktop table: Order #, Product, Buyer, Seller, Amount, Status, Fulfillment, Created.
- Detail modal:
  - `StageProgress` with the canonical stage.
  - Order timeline: created → payment submitted → verified → preparing → shipped → delivered (only show events that exist).
  - Buyer/seller cards with links to user detail.
  - Payment submissions (status, method, amount, reference, submitted date) with a link to the payment detail.
  - Delivery fields from the order: pin address, courier, rider, tracking, ETA.
  - Actions: Cancel order, Copy order number.
- `admin_cancel_order`:
  - block on `completed`,
  - block when the order is part of an active combined payment (point the admin to the combined payment record),
  - release reserved quantity for unpaid/confirmed orders,
  - set `cancelled`, notify buyer and seller, audit,
  - warn that any money already sent is refunded outside KARGO.

**Payments**

- Search by order number, reference, buyer, seller.
- Filters: status (All / Pending review / Verified / Rejected), method, date range.
- Desktop table: Order #, Buyer, Seller, Method, Amount, Reference, Submitted, Status, Reviewed by.
- Show an "Awaiting 24h+" amber chip when `status='pending_review'` and `submitted_at < now() - 24h`.
- Detail modal:
  - Receipt preview via signed URL (60s), skeleton, error/retry.
  - Payer name/phone, reference, method, amount, submitted date.
  - Order context and seller decision (reviewed at/by, rejection reason).
  - Actions: Verify payment / Reject payment, View order.
- Admin override copy: "Use only when the seller cannot act. This changes the order's paid state and notifies both parties."
- Never show full seller account numbers in the list or CSV.

**Combined payments**

- Read-only audit view over the combined-delivery payment tables.
- Columns: Group/Reference, Buyer, Seller, Amount, Status, Submitted, Proof.
- Detail: included orders, shipping fee, status timeline, proof preview.
- No admin actions in v1. Combined-payment integrity is handled by the existing seller RPCs.
- If the combined-delivery schema is not migrated in an environment, show a graceful "Combined payments are not available in this environment" state instead of crashing.

**CSV export:** export the current filtered rows, client-side. Exclude receipt URLs, account numbers, and BIR links. Use a filename like `kargo-payments-2026-10-23.csv`.

### 8.5 Settings

Use the existing Settings visual pattern: 220px left nav in a `Card`, content in a `Card` to the right; on mobile the nav becomes a horizontal scrollable row.

Sub-tabs:

**Profile**

- Avatar, name, email, admin role (display "Administrator"), member since, last sign-in.
- Save via the existing `kargoApi.updateProfile` + avatar upload. Do not expose seller bio/shop fields.
- Show "KARGO Admin · Internal use only" as a quiet label.

**Security**

- Reuse the existing password-change pattern (`SecuritySection`). Export it from `features/settings/index.ts` or copy its exact visual treatment.
- Show a note: "Admin actions are logged with your name."
- Do not add a fake 2FA toggle. If 2FA is not implemented, do not show it.

**Team**

- Every admin can add or revoke admins; there is no tier above or below "Administrator".
- Table: Name, Email, Granted by, Granted at, Actions. There is no Role column — do not render a tier that does not exist.
- "Add admin" opens a modal:
  - search existing accounts by email/name (never create a new auth user here),
  - select account, required reason,
  - confirm with the target name typed.
- Revoke access with a required reason and typed confirmation.
- Guards: cannot revoke your own access; cannot revoke the last active admin.
- Replace the old three-tier matrix with this paragraph, shown in the tab:
  > Every admin can do everything in this console: verify sellers, suspend accounts, moderate batches, cancel orders, override payments, and manage the team. There are no read-only admins. Actions are recorded in the audit log with your name.

**Audit log**

- Filters: search actor/target, action, date range.
- Table: When, Actor, Action, Target, Reason. Row opens a detail modal with before/after JSON as readable key/value rows.
- CSV export of the filtered rows.
- Copy: "Audit entries are immutable. They cannot be edited or deleted."
- Do not display secrets or signed URLs.

---

## 9. Shared admin UI and visual language (copy Buyer/Seller)

Create only the components that are reused across 2+ admin tabs. Put them in `src/features/admin/components/`.

Suggested:

- `AdminPageHeader.tsx` — title, subtitle, right-side actions.
- `AdminStatCard.tsx` — the seller dashboard stat treatment.
- `AdminFilterBar.tsx` — search + selects, wraps on mobile.
- `AdminTable.tsx` — desktop table + mobile card shell. Keep the table/card switch CSS-only at 620px.
- `AdminBadge.tsx` — status/priority/role/moderation pills. Match `StatusBadge` exactly: rounded-full, 11px semibold, dot + label. Add `ADMIN_TONES` in `src/constants/admin.ts`; do not force admin statuses into `STATUS_C`, which is typed to `PaymentHistoryStatus`.
- `AdminConfirmModal.tsx` — title, consequence copy, required reason textarea, optional typed-name confirmation, Cancel/Confirm. Use `Modal` with the `danger` variant.
- `AdminEmptyState.tsx` — thin wrapper over `EmptyState` with admin copy.
- `AdminErrorState.tsx` — inline error card with Retry.
- `AdminSectionTabs.tsx` — accessible segmented control (`role="tablist"`, arrow-key navigation, `aria-selected`).

Visual rules:

- **Colors:** only `INDIGO`, `CREAM`, `CYAN_L`, `SKY`, `GREEN`, `AMBER`, `CORAL`, plus the existing grays. No new purple/blue admin accent. No gradients.
- **Type:** headings `'Josefin Sans', sans-serif`; body inherits the app's Inter stack. Values 22–24px Josefin; labels 11–12px; table text 13px. Do not add a font.
- **Surfaces:** `Card` (white, `1px solid #E5E7EB`, radius 8, subtle shadow, `p-5`). Avoid nested cards.
- **Tables:** copy `Payments.tsx`: `Card className="!p-0 overflow-hidden"`, horizontal scroll wrapper, `thead` background `#6892D5` with white uppercase 11px labels; rows separated by `#F3F4F6`; hover `#F9FAFB`.
- **Inputs:** copy Settings/Security: label 12px/600 `#374151`; input 13px, `1px solid #E5E7EB`, radius 7, padding `8px 12px`.
- **Buttons:** `PrimaryBtn` for the main action, `SecondaryBtn` for Cancel/secondary. Destructive buttons use a red outline treatment (`#B91C1C` text, `#FECACA` border, `#FEF2F2` background) and still meet 44px targets.
- **Modals:** `Modal` width 480 for confirmation, 560–680 for detail, 720 for user detail. Use `useDialogA11y` only for custom full-page overlays, not for `Modal`.
- **Motion:** reuse existing `fi`, `pl`, `pr`, `si` classes. No new animation library. Respect reduced motion.
- **Empty/loading:** `EmptyState`, `CardSkeleton`, `RowSkeleton`. Never show a bare `—` or a blank page.
- **Feedback:** inline `role="status"` success text with a `Check` icon in `GREEN`, auto-clearing after ~2.5s. No `window.alert` in admin.
- **Responsive:** page padding `p-6` desktop, `p-3`/`p-4` mobile; no horizontal page scroll at 375px/390px; tables become cards; filters stack; modals fit `calc(100vw - 24px)`.
- **Header/tab bar:** admin console should look like the same product. Keep the white header, KARGO lockup, notification bell, and 44/56px shell heights. Only the tab set and the small "Admin console" chip change.

---

## 10. File plan

Keep the existing architecture: one feature folder per tab, feature-to-feature imports only through `index.ts`, `@/` alias for cross-folder imports.

```
src/
  types/
    index.ts                     Role, AdminTab, Tab, UserInfo additions
  constants/
    admin.ts                     ADMIN_TONES, filter options, action labels
  data/
    admin.ts                     demo seed rows (?preview=admin)
  services/
    adminApi.ts                  typed RPC wrapper + demo adapter
    index.ts                     export adminApi + types
  features/
    admin/
      index.ts                   export the 5 tab components
      AdminShell.tsx             optional shared header/sub-tab/realtime/refresh wrapper
      AdminDashboard.tsx
      AdminUsers.tsx
      AdminBatches.tsx
      AdminTransactions.tsx
      AdminSettings.tsx
      useAdminResource.ts
      adminTypes.ts              UI row/detail types for adminApi results
      components/
        AdminPageHeader.tsx
        AdminStatCard.tsx
        AdminFilterBar.tsx
        AdminTable.tsx
        AdminBadge.tsx
        AdminConfirmModal.tsx
        AdminErrorState.tsx
        AdminSectionTabs.tsx
        AdminUserDetailModal.tsx
        VerificationReviewModal.tsx
        AdminBatchDetailModal.tsx
        AdminOrderDetailModal.tsx
        AdminPaymentDetailModal.tsx
        AdminCombinedPaymentDetailModal.tsx
        AuditDetailModal.tsx
  components/layout/
    TabBar.tsx                   role-aware tabs
    TabContent.tsx               admin mappings
    Header.tsx                   admin chip, hide search
    UserMenu.tsx                 admin badge, hide seller CTA
    Footer.tsx                   internal admin footer
  App.tsx                        role, landing tab, suspended screen, shell
```

SQL/test plan:

```
supabase/migrations/
  202611010001_admin_foundation.sql
  202611010002_admin_moderation.sql
  202611010003_admin_team_and_audit.sql
supabase/tests/
  admin_backoffice.sql
```

Do not add a router, state library, chart library, table library, or form library.

---

## 11. Implementation order

### Phase 0 — decisions and guardrails
- Confirm the 5-tab composition and sub-tabs.
- Confirm the `can_sell` reconciliation (`public.can_sell()` reads `user_profiles.can_sell`).
- Confirm the single admin role and its consequences (every admin can do everything; no read-only tier).
- Confirm that refunds are recorded, not processed.

### Phase 1 — foundation
- Types, role derivation, landing tab, allowed-tab guard.
- `profileFor` admin/account-status mapping.
- `admin_members`, `is_admin`, audit table, column revokes, `enable_seller_access`.
- Storage admin read policies.
- Admin shell, tab bar, header/menu/footer changes, suspended screen.
- `?preview=admin` demo boot.

### Phase 2 — Dashboard + Users
- `admin_dashboard`, `admin_list_users`, `admin_get_user`.
- Dashboard KPIs, action queue, chart, recent activity.
- Users list, filters, detail modal.
- Seller verification queue + review modal + approve/reject/request-new RPC.
- Suspend/restore + grant/revoke seller.

### Phase 3 — Batches + Transactions
- Batch moderation columns, catalog update, RPCs.
- Batches list/detail/actions + seller-facing moderation notice.
- Orders and payments read RPCs + detail modals.
- Cancel order and payment override with guards.
- Combined payments read-only view + graceful missing-schema state.

### Phase 4 — Settings, team, audit, notifications
- Admin profile/security.
- Team list/grant/revoke + self/last-admin guards.
- Audit log + detail + CSV.
- `NOTIF_ADMIN`, `notify_admins`, verification trigger.
- CSV exports for transactions and audit.

### Phase 5 — hardening
- RLS negative tests, SQL smoke test, typecheck/build/format.
- Mobile 375/390, keyboard, reduced motion, empty/loading/error.
- Demo-mode interaction pass.
- Update `ARCHITECTURE.md` and `DESIGN.md` with the admin folder and tab composition.

---

## 12. Acceptance criteria

An implementation is complete only when all of these pass.

### Access and identity
- [ ] An admin signs in through the normal login screen and lands on **Dashboard**.
- [ ] The admin sees exactly the 5 admin tabs and no buyer/seller tabs.
- [ ] A buyer/seller sees the existing experience unchanged.
- [ ] A non-admin cannot open an admin tab, call an admin RPC, or read an admin-only row.
- [ ] A suspended account sees the suspended screen and cannot mount the console.
- [ ] The last active admin cannot be suspended or revoked.
- [ ] An admin cannot suspend or revoke themselves.
- [ ] `can_sell` cannot be self-granted through PostgREST; the existing "Start Selling" flow still works through `enable_seller_access()`.

### Users and verification
- [ ] Search/filter/pagination work on the Users list.
- [ ] User detail shows identity, roles, seller summary, recent activity, and moderation history.
- [ ] Suspend/restore updates `account_status`, writes a reason, audits, and notifies the user.
- [ ] Grant/revoke seller access updates `can_sell` and is reflected at the next sign-in/refresh.
- [ ] Approve verification sets `verified` + `can_sell=true` + audit + notification.
- [ ] Reject/request-new stores a seller-facing reason and audits.
- [ ] BIR preview works only through a short-lived signed URL.
- [ ] A normal user cannot read another user's BIR document.

### Batches
- [ ] Hidden batches disappear from the buyer catalog and cannot be claimed by direct ID.
- [ ] The seller still sees their hidden/flagged batch with the moderation reason.
- [ ] Flag/hide/restore/close each audit and notify the seller.
- [ ] Lock/unlock matches the existing seller lock behavior.
- [ ] Closing a batch does not cancel existing orders.

### Transactions
- [ ] Orders and payments lists filter, paginate, and export correctly.
- [ ] Order detail shows the real timeline and delivery fields.
- [ ] Cancel order blocks completed orders and active combined-payment orders, releases inventory, audits, and notifies.
- [ ] Payment override is audited, guarded by a reason, and notifies both parties.
- [ ] Combined payments degrade gracefully when the schema is absent.
- [ ] Receipts are only available through short-lived signed URLs.

### Settings, team, audit
- [ ] Profile save and password change match the existing Settings behavior.
- [ ] An admin can add or revoke another admin with a required reason and typed confirmation.
- [ ] An admin cannot revoke their own access; the last active admin cannot be revoked.
- [ ] Every admin mutation writes one audit row with actor, action, target, reason, and before/after.
- [ ] Audit entries cannot be edited or deleted from the client.
- [ ] Audit CSV export works and contains no secrets.

### UI/UX
- [ ] No horizontal page scroll at 375px or 390px.
- [ ] Tables become cards at ≤620px; filters stack; actions remain 44×44px.
- [ ] Modals trap focus, close on Escape, restore focus, and respect reduced motion.
- [ ] Status is communicated with text + shape, not color alone.
- [ ] Every list has loading, empty, error, and no-results states.
- [ ] Success/error feedback is inline; no `alert()`.
- [ ] The visual language matches Buyer/Seller: same cards, tabs, headings, buttons, table header, pills, spacing, and typography.
- [ ] No new colors, fonts, gradients, or dependencies.

### Demo and regression
- [ ] `?preview=original` still boots the seeded seller demo.
- [ ] `?preview=admin` boots a fully navigable admin demo with seeded queues and working in-memory actions.
- [ ] `npm run test:expiry` and `npm run test:emails` still pass.

---

## 13. Verification commands

Run from the repo root:

```bash
npm run typecheck
npm run build
npm run format
npm run test:expiry
npm run test:emails
npx madge --circular --extensions ts,tsx src
```

SQL smoke test (adjust the local URL):

```bash
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_backoffice.sql
```

The SQL test must cover:

- admin can call `admin_dashboard` / list RPCs,
- buyer and seller calls fail with `42501`,
- a non-admin cannot grant or revoke admins,
- a suspended admin loses access,
- the last active admin cannot be revoked,
- `can_sell` cannot be updated directly by `authenticated`,
- `enable_seller_access()` works for an active user,
- hidden batches are absent from `batch_catalog` for a buyer but present for the owner,
- audit rows are created exactly once per mutation,
- a non-admin cannot select `admin_audit_log`.

Use the existing `supabase/tests/combined_delivery_*.sql` style: `begin;` … `rollback;`, deterministic UUID fixtures, `set_config('request.jwt.claim.sub', ...)`, and `do $$ ... raise exception ... $$` assertions.

Manual checks:

1. Sign in as admin → Dashboard.
2. Suspend a buyer → sign in as that buyer → suspended screen.
3. Restore → sign in again → normal app.
4. Approve a seller verification → seller can create a batch.
5. Hide a batch → buyer catalog loses it; seller sees the moderation notice.
6. Add a second admin → confirm they land on Dashboard and the grant is audited.
7. Attempt to revoke the last admin → blocked with a clear message.
8. Check 375px and 390px widths on every admin tab.
9. `?preview=admin` and `?preview=original` both work.

---

## 14. Out of scope

Do not implement these in this pass:

- A dispute or case-management system: no `disputes` table, no case references, no buyer/seller "report a problem" flow, no resolution or escalation UI. KARGO has no such schema today and this pass does not add one.
- Hard-deleting accounts or cascading destructive cleanup.
- Impersonation or "view as buyer/seller" mode.
- Payment processing, wallets, escrow, refunds, or a fee ledger.
- Editing seller products, prices, expenses, shop copy, or batch content.
- Reading seller-private `batch_expenses`.
- Reading buyer saved addresses / `delivery_destinations`; use order delivery fields.
- Self-service admin signup or an admin invite email.
- A separate admin login page or admin subdomain.
- A new chart, table, form, or state library.
- A full buyer/seller support inbox or chat. Off-platform support stays off-platform.
- Admin override of combined-delivery payments in v1.
- Platform-wide settings (fees, categories, maintenance mode) — add later as a separate, tested feature.
- A notification preferences redesign for admins; reuse the existing pattern only.

---

## 15. Copy deck

Use the product's warm, direct, operational voice. Warnings are specific; destructive actions state the consequence before confirmation.

### Navigation and page titles
- Admin console
- Dashboard — "What needs attention across KARGO right now."
- Users — "Buyers, sellers, and admins in one directory."
- Batches — "Review and moderate seller batches."
- Transactions — "Orders, payments, and combined payments across KARGO."
- Settings — "Your admin profile, team, and audit trail."

### Status labels
- Account: Active / Suspended
- Seller verification: Not submitted / Pending review / Verified / Needs correction
- Batch moderation: Visible / Flagged / Hidden
- Payment: Pending review / Verified / Rejected
- Order: use the existing order status vocabulary; do not invent new statuses.
- Admin: Administrator (single role; no tier labels)

### Confirmations
- **Suspend account:** "Suspend {name}?" / "They will lose access to protected actions immediately. Their batches stop accepting new claims. Existing orders stay visible for support." / reason required.
- **Restore account:** "Restore {name}?" / "They regain access immediately." / reason required.
- **Approve seller:** "Approve {name} as a seller?" / "This marks their BIR document verified and enables seller actions." / optional note.
- **Reject verification:** "Reject this document?" / "The seller can resubmit. Tell them exactly what to fix." / reason required.
- **Hide batch:** "Hide this batch from buyers?" / "It disappears from the catalog and cannot accept new claims. The seller still sees it with a moderation notice. Existing orders are unaffected." / reason required.
- **Close batch:** "Close this batch?" / "No new claims can be placed. Existing orders are not cancelled." / reason required.
- **Cancel order:** "Cancel this order?" / "This releases the reserved quantity. Any money already sent must be refunded outside KARGO. This cannot be undone." / reason + type the order number.
- **Verify payment (override):** "Verify this payment?" / "This marks the order paid and notifies the buyer and seller. Use only when the seller cannot act." / reason + type the reference.
- **Grant admin:** "Grant admin access to {name}?" / "They will see the full admin console at their next sign-in. Every admin can do everything, including managing the team. This is logged." / reason + type the name.
- **Revoke admin:** "Remove admin access from {name}?" / "Their account returns to its buyer/seller workspace immediately." / reason + type the name.

### Empty states
- "No accounts match these filters." / "Try a different search or clear the filters."
- "No seller verifications waiting." / "New BIR submissions will appear here."
- "No suspended accounts." / "Accounts you suspend will appear here with the reason."
- "No batches match these filters." / "Try a different status, category, or search."
- "No orders match these filters." / "Try a different status or date range."
- "No payments match these filters." / "New proof submissions will appear here."
- "No admin activity yet." / "Actions taken in the console will be recorded here."

### Suspended screen
- "Your KARGO account is suspended."
- "Contact {support email} if you believe this is a mistake."
- Show the reason if one was recorded.
- "Log out"

### Permission denied
- "This area is for KARGO administrators."
- "Your account does not have admin access."
- "Return to your workspace" (re-runs refresh and sends non-admins to their landing tab).

---

## 16. Final instruction to the implementer

Build the smallest complete admin back office that satisfies this spec. Prefer the existing component, the existing table pattern, and the existing copy tone over inventing something new. If a choice is ambiguous, choose the option that:

1. keeps the buyer/seller experience unchanged,
2. keeps the database as the source of truth,
3. requires an explicit reason for every destructive action,
4. leaves an audit trail,
5. looks like it already belonged in KARGO.
