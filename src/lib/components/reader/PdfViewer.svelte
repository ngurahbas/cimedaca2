<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

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

	async function renderPage(page: PDFPageProxy, canvas: HTMLCanvasElement) {
		if (!browser) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const viewport = page.getViewport({ scale: 1 });

		canvas.style.width = `${viewport.width}px`;
		canvas.style.height = `${viewport.height}px`;
		canvas.width = Math.floor(viewport.width * dpr);
		canvas.height = Math.floor(viewport.height * dpr);

		await page.render({ canvas, canvasContext: ctx, viewport }).promise;
		const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
		await page.render({ canvas, canvasContext: ctx, viewport, transform }).promise;
	}

	$effect(() => {
		if (status !== 'ready' || !pdfDocument) return;
		const doc = pdfDocument;
		const root = scrollEl;
		if (!root) return;

		const canvases = root.querySelectorAll<HTMLCanvasElement>('canvas[data-page-canvas]');
		const pagePromises: Promise<void>[] = [];
		canvases.forEach((canvas) => {
			const pageNum = Number(canvas.dataset.pageCanvas);
			if (!pageNum) return;
			const pagePromise = doc.getPage(pageNum).then((page) => renderPage(page, canvas));
			pagePromises.push(pagePromise);
		});

		return () => {
			pagePromises.forEach(() => {});
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
	<div bind:this={scrollEl} class="h-full w-full overflow-auto bg-surface-100-900 p-4">
		<div class="mx-auto flex flex-col items-center gap-4">
			{#each Array.from({ length: pageCount }, (_, i) => i + 1) as pageNum (pageNum)}
				<div data-page-number={pageNum} class="flex w-full flex-col items-center gap-1">
					<canvas data-page-canvas={pageNum} class="rounded-sm bg-white shadow-sm"></canvas>
					<span class="text-xs opacity-60">Page {pageNum}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
