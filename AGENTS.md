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

- `+page.svelte` - home: a `Menubar.Root` containing `<ThemeSelector />` and a dark-mode `Switch`, plus a welcome heading and a link to `/reader`.
- `demo/+page.svelte`, `demo/playwright/+page.svelte` - Skeleton/Playwright demo pages.
- `reader/+page.svelte` - the PDF reader app (assembles `ReaderMenubar`, `NavigationPane`, `ContentPane`, `AiPane`; lays them out in a flex column at the top, panes below).

**Shared code** (under `src/lib/`):

- `components/` - root components. `ThemeSelector.svelte` is the single `bits-ui` `Menubar.Menu` (trigger + portal + content + radio group over `THEMES`); consumers wrap it in their own `Menubar.Root` (home page and `ReaderMenubar` each do this). The `reader/` subfolder contains all reader pieces: `ReaderMenubar`, `NavigationPane` (with `ThumbnailsPanel` + `OutlinePanel`), `ContentPane` (with `EmptyState` + `PdfViewer` + `ZoomControls`), `AiPane` (with `AiSettings`), plus shared `SidePane` and `SwitchRow`.
- `stores/` - rune-based controllers in `*.svelte.ts` files: `theme.svelte.ts` (`themeController`), `reader.svelte.ts` (`readerController`), `llm.svelte.ts` (`llmController`). Each exports a singleton instance; the reader and LLM stores use `if (browser)` guards before touching `localStorage` and other DOM-only APIs.
- `llm/` - OpenAI-compatible client + SSE parser + PDF extraction pipeline. `client.ts` (`listModels`, `chat`, `streamChat`), `sse.ts` (`parseSseChatStream`), `extract.ts` (`extractPdf`, `toMarkdown`), `types.ts` (`LlmError`, `ChatMessage`, `ExtractedPdf`, `PdfSectionNode`, etc.).
- `pdfjs/` - `setup.ts` lazy-loads `pdfjs-dist` and sets `GlobalWorkerOptions.workerSrc` once via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`. `outline.ts` resolves PDF outline destinations into `OutlineNode[]`.
- `assets/` - static assets imported through `$lib` (favicon).

`src/routes/+layout.svelte` is a thin wrapper: imports `layout.css` and the favicon, then renders `children`. There is no reader-specific `+layout.svelte`.

## Theme system

Two independent concepts stored in `localStorage` and applied to `<html>`:

- `data-theme` - one of 22 themes in the `THEMES` array exported from `src/lib/stores/theme.svelte.ts` (catppuccin, cerberus, concord, crimson, fennec, hamlindigo, legacy, mint, **modern**, mona, nosh, nouveau, pine, reign, rocket, rose, sahara, seafoam, terminus, vintage, **vox**, wintry).
- `data-mode` - `light` | `dark`.

`src/app.html` runs an inline `<script>` in `<head>` (before SvelteKit hydrates) to set `data-theme` / `data-mode` from `localStorage`, preventing a flash of unstyled theme. Don't move it.

`themeController` (`$lib/stores/theme.svelte.ts`) is the single source of truth; `theme` and `mode` are `$state`, set via `setTheme` / `setMode`. `<ThemeSelector />` is the only theme menu component and is embedded (not duplicated) wherever a `Menubar.Root` needs it.

## LLM layer

`llmController` (`$lib/stores/llm.svelte.ts`) is the singleton: `baseUrl` (default `http://localhost:1234/v1` - LM Studio style), `apiKey` (optional), `model` (selected), `availableModels` (string list). Persisted to `localStorage` under `llm-settings` as JSON `{ baseUrl, apiKey?, model }`. `verify(baseUrl, apiKey?, signal?)` hits `GET /v1/models`; on success it stores settings, populates `availableModels`, and (if `model` is empty or no longer available) picks the first id. `refresh()` re-runs `verify` with the current settings. `clear()` resets to defaults. Errors throw `LlmError` and **do not** mutate state on failure.

`$lib/llm/client.ts` exposes `listModels`, `chat` (non-streaming), `streamChat` (calls `parseSseChatStream` from `sse.ts`). Trailing slashes on `baseUrl` are normalized; `Authorization: Bearer …` is only added when `apiKey` is set.

`extractPdf(doc)` (in `extract.ts`) builds an `ExtractedPdf = { tree, byPage }`:

1. Tries the PDF outline via `loadOutline`; if non-empty, builds a section tree by walking the outline and resolving each entry's page range (next entry's `startPage - 1`; last entry runs to `numPages`).
2. Falls back to `page.getStructTree()` heading roles (h1-h6 / heading / title) when no outline.
3. Final fallback: a font-size heuristic that finds the body-text size (most common size), picks the 1-4 larger sizes as headings, treats page-1 occurrences of the largest heading size as the document title, then nests flat headings into a tree.
4. `toMarkdown(tree)` emits `#`-prefixed headings with `(pages N-M)` annotations and section body text.

## Reader state

`readerController` (`$lib/stores/reader.svelte.ts`) owns the reader's reactive surface:

- Pane visibility: `showNav`, `showAi` (booleans, default `true`).
- Pane widths: `navPaneWidth`, `aiPaneWidth` (clamped to 240-720, persisted to `localStorage` as `reader-nav-pane-width` / `reader-ai-pane-width`).
- Mobile: `isMobile` is a `$state` mirror of `matchMedia('(max-width: 767px)')`; the controller wires a `change` listener at module load (browser-only).
- Tab: `activeTab: 'thumbs' | 'outline'`.
- Doc: `doc = $state.raw<{ name: string; data: ArrayBuffer } | null>(null)` - `$state.raw` is used so Svelte 5 doesn't proxy the multi-MB buffer. `openPdfFile(file)` reads the file; `openPdfDialog()` programmatically creates and clicks a hidden `<input type="file" accept="application/pdf">`. `clearDoc()` nulls it.
- Viewer ref: `viewerRef = $state.raw<ViewerRef | null>(null)` - `ContentPane` writes the bound `PdfViewer` here in an `$effect` so `scrollToPage` / `fitToWidth` are callable from the controller.
- PDF render: `pdfDocument = $state.raw<PDFDocumentProxy | null>(null)`, `loadError`, `extracted`, `extractionError`. The controller's bottom-of-file `$effect.root` watches `doc`; on change it loads `pdfjs`, copies the buffer (the original is `$state.raw` so the worker can't share it), awaits `getDocument(...).promise`, swaps the previous document's `cleanup()` in to avoid worker/memory leaks, and runs `extractPdf` to populate `extracted` (or `extractionError`).
- Zoom: `zoomScale` (0.25-4.0, stepped in 0.25). `zoomIn` / `zoomOut` quantize; `setZoom` rounds to 2 decimals. Keyboard shortcuts (registered once at module load, browser-only): `Ctrl/Cmd +` / `Ctrl/Cmd -` / `Ctrl/Cmd 0`; `Ctrl/Cmd + wheel` also zooms. Shortcuts are suppressed when the focus target is `INPUT`, `TEXTAREA`, or `[contenteditable]`.

`PdfViewer.svelte` renders one canvas per page plus a stacked `TextLayer` and `AnnotationLayer` (with a custom `LinkService` that delegates internal page jumps to `readerController.scrollToPage`). The render effect cancels in-flight `RenderTask`s, calls `textLayer.cancel()`, clears `textLayer` / `annotationLayer` DOM, and toggles a `cancelled` flag on cleanup so the async page loop can bail out on doc swap.

## UI Components

Prefer existing libraries over hand-rolled implementations:

- **`@skeletonlabs/skeleton-svelte`** - default for styled, theme-aware components (modals, toasts, navigation, app bars, Tabs, Accordion, Combobox, etc.). Honors the active theme automatically.
- **`bits-ui`** - unstyled, accessible primitives (Dialog, Popover, Menubar, Switch, Tooltip, etc.), used directly when Skeleton has no wrapper or full styling control is needed.
- Style with Tailwind utilities + Skeleton design tokens (e.g. `bg-surface-50-950`, `text-surface-950-50`) so theme/mode switching continues to work.

## Testing

All tests live under `tests/`:

- `tests/unit/` - Vitest specs. Two projects in `vite.config.ts`:
  - **client** (`tests/**/*.svelte.{test,spec}.{js,ts}`) - browser-based via `@vitest/browser-playwright` provider (chromium only, headless). Excludes `src/lib/server/**`.
  - **server** (everything else under `tests/unit/`) - node environment. Excludes `*.svelte.{test,spec}` files.
  - Global `expect.requireAssertions: true` - tests must assert; bare no-assertion tests fail.
- `tests/unit/llm/` - server-project specs for the LLM module:
  - `client.spec.ts` covers `listModels`, `chat`, `streamChat`, and `parseSseChatStream` with hand-crafted `Response` / `ReadableStream` mocks and the captured fixtures.
  - `controller.spec.ts` exercises `llmController`; it mutates the exported singleton directly through a `resetController()` helper (sets `baseUrl`, `apiKey`, `model`, `availableModels`, `loadedFromStorage` back to defaults in `beforeEach`).
  - `extract.spec.ts` loads `tests/fixtures/pdf/*.pdf` via `getDocument` from `pdfjs-dist/legacy/build/pdf.mjs` (a node-friendly entry) with `useWorkerFetch: false`, `disableFontFace: true`, `verbosity: 0`, then runs `extractPdf` / `toMarkdown`. Calls `doc.cleanup()` after each case.
- `tests/unit/samples/` - non-app demo code that exists only as test fodder (e.g. `greet.ts` + `Welcome.svelte`); not imported by the app.
- `tests/e2e/` - Playwright `*.e2e.{ts,js}`. Currently only `page.svelte.e2e.ts` (covers `/demo/playwright`).
- `tests/fixtures/`:
  - `llm/` - byte-identical captures of a local OpenAI-compatible server (see `tests/fixtures/llm/README.md`): `models.json` and `chat-stream.sse`. Hard-coded expected values in `client.spec.ts` are derived from these fixtures; refreshing the fixtures requires updating both the fixture and the test in the same commit.
  - `pdf/` - `fake_scientific_paper.pdf` and `fake_scientific_paper_with_outline.pdf`. The outline path of `extractPdf` is only exercised by the latter; the font-size fallback path is only exercised by the former.

Run a single project: `bun run test:unit --project=server` (or `=client`). Run one file: `bun run test:unit -- path/to/file.spec.ts`.

**E2E** (Playwright) matches `**/*.e2e.{ts,js}`. `playwright.config.ts` defines `webServer: { command: 'bun run build && bun run preview', port: 4173 }`, so `bun run test:e2e` builds + serves the app automatically. The reader route is implemented but not yet covered by e2e; the LLM extraction and controller are covered by the server Vitest project.

## Toolchain quirks

- **Svelte 5 runes mode is forced** for all project files via `compilerOptions.runes` in `svelte.config.js`. Don't disable it; legacy syntax won't type-check.
- **pdfjs-dist is dynamically imported** through `loadPdfJs()` in `src/lib/pdfjs/setup.ts`; consumers (`PdfViewer`, `readerController`, `extract.spec.ts`) `await` it before touching the API. The worker URL is set once via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` and uses the `legacy/build/pdf.mjs` entry only in the server-side test.
- `pdfjs-dist@^6.0.227` is pinned as a direct `devDependency` (not just transitive).
- `engine-strict=true` is set in `.npmrc` - engines in `package.json` are enforced.
- `tsconfig.json` uses `rewriteRelativeImportExtensions: true` (TS 5.7+); you can use `.ts` extensions in relative imports.
- `svelte-kit sync` is run by `prepare`, `check`, and `check:watch`; if types look stale, run `bun run check` once.
- `bun run test` deliberately uses `npm run` (not `bun run`) - it chains `npm run test:unit -- --run` then `npm run test:e2e`. Stick to `npm run` for the all-in-one command.
- `plans/` contains design docs (e.g. `plans/reader-page.md`) - check here before designing adjacent features. The plan's `ThemeMenuMenu` / `PaneToggle` component names are stale; the actual files are `ThemeSelector.svelte` and `SidePane.svelte`.
- `opencode.json` is `{ "lsp": true }` - no extra instructions; LSP only.
- `sveltebugs/` and `test-results/` at the repo root are not part of the app (`test-results/` is Playwright output and git-ignored; `sveltebugs/` is local scratch).

## Code Style

- Tabs for indentation (enforced by Prettier)
- Single quotes, **no** trailing commas
- 100 character print width
- Prettier plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`
- Tailwind class sorting via `prettier-plugin-tailwindcss` (stylesheet: `./src/routes/layout.css`)
- ESLint with TypeScript + Svelte; `no-undef` is disabled because `typescript-eslint` handles it
