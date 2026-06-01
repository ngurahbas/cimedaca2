<script lang="ts">
	type Props = {
		side: 'left' | 'right';
		collapsed: boolean;
		onclick: () => void;
	};

	let { side, collapsed, onclick }: Props = $props();

	const label = $derived(side === 'left' ? 'Toggle navigation pane' : 'Toggle AI pane');
	const rotation = $derived.by(() => {
		if (side === 'left') return collapsed ? 180 : 0;
		return collapsed ? 0 : 180;
	});
</script>

<button
	type="button"
	{onclick}
	aria-label={label}
	title={label}
	class="absolute top-1/2 z-10 flex h-8 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-surface-200-800 bg-surface-100-900 text-surface-950-50 shadow-sm transition-colors hover:bg-surface-200-800 focus-visible:outline-2 focus-visible:outline-primary-500 {side ===
	'left'
		? 'left-0 -translate-x-1/2'
		: 'right-0 translate-x-1/2'}"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="h-3.5 w-3.5 transition-transform duration-200"
		style="transform: rotate({rotation}deg);"
		aria-hidden="true"
	>
		<path d="M15 18l-6-6 6-6" />
	</svg>
</button>
