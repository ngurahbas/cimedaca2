import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { llmController, DEFAULT_BASE_URL } from '$lib/stores/llm.svelte';
import { LlmError } from '$lib/llm/types';

function makeResponse(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function resetController(): void {
	llmController.baseUrl = DEFAULT_BASE_URL;
	llmController.apiKey = undefined;
	llmController.model = '';
	llmController.availableModels = [];
	llmController.loadedFromStorage = false;
}

describe('llmController', () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, 'fetch');
		resetController();
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it('verify updates state and selects the first model on success', async () => {
		fetchSpy.mockResolvedValue(
			makeResponse(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }))
		);

		const ids = await llmController.verify('http://localhost:1234/v1', 'key');

		expect(ids).toEqual(['model-a', 'model-b']);
		expect(llmController.baseUrl).toBe('http://localhost:1234/v1');
		expect(llmController.apiKey).toBe('key');
		expect(llmController.availableModels).toEqual(['model-a', 'model-b']);
		expect(llmController.model).toBe('model-a');
	});

	it('verify normalizes a trailing slash on baseUrl', async () => {
		fetchSpy.mockResolvedValue(makeResponse(JSON.stringify({ data: [{ id: 'm' }] })));

		await llmController.verify('http://localhost:1234/v1/');

		expect(llmController.baseUrl).toBe('http://localhost:1234/v1');
	});

	it('verify clears an empty apiKey to undefined', async () => {
		fetchSpy.mockResolvedValue(makeResponse(JSON.stringify({ data: [{ id: 'm' }] })));

		await llmController.verify('http://localhost:1234/v1', '');

		expect(llmController.apiKey).toBeUndefined();
	});

	it('verify keeps the current model when it is still available', async () => {
		llmController.model = 'model-b';
		fetchSpy.mockResolvedValue(
			makeResponse(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }))
		);

		await llmController.verify('http://localhost:1234/v1');

		expect(llmController.model).toBe('model-b');
	});

	it('verify does not change state on failure', async () => {
		llmController.baseUrl = 'http://existing.com/v1';
		llmController.apiKey = 'existing';
		llmController.model = 'existing-model';
		llmController.availableModels = ['existing-model'];

		fetchSpy.mockResolvedValue(makeResponse('{"error":{"message":"unauthorized"}}', 401));

		await expect(llmController.verify('http://new.com/v1', 'new-key')).rejects.toBeInstanceOf(
			LlmError
		);

		expect(llmController.baseUrl).toBe('http://existing.com/v1');
		expect(llmController.apiKey).toBe('existing');
		expect(llmController.model).toBe('existing-model');
		expect(llmController.availableModels).toEqual(['existing-model']);
	});

	it('setModel updates the selected model', async () => {
		fetchSpy.mockResolvedValue(
			makeResponse(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }))
		);
		await llmController.verify('http://localhost:1234/v1');

		llmController.setModel('model-b');

		expect(llmController.model).toBe('model-b');
	});

	it('clear resets all state', async () => {
		fetchSpy.mockResolvedValue(makeResponse(JSON.stringify({ data: [{ id: 'm' }] })));
		await llmController.verify('http://localhost:1234/v1', 'key');
		llmController.setModel('m');
		llmController.loadedFromStorage = true;

		llmController.clear();

		expect(llmController.baseUrl).toBe(DEFAULT_BASE_URL);
		expect(llmController.apiKey).toBeUndefined();
		expect(llmController.model).toBe('');
		expect(llmController.availableModels).toEqual([]);
		expect(llmController.loadedFromStorage).toBe(false);
	});

	it('refresh re-fetches using the current baseUrl and apiKey', async () => {
		fetchSpy.mockResolvedValue(makeResponse(JSON.stringify({ data: [{ id: 'm' }] })));
		await llmController.verify('http://localhost:1234/v1', 'key');
		fetchSpy.mockClear();
		fetchSpy.mockResolvedValue(makeResponse(JSON.stringify({ data: [{ id: 'm' }] })));

		await llmController.refresh();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const url = fetchSpy.mock.calls[0][0] as string;
		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(url).toBe('http://localhost:1234/v1/models');
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe('Bearer key');
	});
});
