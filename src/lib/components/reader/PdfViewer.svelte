<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { readerController } from '$lib/stores/reader.svelte';
	import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from 'pdfjs-dist';

	type Props = {
		data: ArrayBuffer;
	};
	export { scrollToPage };

	let { data }: Props = $props();

	type Status = 'idle' | 'loading' | 'ready' | 'error';
	let status = $state<Status>('idle');
	let errorMessage = $state('');
	let pdfDocument = $state<PDFDocumentProxy | null>(null);
	let scrollEl: HTMLDivElement | undefined = $state();
	let pageCount = $state(0);

	let workerSet = false;
	let pdfjsModule: typeof import('pdfjs-dist') | null = null;

	function handleWheel(e: WheelEvent) {
		if (!e.ctrlKey && !e.metaKey) return;
		e.preventDefault();
		if (e.deltaY < 0) {
			readerController.zoomIn();
		} else if (e.deltaY > 0) {
			readerController.zoomOut();
		}
	}

	function scrollToPage(n: number) {
		if (!scrollEl) return;
		const target = scrollEl.querySelector<HTMLElement>(`[data-page-number="${n}"]`);
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	onMount(() => {
		status = 'loading';
	});

	$effect(() => {
		const buffer = data;
		if (!browser) return;

		let cancelled = false;
		let prev: PDFDocumentProxy | null = null;

		(async () => {
			try {
				const pdfjs = await import('pdfjs-dist');
				pdfjsModule = pdfjs;
				if (!workerSet) {
					pdfjs.GlobalWorkerOptions.workerSrc = new URL(
						'pdfjs-dist/build/pdf.worker.min.mjs',
						import.meta.url
					).href;
					workerSet = true;
				}

				const copy = buffer.slice(0);
				const pdf = await pdfjs.getDocument({ data: copy }).promise;
				if (cancelled) {
					await pdf.cleanup();
					return;
				}

				prev = pdfDocument;
				pdfDocument = pdf;
				pageCount = pdf.numPages;
				status = 'ready';

				if (prev) {
					await prev.cleanup();
				}
			} catch (err) {
				if (cancelled) return;
				console.error('PdfViewer failed to load document:', err);
				errorMessage = err instanceof Error ? err.message : String(err);
				status = 'error';
				if (prev) {
					await prev.cleanup();
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	function renderPage(
		page: PDFPageProxy,
		canvas: HTMLCanvasElement,
		scale: number
	): RenderTask | null {
		if (!browser) return null;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		const dpr = window.devicePixelRatio || 1;
		const viewport = page.getViewport({ scale });

		canvas.style.width = `${viewport.width}px`;
		canvas.style.height = `${viewport.height}px`;
		canvas.width = Math.floor(viewport.width * dpr);
		canvas.height = Math.floor(viewport.height * dpr);

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
		return page.render({ canvas, canvasContext: ctx, viewport, transform });
	}

	$effect(() => {
		if (status !== 'ready' || !pdfDocument || !pdfjsModule) return;
		const doc = pdfDocument;
		const pdfjs = pdfjsModule;
		const root = scrollEl;
		if (!root) return;

		const scale = readerController.zoomScale;

		const activeTasks = new SvelteSet<RenderTask>();
		const activeTextLayers: Array<{ textLayer: TextLayer | null; cancelled: boolean }> = [];
		let cancelled = false;

		for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
			const canvas = root.querySelector<HTMLCanvasElement>(`canvas[data-page-canvas="${pageNum}"]`);
			const textContainer = root.querySelector<HTMLDivElement>(`div[data-page-text="${pageNum}"]`);
			if (!canvas || !textContainer) continue;

			void doc.getPage(pageNum).then(async (page) => {
				if (cancelled) return;

				const viewport = page.getViewport({ scale });

				// Render canvas
				const task = renderPage(page, canvas, scale);
				if (task) {
					activeTasks.add(task);
					task.promise.then(() => activeTasks.delete(task)).catch(() => activeTasks.delete(task));
				}

				// Render text layer
				const textLayerEntry = { textLayer: null as TextLayer | null, cancelled: false };
				activeTextLayers.push(textLayerEntry);

				try {
					const textContent = await page.getTextContent();
					if (cancelled || textLayerEntry.cancelled) return;

					// Set CSS scale variables for text layer font sizing
					textContainer.style.setProperty('--scale-factor', String(viewport.scale));
					textContainer.style.setProperty('--user-unit', '1');
					textContainer.style.setProperty(
						'--total-scale-factor',
						'calc(var(--scale-factor) * var(--user-unit))'
					);

					const textLayer = new pdfjs.TextLayer({
						textContentSource: textContent,
						container: textContainer,
						viewport
					});

					textLayerEntry.textLayer = textLayer;
					await textLayer.render();
				} catch (err) {
					if (cancelled || textLayerEntry.cancelled) return;
					console.error(`Text layer render failed for page ${pageNum}:`, err);
				}
			});
		}

		return () => {
			cancelled = true;
			activeTasks.forEach((task) => {
				try {
					task.cancel();
				} catch {
					/* ignore */
				}
			});
			activeTasks.clear();

			activeTextLayers.forEach((entry) => {
				entry.cancelled = true;
				if (entry.textLayer) {
					try {
						entry.textLayer.cancel();
					} catch {
						/* ignore */
					}
				}
			});

			if (root) {
				const textContainers = root.querySelectorAll<HTMLDivElement>('div[data-page-text]');
				textContainers.forEach((tc) => {
					tc.innerHTML = '';
					tc.style.cssText = '';
				});
			}
		};
	});
</script>

{#if status === 'loading' || status === 'idle'}
	<div class="flex h-full w-full items-center justify-center">
		<div class="flex flex-col items-center gap-3 text-surface-950-50">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-surface-300-700 border-t-primary-500"
				aria-hidden="true"
			></div>
			<p class="text-sm opacity-70">Loading PDF…</p>
		</div>
	</div>
{:else if status === 'error'}
	<div class="flex h-full w-full items-center justify-center p-6">
		<div
			class="flex max-w-md flex-col gap-2 card border border-error-500 preset-tonal-surface p-6 text-center"
		>
			<h3 class="text-base font-semibold text-error-500">Failed to render PDF</h3>
			<p class="text-sm opacity-80">{errorMessage}</p>
		</div>
	</div>
{:else}
	<div
		bind:this={scrollEl}
		class="h-full w-full overflow-auto bg-surface-100-900 p-4"
		onwheel={handleWheel}
	>
		<div class="mx-auto flex flex-col items-center gap-4">
			{#each Array.from({ length: pageCount }, (_, i) => i + 1) as pageNum (pageNum)}
				<div data-page-number={pageNum} class="flex w-full flex-col items-center gap-1">
					<div class="relative">
						<canvas data-page-canvas={pageNum} class="rounded-sm bg-white shadow-sm"></canvas>
						<div data-page-text={pageNum} class="textLayer absolute inset-0 overflow-clip"></div>
					</div>
					<span class="text-xs opacity-60">Page {pageNum}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.textLayer {
		position: absolute;
		text-align: initial;
		inset: 0;
		overflow: clip;
		opacity: 1;
		line-height: 1;
		letter-spacing: normal;
		word-spacing: normal;
		text-size-adjust: none;
		forced-color-adjust: none;
		transform-origin: 0 0;
		caret-color: CanvasText;
		z-index: 0;
		--scale-factor: 1;
		--user-unit: 1;
		--total-scale-factor: calc(var(--scale-factor) * var(--user-unit));
		--min-font-size: 1;
		--text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
		--min-font-size-inv: calc(1 / var(--min-font-size));
	}

	.textLayer :global(span),
	.textLayer :global(br) {
		color: transparent;
		position: absolute;
		white-space: pre;
		cursor: text;
		transform-origin: 0% 0%;
		user-select: text;
		-webkit-user-select: text;
	}

	.textLayer :global(> :not(.markedContent)),
	.textLayer :global(.markedContent span:not(.markedContent)) {
		z-index: 1;
		--font-height: 0;
		font-size: calc(var(--text-scale-factor) * var(--font-height));
		--scale-x: 1;
		--rotate: 0deg;
		transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
	}

	.textLayer :global(.markedContent) {
		display: contents;
	}

	.textLayer :global(span[role='img']) {
		user-select: none;
		cursor: default;
	}

	.textLayer :global(::selection) {
		background: color-mix(in srgb, AccentColor, transparent 50%);
		color: transparent;
	}
</style>
