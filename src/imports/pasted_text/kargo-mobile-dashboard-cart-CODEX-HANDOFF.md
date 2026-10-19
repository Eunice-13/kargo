# Codex handoff — mobile Dashboard + Cart

Paste everything below the rule into Codex as the task prompt.

---

Implement the mobile spec at:
  src/imports/pasted_text/kargo-mobile-dashboard-cart-prompt.md

Repo root: the directory containing that file's src/ tree (React 19 + Vite + Tailwind v4).

## Read first, in this order
1. The spec itself, front to back. Its §0 and §3 are the constraints; §2 is the deliverable;
   §7 is the acceptance gate. Do not start editing before you've read §0, §2, §3 and §7.
2. `src/imports/pasted_text/kargo-mobile-sizing-prompt.md` §0 and §2 only. The spec reuses that
   file's phone type scale and its desktop-invariance mechanism. Do not invent a second scale.
3. `MOBILE_REPONSIVENESS.md` for the house rules.

## What to build
The spec's §2 (a real 3-column `Product | Status | Deadline` table replacing the card conversion
on three specific tables), §4 (size compaction for the Upcoming Deadlines panel, the stats row and
the seller sidebar), and the three enumerated JSX changes in §3.
Supersedes: wherever this spec and `kargo-mobile-sizing-prompt.md` disagree about the Dashboard or
the Cart, this spec wins. Everywhere else the first prompt stands.

## Hard rules
- **Desktop must be provably unchanged** at 1280×900 and 1440×900. This is the acceptance gate,
  not a nicety. Snapshot every selector listed in §7.2 (rect + computed font-size + computed
  display) BEFORE you edit, and again after. Zero diffs, or you are not done.
- **CSS:** every added or changed declaration lives inside `@media (max-width: 620px)`,
  `(max-width: 480px)`, or `(max-width: 380px)`. No exceptions.
- **JSX:** exactly the three changes in §3 — the `isPhone` flag, the phone-only "three most urgent"
  derivation, and the Cart's mobile table branch. Nothing else. Each is gated on a phone-width
  check so desktop renders as before.
- **Files you may touch:** `src/responsive.css`, `src/features/dashboard/Dashboard.tsx`,
  `src/features/claims/MyClaims.tsx`. `src/index.css` only if a rule there actively contradicts the
  new one. If you need to change any other file, stop and report why instead.
- **Do not touch** anything in the spec's DO NOT CHANGE list, including the `≤1024` table→card
  conversion, `StatusBadge`, `Countdown`, and `MyClaims.tsx`'s seller branch.
- **Do not revert existing uncommitted work.** `src/responsive.css`, `src/components/layout/SearchBox.tsx`
  and `scripts/responsive-audit.mjs` already carry uncommitted changes from a prior mobile pass.
  Build on top of them; never `git checkout` them.
- **Line numbers in the spec are anchored to commit `9b4483b`** and `src/responsive.css` is under
  active edit, so some have drifted. When a citation doesn't point at the selector it names,
  **locate the rule by selector.** Class names and selectors in the spec are stable; numbers are hints.
  If a citation is wrong AND you can't find the right rule, stop and report — don't guess.
- **Do not commit.** Leave the changes in the working tree for review.

## Verify, then report
Run and paste the real output of:
  npx tsc --noEmit
  npm run format:all
  git diff --stat -- src/

The diff must contain only the files listed above. Then run the desktop-invariance snapshot (§7.2)
and the mobile acceptance assertions (§7.3) — including the three new Cart checks: row tap opens the
order-detail modal, the Pending Payments cards still expose "Pay Now", and the desktop Cart still
shows all eight columns.

A dev server is already running on port 8443; `scripts/responsive-audit.mjs` drives CDP against
`http://127.0.0.1:9338` and `http://127.0.0.1:8443/?preview=original`. Extend it to 360px and 414px
if needed. Treat emulator tap-target numbers as unreliable — `(pointer: coarse)` grants a 44px floor
that headless emulation doesn't report. Don't "fix" numbers that only look wrong in the emulator.

## Report back with
1. Every file you changed, and for each, a one-line reason.
2. The desktop-invariance result: the selector list checked, and proof of zero diffs.
3. Any spec citation that was stale, and what you used instead.
4. Any place the spec was ambiguous, wrong, or impossible — what you did and why.
5. Anything you deliberately left undone.

If you hit something that would require touching a fourth file or changing desktop rendering,
**stop and report** rather than proceeding.
