<script lang="ts">
	import { browser } from '$app/environment';
	import { SvelteSet } from 'svelte/reactivity';
	import { readerController } from '$lib/stores/reader.svelte';
	import type { PDFDocumentProxy } from 'pdfjs-dist';

	type Props = {
		pdfDoc: PDFDocumentProxy | null;
		pageCount: number;
		hasDoc: boolean;
	};

	let { pdfDoc, pageCount, hasDoc }: Props = $props();

	let thumbContainer: HTMLDivElement | undefined = $state();
	let workerSet = false;

	const renderedPages = new SvelteSet<number>();
	let renderQueue: number[] = [];
	let activeRenders = 0;
	const MAX_CONCURRENT = 2;

	const renderContents = $derived(readerController.showNav);

	$effect(() => {
		if (!renderContents || !pdfDoc) return;
		const root = thumbContainer;
		if (!root) return;
		if (readerController.activeTab !== 'thumbs') return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const target = entry.target as HTMLElement;
					const pageNum = Number(target.dataset.pageNumber);
					if (!pageNum || renderedPages.has(pageNum)) continue;
					if (!renderQueue.includes(pageNum)) {
						renderQueue.push(pageNum);
					}
					void drainQueue();
				}
			},
			{ root, rootMargin: '128px 0px', threshold: 0.01 }
		);

		const items = root.querySelectorAll<HTMLElement>('[data-thumb-item]');
		items.forEach((item) => observer.observe(item));

		return () => {
			observer.disconnect();
		};
	});

	async function drainQueue() {
		if (!pdfDoc) return;
		while (activeRenders < MAX_CONCURRENT && renderQueue.length > 0) {
			const pageNum = renderQueue.shift();
			if (pageNum === undefined) break;
			if (renderedPages.has(pageNum)) continue;
			activeRenders += 1;
			void renderThumbnail(pageNum).finally(() => {
				activeRenders -= 1;
				if (renderQueue.length > 0) {
					void drainQueue();
				}
			});
		}
	}

	async function renderThumbnail(pageNum: number) {
		const doc = pdfDoc;
		const root = thumbContainer;
		if (!doc || !root) return;
		const wrapper = root.querySelector<HTMLElement>(
			`[data-thumb-item][data-page-number="${pageNum}"]`
		);
		const canvas = wrapper?.querySelector<HTMLCanvasElement>('canvas');
		if (!wrapper || !canvas) return;

		try {
			const pdfjs = await import('pdfjs-dist');
			if (!workerSet) {
				pdfjs.GlobalWorkerOptions.workerSrc = new URL(
					'pdfjs-dist/build/pdf.worker.min.mjs',
					import.meta.url
				).href;
				workerSet = true;
			}
			const page = await doc.getPage(pageNum);
			const viewport = page.getViewport({ scale: 1 });
			const targetWidth = 120;
			const scale = targetWidth / viewport.width;
			const scaled = page.getViewport({ scale });
			const dpr = browser ? window.devicePixelRatio || 1 : 1;

			canvas.width = Math.floor(scaled.width * dpr);
			canvas.height = Math.floor(scaled.height * dpr);
			canvas.style.width = `${scaled.width}px`;
			canvas.style.height = `${scaled.height}px`;

			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.scale(dpr, dpr);
			await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
			renderedPages.add(pageNum);
		} catch (err) {
			console.error(`ThumbnailsPanel: failed to render thumbnail ${pageNum}:`, err);
		}
	}
</script>

{#if !hasDoc}
	<div class="flex h-full items-center justify-center p-4 text-center text-sm opacity-70">
		Open a PDF to see thumbnails
	</div>
{:else}
	<div bind:this={thumbContainer} class="flex h-full flex-col gap-3 overflow-y-auto p-3">
		{#each Array.from({ length: pageCount }, (_, i) => i + 1) as pageNum (pageNum)}
			<button
				type="button"
				data-thumb-item
				data-page-number={pageNum}
				onclick={() => readerController.scrollToPage(pageNum)}
				class="flex flex-col items-center gap-1 self-center rounded-sm border border-surface-200-800 bg-white p-1 shadow-sm transition-colors hover:border-primary-500"
			>
				<canvas class="block bg-white" style="width: 120px;" aria-label={`Page ${pageNum}`}
				></canvas>
				<span class="rounded-sm bg-surface-100-900 px-1.5 text-xs opacity-70">Page {pageNum}</span>
			</button>
		{/each}
	</div>
{/if}
