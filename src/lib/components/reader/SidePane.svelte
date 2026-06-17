<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Collapsible } from 'bits-ui';
	import { readerController } from '$lib/stores/reader.svelte';

	type Props = {
		side: 'left' | 'right';
		open: boolean;
		onOpenChange: (v: boolean) => void;
		width: number;
		setWidth: (w: number) => void;
		paneTitle: string;
		ariaLabel: string;
		children: Snippet;
	};

	let { side, open, onOpenChange, width, setWidth, paneTitle, ariaLabel, children }: Props =
		$props();

	let resizing = $state(false);
	let dragWidth = $state<number | null>(null);

	const chevronRotation = $derived(side === 'left' ? (open ? 90 : -90) : open ? -90 : 90);

	const triggerPosition = $derived(
		side === 'left'
			? 'absolute top-1/2 right-0 translate-x-1/2'
			: 'absolute top-1/2 left-0 -translate-x-1/2'
	);

	const separatorPosition = $derived(side === 'left' ? 'right-0' : 'left-0');

	const renderedWidth = $derived(dragWidth ?? width);

	// Mobile drawer: close on Escape
	$effect(() => {
		if (!readerController.isMobile) return;
		if (!open) return;

		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onOpenChange(false);
			}
		}
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});

	// Mobile drawer: lock body scroll
	$effect(() => {
		if (!readerController.isMobile) return;
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});

	function startResize(e: MouseEvent) {
		e.preventDefault();
		resizing = true;
		const startX = e.clientX;
		const startWidth = width;

		function onMove(ev: MouseEvent) {
			const raw = startWidth + (side === 'left' ? ev.clientX - startX : startX - ev.clientX);
			dragWidth = readerController.clampWidth(raw);
		}

		function onUp() {
			resizing = false;
			const final = dragWidth ?? width;
			dragWidth = null;
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			setWidth(final);
		}

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	}
</script>

{#if readerController.isMobile}
	{#if open}
		<!-- Backdrop -->
		<button
			class="absolute inset-0 z-30 cursor-default bg-black/30"
			onclick={() => onOpenChange(false)}
			aria-label="Close {paneTitle}"
		></button>

		<!-- Drawer -->
		<div
			class="absolute inset-x-0 z-40 flex max-h-[60vh] flex-col overflow-hidden border border-surface-200-800 bg-surface-50-950 shadow-lg {side ===
			'left'
				? 'top-0 rounded-b-md'
				: 'bottom-0 rounded-t-md'}"
		>
			<div
				class="flex shrink-0 items-center justify-between border-b border-surface-200-800 px-3 py-2"
			>
				<span class="text-sm font-semibold text-surface-950-50">{paneTitle}</span>
				<button
					onclick={() => onOpenChange(false)}
					class="flex h-7 w-7 items-center justify-center rounded-full text-surface-950-50 hover:bg-surface-100-900"
					aria-label="Close {paneTitle}"
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
				{@render children()}
			</div>
		</div>
	{/if}
{:else}
	<!-- Desktop: collapsible panel with floating edge pill -->
	<Collapsible.Root
		bind:open
		aria-label={ariaLabel}
		class="relative shrink-0 md:flex md:h-full md:flex-row"
	>
		<Collapsible.Content
			forceMount
			class="flex min-h-0 flex-col overflow-hidden md:w-0 md:rounded-md md:border md:border-surface-200-800 md:bg-surface-50-950 md:transition-[width] md:duration-200 md:ease-in-out"
			style="width: {open ? renderedWidth + 'px' : undefined};{resizing
				? 'transition: none !important;'
				: ''}"
		>
			{@render children()}
		</Collapsible.Content>

		{#if open}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize {paneTitle.toLowerCase()} pane"
				tabindex="-1"
				class="absolute top-0 z-20 h-full w-1 cursor-col-resize bg-surface-200-800/30 hover:bg-primary-500/50 {separatorPosition}"
				onmousedown={startResize}
			></div>
		{/if}

		<Collapsible.Trigger
			aria-label="Toggle {paneTitle.toLowerCase()} pane"
			class="{triggerPosition} z-10 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-surface-200-800 bg-surface-50-950 text-surface-950-50 shadow-sm transition-colors hover:bg-surface-100-900 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
	</Collapsible.Root>
{/if}
