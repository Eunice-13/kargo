# Refactor Notes — Tab-based folder split of `src/App.tsx`

Pure refactor of the single-file `src/App.tsx` (~16,156 lines) into a tab/feature
folder structure. No behavior, visual, or copy changes intended.

## Baseline (Step 0)

Captured before any changes (commit `chore: baseline before tab-based refactor`).

- `npm run typecheck` (`tsc --noEmit`): PASS
- `npm run build` (`vite build`): PASS
- JS bundle: `dist/assets/index-<hash>.js` = **428.66 kB** (gzip 109.60 kB)
- CSS bundle: `dist/assets/index-<hash>.css` = 61.46 kB (gzip 13.51 kB)
- Modules transformed: 1878
- Package manager: pnpm 10.34.3 via corepack (matches `.mise.toml`). `pnpm` was not
  on PATH; enabled through `corepack`. Dependencies were not installed at start;
  `corepack pnpm install` was run to enable typecheck/build.
- Git: repository did not exist at start; initialized here so each step can be
  committed. Baseline committed as the first commit.

### Smoke checklist
The interactive browser smoke checklist (buyer/seller flows, header menus, log out)
must be run manually by a human against `http://localhost:8443/?preview=original`.
This environment cannot drive a browser. The objective, automatable equivalents
(typecheck + build + bundle size + `madge --circular`) are used as the verifiable
gate after every step, and are recorded per step below.

## Unused / dead code found

- `BatchDetailPanel` (App.tsx L7740–8094) — never rendered. Moved to `src/_unused/`.
- `SellerSearchModal` (App.tsx L9590–9740) — never rendered. Moved to `src/_unused/`.

No other top-level component/helper/type/const was found unused; every other one has
at least one live reference. (Note: `ItemClaimModal` and `SellerProfileModal` are
referenced inside the two dead components above, but both are also rendered by live
features, so they remain live.)

## Bugs noticed but intentionally NOT fixed

(none yet)

## Files still over 500 lines after the split (and why)

(to be filled at the end)

## Things not verified

- Interactive browser smoke checklist (see above) — requires manual human run.

## Final folder tree

(to be filled at the end)
