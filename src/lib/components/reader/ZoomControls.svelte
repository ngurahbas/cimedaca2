<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import { readerController } from '$lib/stores/reader.svelte';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import StretchHorizontal from '@lucide/svelte/icons/stretch-horizontal';
</script>

<div
	class="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-surface-200-800 bg-surface-50-950/70 px-3 py-2 shadow-lg backdrop-blur-sm transition-colors hover:bg-surface-50-950/90"
>
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger
				onclick={() => readerController.zoomOut()}
				class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-200-800 focus-visible:bg-surface-200-800"
				aria-label="Zoom out"
			>
				<Minus class="h-4 w-4" strokeWidth={2.5} />
			</Tooltip.Trigger>
			<Tooltip.Content
				side="top"
				sideOffset={6}
				class="z-50 rounded-md border border-surface-200-800 bg-surface-50-950 px-2 py-1 text-xs text-surface-950-50 shadow-md"
			>
				Zoom out
			</Tooltip.Content>
		</Tooltip.Root>

		<span class="min-w-[3rem] text-center text-sm font-medium text-surface-950-50 select-none">
			{Math.round(readerController.zoomScale * 100)}%
		</span>

		<Tooltip.Root>
			<Tooltip.Trigger
				onclick={() => readerController.zoomIn()}
				class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-200-800 focus-visible:bg-surface-200-800"
				aria-label="Zoom in"
			>
				<Plus class="h-4 w-4" strokeWidth={2.5} />
			</Tooltip.Trigger>
			<Tooltip.Content
				side="top"
				sideOffset={6}
				class="z-50 rounded-md border border-surface-200-800 bg-surface-50-950 px-2 py-1 text-xs text-surface-950-50 shadow-md"
			>
				Zoom in
			</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger
				onclick={() => readerController.fitToWidth()}
				class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-200-800 focus-visible:bg-surface-200-800"
				aria-label="Fit to width"
			>
				<StretchHorizontal class="h-4 w-4" strokeWidth={2.5} />
			</Tooltip.Trigger>
			<Tooltip.Content
				side="top"
				sideOffset={6}
				class="z-50 rounded-md border border-surface-200-800 bg-surface-50-950 px-2 py-1 text-xs text-surface-950-50 shadow-md"
			>
				Fit to width
			</Tooltip.Content>
		</Tooltip.Root>

		<Tooltip.Root>
			<Tooltip.Trigger
				onclick={() => readerController.resetZoom()}
				class="flex h-7 items-center justify-center rounded-full px-2 text-xs font-medium text-surface-950-50 outline-none select-none hover:bg-surface-200-800 focus-visible:bg-surface-200-800"
				aria-label="Reset zoom"
			>
				<RotateCcw class="h-3.5 w-3.5" strokeWidth={2.5} />
			</Tooltip.Trigger>
			<Tooltip.Content
				side="top"
				sideOffset={6}
				class="z-50 rounded-md border border-surface-200-800 bg-surface-50-950 px-2 py-1 text-xs text-surface-950-50 shadow-md"
			>
				Reset zoom
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
