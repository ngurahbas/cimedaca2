<script lang="ts">
	import { Menubar, Switch } from 'bits-ui';
	import { themeController, THEMES, type Theme } from '$lib/stores/theme.svelte';

	const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<Menubar.Root
	class="inline-flex items-center gap-1 self-start rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-sm"
>
	<Menubar.Menu>
		<Menubar.Trigger
			class="flex items-center justify-center rounded px-3 py-1.5 text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[state=open]:bg-surface-100-900"
		>
			Theme
		</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content
				class="z-50 min-w-[10rem] rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-md"
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
							class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-surface-950-50 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-100-900"
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

	<Menubar.Menu>
		<Menubar.Trigger
			class="flex items-center justify-center rounded px-3 py-1.5 text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[state=open]:bg-surface-100-900"
		>
			Appearance
		</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content
				class="z-50 min-w-[12rem] rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-md"
				sideOffset={6}
			>
				<Menubar.Group>
					<Menubar.GroupHeading
						class="px-2 py-1.5 text-xs font-semibold tracking-wide text-surface-700-300 uppercase"
					>
						Mode
					</Menubar.GroupHeading>
					<div class="flex items-center justify-between gap-2 px-2 py-1.5">
						<span class="text-sm text-surface-950-50">Dark mode</span>
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
				</Menubar.Group>
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>
</Menubar.Root>
