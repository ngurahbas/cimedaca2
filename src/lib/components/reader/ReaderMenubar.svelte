<script lang="ts">
	import { Menubar } from 'bits-ui';
	import { themeController } from '$lib/stores/theme.svelte';
	import { readerController } from '$lib/stores/reader.svelte';
	import ThemeSelector from '../ThemeSelector.svelte';
	import SwitchRow from './SwitchRow.svelte';
</script>

<Menubar.Root
	class="inline-flex items-center gap-1 self-start rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-sm"
>
	<Menubar.Menu>
		<Menubar.Trigger
			class="flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[state=open]:bg-surface-100-900"
		>
			File
		</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content
				class="z-50 min-w-[10rem] rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-md"
				align="start"
				sideOffset={6}
			>
				<Menubar.Item
					onSelect={() => readerController.openPdfDialog()}
					class="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm text-surface-950-50 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-100-900"
				>
					Open…
				</Menubar.Item>
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>

	<Menubar.Menu>
		<Menubar.Trigger
			class="flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[state=open]:bg-surface-100-900"
		>
			View
		</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content
				class="z-50 min-w-[12rem] rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-md"
				align="start"
				sideOffset={6}
			>
				<SwitchRow
					label="Navigation pane"
					checked={readerController.showNav}
					onCheckedChange={(v) => (readerController.showNav = v)}
				/>
				<SwitchRow
					label="AI pane"
					checked={readerController.showAi}
					onCheckedChange={(v) => (readerController.showAi = v)}
				/>
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>

	<ThemeSelector />

	<SwitchRow
		label="Dark mode"
		checked={themeController.isDark}
		onCheckedChange={(v) => themeController.setMode(v ? 'dark' : 'light')}
	/>
</Menubar.Root>
