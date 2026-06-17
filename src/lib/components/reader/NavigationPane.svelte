<script lang="ts">
	import { Tabs } from '@skeletonlabs/skeleton-svelte';
	import { browser } from '$app/environment';
	import { readerController } from '$lib/stores/reader.svelte';
	import { loadOutline, type OutlineNode } from '$lib/pdfjs/outline';
	import SidePane from './SidePane.svelte';
	import ThumbnailsPanel from './ThumbnailsPanel.svelte';
	import OutlinePanel from './OutlinePanel.svelte';

	const pdfDoc = $derived(readerController.pdfDocument);
	const pageCount = $derived(pdfDoc?.numPages ?? 0);

	let outline = $state<OutlineNode[] | null>(null);

	$effect(() => {
		const doc = pdfDoc;
		if (!browser) return;
		if (!doc) {
			outline = null;
			return;
		}
		let cancelled = false;
		outline = null;
		loadOutline(doc).then((result) => {
			if (!cancelled) outline = result;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<SidePane
	side="left"
	open={readerController.showNav}
	onOpenChange={(v) => (readerController.showNav = v)}
	width={readerController.navPaneWidth}
	setWidth={readerController.setNavPaneWidth}
	paneTitle="Navigation"
	ariaLabel="Navigation"
>
	<Tabs
		value={readerController.activeTab}
		onValueChange={(d) => readerController.setTab(d.value as 'thumbs' | 'outline')}
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
			<ThumbnailsPanel {pdfDoc} {pageCount} />
		</Tabs.Content>
		<Tabs.Content value="outline" class="min-h-0 flex-1 overflow-hidden">
			<OutlinePanel {outline} />
		</Tabs.Content>
	</Tabs>
</SidePane>
