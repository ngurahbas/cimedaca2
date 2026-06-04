<script lang="ts">
	import { Menubar } from 'bits-ui';
	import { themeController, THEMES, type Theme } from '$lib/stores/theme.svelte';

	const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<Menubar.Menu>
	<Menubar.Trigger
		class="flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[state=open]:bg-surface-100-900"
	>
		Theme
	</Menubar.Trigger>
	<Menubar.Portal>
		<Menubar.Content
			class="z-50 min-w-[10rem] rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-md"
			align="start"
			sideOffset={6}
		>
			<Menubar.RadioGroup
				value={themeController.theme}
				onValueChange={(v: string) => themeController.setTheme(v as Theme)}
				class="max-h-80 overflow-y-auto"
			>
				{#each THEMES as t (t)}
					<Menubar.RadioItem
						value={t}
						class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-surface-950-50 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-100-900"
					>
						{#snippet children({ checked })}
							<span
								class="flex h-3.5 w-3.5 items-center justify-center text-primary-500"
								aria-hidden="true"
							>
								{#if checked}✓{/if}
							</span>
							{capitalize(t)}
						{/snippet}
					</Menubar.RadioItem>
				{/each}
			</Menubar.RadioGroup>
		</Menubar.Content>
	</Menubar.Portal>
</Menubar.Menu>
