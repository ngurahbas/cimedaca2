<script lang="ts">
	import { browser } from '$app/environment';

	let { data }: { data: ArrayBuffer } = $props();

	let blobUrl = $state<string | null>(null);

	$effect(() => {
		if (!browser) return;

		const blob = new Blob([data], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		blobUrl = url;

		return () => {
			URL.revokeObjectURL(url);
			blobUrl = null;
		};
	});
</script>

{#if blobUrl}
	<embed src={blobUrl} type="application/pdf" class="h-full w-full" />
{:else}
	<div class="flex h-full w-full items-center justify-center">
		<div class="flex flex-col items-center gap-3 text-surface-950-50">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-surface-300-700 border-t-primary-500"
				aria-hidden="true"
			></div>
			<p class="text-sm opacity-70">Loading PDF…</p>
		</div>
	</div>
{/if}
