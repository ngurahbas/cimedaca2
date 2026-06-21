<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import FileText from '@lucide/svelte/icons/file-text';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import { readerController } from '$lib/stores/reader.svelte';
	import SidePane from './SidePane.svelte';
	import AiSettings from './AiSettings.svelte';

	const extracted = $derived(readerController.extracted);
	const extractionError = $derived(readerController.extractionError);
	const loadError = $derived(readerController.loadError);

	const sectionCount = $derived(countSections(extracted?.tree ?? []));
	const topTitles = $derived((extracted?.tree ?? []).slice(0, 5).map((n) => n.title));

	function countSections(nodes: { children: unknown[] }[]): number {
		let total = 0;
		for (const n of nodes) {
			total += 1 + countSections(n.children as { children: unknown[] }[]);
		}
		return total;
	}
</script>

<SidePane
	side="right"
	open={readerController.showAi}
	onOpenChange={(v) => (readerController.showAi = v)}
	width={readerController.aiPaneWidth}
	setWidth={(w) => readerController.setAiPaneWidth(w)}
	paneTitle="AI"
	ariaLabel="AI"
>
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="shrink-0 p-3">
			<AiSettings />
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-3 p-4 text-sm text-surface-950-50">
			{#if readerController.doc === null}
				<div class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
					<Bot class="h-10 w-10 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
					<div class="space-y-1">
						<h3 class="text-sm font-semibold text-surface-950-50">AI Pane</h3>
						<p class="text-xs opacity-70">Open a PDF to start.</p>
					</div>
				</div>
			{:else if loadError}
				<div class="flex flex-col gap-2 card border border-error-500 preset-tonal-surface p-4">
					<div class="flex items-center gap-1.5 text-error-500">
						<AlertCircle class="h-4 w-4 shrink-0" />
						<span class="text-sm font-semibold">Failed to render PDF</span>
					</div>
					<p class="text-xs opacity-80">{loadError}</p>
				</div>
			{:else if extractionError}
				<div class="flex flex-col gap-2 card border border-error-500 preset-tonal-surface p-4">
					<div class="flex items-center gap-1.5 text-error-500">
						<AlertCircle class="h-4 w-4 shrink-0" />
						<span class="text-sm font-semibold">Extraction failed</span>
					</div>
					<p class="text-xs opacity-80">{extractionError}</p>
				</div>
			{:else if !extracted}
				<div class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
					<div
						class="h-8 w-8 animate-spin rounded-full border-2 border-surface-300-700 border-t-primary-500"
						aria-hidden="true"
					></div>
					<div class="space-y-1">
						<h3 class="text-sm font-semibold text-surface-950-50">AI Pane</h3>
						<p class="text-xs opacity-70">Extracting structure…</p>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					<div class="flex items-center gap-2">
						<Bot class="h-5 w-5 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
						<h3 class="text-sm font-semibold text-surface-950-50">AI Pane</h3>
					</div>
					<div
						class="flex flex-col gap-1.5 card border border-surface-200-800 preset-tonal-surface p-3"
					>
						<div class="flex items-center gap-2 text-xs">
							<FileText class="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
							<span class="font-medium">
								Extracted: {sectionCount}
								{sectionCount === 1 ? 'section' : 'sections'} ·
								{extracted.byPage.length}
								{extracted.byPage.length === 1 ? 'page' : 'pages'}
							</span>
						</div>
						{#if topTitles.length > 0}
							<p class="text-xs opacity-70" title={topTitles.join(' / ')}>
								{topTitles.join(' / ')}{sectionCount > topTitles.length ? ' / …' : ''}
							</p>
						{/if}
					</div>
					<p class="text-xs opacity-60">
						Conversation features are coming soon — the extracted structure is ready to feed to an
						LLM.
					</p>
				</div>
			{/if}
		</div>
	</div>
</SidePane>
