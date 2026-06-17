<script lang="ts">
	import { readerController, type ViewerRef } from '$lib/stores/reader.svelte';
	import EmptyState from './EmptyState.svelte';
	import PdfViewer from './PdfViewer.svelte';
	import ZoomControls from './ZoomControls.svelte';

	let viewer = $state<PdfViewer | undefined>(undefined);

	$effect(() => {
		readerController.viewerRef = (viewer as unknown as ViewerRef) ?? null;
	});
</script>

<section
	class="relative min-h-0 flex-1 overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950"
>
	{#if readerController.doc === null}
		<EmptyState />
	{:else}
		<PdfViewer bind:this={viewer} />
		<ZoomControls />
	{/if}
</section>
