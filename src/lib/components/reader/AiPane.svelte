<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import { Collapsible } from 'bits-ui';
	import { readerController } from '$lib/stores/reader.svelte';
	import AiSettings from './AiSettings.svelte';

	const chevronRotation = $derived(readerController.showAi ? 90 : -90);

	let aiResizing = $state(false);

	// Mobile drawer: close on Escape
	$effect(() => {
		if (!readerController.isMobile) return;
		if (!readerController.showAi) return;

		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				readerController.showAi = false;
			}
		}
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});

	// Mobile drawer: lock body scroll
	$effect(() => {
		if (!readerController.isMobile) return;
		if (readerController.showAi) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});

	function startAiResize(e: MouseEvent) {
		e.preventDefault();
		aiResizing = true;
		const startX = e.clientX;
		const startWidth = readerController.aiPaneWidth;

		function onMove(ev: MouseEvent) {
			const delta = startX - ev.clientX;
			readerController.aiPaneWidth = readerController.clampWidth(startWidth + delta);
		}

		function onUp() {
			aiResizing = false;
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			readerController.setAiPaneWidth(readerController.aiPaneWidth);
		}

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	}
</script>

{#snippet paneContent()}
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="shrink-0 p-3">
			<AiSettings />
		</div>
		<div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
			<Bot class="h-10 w-10 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
			<div class="space-y-1">
				<h3 class="text-sm font-semibold text-surface-950-50">AI Pane</h3>
				<p class="text-xs opacity-70">Conversation features are coming soon.</p>
			</div>
		</div>
	</div>
{/snippet}

{#if readerController.isMobile}
	{#if readerController.showAi}
		<!-- Backdrop -->
		<button
			class="absolute inset-0 z-30 cursor-default bg-black/30"
			onclick={() => (readerController.showAi = false)}
			aria-label="Close AI pane"
		></button>

		<!-- Drawer -->
		<div
			class="absolute inset-x-0 bottom-0 z-40 flex max-h-[60vh] flex-col overflow-hidden rounded-t-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
		>
			<div
				class="flex shrink-0 items-center justify-between border-b border-surface-200-800 px-3 py-2"
			>
				<span class="text-sm font-semibold text-surface-950-50">AI</span>
				<button
					onclick={() => (readerController.showAi = false)}
					class="flex h-7 w-7 items-center justify-center rounded-full text-surface-950-50 hover:bg-surface-100-900"
					aria-label="Close AI pane"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-4 w-4"
						aria-hidden="true"
					>
						<path d="M18 6L6 18" />
						<path d="M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto">
				{@render paneContent()}
			</div>
		</div>
	{/if}
{:else}
	<!-- Desktop: collapsible panel with floating edge pill -->
	<Collapsible.Root
		bind:open={readerController.showAi}
		aria-label="AI"
		class="relative flex h-full shrink-0 flex-row"
	>
		<Collapsible.Trigger
			aria-label="Toggle AI pane"
			class="absolute top-1/2 left-0 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-surface-200-800 bg-surface-50-950 text-surface-950-50 shadow-sm transition-colors hover:bg-surface-100-900 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-3 w-3 transition-transform duration-200"
				style="transform: rotate({chevronRotation}deg);"
				aria-hidden="true"
			>
				<path d="M6 9l6 6 6-6" />
			</svg>
		</Collapsible.Trigger>
		<Collapsible.Content
			forceMount
			class="flex h-full min-h-0 w-0 flex-col overflow-hidden rounded-md border border-surface-200-800 bg-surface-50-950 transition-[width] duration-200"
			style="width: {readerController.showAi
				? readerController.aiPaneWidth + 'px'
				: undefined};{aiResizing ? 'transition: none !important;' : ''}"
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
				{@render paneContent()}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{/if}
