<script lang="ts">
	import { readerController } from '$lib/stores/reader.svelte';
	import type { OutlineNode } from '$lib/pdfjs/outline';

	type Props = {
		outline: OutlineNode[] | null;
	};

	let { outline }: Props = $props();
</script>

{#snippet outlineNode(node: OutlineNode, depth: number)}
	{@const indent = depth * 8}
	<li>
		<button
			type="button"
			disabled={node.pageNumber === null}
			onclick={() => {
				if (node.pageNumber !== null) readerController.scrollToPage(node.pageNumber);
			}}
			class="flex w-full items-start gap-1 rounded-sm px-2 py-1 text-left text-sm hover:bg-surface-100-900 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
			style="padding-left: {indent + 8}px;"
		>
			<span class="truncate" title={node.title}>
				{depth >= 3 ? '…' : ''}{node.title}
			</span>
		</button>
		{#if node.items.length > 0 && depth < 3}
			<ul>
				{#each node.items as child, idx (idx)}
					{@render outlineNode(child, depth + 1)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}

{#if outline === null}
	<div class="flex h-full items-center justify-center p-4 text-center text-sm opacity-70">
		Loading outline…
	</div>
{:else if outline.length === 0}
	<div class="flex h-full items-center justify-center p-4 text-center text-sm opacity-70">
		This PDF has no outline
	</div>
{:else}
	<ul class="flex flex-col gap-0.5 overflow-y-auto p-2">
		{#each outline as node, idx (idx)}
			{@render outlineNode(node, 0)}
		{/each}
	</ul>
{/if}
