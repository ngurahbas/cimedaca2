<script lang="ts">
	import ReaderMenubar from '$lib/components/reader/ReaderMenubar.svelte';
	import ContentPane from '$lib/components/reader/ContentPane.svelte';
</script>

<div class="flex h-screen w-full flex-col gap-2 bg-surface-50-950 p-4">
	<ReaderMenubar />
	<ContentPane />
</div>
