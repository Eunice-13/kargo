# KARGO Prompt: "Do you have a reservation?" Gate for Shared Batch Links (Buyer Side)

## Context

This is a **refinement prompt** for the existing KARGO pasabuy / order-fulfillment app (React 19 + Vite + Tailwind v4). It adds **one new entry branch** for buyers who arrive from a **shared batch link**. It is not a redesign.

Keep the existing design system, component library, auth screens, and the seller side exactly as they are. Reuse existing components (`Modal`, `PrimaryBtn`, `SecondaryBtn`, `AuthLayout`, `AuthInput`, `LogoMark`) — do not invent new visual styles, colors, fonts, or button styles.

**Ordering rule from the panel:** the **Reservation step comes first**, the **Buyer Home Page (browsing items) comes after**.

---

## 1. DO NOT CHANGE (preserve exactly as-is)

- The entire visual design system (`DESIGN.md`): Indigo `#191BA9`, cream background, Josefin Sans + Inter, existing card/button/status styles.
- The **existing direct-website mechanism**: opening the app at the root URL with no `?batch=` parameter must still boot straight to the normal **Login → App** flow. No reservation popup, no new steps.
- The `?preview=original` demo bypass (`App.tsx`) — demo mode must keep booting straight into `stage === "app"` with seed data and no gate.
- The seller side entirely: seller logins, seller batch links, seller Dashboard/Batches/Payments, `ApplyToSellModal`, `NewBatchModal`.
- The existing auth logic in `src/features/auth/Login.tsx` and `SignUp.tsx` (validation, Supabase calls, roles, Forgot password, demo note) — extend with context/props only, do not rewrite.
- The existing shared-link builder `buildBatchLink()` in `src/components/shared/shareLink.ts` — it already emits `?batch=<id>`; do not change the link format.

---

## 2. Current behavior (verify, then change only what is listed)

- `src/App.tsx` reads `?batch=<id>` into `sharedBatchId`, then calls `requestBatchOpen(id)`; `stage` starts at `"login"` and the initial tab is `"Batches"` when a batch id is present.
- Auth success (`handleLoginSuccess` / `handleSignupSuccess`) sets `stage: "app"`; `Batches.tsx` consumes `navIntent.batchId` and opens that batch's claim page.
- So today, a shared batch link **already** works: login screen → after auth → the batch's claim page.

The only gap the panel flagged: the buyer is dropped on a bare login screen with **no explanation of why they landed there**, and no way to declare "I already reserved" vs "I'm new". That is what we are adding.

---

## 3. New behavior

### 3.1 Entry-detection rule

Show the new gate **only** when all of these are true:

| Condition | Where |
|---|---|
| `sharedBatchId !== null` (URL has `?batch=<id>`) | `App.tsx` |
| `stage !== "app"` (helper is not yet authenticated) | `App.tsx` |
| `booting === false` (session check finished — never flash the gate at a returning logged-in user) | `App.tsx` |
| `originalPreview === false` | `App.tsx` |

If the buyer has a valid session, they skip the gate completely and land on the linked batch page — the current mechanism, unchanged.

If there is **no** `?batch=` in the URL, nothing new happens at all.

### 3.2 Flow

```
Buyer opens a shared batch link (?batch=<id>)
        │
        ▼
POPUP: "Do you have a reservation?"
        │
        ├── "Yes, I have a reservation"
        │        └──► Choose: [ Log in ]  or  [ Create account ]
        │                     │                    │
        │                     ▼                    ▼
        │             Login screen          Create account screen
        │             (email + password)    (full name, email, password, social link)
        │                     │                    │
        │                     └────────┬───────────┘
        │                              ▼
        │                    Buyer Home Page (browsing items)
        │                    └─ linked batch's claim page open on top
        │
        ├── "No, not yet"
        │        └──► Create account screen → Buyer Home Page
        │
        └── Dismiss (×)
                 └──► existing Login screen, batch intent still pending
                      (unchanged fallback: login → the linked batch page)
```

### 3.3 Landing after auth

Both branches must end on the **Buyer Home Page (Batches tab, browsing items)**, with the batch from the link opened on top via the existing `navIntent` mechanism (this is what the current code already does, so keep it). Do not silently drop the link.

**Decision (confirmed):** land on Buyer Home **with the linked batch open on top**. Do not discard the shared batch link.

---

## 4. Detailed requirements

### 4.1 New component: `src/features/auth/ReservationGate.tsx`

- A **popup/modal**, not a full page, rendered over the existing auth surface.
- Build it on the shared `Modal` component (`src/components/shared/Modal.tsx`) so it inherits the focus trap, Escape handling, body scroll lock, header offset, and mobile behavior for free.
- Two internal steps (`useState<"question" | "choose">`):
  - **Step 1 — the question**
    - Title: `Do you have a reservation?`
    - Body: explain *why* they are here, e.g. "This batch was shared with you. Log in or create an account to view it and reserve your items."
    - Optionally show the batch title/seller from `batches.find(b => b.id === sharedBatchId)` when available (plain text only — do not build a new card style).
    - Primary button: `Yes, I have a reservation` → advances to step 2.
    - Secondary button: `No, not yet` → goes to the **Create account** screen.
  - **Step 2 — the account choice**
    - Primary: `Log in` → `setStage("login")`
    - Secondary: `Create account` → `setStage("signup")`
    - A back affordance returning to step 1.
- Keep all copy short and in the existing voice ("Your Budol, Our Kargo!"-style is fine, but do not restyle the auth pages).
- Export it from `src/features/auth/index.ts` alongside `Login`, `SignUp`, `Onboarding`, `ApplyToSellModal`.
- Keep the component under `src/features/auth/` — do **not** put it in `App.tsx` (per `ARCHITECTURE.md`, screens live under `src/features/`).

### 4.2 Wire-up in `src/App.tsx`

- Add one boolean: `const viaBatchLink = sharedBatchId !== null` (reuse the existing `sharedBatchId` computation — do not add a second parser).
- Render `{showReservationGate && <ReservationGate ... />}` next to the existing `stage === "login"` / `stage === "signup"` blocks, gated by the table in §3.1.
- Pass callbacks: `onLogin={() => setStage("login")}`, `onSignUp={() => setStage("signup")}`, `onDismiss={() => setShowReservationGate(false)}`.
- Dismissing the popup must **not** clear `sharedBatchId` / `navIntent.batchId`, so the post-login landing still opens the linked batch.
- Do **not** add a new `AppStage` value. `AppStage` stays `"login" | "signup" | "app"` (`src/types/index.ts`). The gate is an overlay, not a stage.
- Suppress the gate once `stage === "app"` (covers both auth successes and restored sessions) so it never reappears mid-session.

### 4.3 Direct website + other entry points (regression guard)

Explicitly verify these still behave exactly as today, with **no** gate:

| Entry | Expected |
|---|---|
| App root URL, no params | Login → App (unchanged) |
| `?preview=original` | Straight to demo `app` stage, seed data, no gate |
| Already-authenticated buyer opens `?batch=<id>` | Straight to the batch's claim page, no gate |
| Batch card tapped **inside** the app (Header `onBatchSelect`, Seller Profile, search results) | Existing in-app navigation, no gate |
| Seller shared link, seller account | No gate; seller lands on their Dashboard/batch as today |
| Logout | Returns to Login (unchanged) |

### 4.4 Keep the deep link intact

- After auth via either gate branch, the URL still contains `?batch=<id>` and `navIntent.batchId` is still set, so `Batches.tsx` opens the claim page. Do not strip the query param before auth completes.
- Do not break the existing retry comment in `Batches.tsx` ("Login can mount this tab before the catalog arrives. Keep the intent pending and retry when batches load").

### 4.5 Create-account screen requirements (from the panel)

Reached with `stage === "signup"` (`src/features/auth/SignUp.tsx`). Fields required by the panel:

1. **Full name** — already `AuthInput label="Full Name"` with first+last validation.
2. **Email address** — already present.
3. **Password** — already present (min 8 chars).
4. **Social media link** — the existing "Contact & Social Links" block (Facebook / TikTok / Instagram + profile URL) already exists. For buyers arriving through this gate, present it as **recommended** with helper copy (e.g. "Helpers often check this before confirming a reservation."). Do not make it blocking (see §8).

Also keep: optional profile photo, the Buyer/Seller role choice (default **Buyer** when arriving through the gate), the terms checkbox behavior as-is, and the existing "Already have an account? Log in" switch.

### 4.6 Log-in screen requirements

`src/features/auth/Login.tsx` keeps its current fields: **Email address** + **Password** (+ "Forgot password?"), and keeps signing in through `kargoApi.signIn`.

**Decision (confirmed):** do **not** change login credentials. "Full name" is only collected on the Create account screen; it is not part of Log in. Do not weaken authentication, and do not add a name+email "reservation lookup" unless a real backend endpoint is built.

### 4.7 Copy requirements

Use exactly the panel's question as the popup title: **"Do you have a reservation?"**. All other copy must explain the two outcomes without jargon: what a reservation is, that an account is needed to view/reserve, and that the shared batch will open next.

### 4.8 Accessibility and mobile

- The popup must be keyboard-reachable, Escape-dismissible, and announce via the `Modal` dialog semantics it already implements.
- The two questions/choices must be real `<button>` elements with clear labels (no icon-only actions).
- Verify the popup on narrow widths together with the auth panes per `MOBILE_REPONSIVENESS.md` — the popup must not overflow the viewport or cover the whole form on small screens.

### 4.9 Code quality

- Follow `AGENTS.md`: default exports for components, double quotes, `@/` alias for cross-folder imports, no new dependency.
- Respect dependency direction in `ARCHITECTURE.md`: `App.tsx` → `features/auth`, never the reverse.

---

## 5. Acceptance criteria

- [ ] Opening `…/?batch=7` while logged out shows the **"Do you have a reservation?"** popup immediately after the session check settles (no flash for already-logged-in users).
- [ ] **Yes** → step 2 → **Log in** → login form → after success, Buyer Home Page with batch 7's claim page open.
- [ ] **Yes** → step 2 → **Create account** → signup form → after success, Buyer Home Page with batch 7's claim page open.
- [ ] **No, not yet** → create-account form → after success, Buyer Home Page.
- [ ] Dismissing the popup leaves the normal login flow intact, and the linked batch still opens after login.
- [ ] Opening the app at the root URL shows **no** popup and behaves exactly as before.
- [ ] `?preview=original` still boots straight into demo mode with no popup.
- [ ] An already-authenticated buyer opening a batch link goes straight to the batch page with no popup.
- [ ] In-app batch clicks (header search, seller profile, in-app cards) show no popup.
- [ ] Popup reuses `Modal` + existing buttons; no new colors, fonts, or ad-hoc button styles.
- [ ] No `AppStage` type change; no change to `shareLink.ts` link format; no seller-side changes.

---

## 6. Files expected to change

| File | Change |
|---|---|
| `src/features/auth/ReservationGate.tsx` | **New** — the popup (2 steps) |
| `src/features/auth/index.ts` | Export `ReservationGate` |
| `src/App.tsx` | `viaBatchLink` flag + conditional render + dismissal state; pass stage callbacks |
| `src/features/auth/SignUp.tsx` | Optional: gate-aware copy/default role and "recommended" social-link hint |
| `src/features/auth/Login.tsx` | Only if login copy needs to reflect why the user landed there (fields stay email + password) |
| `src/index.css` | Only if a tiny popup-specific tweak is unavoidable — prefer existing classes |

No changes to `src/state/navIntent.ts`, `src/components/shared/shareLink.ts`, `src/features/batches/*`, or the seller flow.

---

## 7. Manual test script (for the demo)

1. Log out. Open the app root → confirm normal Login screen, no popup.
2. Open `?batch=<existing batch id>` → popup appears.
3. Answer **Yes → Log in**, sign in → confirm Buyer Home + the batch's claim page.
4. Log out. Open the same link → **Yes → Create account**, register a buyer → confirm Buyer Home + claim page.
5. Log out. Open the same link → **No, not yet** → register → confirm Buyer Home.
6. Log out. Open the same link → dismiss (×) → log in → confirm the batch still opens.
7. Log in, then open the link again → no popup, straight to the batch page.
8. Repeat step 1 with `?preview=original` → demo mode, no popup.

---

## 8. Resolved decisions

These are settled — implement them as written.

1. **Login fields — settled.** Log in stays **email address + password** (Supabase `kargoApi.signIn`). Full name is **not** collected at login. No client-side "reservation lookup" by name+email; that would need a real backend endpoint and is out of scope.
2. **Post-auth destination — settled.** Buyer Home Page **with the shared batch's claim page opened on top** (preserve the existing `?batch=` behavior). The link is never discarded.
3. **"No" branch — settled.** "No, not yet" still requires an account, so it routes straight to the **Create account** screen, then Buyer Home.
4. **Social media link — settled.** Optional but **prominently encouraged** on buyer create-account via the gate. Do not make it blocking.
5. **Popup, not a page — settled.** Implement the panel's "popup" as a `Modal` overlay over the auth surface. `AppStage` stays `"login" | "signup" | "app"`.
