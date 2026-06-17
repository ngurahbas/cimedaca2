<script lang="ts">
	import { readerController } from '$lib/stores/reader.svelte';
</script>

<div class="flex h-full w-full items-center justify-center p-6">
	<div
		class="flex max-w-md flex-col items-center gap-4 card border border-surface-200-800 preset-tonal-surface p-8 text-center shadow-sm"
	>
		<div class="space-y-1">
			<h2 class="text-lg font-semibold text-surface-950-50">Open a PDF to get started</h2>
			<p class="text-sm opacity-70">Choose a PDF from your device to begin reading.</p>
		</div>

		<button
			type="button"
			class="btn preset-filled-primary-500"
			onclick={() => readerController.openPdfDialog()}
		>
			Open PDF
		</button>

		<p class="text-xs opacity-60">…or use File → Open</p>
	</div>
</div>
