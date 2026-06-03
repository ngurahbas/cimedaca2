# Inspector overlay shows line/column off by +1

**Package:** `@sveltejs/vite-plugin-svelte` (inspector runtime)
**Svelte version:** 5 (runes mode)
**Regression from:** Svelte 4

## Description

The Svelte inspector overlay (toggleable via configurable key combo, default `Alt+X`) displays and reports line/column numbers that are 1 greater than the actual source location. Clicking a component in inspect mode sends an incorrect `file:line:col` to the Vite `/__open-in-editor` endpoint, and the hover tooltip also shows the wrong line.

## Root cause

The inspector overlay at `Inspector.svelte:120` constructs the file location string as:

```js
file_loc = `${file}:${line + 1}:${column + 1}`;
```

This `+1` was correct for **Svelte 4**, where `__svelte_meta.loc.line` was 0-indexed. However, **Svelte 5** changed the compiler to use 1-indexed lines via `getLocator(source, { offsetLine: 1 })` (see `state.js:57`), but the inspector overlay was never updated to match — it still unconditionally adds 1, making the displayed value 2-indexed.

## Evidence

1. **`node_modules/svelte/src/compiler/state.js:57`** — locator configured with `offsetLine: 1`:
   ```js
   const l = getLocator(source, { offsetLine: 1 });
   ```

2. **`node_modules/svelte/src/internal/client/dev/elements.js:33`** — `__svelte_meta.loc` stores the locator output directly:
   ```js
   loc: { file: filename, line: location[0], column: location[1] }
   ```
   Since `location[0]` comes from the locator (which returns 1-indexed lines), `__svelte_meta.loc.line` is 1-indexed.

3. **`node_modules/@sveltejs/vite-plugin-svelte/src/plugins/inspector/runtime/Inspector.svelte:120`** — double-adds 1:
   ```js
   file_loc = `${file}:${line + 1}:${column + 1}`;
   ```

## Impact

- Hover tooltip shows wrong line (e.g. shows line 11 when the real location is line 10)
- Click/Enter sends wrong file locator to the editor endpoint, opening the wrong line if an editor is configured
- Any tooling consuming the inspector's URL query parameter receives inflated coordinates

## Expected behavior

With Svelte 5's 1-indexed line convention, the `+1` should be removed:

```diff
- file_loc = `${file}:${line + 1}:${column + 1}`;
+ file_loc = `${file}:${line}:${column}`;
```
