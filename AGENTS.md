# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. The UI is organized by tab/feature — see `ARCHITECTURE.md` for the full folder tree, dependency direction, and "where do I add X" guidance. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Root component only (~150 lines): stage switch (login/signup/app), shared state, and the app-shell layout. Individual screens live under `src/features/`, not here.
- `src/types/` - Shared TypeScript types (`SharedState`, row/entity types, unions)
- `src/constants/` - Theme palette (`theme.ts`) and fulfillment-board constants (`fulfillment.ts`)
- `src/data/` - Seed data (initial values; live copies are React state in `App.tsx`)
- `src/state/` - Module-level mutable singletons (`navIntent` for cross-tab deep-linking)
- `src/components/shared/` - UI used by 2+ features (atoms + cross-feature modals); `index.ts` barrel
- `src/components/layout/` - App-shell chrome: `Header` (SearchBox/NotificationsMenu/UserMenu), `TabBar`, `TabContent`
- `src/features/<name>/` - One folder per tab (dashboard, batches, claims, payments, orders, reports, settings, auth) plus `fulfillment` (board logic shared by dashboard + orders). Each has an `index.ts` exposing its public surface.
- `src/_unused/` - Dead code kept for reference, not imported anywhere
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

Dependency direction (no cycles): `types, constants, data, state` -> `components/shared` -> `features/*` -> `components/layout` -> `App.tsx`. Use the `@/` alias for cross-folder imports and relative `./` for siblings. A feature may import another feature only through its `index.ts`.

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
