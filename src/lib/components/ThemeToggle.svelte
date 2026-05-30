<script lang="ts">
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	let checked = $state(false);

	$effect(() => {
		const theme = localStorage.getItem('theme') || 'modern';
		checked = theme === 'vox';
	});

	function onCheckedChange(e: { checked: boolean }) {
		const theme = e.checked ? 'vox' : 'modern';
		const mode = e.checked ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', theme);
		document.documentElement.setAttribute('data-mode', mode);
		localStorage.setItem('theme', theme);
		checked = e.checked;
	}
</script>

<Switch {checked} {onCheckedChange}>
	<Switch.Control>
		<Switch.Thumb />
	</Switch.Control>
	<Switch.HiddenInput />
</Switch>
