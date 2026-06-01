# Plan: Initial `/reader` Page

## Goal

Build the initial phase of the `/reader` route:

1. Menubar with **File > Open**, **View** toggles, **Theme** picker, and **Dark Mode** switch.
2. **Navigation Pane** with toggle tab between **Thumbnails** and **Outline**; on desktop sits at the left of the content, on mobile slides in as a top-drawer overlay and is hidden by default.
3. **Content Pane** that renders an opened PDF.
4. **AI Pane** that sits to the right of the content on desktop and below the content on mobile (placeholder for now).
5. Each side pane has an arrow button on its **inner edge** that collapses it to a thin rail (still clickable to re-open).

## Decisions (confirmed)

- PDF rendering: **`pdfjs-dist`** directly (added to `devDependencies` explicitly so it's not just a transitive dep).
- File Open: **local file** via `<input type="file" accept="application/pdf">`. One `openPdfFile(file)` helper on the controller, called from every entry point (menubar, empty state, future drag-and-drop).
- Toggle arrows: **on the inner edge** of each pane.
- Desktop: panes **open by default**; collapse to a ~40px rail when the arrow is clicked.
- Mobile: **nav pane** is a top-drawer overlay (hidden by default; backdrop + click-outside + Esc to close; body scroll lock while open). **AI pane** is a regular stacked row below the content, toggled inline. The two are independent.
- **Theme menu** is reused via a new `<ThemeMenuMenu />` component extracted from `src/lib/components/ThemeMenu.svelte`. `ThemeMenu.svelte` becomes a thin wrapper that renders `<Menubar.Root><ThemeMenuMenu /></Menubar.Root>` for the home page; `ReaderMenubar.svelte` embeds `<ThemeMenuMenu />` inside its own `<Menubar.Root>`.

## Layout

### Mobile (`<md`, < 768px)

```
┌──────────────────────────┐
│ Menubar (File, View, …)  │
├──────────────────────────┤
│      Content Pane        │  ◀── NavigationPane slides in as a top drawer
│                          │      (max ~60% height, backdrop, scroll-locked)
├──────────────────────────┤
│      AI Pane             │  ◀── stacked below, arrow toggles inline
└──────────────────────────┘
```

### Desktop (`>=md`)

```
┌──────────────────────────────────────────┐
│ Menubar                                  │
├──────┬──────────────────────────┬────────┤
│ Nav  │                          │   AI   │
│ Pane │      Content Pane        │  Pane  │
│  ◀   │                          │  ▶     │
└──────┴──────────────────────────┴────────┘
```

When collapsed, each side pane shrinks to a ~40px rail that still shows the arrow.

## File structure

```
src/routes/reader/
  +page.svelte                          ← assembles layout, owns layout classes

src/lib/components/reader/
  ReaderMenubar.svelte                  ← bits-ui Menubar: File, View, ThemeMenuMenu, Dark switch
  NavigationPane.svelte                 ← Skeleton Tabs (Thumbnails | Outline) + drawer wrapper
  ContentPane.svelte                    ← PdfViewer | EmptyState
  PdfViewer.svelte                      ← pdfjs-dist, dynamic-imported, state machine
  AiPane.svelte                         ← placeholder
  PaneToggle.svelte                     ← chevron button, side prop
  EmptyState.svelte                     ← centered card + "Open PDF" button

src/lib/stores/
  reader.svelte.ts                      ← ReaderController (pane state, active tab, doc)

src/lib/components/                     ← refactor (existing file changes)
  ThemeMenu.svelte                      ← now: Menubar.Root wrapper around <ThemeMenuMenu />
  ThemeMenuMenu.svelte                  ← NEW: the inner Menubar.Menu block, embeddable
```

## State (`src/lib/stores/reader.svelte.ts`)

```ts
import { browser } from '$app/environment';

class ReaderController {
	showNav = $state(true);
	showAi = $state(true);
	mobileNavOpen = $state(false);
	activeTab = $state<'thumbs' | 'outline'>('thumbs');
	// raw to avoid Svelte proxying a multi-MB ArrayBuffer
	doc = $state.raw<{ name: string; data: ArrayBuffer } | null>(null);

	toggleNav() {
		this.showNav = !this.showNav;
	}
	toggleAi() {
		this.showAi = !this.showAi;
	}
	openMobileNav() {
		this.mobileNavOpen = true;
	}
	closeMobileNav() {
		this.mobileNavOpen = false;
	}

	async openPdfFile(file: File) {
		const data = await file.arrayBuffer();
		this.doc = { name: file.name, data };
	}
	clearDoc() {
		this.doc = null;
	}
}

export const readerController = new ReaderController();

if (browser) {
	document.documentElement.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') readerController.closeMobileNav();
	});
}
```

Notes:
- `doc` is `$state.raw` so Svelte 5 doesn't proxy a multi-MB buffer; `PdfViewer` re-renders on change via a keyed effect.
- Single `openPdfFile(file)` entry point — used by `ReaderMenubar`'s file input, `EmptyState`'s button, and (future) drag-and-drop / URL loading.
- Esc closes the mobile drawer. No other shortcuts in this phase.

## Component details

### `ThemeMenu.svelte` (refactor) and `ThemeMenuMenu.svelte` (new)

- `ThemeMenuMenu.svelte` exports the inner `Menubar.Menu` block (trigger + portal + content + radio group of all `THEMES`). Standalone-embeddable.
- `ThemeMenu.svelte` becomes: `<Menubar.Root class="…"><ThemeMenuMenu /></Menubar.Root>` plus the existing Dark-mode `Switch` (preserves the home-page appearance).
- `ReaderMenubar.svelte` wraps multiple menus in a single `<Menubar.Root>` and embeds `<ThemeMenuMenu />` inside it.

### `ReaderMenubar.svelte`

- bits-ui `Menubar` primitives (same pattern as `ThemeMenu.svelte`).
- **File** menu → "Open…" item triggers a hidden `<input type="file" accept="application/pdf">`; on change, calls `readerController.openPdfFile(file)` and closes the menu.
- **View** menu → two `Switch`es bound to `showNav` / `showAi`. Disabled on mobile (the nav pane is a drawer there, not show/hide).
- **Theme** menu → embeds `<ThemeMenuMenu />`.
- **Dark mode** `Switch` bound to `themeController.setMode` (lifted from `ThemeMenu.svelte`).

### `NavigationPane.svelte`

- `Skeleton.Tabs` with two `Content` panels: **Thumbnails** and **Outline**.
- **Thumbnails** (`doc === null`): "Open a PDF to see thumbnails". When present: a single `IntersectionObserver` observes all thumbnail wrappers at once, with a small FIFO render queue (e.g. 2 concurrent). Each item is a fixed-size canvas (~120px wide) rendered via `pdfjs.getDocument({ data }).promise` once and reused.
- **Outline** (`doc === null`): "Open a PDF to see its outline". When present: `pdf.getOutline()` → recursive nested list (render 3 levels deep, deeper items get an ellipsis). Clicking a leaf calls `viewer.scrollToPage(n)`. If the outline array is empty, render a small "This PDF has no outline" message **inside** the tab — do NOT auto-switch to Thumbnails.
- Outer flex container handles the desktop rail / mobile drawer. On mobile, the drawer is positioned `absolute inset-x-0 top-0 z-40` with `max-height: 60vh`, a backdrop, focus trap while open, and a body `overflow-hidden` toggle driven by `mobileNavOpen`.

### `ContentPane.svelte`

- Flex column. `doc === null` → `<EmptyState />`. Otherwise → `<PdfViewer {data} bind:this={viewer} />`.
- Hosts the **left-edge** `PaneToggle` for nav: on desktop, `readerController.toggleNav()`; on mobile, `readerController.openMobileNav()`.
- The host is a `relative` flex item so the absolutely-positioned arrow sticks to the inner edge.

### `PdfViewer.svelte`

- All `pdfjs-dist` imports happen inside an `onMount` dynamic `import('pdfjs-dist')` so SSR doesn't ship the bundle.
- Worker: `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` (Vite-friendly; file confirmed present in v6.0.227). Sets `GlobalWorkerOptions.workerSrc` once.
- `status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle')`; render skeleton spinner / error card accordingly.
- `$effect` on `data`: `getDocument({ data }).promise` → store `pdfDocument`. In the cleanup branch, call `await prev.destroy()` before loading the new one (prevents worker/memory leaks on swap). Renders each page to a stacked canvas in a scroll container.
- Exports `scrollToPage(n: number)` as a `<script>`-level function so `bind:this` works.
- SSR returns a `<div>Loading viewer…</div>` placeholder.

### `AiPane.svelte`

- Placeholder card with label "AI Pane" + an icon.
- Hosts the **left-edge** `PaneToggle` for the AI pane (`side="right"` semantically — the arrow's `side` is the pane it belongs to, not which way it points).

### `PaneToggle.svelte`

- Props: `side: 'left' | 'right'`, `collapsed: boolean`, `onclick: () => void`.
- Skeleton `button preset-tonal`, vertical orientation, absolutely positioned to its parent pane's inner edge.
- Chevron icon rotates 180° based on `collapsed` (left-pane arrow points left when expanded → right when collapsed; right-pane arrow is mirrored).

### `EmptyState.svelte`

- Centered card with "Open a PDF to get started" + primary button.
- Button opens a hidden `<input type="file" accept="application/pdf">` local to this component; on change, calls `readerController.openPdfFile(file)`. (Decoupled from `ReaderMenubar`; both call the same `openPdfFile` helper.)
- Secondary hint: "…or use File → Open".

## Routing

- New route `src/routes/reader/+page.svelte`. No reader-specific `+layout.svelte` in this phase — `src/routes/+layout.svelte` already wraps everything and only imports `layout.css` and the favicon, so no changes there.

## Dependencies

- `pdfjs-dist@^6.0.227` added to `devDependencies` in `package.json` (currently only a transitive dep — locks it in).
- All other libs already present: `bits-ui`, `@skeletonlabs/skeleton-svelte`, Tailwind 4.

## Verification

- `bun run check` — typecheck (catches `$state.raw` and effect cleanup types).
- `bun run lint` — Prettier + ESLint.
- `bun run test:unit` — confirms the existing client/server Vitest projects still pass (no new tests in this phase, but the run is cheap insurance).
- Manual smoke: open `/reader` → empty state → open a multi-page PDF → toggle nav (desktop rail collapse) → switch tab → click outline entry → shrink to mobile width → open/close drawer → click backdrop → press Esc.

## Out of scope (explicitly deferred)

- Zoom in/out, page-fit modes, page-number indicator.
- Full-text search, text selection, annotations.
- Drag-and-drop file open, URL-based open, recent files.
- Persisted reader state (last open file, pane positions, tab choice) — `localStorage` later.
- Real AI pane (chat, summarize, ask-document) — placeholder only.
- Unit/E2E tests — manual smoke for this phase; e2e harness comes with the AI pane.

## Notes / assumptions

- The Theme menu is embedded via the extracted `<ThemeMenuMenu />` so the reader is fully themeable without duplicating the radio-group markup.
- The AI Pane is a pure static placeholder — no skeleton/fake chat UI.
- Thumbnails are real pdfjs renders (one canvas per page). Lazy via a single `IntersectionObserver` + render queue.
- The arrow button on mobile opens the Navigation Pane as a top drawer overlaying the content. The AI Pane on mobile is shown stacked below the content and toggled inline.
- Only existing files modified: `package.json` (add `pdfjs-dist`) and `src/lib/components/ThemeMenu.svelte` (split into wrapper + `ThemeMenuMenu.svelte`).
