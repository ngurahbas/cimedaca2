<script lang="ts">
	import { Menubar, Switch } from 'bits-ui';
	import { themeController } from '$lib/stores/theme.svelte';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import { resolve } from '$app/paths';
</script>

<div class="flex flex-col gap-6 p-6">
	<Menubar.Root
		class="inline-flex items-center gap-1 self-start rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-sm"
	>
		<ThemeSelector />

		<div class="flex items-center gap-2 rounded-sm px-3 py-1.5 hover:bg-surface-100-900">
			<span class="text-sm font-medium text-surface-950-50 select-none">Dark mode</span>
			<Switch.Root
				checked={themeController.isDark}
				onCheckedChange={(v: boolean) => themeController.setMode(v ? 'dark' : 'light')}
				class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-surface-300-700 bg-surface-300-700 transition-colors outline-none data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-500"
			>
				<Switch.Thumb
					class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4.5"
				/>
			</Switch.Root>
		</div>
	</Menubar.Root>

	<h1 class="text-2xl font-bold">Welcome to SvelteKit</h1>
	<p>
		Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation
	</p>
	<a href={resolve('/reader')} class="anchor">reader</a>
</div>
