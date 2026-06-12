<script lang="ts">
	import { readerController } from '$lib/stores/reader.svelte';
	import EmptyState from './EmptyState.svelte';
	import PdfViewer from './PdfViewer.svelte';
	import PdfiumViewer from './PdfiumViewer.svelte';
	import ZoomControls from './ZoomControls.svelte';

	let viewer = $state<ReturnType<typeof PdfViewer> | undefined>(undefined);

	$effect(() => {
		if (readerController.pdfEngine !== 'pdfjs') {
			readerController.viewerRef = null;
			return () => {
				readerController.viewerRef = null;
			};
		}
		readerController.viewerRef = viewer
			? { scrollToPage: (n: number) => viewer?.scrollToPage(n) }
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
	{:else if readerController.pdfEngine === 'pdfjs'}
		<PdfViewer data={readerController.doc.data} bind:this={viewer} />
		<ZoomControls />
	{:else}
		<PdfiumViewer data={readerController.doc.data} />
	{/if}
</section>
