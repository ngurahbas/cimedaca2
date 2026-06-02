<script lang="ts">
	import ReaderMenubar from '$lib/components/reader/ReaderMenubar.svelte';
	import NavigationPane from '$lib/components/reader/NavigationPane.svelte';
	import ContentPane from '$lib/components/reader/ContentPane.svelte';
	import AiPane from '$lib/components/reader/AiPane.svelte';
</script>

<div class="flex h-screen w-full flex-col gap-2 bg-surface-50-950 p-4">
	<ReaderMenubar />
	<div class="relative flex min-h-0 flex-1 gap-2 max-md:flex-col">
		<NavigationPane />
		<ContentPane />
		<AiPane />
	</div>
</div>
