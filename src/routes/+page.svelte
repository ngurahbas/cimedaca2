<script lang="ts">
	import ThemeMenu from '$lib/components/ThemeMenu.svelte';
	import { resolve } from '$app/paths';
</script>

<div class="flex flex-col gap-6 p-6">
	<ThemeMenu />

	<h1 class="text-2xl font-bold">Welcome to SvelteKit</h1>
	<p>
		Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation
	</p>
	<a href={resolve('/reader')} class="anchor">reader</a>
</div>
