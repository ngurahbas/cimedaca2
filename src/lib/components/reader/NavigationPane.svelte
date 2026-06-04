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

	const chevronRotation = $derived.by(() => {
		if (readerController.isMobile) {
			return readerController.showNav ? 180 : 0;
		}
		return readerController.showNav ? -90 : 90;
	});
</script>

<Collapsible.Root
	bind:open={readerController.showNav}
	aria-label="Navigation"
	class="grid shrink-0 overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950 transition-[grid-template-rows] duration-200 ease-in-out md:flex md:h-full md:flex-row md:transition-none"
	style="grid-template-rows: auto {readerController.showNav ? '1fr' : '0fr'};"
>
	<Collapsible.Content
		forceMount
		class="flex min-h-0 flex-col overflow-hidden md:w-0 md:transition-[width] md:duration-200 md:ease-in-out md:data-[state=open]:w-64"
	>
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
				<ThumbnailsPanel {pdfDoc} {pageCount} {hasDoc} />
			</Tabs.Content>
			<Tabs.Content value="outline" class="min-h-0 flex-1 overflow-hidden">
				<OutlinePanel {outline} {outlineLoading} {hasDoc} />
			</Tabs.Content>
		</Tabs>
	</Collapsible.Content>
	<Collapsible.Trigger
		class="order-first flex shrink-0 items-center justify-between gap-2 border-b border-surface-200-800 bg-surface-50-950 px-3 py-2 text-sm font-semibold text-surface-950-50 hover:bg-surface-100-900 md:order-last md:flex-col md:justify-center md:gap-1.5 md:border-b-0 md:border-l md:px-2 md:py-3"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="order-last h-4 w-4 shrink-0 transition-transform duration-200 md:order-first"
			style="transform: rotate({chevronRotation}deg);"
			aria-hidden="true"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
		<span class="order-first md:order-last md:[writing-mode:vertical-rl]">Navigation Pane</span>
	</Collapsible.Trigger>
</Collapsible.Root>
