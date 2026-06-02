<script lang="ts">
	import { browser } from '$app/environment';
	import { Tabs } from '@skeletonlabs/skeleton-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { readerController, type ReaderTab } from '$lib/stores/reader.svelte';
	import type { PDFDocumentProxy } from 'pdfjs-dist';

	type RefProxy = { num: number; gen: number };

	type OutlineNode = {
		title: string;
		pageNumber: number | null;
		items: OutlineNode[];
	};

	let pdfDoc = $state<PDFDocumentProxy | null>(null);
	let pageCount = $state(0);
	let outline = $state<OutlineNode[] | null>(null);
	let outlineLoading = $state(false);
	let thumbContainer: HTMLDivElement | undefined = $state();
	let drawerEl: HTMLDivElement | undefined = $state();
	let workerSet = false;

	const renderedPages = new SvelteSet<number>();
	let renderQueue: number[] = [];
	let activeRenders = 0;
	const MAX_CONCURRENT = 2;

	const showDesktop = $derived(!readerController.isMobile && readerController.showNav);
	const showMobileDrawer = $derived(readerController.isMobile && readerController.mobileNavOpen);
	const renderContents = $derived(showDesktop || showMobileDrawer);
	const hasDoc = $derived(readerController.doc !== null);

	$effect(() => {
		const docState = readerController.doc;
		if (!browser) return;

		if (!docState) {
			const previous = pdfDoc;
			pdfDoc = null;
			pageCount = 0;
			outline = null;
			outlineLoading = false;
			renderedPages.clear();
			renderQueue = [];
			activeRenders = 0;
			void previous?.cleanup();
			return;
		}

		let cancelled = false;
		outline = null;
		outlineLoading = true;

		(async () => {
			let prev: PDFDocumentProxy | null = null;
			try {
				const pdfjs = await import('pdfjs-dist');
				if (!workerSet) {
					pdfjs.GlobalWorkerOptions.workerSrc = new URL(
						'pdfjs-dist/build/pdf.worker.min.mjs',
						import.meta.url
					).href;
					workerSet = true;
				}
				const copy = docState.data.slice(0);
				const pdf = await pdfjs.getDocument({ data: copy }).promise;
				if (cancelled) {
					await pdf.cleanup();
					return;
				}

				prev = pdfDoc;
				pdfDoc = pdf;
				pageCount = pdf.numPages;
				renderedPages.clear();
				renderQueue = [];
				activeRenders = 0;

				try {
					const rawOutline = await pdf.getOutline();
					if (cancelled) return;
					outline = rawOutline ? await transformOutline(pdf, rawOutline) : [];
				} catch (err) {
					console.error('NavigationPane: failed to read outline:', err);
					outline = [];
				} finally {
					outlineLoading = false;
				}

				if (prev) {
					await prev.cleanup();
				}
			} catch (err) {
				if (cancelled) return;
				console.error('NavigationPane: failed to load PDF:', err);
				outline = [];
				outlineLoading = false;
				if (prev) {
					await prev.cleanup();
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!browser) return;
		if (readerController.isMobile && readerController.mobileNavOpen) {
			const prev = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prev;
			};
		}
	});

	$effect(() => {
		if (!showMobileDrawer) return;
		const el = drawerEl;
		if (!el) return;
		const focusable = el.querySelector<HTMLElement>(
			'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
		);
		focusable?.focus();
	});

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
			console.error(`NavigationPane: failed to render thumbnail ${pageNum}:`, err);
		}
	}

	async function transformOutline(
		doc: PDFDocumentProxy,
		items: Array<{
			title: string;
			dest: string | Array<unknown> | null;
			items: Array<unknown>;
		}>
	): Promise<OutlineNode[]> {
		const result: OutlineNode[] = [];
		for (const item of items) {
			const pageNumber = await resolveOutlineDest(doc, item.dest);
			const children =
				Array.isArray(item.items) && item.items.length > 0
					? await transformOutline(
							doc,
							item.items as Array<{
								title: string;
								dest: string | Array<unknown> | null;
								items: Array<unknown>;
							}>
						)
					: [];
			result.push({
				title: item.title,
				pageNumber,
				items: children
			});
		}
		return result;
	}

	async function resolveOutlineDest(
		doc: PDFDocumentProxy,
		dest: string | Array<unknown> | null
	): Promise<number | null> {
		try {
			let explicit: Array<unknown> | null = null;
			if (typeof dest === 'string') {
				explicit = await doc.getDestination(dest);
			} else if (Array.isArray(dest)) {
				explicit = dest;
			}
			if (!explicit || explicit.length === 0) return null;
			const ref = explicit[0] as RefProxy;
			if (!ref || typeof ref !== 'object') return null;
			const pageIndex = await doc.getPageIndex(ref);
			return pageIndex + 1;
		} catch (err) {
			console.error('NavigationPane: failed to resolve outline destination:', err);
			return null;
		}
	}

	function handleTabChange(value: string) {
		if (value === 'thumbs' || value === 'outline') {
			readerController.activeTab = value satisfies ReaderTab;
		}
	}

	function handleOutlineClick(pageNumber: number | null) {
		if (pageNumber === null) return;
		readerController.scrollToPage(pageNumber);
		if (readerController.isMobile) {
			readerController.closeMobileNav();
		}
	}

	function closeDrawer() {
		readerController.closeMobileNav();
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
			closeDrawer();
		}
	}
</script>

{#snippet emptyMessage(text: string)}
	<div class="flex h-full items-center justify-center p-4 text-center text-sm opacity-70">
		{text}
	</div>
{/snippet}

{#snippet thumbnailsContent()}
	{#if !hasDoc}
		{@render emptyMessage('Open a PDF to see thumbnails')}
	{:else}
		<div bind:this={thumbContainer} class="flex h-full flex-col gap-3 overflow-y-auto p-3">
			{#each Array.from({ length: pageCount }, (_, i) => i + 1) as pageNum (pageNum)}
				<button
					type="button"
					data-thumb-item
					data-page-number={pageNum}
					onclick={() => handleOutlineClick(pageNum)}
					class="flex flex-col items-center gap-1 rounded border border-surface-200-800 bg-white p-1 shadow-sm transition-colors hover:border-primary-500"
				>
					<canvas class="block bg-white" style="width: 120px;" aria-label={`Page ${pageNum}`}
					></canvas>
					<span class="text-xs opacity-70">Page {pageNum}</span>
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet outlineNode(node: OutlineNode, depth: number)}
	{@const indent = depth * 8}
	<li>
		<button
			type="button"
			disabled={node.pageNumber === null}
			onclick={() => handleOutlineClick(node.pageNumber)}
			class="flex w-full items-start gap-1 rounded px-2 py-1 text-left text-sm hover:bg-surface-100-900 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
			style="padding-left: {indent + 8}px;"
		>
			<span class="truncate" title={node.title}>
				{depth >= 3 ? '…' : ''}{node.title}
			</span>
		</button>
		{#if node.items.length > 0 && depth < 3}
			<ul>
				{#each node.items as child, idx (idx)}
					{@render outlineNode(child, depth + 1)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}

{#snippet outlineContent()}
	{#if !hasDoc}
		{@render emptyMessage('Open a PDF to see its outline')}
	{:else if outline === null || outlineLoading}
		{@render emptyMessage('Loading outline…')}
	{:else if outline.length === 0}
		{@render emptyMessage('This PDF has no outline')}
	{:else}
		<ul class="flex flex-col gap-0.5 overflow-y-auto p-2">
			{#each outline as node, idx (idx)}
				{@render outlineNode(node, 0)}
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet paneContents()}
	<Tabs
		value={readerController.activeTab}
		onValueChange={(d) => handleTabChange(d.value)}
		class="flex h-full min-h-0 w-full flex-col"
	>
		<Tabs.List class="flex shrink-0 items-center gap-1 border-b border-surface-200-800 p-1">
			<Tabs.Trigger
				value="thumbs"
				class="flex-1 rounded px-2 py-1.5 text-sm font-medium text-surface-950-50 outline-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[selected]:bg-primary-500/15 data-[selected]:text-primary-500"
			>
				Thumbnails
			</Tabs.Trigger>
			<Tabs.Trigger
				value="outline"
				class="flex-1 rounded px-2 py-1.5 text-sm font-medium text-surface-950-50 outline-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[selected]:bg-primary-500/15 data-[selected]:text-primary-500"
			>
				Outline
			</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="thumbs" class="min-h-0 flex-1 overflow-hidden">
			{@render thumbnailsContent()}
		</Tabs.Content>
		<Tabs.Content value="outline" class="min-h-0 flex-1 overflow-hidden">
			{@render outlineContent()}
		</Tabs.Content>
	</Tabs>
{/snippet}

{#if readerController.isMobile}
	{#if showMobileDrawer}
		<div
			role="button"
			tabindex="0"
			aria-label="Close navigation"
			class="fixed inset-0 z-30 bg-surface-950/40"
			onclick={closeDrawer}
			onkeydown={handleBackdropKeydown}
		></div>
		<div
			bind:this={drawerEl}
			role="dialog"
			aria-modal="true"
			aria-label="Navigation"
			class="fixed inset-x-0 top-0 z-40 max-h-[60vh] overflow-hidden rounded-b-md border-b border-surface-200-800 bg-surface-50-950 shadow-lg"
		>
			<div class="flex h-full min-h-0 flex-col">
				<div class="flex items-center justify-between border-b border-surface-200-800 px-3 py-2">
					<span class="text-sm font-semibold text-surface-950-50">Navigation</span>
					<button
						type="button"
						onclick={closeDrawer}
						class="rounded p-1 text-surface-950-50 hover:bg-surface-100-900"
						aria-label="Close navigation"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-4 w-4"
							aria-hidden="true"
						>
							<path d="M18 6L6 18" />
							<path d="M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="min-h-0 flex-1">
					{@render paneContents()}
				</div>
			</div>
		</div>
	{/if}
{:else}
	<aside
		class="flex shrink-0 flex-col overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950 transition-[width] duration-200 {readerController.showNav
			? 'w-64'
			: 'w-10'}"
		aria-label="Navigation"
	>
		{#if readerController.showNav}
			{@render paneContents()}
		{/if}
	</aside>
{/if}
