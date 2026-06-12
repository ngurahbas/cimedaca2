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

	function startAiResize(e: MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = readerController.aiPaneWidth;

		function onMove(ev: MouseEvent) {
			const delta = startX - ev.clientX;
			readerController.setAiPaneWidth(startWidth + delta);
		}

		function onUp() {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		}

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
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

<Collapsible.Root
	bind:open={readerController.showAi}
	aria-label="AI"
	class="relative shrink-0 overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950 md:flex md:h-full md:flex-row md:overflow-visible md:border-0 md:bg-transparent"
>
	<Collapsible.Trigger
		aria-label="Toggle AI pane"
		class="order-first flex shrink-0 cursor-pointer items-center justify-center gap-2 border-b border-surface-200-800 bg-surface-50-950 px-2 py-1 text-surface-950-50 hover:bg-surface-100-900 max-md:rounded-none md:absolute md:top-1/2 md:left-0 md:z-10 md:order-last md:h-7 md:w-7 md:-translate-x-1/2 md:-translate-y-1/2 md:items-center md:justify-center md:rounded-full md:border md:border-surface-200-800 md:bg-surface-50-950 md:px-0 md:py-0 md:shadow-sm md:transition-colors md:hover:bg-surface-100-900 md:focus-visible:ring-2 md:focus-visible:ring-primary-500 md:focus-visible:outline-none"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="order-last h-4 w-4 shrink-0 transition-transform duration-200 md:order-first md:h-3 md:w-3"
			style="transform: rotate({chevronRotation}deg);"
			aria-hidden="true"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
		<span class="order-first text-xs md:hidden">AI</span>
	</Collapsible.Trigger>
	<Collapsible.Content
		forceMount
		class="flex min-h-0 flex-col overflow-hidden transition-[max-height,width] duration-200 max-md:max-h-0 max-md:data-[state=open]:max-h-[60vh] md:h-full md:w-0 md:rounded-md md:border md:border-surface-200-800 md:bg-surface-50-950 md:transition-[width] md:duration-200"
		style="width: {readerController.showAi ? readerController.aiPaneWidth + 'px' : undefined};"
	>
		{#if readerController.showAi}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize AI pane"
				tabindex="-1"
				class="absolute top-0 left-0 z-20 h-full w-1 cursor-col-resize bg-surface-200-800/30 hover:bg-primary-500/50"
				onmousedown={startAiResize}
			></div>
		{/if}
		<div class="min-h-0 flex-1 overflow-y-auto">
			{@render placeholder()}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
