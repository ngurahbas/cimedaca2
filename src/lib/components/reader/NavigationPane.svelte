<script lang="ts">
	import { browser } from '$app/environment';
	import { Tabs } from '@skeletonlabs/skeleton-svelte';
	import { Collapsible } from 'bits-ui';
	import { readerController, type ReaderTab } from '$lib/stores/reader.svelte';
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import ThumbnailsPanel from './ThumbnailsPanel.svelte';
	import OutlinePanel from './OutlinePanel.svelte';

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
	let workerSet = false;
	let navResizing = $state(false);

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

	// Mobile drawer: close on Escape
	$effect(() => {
		if (!readerController.isMobile) return;
		if (!readerController.showNav) return;

		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				readerController.showNav = false;
			}
		}
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});

	// Mobile drawer: lock body scroll
	$effect(() => {
		if (!readerController.isMobile) return;
		if (readerController.showNav) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});

	const desktopChevronRotation = $derived(readerController.showNav ? -90 : 90);

	function startNavResize(e: MouseEvent) {
		e.preventDefault();
		navResizing = true;
		const startX = e.clientX;
		const startWidth = readerController.navPaneWidth;

		function onMove(ev: MouseEvent) {
			const delta = ev.clientX - startX;
			readerController.navPaneWidth = readerController.clampWidth(startWidth + delta);
		}

		function onUp() {
			navResizing = false;
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			readerController.setNavPaneWidth(readerController.navPaneWidth);
		}

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	}
</script>

{#if readerController.isMobile}
	{#if readerController.showNav}
		<!-- Backdrop -->
		<button
			class="absolute inset-0 z-30 cursor-default bg-black/30"
			onclick={() => (readerController.showNav = false)}
			aria-label="Close navigation"
		></button>

		<!-- Drawer -->
		<div
			class="absolute inset-x-0 top-0 z-40 flex max-h-[60vh] flex-col overflow-hidden rounded-b-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
		>
			<div
				class="flex shrink-0 items-center justify-between border-b border-surface-200-800 px-3 py-2"
			>
				<span class="text-sm font-semibold text-surface-950-50">Navigation</span>
				<button
					onclick={() => (readerController.showNav = false)}
					class="flex h-7 w-7 items-center justify-center rounded-full text-surface-950-50 hover:bg-surface-100-900"
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
			<div class="min-h-0 flex-1 overflow-y-auto">
				{@render paneContent()}
			</div>
		</div>
	{/if}
{:else}
	<!-- Desktop: collapsible panel with floating edge pill -->
	<Collapsible.Root
		bind:open={readerController.showNav}
		aria-label="Navigation"
		class="relative shrink-0 md:flex md:h-full md:flex-row"
	>
		<Collapsible.Content
			forceMount
			class="flex min-h-0 flex-col overflow-hidden md:w-0 md:rounded-md md:border md:border-surface-200-800 md:bg-surface-50-950 md:transition-[width] md:duration-200 md:ease-in-out"
			style="width: {readerController.showNav
				? readerController.navPaneWidth + 'px'
				: undefined};{navResizing ? 'transition: none !important;' : ''}"
		>
			{@render paneContent()}
		</Collapsible.Content>

		{#if readerController.showNav}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize navigation pane"
				tabindex="-1"
				class="absolute top-0 right-0 z-20 h-full w-1 cursor-col-resize bg-surface-200-800/30 hover:bg-primary-500/50"
				onmousedown={startNavResize}
			></div>
		{/if}

		<Collapsible.Trigger
			aria-label="Toggle navigation pane"
			class="absolute top-1/2 right-0 z-10 flex h-7 w-7 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-surface-200-800 bg-surface-50-950 text-surface-950-50 shadow-sm transition-colors hover:bg-surface-100-900 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-3 w-3 transition-transform duration-200"
				style="transform: rotate({desktopChevronRotation}deg);"
				aria-hidden="true"
			>
				<path d="M6 9l6 6 6-6" />
			</svg>
		</Collapsible.Trigger>
	</Collapsible.Root>
{/if}

{#snippet paneContent()}
	<Tabs
		value={readerController.activeTab}
		onValueChange={(d) => handleTabChange(d.value)}
		class="flex h-full min-h-0 w-full flex-col"
	>
		<Tabs.List class="flex shrink-0 items-center gap-1 border-b border-surface-200-800 p-1">
			<Tabs.Trigger
				value="thumbs"
				class="flex-1 rounded-sm px-2 py-1.5 text-sm font-medium text-surface-950-50 outline-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[selected]:bg-primary-500/15 data-[selected]:text-primary-500"
			>
				Thumbnails
			</Tabs.Trigger>
			<Tabs.Trigger
				value="outline"
				class="flex-1 rounded-sm px-2 py-1.5 text-sm font-medium text-surface-950-50 outline-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[selected]:bg-primary-500/15 data-[selected]:text-primary-500"
			>
				Outline
			</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="thumbs" class="min-h-0 flex-1 overflow-hidden">
			<ThumbnailsPanel {pdfDoc} {pageCount} {hasDoc} />
		</Tabs.Content>
		<Tabs.Content value="outline" class="min-h-0 flex-1 overflow-hidden">
			<OutlinePanel {outline} {outlineLoading} {hasDoc} />
		</Tabs.Content>
	</Tabs>
{/snippet}
