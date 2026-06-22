<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import Square from '@lucide/svelte/icons/square';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { chatController } from '$lib/stores/chat.svelte';

	type Props = {
		disabled?: boolean;
	};

	let { disabled = false }: Props = $props();

	let text = $state('');
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	const suggestedPrompts = [
		'Summarize this document',
		'What are the main findings?',
		'Explain the introduction',
		'List key sections'
	];

	const canSubmit = $derived(
		text.trim().length > 0 && !disabled && !chatController.isStreaming && !chatController.isThinking
	);

	function resizeTextarea() {
		if (!textareaRef) return;
		textareaRef.style.height = 'auto';
		textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 160)}px`;
	}

	function handleInput() {
		resizeTextarea();
	}

	function send() {
		const trimmed = text.trim();
		if (!trimmed || disabled) return;
		chatController.send(trimmed);
		text = '';
		if (textareaRef) textareaRef.style.height = 'auto';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function usePrompt(prompt: string) {
		if (disabled || chatController.isStreaming || chatController.isThinking) return;
		chatController.send(prompt);
	}
</script>

<div class="flex flex-col gap-2">
	{#if chatController.messages.length === 0 && !disabled}
		<div class="flex flex-wrap gap-2">
			{#each suggestedPrompts as prompt (prompt)}
				<button
					type="button"
					onclick={() => usePrompt(prompt)}
					class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-surface-200-800 bg-surface-50-950 px-2.5 py-1 text-xs text-surface-950-50 hover:bg-surface-100-900"
				>
					<Sparkles class="h-3 w-3 text-primary-500" aria-hidden="true" />
					{prompt}
				</button>
			{/each}
		</div>
	{/if}

	<div class="flex items-end gap-2 rounded-xl border border-surface-200-800 bg-surface-50-950 p-2">
		<textarea
			bind:this={textareaRef}
			bind:value={text}
			oninput={handleInput}
			onkeydown={handleKeydown}
			{disabled}
			placeholder={disabled ? 'Open a PDF to start chatting' : 'Ask about this document…'}
			rows="1"
			class="max-h-40 min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-surface-950-50 placeholder:text-surface-500 focus:ring-0 focus:outline-none"
		></textarea>
		{#if chatController.isStreaming || chatController.isThinking}
			<button
				type="button"
				onclick={() => chatController.abort()}
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error-500 text-white hover:opacity-90"
				aria-label="Stop generating"
			>
				<Square class="h-4 w-4" aria-hidden="true" />
			</button>
		{:else}
			<button
				type="button"
				onclick={send}
				disabled={!canSubmit}
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg preset-filled-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Send message"
			>
				<Send class="h-4 w-4" aria-hidden="true" />
			</button>
		{/if}
	</div>
</div>
