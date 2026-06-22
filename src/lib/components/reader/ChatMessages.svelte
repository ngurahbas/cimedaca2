<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { chatController } from '$lib/stores/chat.svelte';
	import ChatMessage from './ChatMessage.svelte';

	let scrollRef = $state<HTMLDivElement | null>(null);

	$effect(() => {
		// Re-run when messages or streaming state changes so the view stays pinned to the bottom.
		void chatController.messages;
		void chatController.isThinking;
		void chatController.isStreaming;

		if (scrollRef) {
			scrollRef.scrollTop = scrollRef.scrollHeight;
		}
	});
</script>

<div
	bind:this={scrollRef}
	class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1"
	aria-live="polite"
	aria-atomic="false"
>
	{#if chatController.messages.length === 0 && !chatController.isThinking}
		<div class="flex flex-1 flex-col items-center justify-center gap-2 text-center opacity-60">
			<p class="text-xs">Ask anything about the document.</p>
		</div>
	{:else}
		{#each chatController.messages as message (message)}
			<ChatMessage {message} />
		{/each}
	{/if}

	{#if chatController.isThinking}
		<div class="flex gap-2.5">
			<div
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500"
			>
				<Bot class="h-4 w-4" aria-hidden="true" />
			</div>
			<div class="flex items-center gap-2 text-xs text-surface-500">
				<Loader2 class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
				<span>Thinking…</span>
			</div>
		</div>
	{/if}
</div>
