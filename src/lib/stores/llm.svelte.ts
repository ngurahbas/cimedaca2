import { browser } from '$app/environment';
import { type LlmSettings } from '$lib/llm/types';
import { listModels } from '$lib/llm/client';

const STORAGE_KEY = 'llm-settings';
export const DEFAULT_BASE_URL = 'http://localhost:1234/v1';

function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

function readStoredSettings(): Partial<LlmSettings> | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== 'object' || parsed === null) return null;
		return parsed as Partial<LlmSettings>;
	} catch {
		return null;
	}
}

class LlmController {
	baseUrl = $state<string>(DEFAULT_BASE_URL);
	apiKey = $state<string | undefined>(undefined);
	model = $state<string>('');
	availableModels = $state<string[]>([]);
	loadedFromStorage = $state(false);

	isConfigured = $derived(this.model.length > 0);

	constructor() {
		this.load();
	}

	async verify(baseUrl: string, apiKey?: string, signal?: AbortSignal): Promise<string[]> {
		const normalized = normalizeBaseUrl(baseUrl);
		const ids = await listModels({ baseUrl: normalized, apiKey, signal });
		this.baseUrl = normalized;
		this.apiKey = apiKey && apiKey.length > 0 ? apiKey : undefined;
		this.availableModels = ids;
		if (ids.length > 0 && (this.model.length === 0 || !ids.includes(this.model))) {
			this.model = ids[0];
		}
		this.persist();
		return ids;
	}

	async refresh(signal?: AbortSignal): Promise<string[]> {
		return this.verify(this.baseUrl, this.apiKey, signal);
	}

	setModel(model: string): void {
		this.model = model;
		if (this.availableModels.length > 0) this.persist();
	}

	clear(): void {
		this.baseUrl = DEFAULT_BASE_URL;
		this.apiKey = undefined;
		this.model = '';
		this.availableModels = [];
		this.loadedFromStorage = false;
		this.persist();
	}

	asSettings(): LlmSettings | null {
		if (!this.isConfigured) return null;
		const settings: LlmSettings = { baseUrl: this.baseUrl, model: this.model };
		if (this.apiKey !== undefined) settings.apiKey = this.apiKey;
		return settings;
	}

	private load(): void {
		const stored = readStoredSettings();
		if (!stored) return;
		if (typeof stored.baseUrl === 'string' && stored.baseUrl.length > 0) {
			this.baseUrl = normalizeBaseUrl(stored.baseUrl);
		}
		if (typeof stored.apiKey === 'string' && stored.apiKey.length > 0) {
			this.apiKey = stored.apiKey;
		}
		if (typeof stored.model === 'string' && stored.model.length > 0) {
			this.model = stored.model;
		}
		this.loadedFromStorage = true;
	}

	private persist(): void {
		if (!browser) return;
		try {
			const payload: LlmSettings = { baseUrl: this.baseUrl, model: this.model };
			if (this.apiKey !== undefined) payload.apiKey = this.apiKey;
			localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
		} catch {
			// ignore quota / privacy-mode errors
		}
	}
}

export const llmController = new LlmController();
