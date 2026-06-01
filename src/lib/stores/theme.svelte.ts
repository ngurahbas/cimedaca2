import { browser } from '$app/environment';

export const THEMES = [
	'catppuccin',
	'cerberus',
	'concord',
	'crimson',
	'fennec',
	'hamlindigo',
	'legacy',
	'mint',
	'modern',
	'mona',
	'nosh',
	'nouveau',
	'pine',
	'reign',
	'rocket',
	'rose',
	'sahara',
	'seafoam',
	'terminus',
	'vintage',
	'vox',
	'wintry'
] as const;

export type Theme = (typeof THEMES)[number];
export type Mode = 'light' | 'dark';

const THEME_KEY = 'theme';
const MODE_KEY = 'mode';
const VALID_THEMES: ReadonlySet<Theme> = new Set(THEMES);
const VALID_MODES: readonly Mode[] = ['light', 'dark'];

function isTheme(value: string | null): value is Theme {
	return value !== null && VALID_THEMES.has(value as Theme);
}

function isMode(value: string | null): value is Mode {
	return value !== null && (VALID_MODES as readonly string[]).includes(value);
}

class ThemeController {
	theme = $state<Theme>('modern');
	mode = $state<Mode>('light');

	constructor() {
		if (!browser) return;
		const storedTheme = localStorage.getItem(THEME_KEY);
		const storedMode = localStorage.getItem(MODE_KEY);
		if (isTheme(storedTheme)) this.theme = storedTheme;
		if (isMode(storedMode)) this.mode = storedMode;
	}

	get isDark(): boolean {
		return this.mode === 'dark';
	}

	setTheme(value: Theme): void {
		this.theme = value;
		this.persist(THEME_KEY, value);
		this.applyAttribute('data-theme', value);
	}

	setMode(value: Mode): void {
		this.mode = value;
		this.persist(MODE_KEY, value);
		this.applyAttribute('data-mode', value);
	}

	toggleMode(): void {
		this.setMode(this.mode === 'dark' ? 'light' : 'dark');
	}

	private persist(key: string, value: string): void {
		if (!browser) return;
		try {
			localStorage.setItem(key, value);
		} catch {
			// ignore quota / privacy-mode errors
		}
	}

	private applyAttribute(name: string, value: string): void {
		if (!browser) return;
		document.documentElement.setAttribute(name, value);
	}
}

export const themeController = new ThemeController();
