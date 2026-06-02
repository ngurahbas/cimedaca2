<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import { Collapsible } from 'bits-ui';
	import { readerController } from '$lib/stores/reader.svelte';

	const chevronRotation = $derived.by(() => {
		if (readerController.isMobile) {
			return readerController.showAi ? 180 : 0;
		}
		return readerController.showAi ? 90 : -90;
	});
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

<Collapsible.Root
	bind:open={readerController.showAi}
	aria-label="AI"
	class="flex shrink-0 flex-col overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950 md:h-full md:flex-row"
>
	<Collapsible.Trigger
		class="flex shrink-0 items-center justify-between gap-2 border-b border-surface-200-800 bg-surface-50-950 px-3 py-2 text-sm font-semibold text-surface-950-50 hover:bg-surface-100-900 md:flex-col md:justify-center md:gap-1.5 md:border-r md:border-b-0 md:px-2 md:py-3"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="order-last h-4 w-4 shrink-0 transition-transform duration-200 md:order-first"
			style="transform: rotate({chevronRotation}deg);"
			aria-hidden="true"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
		<span class="order-first md:order-last md:[writing-mode:vertical-rl]">AI Pane</span>
	</Collapsible.Trigger>
	<Collapsible.Content
		forceMount
		class="flex max-h-0 min-h-0 flex-col overflow-hidden transition-[max-height,width] duration-200 data-[state=open]:max-h-[60vh] md:max-h-none md:w-0 md:data-[state=open]:w-80"
	>
		<div class="min-h-0 flex-1 overflow-y-auto">
			{@render placeholder()}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
