<script lang="ts">
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	const themes = [
		{ id: 'catppuccin', label: 'Catppuccin' },
		{ id: 'cerberus', label: 'Cerberus' },
		{ id: 'concord', label: 'Concord' },
		{ id: 'crimson', label: 'Crimson' },
		{ id: 'fennec', label: 'Fennec' },
		{ id: 'hamlindigo', label: 'Hamlindigo' },
		{ id: 'legacy', label: 'Legacy' },
		{ id: 'mint', label: 'Mint' },
		{ id: 'modern', label: 'Modern' },
		{ id: 'mona', label: 'Mona' },
		{ id: 'nosh', label: 'Nosh' },
		{ id: 'nouveau', label: 'Nouveau' },
		{ id: 'pine', label: 'Pine' },
		{ id: 'reign', label: 'Reign' },
		{ id: 'rocket', label: 'Rocket' },
		{ id: 'rose', label: 'Rose' },
		{ id: 'sahara', label: 'Sahara' },
		{ id: 'seafoam', label: 'Seafoam' },
		{ id: 'terminus', label: 'Terminus' },
		{ id: 'vintage', label: 'Vintage' },
		{ id: 'vox', label: 'Vox' },
		{ id: 'wintry', label: 'Wintry' }
	];

	let selectedTheme = $state('modern');
	let darkMode = $state(false);

	$effect(() => {
		selectedTheme = localStorage.getItem('theme') || 'modern';
		darkMode = (localStorage.getItem('mode') || 'light') === 'dark';
	});

	function onThemeChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const theme = target.value;
		selectedTheme = theme;
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}

	function onModeChange(e: { checked: boolean }) {
		const mode = e.checked ? 'dark' : 'light';
		darkMode = e.checked;
		document.documentElement.setAttribute('data-mode', mode);
		localStorage.setItem('mode', mode);
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-1">
		<label for="theme-select" class="text-sm font-medium">Theme</label>
		<select
			id="theme-select"
			value={selectedTheme}
			onchange={onThemeChange}
			class="w-48 rounded border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
		>
			{#each themes as theme (theme.id)}
				<option value={theme.id}>{theme.label}</option>
			{/each}
		</select>
	</div>
	<div class="flex items-center gap-3">
		<span class="text-sm font-medium">Dark Mode</span>
		<Switch checked={darkMode} onCheckedChange={onModeChange}>
			<Switch.Control>
				<Switch.Thumb />
			</Switch.Control>
			<Switch.HiddenInput />
		</Switch>
	</div>
</div>
