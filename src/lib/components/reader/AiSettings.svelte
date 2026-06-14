<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { Accordion, Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';
	import { llmController } from '$lib/stores/llm.svelte';
	import { LlmError } from '$lib/llm/types';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let urlInput = $state(llmController.baseUrl);
	let keyInput = $state(llmController.apiKey ?? '');
	let showKey = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let abortController = $state<AbortController | null>(null);

	const hasUrl = $derived(urlInput.trim().length > 0);
	const modelItems = $derived(
		llmController.availableModels.map((id) => ({ label: id, value: id }))
	);
	const collection = $derived(
		useListCollection({
			items: modelItems,
			itemToString: (item) => item.label,
			itemToValue: (item) => item.value
		})
	);

	onMount(() => {
		if (!browser) return;
		if (llmController.loadedFromStorage) {
			void handleVerify();
		}
	});

	async function handleVerify() {
		if (abortController) abortController.abort();
		abortController = new AbortController();
		isLoading = true;
		error = null;
		try {
			await llmController.verify(
				urlInput.trim(),
				keyInput.trim() || undefined,
				abortController.signal
			);
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return;
			error = err instanceof LlmError ? err.message : 'Failed to fetch models';
		} finally {
			isLoading = false;
			abortController = null;
		}
	}

	function handleModelChange(event: { value: string | string[] }) {
		const value = Array.isArray(event.value) ? event.value[0] : event.value;
		if (value) llmController.setModel(value);
	}

	function toggleShowKey() {
		showKey = !showKey;
	}
</script>

<Accordion defaultValue={['settings']} multiple collapsible class="w-full">
	<Accordion.Item value="settings" class="border-b border-surface-200-800">
		<Accordion.ItemTrigger
			class="flex w-full items-center justify-between py-2 text-sm font-semibold text-surface-950-50 outline-none select-none"
		>
			<span>Provider Settings</span>
			<Accordion.ItemIndicator class="group">
				<ChevronDown class="h-4 w-4 transition group-data-[state=open]:rotate-180" />
			</Accordion.ItemIndicator>
		</Accordion.ItemTrigger>
		<Accordion.ItemContent>
			{#snippet element(attributes)}
				{#if !attributes.hidden}
					<div {...attributes} class="pb-3">
						<div class="flex flex-col gap-3">
							<label class="flex flex-col gap-1">
								<span class="text-xs font-medium text-surface-950-50">Base URL</span>
								<input
									type="text"
									bind:value={urlInput}
									placeholder="http://localhost:1234/v1"
									class="w-full rounded-md border border-surface-200-800 bg-surface-50-950 px-3 py-2 text-sm text-surface-950-50 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
								/>
							</label>

							<label class="flex flex-col gap-1">
								<span class="text-xs font-medium text-surface-950-50">API key</span>
								<div class="relative">
									<input
										type={showKey ? 'text' : 'password'}
										bind:value={keyInput}
										placeholder="Optional"
										class="w-full rounded-md border border-surface-200-800 bg-surface-50-950 px-3 py-2 pr-10 text-sm text-surface-950-50 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
									/>
									<button
										type="button"
										onclick={toggleShowKey}
										class="absolute top-1/2 right-2 -translate-y-1/2 text-surface-500 hover:text-surface-950-50"
										aria-label={showKey ? 'Hide API key' : 'Show API key'}
									>
										{#if showKey}
											<EyeOff class="h-4 w-4" />
										{:else}
											<Eye class="h-4 w-4" />
										{/if}
									</button>
								</div>
							</label>

							<button
								type="button"
								onclick={handleVerify}
								disabled={!hasUrl || isLoading}
								class="flex items-center justify-center gap-2 rounded-md preset-filled-primary-500 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if isLoading}
									<Loader2 class="h-4 w-4 animate-spin" />
								{/if}
								Verify / Fetch models
							</button>

							{#if error}
								<div class="flex items-center gap-1.5 text-xs text-error-500">
									<AlertCircle class="h-3.5 w-3.5 shrink-0" />
									<span>{error}</span>
								</div>
							{:else if llmController.availableModels.length > 0}
								<div class="flex items-center gap-1.5 text-xs text-success-500">
									<Check class="h-3.5 w-3.5 shrink-0" />
									<span>{llmController.availableModels.length} models available</span>
								</div>
							{/if}

							{#if llmController.availableModels.length > 0}
								{@const selectedValue = llmController.model ? [llmController.model] : []}
								<Combobox
									value={selectedValue}
									onValueChange={handleModelChange}
									{collection}
									class="w-full"
								>
									<Combobox.Label class="text-xs font-medium text-surface-950-50"
										>Model</Combobox.Label
									>
									<Combobox.Control class="relative mt-1">
										<Combobox.Input
											placeholder="Select a model…"
											class="w-full rounded-md border border-surface-200-800 bg-surface-50-950 px-3 py-2 pr-10 text-sm text-surface-950-50 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
										/>
										<Combobox.Trigger
											class="absolute top-1/2 right-2 -translate-y-1/2 text-surface-500 hover:text-surface-950-50"
										>
											<ChevronDown class="h-4 w-4" />
										</Combobox.Trigger>
									</Combobox.Control>
									<Portal>
										<Combobox.Positioner>
											<Combobox.Content
												class="z-50 max-h-60 w-full overflow-y-auto rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-md"
											>
												{#each modelItems as item (item.value)}
													<Combobox.Item
														{item}
														class="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm text-surface-950-50 hover:bg-surface-100-900"
													>
														<Combobox.ItemText>{item.label}</Combobox.ItemText>
														<Combobox.ItemIndicator />
													</Combobox.Item>
												{/each}
											</Combobox.Content>
										</Combobox.Positioner>
									</Portal>
								</Combobox>
							{/if}
						</div>
					</div>
				{/if}
			{/snippet}
		</Accordion.ItemContent>
	</Accordion.Item>
</Accordion>
