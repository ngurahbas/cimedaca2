import { browser } from '$app/environment';
import { LlmError, type LlmSettings } from '$lib/llm/types';
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

	isConfigured = $derived(this.model.length > 0);

	constructor() {
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
	}

	setBaseUrl(url: string): void {
		this.baseUrl = normalizeBaseUrl(url);
		this.persist();
	}

	setApiKey(key: string | undefined): void {
		this.apiKey = key && key.length > 0 ? key : undefined;
		this.persist();
	}

	setModel(model: string): void {
		this.model = model;
		this.persist();
	}

	clear(): void {
		this.baseUrl = DEFAULT_BASE_URL;
		this.apiKey = undefined;
		this.model = '';
		this.persist();
	}

	asSettings(): LlmSettings | null {
		if (!this.isConfigured) return null;
		const settings: LlmSettings = { baseUrl: this.baseUrl, model: this.model };
		if (this.apiKey !== undefined) settings.apiKey = this.apiKey;
		return settings;
	}

	async refreshModels(signal?: AbortSignal): Promise<string[]> {
		try {
			const params: { baseUrl: string; apiKey?: string; signal?: AbortSignal } = {
				baseUrl: this.baseUrl
			};
			if (this.apiKey !== undefined) params.apiKey = this.apiKey;
			if (signal !== undefined) params.signal = signal;
			const ids = await listModels(params);
			if (ids.length > 0 && this.model.length === 0) {
				this.setModel(ids[0]);
			}
			return ids;
		} catch (err) {
			if (err instanceof LlmError) return [];
			throw err;
		}
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
