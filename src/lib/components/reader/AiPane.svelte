<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import { readerController } from '$lib/stores/reader.svelte';

	function toggleAi() {
		readerController.toggleAi();
	}
</script>

{#snippet placeholder()}
	<div class="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
		<Bot class="h-10 w-10 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
		<div class="space-y-1">
			<h3 class="text-sm font-semibold text-surface-950-50">AI Pane</h3>
			<p class="text-xs opacity-70">Conversation features are coming soon.</p>
		</div>
	</div>
{/snippet}

{#if readerController.isMobile}
	<aside
		aria-label="AI"
		class="flex shrink-0 flex-col overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950"
	>
		<button
			type="button"
			onclick={toggleAi}
			aria-expanded={readerController.showAi}
			class="flex items-center justify-between gap-2 border-b border-surface-200-800 px-3 py-2 text-left hover:bg-surface-100-900"
		>
			<span class="text-sm font-semibold text-surface-950-50">AI Pane</span>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-4 w-4 transition-transform duration-200"
				style="transform: rotate({readerController.showAi ? 180 : 0}deg);"
				aria-hidden="true"
			>
				<path d="M6 9l6 6 6-6" />
			</svg>
		</button>
		{#if readerController.showAi}
			<div class="max-h-[40vh] min-h-0 flex-1 overflow-y-auto">
				{@render placeholder()}
			</div>
		{/if}
	</aside>
{:else}
	<aside
		aria-label="AI"
		class="flex shrink-0 flex-col overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950 transition-[width] duration-200 {readerController.showAi
			? 'w-80'
			: 'w-10'}"
	>
		{#if readerController.showAi}
			{@render placeholder()}
		{/if}
	</aside>
{/if}
