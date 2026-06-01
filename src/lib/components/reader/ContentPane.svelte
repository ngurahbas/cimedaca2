<script lang="ts">
	import { readerController } from '$lib/stores/reader.svelte';
	import EmptyState from './EmptyState.svelte';
	import PdfViewer from './PdfViewer.svelte';
	import PaneToggle from './PaneToggle.svelte';

	let viewer = $state<ReturnType<typeof PdfViewer> | undefined>(undefined);

	const collapsed = $derived(!readerController.showNav);

	function handleToggle() {
		if (readerController.isMobile) {
			readerController.openMobileNav();
		} else {
			readerController.toggleNav();
		}
	}
</script>

<section
	class="relative min-h-0 flex-1 overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950"
>
	{#if readerController.doc === null}
		<EmptyState />
	{:else}
		<PdfViewer data={readerController.doc.data} bind:this={viewer} />
	{/if}

	<PaneToggle side="left" {collapsed} onclick={handleToggle} />
</section>
