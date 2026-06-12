<script lang="ts">
	import { Menubar, Switch } from 'bits-ui';
	import { themeController } from '$lib/stores/theme.svelte';
	import { readerController, type PdfEngine } from '$lib/stores/reader.svelte';
	import ThemeMenuMenu from '../ThemeMenuMenu.svelte';

	let fileInput: HTMLInputElement | undefined = $state();

	async function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			await readerController.openPdfFile(file);
		}
		input.value = '';
	}
</script>

<Menubar.Root
	class="inline-flex items-center gap-1 self-start rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-sm"
>
	<input
		bind:this={fileInput}
		type="file"
		accept="application/pdf"
		class="hidden"
		onchange={handleFileChange}
	/>

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
					onSelect={() => fileInput?.click()}
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
				{#if readerController.pdfEngine === 'pdfjs'}
					<div
						class="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm text-surface-950-50 select-none"
					>
						<span>Navigation pane</span>
						<Switch.Root
							checked={readerController.showNav}
							onCheckedChange={(v: boolean) => (readerController.showNav = v)}
							class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-surface-300-700 bg-surface-300-700 transition-colors outline-none data-[disabled]:cursor-not-allowed data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-500"
						>
							<Switch.Thumb
								class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4.5"
							/>
						</Switch.Root>
					</div>
				{/if}
				<div
					class="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm text-surface-950-50 select-none"
				>
					<span>AI pane</span>
					<Switch.Root
						checked={readerController.showAi}
						onCheckedChange={(v: boolean) => (readerController.showAi = v)}
						class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-surface-300-700 bg-surface-300-700 transition-colors outline-none data-[disabled]:cursor-not-allowed data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-500"
					>
						<Switch.Thumb
							class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4.5"
						/>
					</Switch.Root>
				</div>
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>

	<Menubar.Menu>
		<Menubar.Trigger
			class="flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium text-surface-950-50 outline-none select-none hover:bg-surface-100-900 focus-visible:bg-surface-100-900 data-[state=open]:bg-surface-100-900"
		>
			Engine
		</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content
				class="z-50 min-w-[10rem] rounded-md border border-surface-200-800 bg-surface-50-950 p-1 shadow-md"
				align="start"
				sideOffset={6}
			>
				<Menubar.RadioGroup
					value={readerController.pdfEngine}
					onValueChange={(v: string) => readerController.setPdfEngine(v as PdfEngine)}
				>
					<Menubar.RadioItem
						value="pdfjs"
						class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-surface-950-50 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-100-900"
					>
						{#snippet children({ checked })}
							<span
								class="flex h-3.5 w-3.5 items-center justify-center text-primary-500"
								aria-hidden="true"
							>
								{#if checked}✓{/if}
							</span>
							pdfjs-dist
						{/snippet}
					</Menubar.RadioItem>
					<Menubar.RadioItem
						value="pdfium"
						class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-surface-950-50 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-100-900"
					>
						{#snippet children({ checked })}
							<span
								class="flex h-3.5 w-3.5 items-center justify-center text-primary-500"
								aria-hidden="true"
							>
								{#if checked}✓{/if}
							</span>
							PDFium
						{/snippet}
					</Menubar.RadioItem>
				</Menubar.RadioGroup>
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>

	<ThemeMenuMenu />

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
