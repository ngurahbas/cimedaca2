<script lang="ts">
	import { readerController } from '$lib/stores/reader.svelte';
	import EmptyState from './EmptyState.svelte';
	import PdfViewer from './PdfViewer.svelte';
	import ZoomControls from './ZoomControls.svelte';

	let viewer = $state<ReturnType<typeof PdfViewer> | undefined>(undefined);

	$effect(() => {
		readerController.viewerRef = viewer
			? {
					scrollToPage: (n: number) => viewer?.scrollToPage(n),
					fitToWidth: () => viewer?.fitToWidth()
				}
			: null;
		return () => {
			readerController.viewerRef = null;
		};
	});
</script>

<section
	class="relative min-h-0 flex-1 overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950"
>
	{#if readerController.doc === null}
		<EmptyState />
	{:else}
		<PdfViewer data={readerController.doc.data} bind:this={viewer} />
		<ZoomControls />
	{/if}
</section>
