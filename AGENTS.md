# AGENTS.md

## Commands

- `bun run dev` - start dev server
- `bun run build` - production build (via Vite)
- `bun run preview` - preview built app on port 4173
- `bun run check` - type check (runs `svelte-kit sync` first, **required** before check works)
- `bun run check:watch` - type check in watch mode
- `bun run lint` - Prettier check + ESLint
- `bun run format` - auto-format with Prettier
- `bun run test:unit` - Vitest (client + server projects; see Testing)
- `bun run test:e2e` - Playwright e2e (builds + serves via `webServer` in `playwright.config.ts`)
- `bun run test` - runs `test:unit -- --run` then `test:e2e` (uses `npm run` not `bun run`)

Recommended local verification order: `bun run format` -> `bun run lint` -> `bun run check` -> `bun run test:unit`. Run e2e before pushing if you touched routes or `app.html`.

## Architecture

SvelteKit app using **Svelte 5 runes mode**, forced project-wide for non-`node_modules` files in `svelte.config.js`. UI: Skeleton UI + Tailwind CSS 4 (`@tailwindcss/vite`).

**Routes** (under `src/routes/`):
- `+page.svelte` - home, renders `<ThemeMenu />` only
- `demo/+page.svelte`, `demo/playwright/+page.svelte` - Skeleton/Playwright demo pages
- `reader/+page.svelte` - the PDF reader app (assembles `ReaderMenubar`, `NavigationPane`, `ContentPane`, `AiPane`)

**Shared code** (under `src/lib/`):
- `components/` - root components (`ThemeMenu.svelte`, `ThemeMenuMenu.svelte`) and `reader/` subfolder with the reader's pieces
- `stores/` - rune-based controllers in `*.svelte.ts` files (e.g. `theme.svelte.ts`, `reader.svelte.ts`). They export a singleton instance; rely on `$app/environment` `browser` guard.
- `assets/` - static assets imported through `$lib` (favicon)
- `vitest-examples/` - sample test/demo content; **not part of the app**

`src/routes/+layout.svelte` is a thin wrapper: imports `layout.css` and the favicon, then renders `children`. There is no reader-specific `+layout.svelte`.

## Theme system

Two independent concepts stored in `localStorage` and applied to `<html>`:

- `data-theme` - one of 22 themes in the `THEMES` array exported from `src/lib/stores/theme.svelte.ts` (catppuccin, cerberus, concord, crimson, fennec, hamlindigo, legacy, mint, **modern**, mona, nosh, nouveau, pine, reign, rocket, rose, sahara, seafoam, terminus, vintage, **vox**, wintry).
- `data-mode` - `light` | `dark`.

`src/app.html` runs an inline `<script>` in `<head>` (before SvelteKit hydrates) to set `data-theme` / `data-mode` from `localStorage`, preventing a flash of unstyled theme. Don't move it.

`themeController` (`$lib/stores/theme.svelte.ts`) is the single source of truth; `theme` and `mode` are `$state`, set via `setTheme` / `setMode`. `ThemeMenuMenu.svelte` is the embeddable radio-group block; `ThemeMenu.svelte` wraps it in its own `<Menubar.Root>` for the home page. `ReaderMenubar.svelte` embeds `<ThemeMenuMenu />` inside its own `<Menubar.Root>` - do not duplicate the radio markup.

## UI Components

Prefer existing libraries over hand-rolled implementations:

- **`@skeletonlabs/skeleton-svelte`** - default for styled, theme-aware components (modals, toasts, navigation, app bars, Tabs, etc.). Honors the active theme automatically.
- **`bits-ui`** - unstyled, accessible primitives (Dialog, Popover, Tabs primitives, Accordion, Switch, Slider, Tooltip, Menubar, etc.), used directly when Skeleton has no wrapper or full styling control is needed.
- Style with Tailwind utilities + Skeleton design tokens (e.g. `bg-surface-50-950`, `text-surface-950-50`) so theme/mode switching continues to work.

## Testing

**Vitest** (`vite.config.ts`) is configured with two projects:

- **client** - browser-based via `@vitest/browser-playwright` provider (chromium only, headless). Matches `src/**/*.svelte.{test,spec}.{js,ts}`. Excludes `src/lib/server/**`.
- **server** - node environment. Matches `src/**/*.{test,spec}.{js,ts}`. Excludes `*.svelte.{test,spec}` files.
- Global `expect.requireAssertions: true` - tests must assert; bare no-assertion tests fail.

Run a single project: `bun run test:unit --project=server` (or `=client`). Run one file: `bun run test:unit -- path/to/file.spec.ts`.

**E2E** (Playwright) matches `**/*.e2e.{ts,js}`. `playwright.config.ts` defines `webServer: { command: 'bun run build && bun run preview', port: 4173 }`, so `bun run test:e2e` builds + serves the app automatically. Existing e2e only covers `/demo/playwright`; the `/reader` route is **manual-smoke-only** in this phase.

## Toolchain quirks

- **Svelte 5 runes mode is forced** for all project files via `compilerOptions.runes` in `svelte.config.js`. Don't disable it; legacy syntax won't type-check.
- **pdfjs-dist is dynamically imported** inside `$effect` in `src/lib/components/reader/PdfViewer.svelte` (`await import('pdfjs-dist')`) and the component is SSR-gated with `$app/environment`'s `browser`. The worker is loaded via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`. Direct static imports will fail SSR.
- `pdfjs-dist@^6.0.227` is pinned as a direct `devDependency` (not just transitive).
- `engine-strict=true` is set in `.npmrc` - engines in `package.json` are enforced.
- `tsconfig.json` uses `rewriteRelativeImportExtensions: true` (TS 5.7+); you can use `.ts` extensions in relative imports.
- `svelte-kit sync` is run by `prepare`, `check`, and `check:watch`; if types look stale, run `bun run check` once.
- `plans/` contains design docs (e.g. `plans/reader-page.md`) - check here before designing adjacent features.

## Code Style

- Tabs for indentation (enforced by Prettier)
- Single quotes, **no** trailing commas
- 100 character print width
- Prettier plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`
- Tailwind class sorting via `prettier-plugin-tailwindcss` (stylesheet: `./src/routes/layout.css`)
- ESLint with TypeScript + Svelte; `no-undef` is disabled because `typescript-eslint` handles it
