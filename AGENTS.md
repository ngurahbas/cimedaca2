# AGENTS.md

## Commands

- `bun run dev` - start dev server
- `bun run build` - production build
- `bun run check` - type check (runs `svelte-kit sync` first, required)
- `bun run lint` - check formatting and lint
- `bun run format` - auto-format with Prettier
- `bun run test:unit` - run unit tests (Vitest)
- `bun run test:e2e` - run e2e tests (Playwright, builds first)
- `bun run test` - all tests

Run `bun run check` before committing to catch type errors.

## Architecture

SvelteKit app using Svelte 5 runes mode (forced for all project files). UI built with Skeleton UI and Tailwind CSS 4 — see [UI Components](#ui-components) for component guidance.

**Theme system**: Two themes available - `modern` (light) and `vox` (dark). Theme and mode stored in localStorage, applied via `data-theme` and `data-mode` attributes on `<html>`. Theme toggle component at `$lib/components/ThemeToggle.svelte`.

**Entry points**:

- Routes: `src/routes/`
- Shared components: `src/lib/components/`
- Layout: `src/routes/+layout.svelte` (imports theme toggle and favicon)
- Global styles: `src/routes/layout.css` (Tailwind + Skeleton imports)

## UI Components

Prefer the project's existing component libraries over hand-rolled implementations:

- **`@skeletonlabs/skeleton-svelte`** — default for styled, theme-aware components (modals, toasts, navigation, app bars, etc.). They honor the active `modern` / `vox` theme automatically.
- **`bits-ui`** — use for unstyled, accessible primitives (Dialog, Popover, Tabs, Accordion, Switch, Slider, Tooltip, etc.), either when Skeleton has no wrapper or when you need full styling control.
- Avoid custom dropdowns, tooltips, dialogs, accordions, etc. when one of the above covers the case.
- Style with Tailwind utilities plus Skeleton's design tokens so `data-theme` / `data-mode` switching continues to work.

## Testing

Vitest configured with two projects:

- **client**: browser-based tests for `.svelte.{test,spec}.{js,ts}` files
- **server**: node environment for other `*.{test,spec}.{js,ts}` files

E2E tests use Playwright and match `**/*.e2e.{ts,js}`. The e2e test command builds the app first.

## Code Style

- Tabs for indentation
- Single quotes, no trailing commas
- 100 character print width
- Prettier plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`
- ESLint with TypeScript and Svelte support
