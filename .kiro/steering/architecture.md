# KARGO architecture rules

The UI is organized by tab/feature under `src/`. Follow these rules when adding or
moving code so the structure and its import graph stay clean. See `ARCHITECTURE.md`
for the full tree and "where do I add X".

## Dependency direction (no circular imports)

```
types, constants, data, state
  -> components/shared
    -> features/*
      -> components/layout
        -> App.tsx
```

- Lower layers must never import from higher layers.
- A feature (`src/features/<name>`) may import from `components/*`, `types`,
  `constants`, `data`, `state`.
- A feature may import another feature ONLY through that feature's `index.ts`.
- `components/shared` and `components/layout` must not import from a feature — except
  `components/layout/TabContent`, which composes the feature tab components.
- A file must never import from its own feature's main component. Put shared types or
  constants for a feature in a small leaf file (e.g. `feature/types.ts`) that both the
  main component and its sub-files import.
- If you hit a cycle, move the shared piece DOWN (to `components/shared` for UI, or a
  leaf module for a type/const). Do not work around a cycle with a dynamic import.

## Placement rule (source of truth)

Decide placement by ACTUAL usage, not by guessing:

- Used by exactly one feature -> it lives in that feature's folder.
- Used by two or more features -> `components/shared` (for UI) or its own feature
  folder exposed via `index.ts` (for feature logic, like `fulfillment`).

## Conventions

- Components are DEFAULT exports. Per-folder `index.ts` files re-export with NAMED
  exports.
- Strings containing apostrophes use double quotes (single quotes break the build).
- Use the `@/` alias for cross-folder imports; use relative `./` for siblings.
- Files are UTF-8 without BOM; keep emoji/symbols (₱, —, ✓, •) intact when moving code.

## Verifying a change

After structural changes, run `npm run typecheck` and `npm run build` (both must
pass), and check for cycles with `npx madge --circular --extensions ts,tsx src`.
