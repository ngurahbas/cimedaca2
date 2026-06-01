# Plan: Initial `/reader` Page

## Goal

Build the initial phase of the `/reader` route:

1. Menubar with **File > Open** and **Dark Mode** switch.
2. **Navigation Pane** with toggle tab between **Thumbnails** and **Outline**; on desktop sits at the left of the content, on mobile sits above the content and is hidden by default.
3. **Content Pane** that renders an opened PDF.
4. **AI Pane** that sits to the right of the content on desktop and below the content on mobile (placeholder for now).
5. Each side pane has an arrow button on its **inner edge** that collapses it to a thin rail (still clickable to re-open).

## Decisions (confirmed)

- PDF rendering: **`pdfjs-dist`** directly (already in `node_modules`).
- File Open: **local file** via `<input type="file" accept="application/pdf">`.
- Toggle arrows: **on the inner edge** of each pane.
- Default state: **panes open by default** on desktop, collapsing to a thin rail (~40px) when the arrow is clicked. On mobile, panes are **hidden by default** and toggled via the same arrow.

## Layout

### Mobile (`<md`, < 768px)

```
┌──────────────────────────┐
│ Menubar (File, Dark mode)│
├──────────────────────────┤
│ Navigation Pane (hidden  │  ← arrow toggles
│ by default, slides in)   │
├──────────────────────────┤
│      Content Pane        │
├──────────────────────────┤
│      AI Pane             │  ← arrow toggles (placeholder)
└──────────────────────────┘
```

### Desktop (`>=md`)

```
┌──────────────────────────────────────────┐
│ Menubar                                  │
├──────┬──────────────────────────┬────────┤
│ Nav  │                          │   AI   │
│ Pane │      Content Pane        │  Pane  │
│  ▶   │                          │  ◀     │
└──────┴──────────────────────────┴────────┘
```

When collapsed, each side pane shrinks to a ~40px rail that still shows the arrow.

## File structure (all new files)

```
src/routes/reader/
  +page.svelte                          ← assembles layout, owns pane state via store

src/lib/components/reader/
  ReaderMenubar.svelte                  ← File > Open, View > toggles, Dark mode switch
  NavigationPane.svelte                 ← Skeleton Tabs: Thumbnails | Outline
  ContentPane.svelte                    ← hosts PdfViewer or EmptyState
  PdfViewer.svelte                      ← pdfjs-dist canvas renderer
  AiPane.svelte                         ← placeholder ("AI Pane")
  PaneToggle.svelte                     ← arrow button reused on both edges
  EmptyState.svelte                     ← shown in ContentPane before a PDF is opened

src/lib/stores/
  reader.svelte.ts                      ← pane visibility, active nav tab, loaded doc
```

No existing files are modified. `Menubar.svelte` and the theme store are reused as-is for patterns/components, but the reader uses its own menubar so it can include the File menu.

## State (`src/lib/stores/reader.svelte.ts`)

```ts
class ReaderController {
  showNav = $state(true)
  showAi = $state(true)
  activeTab = $state<'thumbs' | 'outline'>('thumbs')
  doc = $state<{ name: string; data: ArrayBuffer } | null>(null)

  toggleNav() { this.showNav = !this.showNav }
  toggleAi() { this.showAi = !this.showAi }
  setDoc(name: string, data: ArrayBuffer) { this.doc = { name, data } }
  clearDoc() { this.doc = null }
}
export const readerController = new ReaderController()
```

## Component details

### `ReaderMenubar.svelte`

- Built with bits-ui `Menubar` (same pattern as the existing `Menubar.svelte`).
- **File** menu: "Open…" item triggers a hidden `<input type="file" accept="application/pdf">`. On change, reads via `FileReader.readAsArrayBuffer`, calls `readerController.setDoc(name, data)`, closes the menu.
- **View** menu: two Switches — "Show Navigation" bound to `readerController.showNav`, "Show AI Pane" bound to `readerController.showAi`.
- **Theme** menu: kept (matches existing Menubar) — radio list of all `THEMES`.
- **Appearance** menu: "Dark mode" Switch bound to `themeController.setMode` (lifted from existing Menubar).

### `NavigationPane.svelte`

- Skeleton `Tabs` with two panels: **Thumbnails** and **Outline**.
- *Thumbnails*: when `doc` is `null` → "Open a PDF to see thumbnails". When present, uses `pdfjs.getDocument({ data }).promise` and renders one small canvas per page in a scrollable list. Lazy-render via `IntersectionObserver` for performance.
- *Outline*: uses `pdf.getOutline()` to render a nested list of headings. Clicking a heading scrolls the ContentPane to that page (via a method on `PdfViewer`). Falls back to a friendly empty state if the PDF has no outline.
- The component is wrapped by a flex container that handles the desktop left-rail / mobile drawer logic (driven by `readerController.showNav`).

### `ContentPane.svelte`

- Flex column. When `doc` is `null` → renders `<EmptyState />`. When present → renders `<PdfViewer data={doc.data} bind:this={viewer} />`.
- Hosts the right-edge arrow button → `readerController.toggleNav()`. On mobile, the same arrow opens the Navigation Pane as a drawer that overlays the content.

### `PdfViewer.svelte`

- Uses `pdfjs-dist` directly.
- Worker setup: `GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` (Vite-friendly).
- On mount / data change: `getDocument({ data }).promise`, then renders each page to a `<canvas>` stacked vertically inside a scroll container.
- Exposes `scrollToPage(n: number)` via a bound method so the Outline can navigate.
- All `pdfjs` calls are guarded with `browser` from `$app/environment`; SSR returns a placeholder.

### `AiPane.svelte`

- Placeholder card with a label "AI Pane" and an icon.
- Hosts the left-edge arrow button → `readerController.toggleAi()`.

### `PaneToggle.svelte`

- Props: `side: 'left' | 'right'`, `collapsed: boolean`, `onclick: () => void`.
- Renders a vertical Skeleton `button preset-tonal` with a chevron icon that rotates based on `collapsed`.
- Absolutely positioned against the parent pane so it stays on the inner edge.

### `EmptyState.svelte`

- Friendly centered card with text "Open a PDF to get started" and a button that opens the file picker (re-uses the hidden input from `ReaderMenubar`, or shows a hint to use File > Open).

## Routing

No changes. `/reader` is reached by navigating to `/reader`; the existing `+layout.svelte` continues to wrap it.

## Dependencies

- `pdfjs-dist` is already in `node_modules` (confirmed). No `package.json` change.

## Verification

- `bun run check` — typecheck
- `bun run lint` — Prettier + ESLint
- (Optional, not in this phase) `tests/e2e/reader.e2e.ts` — Playwright test for the three panes + menubar.

## Notes / assumptions

- The `Theme` menu is kept in `ReaderMenubar` so the reader is fully themeable.
- The AI Pane is a pure static placeholder — no skeleton/fake chat UI.
- Thumbnails are real pdfjs renders (one canvas per page). Lazy via `IntersectionObserver`.
- The arrow button on mobile opens the Navigation Pane as a top drawer overlaying the content. The AI Pane on mobile is shown stacked below the content and toggled via the same arrow pattern.
