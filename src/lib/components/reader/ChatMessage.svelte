<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { Collapsible } from 'bits-ui';
	import type { UiChatMessage } from '$lib/stores/chat.svelte';

	type Props = {
		message: UiChatMessage;
	};

	let { message }: Props = $props();
	let reasoningOpen = $state(false);

	let isAssistant = $derived(message.role === 'assistant');
</script>

{#if isAssistant}
	<div class="flex gap-2.5">
		<div
			class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500"
		>
			<Bot class="h-4 w-4" aria-hidden="true" />
		</div>
		<div class="flex min-w-0 flex-1 flex-col gap-1.5">
			{#if message.reasoningContent}
				<Collapsible.Root bind:open={reasoningOpen}>
					<Collapsible.Trigger
						class="group flex w-fit items-center gap-1 text-xs font-medium text-surface-500 outline-none hover:text-surface-950-50"
					>
						<span>Thinking</span>
						<ChevronDown
							class="h-3.5 w-3.5 transition group-data-[state=open]:rotate-180"
							aria-hidden="true"
						/>
					</Collapsible.Trigger>
					<Collapsible.Content>
						<div
							class="mt-1 rounded-md border border-surface-200-800 bg-surface-100-900/50 p-2 text-xs text-surface-950-50 opacity-80"
						>
							{message.reasoningContent}
						</div>
					</Collapsible.Content>
				</Collapsible.Root>
			{/if}
			<div
				class="min-h-[2.25rem] w-fit max-w-[95%] rounded-2xl rounded-tl-sm border border-surface-200-800 preset-tonal-surface px-3 py-2 text-sm text-surface-950-50"
			>
				<span>{message.content}</span>
				{#if message.isStreaming}
					<span
						class="ml-0.5 inline-block h-2 w-2 animate-pulse rounded-full bg-primary-500 align-middle"
						aria-hidden="true"
					></span>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<div class="flex justify-end">
		<div class="max-w-[95%] rounded-2xl rounded-tr-sm preset-filled-primary-500 px-3 py-2 text-sm">
			{message.content}
		</div>
	</div>
{/if}
