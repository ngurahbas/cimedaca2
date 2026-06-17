<script lang="ts">
	import { Switch } from 'bits-ui';

	type Props = {
		label: string;
		checked: boolean;
		onCheckedChange: (v: boolean) => void;
	};

	let { label, checked, onCheckedChange }: Props = $props();
</script>

<div
	class="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm text-surface-950-50 select-none"
>
	<span>{label}</span>
	<Switch.Root
		{checked}
		{onCheckedChange}
		class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-surface-300-700 bg-surface-300-700 transition-colors outline-none data-[disabled]:cursor-not-allowed data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-500"
	>
		<Switch.Thumb
			class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4.5"
		/>
	</Switch.Root>
</div>
