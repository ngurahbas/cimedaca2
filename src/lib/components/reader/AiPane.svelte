<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import { readerController } from '$lib/stores/reader.svelte';
	import SidePane from './SidePane.svelte';
	import AiSettings from './AiSettings.svelte';
</script>

<SidePane
	side="right"
	open={readerController.showAi}
	onOpenChange={(v) => (readerController.showAi = v)}
	width={readerController.aiPaneWidth}
	setWidth={readerController.setAiPaneWidth}
	paneTitle="AI"
	ariaLabel="AI"
>
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="shrink-0 p-3">
			<AiSettings />
		</div>
		<div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
			<Bot class="h-10 w-10 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
			<div class="space-y-1">
				<h3 class="text-sm font-semibold text-surface-950-50">AI Pane</h3>
				<p class="text-xs opacity-70">Conversation features are coming soon.</p>
			</div>
		</div>
	</div>
</SidePane>
