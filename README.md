<<<<<<< HEAD
# KARGO — Order Fulfillment Platform

React 19 + Vite + Tailwind CSS v4 + TypeScript. Front-end prototype (no backend); all data lives in memory and resets on refresh.

## Run it in VS Code

Requires Node.js 22 (any 20+ works).

1. Open this folder in VS Code (`File > Open Folder...`).
2. Open the integrated terminal (`Ctrl+` `` ` ``) and run:

   ```
   npm install
   npm run dev
   ```

3. Open http://localhost:8443. The sign-up screen appears first.
   To skip it and go straight into the app, open http://localhost:8443/?preview=original

Other commands:

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check (should print nothing) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |

If port 8443 is busy, set another one: `PORT=3000 npm run dev` (macOS/Linux) or `$env:PORT=3000; npm run dev` (Windows PowerShell).

## What's in here

- `src/App.tsx` — the whole app (screens, components, seed data)
- `src/index.css` — global styles / Tailwind entry
- `.figma/` and the Figma plugins in `vite.config.ts` — needed if you re-import into Figma Make; harmless otherwise. Keep them.
- `pnpm-lock.yaml` (Figma Make) and `package-lock.json` (npm) are both included; use whichever package manager you like, but stick to one.

## Changes in this version

- **Fulfillment Board now works** (Seller > Dashboard, and the Orders screen board). Tap a card to expand it, pick a status in the dropdown, and the card moves to that column right away on both boards. Column counts and the "Orders Fulfilled" stat update, the dropdown keeps keyboard focus, and screen readers hear "Moved X for Y to Z". Choosing Cancelled asks for confirmation first.
- Fixed the 14 TypeScript syntax errors and one undefined reference, so `npm run typecheck` passes and VS Code no longer shows red errors. Added the `typecheck` script.
- Added a visible keyboard focus ring for div-based buttons (`role="button"`).

## Known issues not fixed in this version

- Claim quantity is ignored: a claim of qty 2 or 3 is saved as x1 (My Claims and Pending Payments show the wrong amount).
- Claiming doesn't update "X/Y claimed", batch progress or "Only N left".
- Header search results do nothing when you are already on the Batches tab; the dropdown doesn't close on Escape or click-away.
- Orders and Reports screens exist but are not reachable from the tab bar.
- Pay Now / Pay All marks claims "Paid and Reserved" immediately (no seller review); new Payment History rows have a blank Batch and use a hardcoded date (Sep 10, 2026).
- Seller Dashboard shows leftover dev copy: "No "Pay All Pending" needed — sellers verify, not pay."
- Accessibility: low-contrast grey/amber text, unlabeled filter dropdowns, no page-level `<h1>`.
=======
# kargo
>>>>>>> 2189c18c3f2464366b2a66bd17a6b62704785f90
