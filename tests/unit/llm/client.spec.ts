import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chat, listModels, LlmError, streamChat } from '$lib/llm/client';
import { parseSseChatStream } from '$lib/llm/sse';

const FIXTURE_DIR = new URL('../../fixtures/llm/', import.meta.url);
const CHAT_STREAM_FIXTURE = readFileSync(new URL('chat-stream.sse', FIXTURE_DIR), 'utf8');
const MODELS_FIXTURE = readFileSync(new URL('models.json', FIXTURE_DIR), 'utf8');

function streamFromString(s: string): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(s));
			controller.close();
		}
	});
}

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const c of chunks) controller.enqueue(encoder.encode(c));
			controller.close();
		}
	});
}

function makeResponse(
	body: string,
	init: { status?: number; headers?: Record<string, string> } = {}
): Response {
	return new Response(body, {
		status: init.status ?? 200,
		headers: init.headers ?? { 'Content-Type': 'application/json' }
	});
}

function makeStreamResponse(body: ReadableStream<Uint8Array>, status = 200): Response {
	return new Response(body, {
		status,
		headers: { 'Content-Type': 'text/event-stream' }
	});
}

const EXPECTED_REASONING = 'The user said "hi".\nThe user is initiating a conversation.\n\n    *';

describe('parseSseChatStream', () => {
	it('parses the captured fixture byte-for-byte', async () => {
		const deltas: Array<{
			content?: string;
			reasoningContent?: string;
			finishReason?: string | null;
		}> = [];
		await parseSseChatStream(streamFromString(CHAT_STREAM_FIXTURE), (d) => deltas.push(d));

		const content = deltas.map((d) => d.content ?? '').join('');
		const reasoning = deltas.map((d) => d.reasoningContent ?? '').join('');
		const lastFinish = deltas.length > 0 ? deltas[deltas.length - 1].finishReason : undefined;

		expect(reasoning).toBe(EXPECTED_REASONING);
		expect(content).toBe('');
		expect(lastFinish).toBe('length');
		expect(deltas.length).toBe(18);
	});

	it('reassembles lines split across chunk boundaries', async () => {
		const sse =
			'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n' +
			'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
			'data: [DONE]\n\n';

		const splitAt = 17;
		const chunks = [sse.slice(0, splitAt), sse.slice(splitAt)];

		const collected: string[] = [];
		await parseSseChatStream(streamFromChunks(chunks), (d) => {
			if (d.content) collected.push(d.content);
		});
		expect(collected.join('')).toBe('hello');
	});

	it('rejects with AbortError when the signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(
			parseSseChatStream(streamFromString(CHAT_STREAM_FIXTURE), () => {}, controller.signal)
		).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('rejects with LlmError on malformed JSON', async () => {
		const bad = 'data: {not json}\n\n';
		await expect(parseSseChatStream(streamFromString(bad), () => {})).rejects.toBeInstanceOf(
			LlmError
		);
	});

	it('skips the role-only first chunk', async () => {
		const sse =
			'data: {"choices":[{"delta":{"role":"assistant","content":null}}]}\n\n' +
			'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n' +
			'data: [DONE]\n\n';
		const collected: string[] = [];
		await parseSseChatStream(streamFromString(sse), (d) => {
			if (d.content) collected.push(d.content);
		});
		expect(collected).toEqual(['hi']);
	});
});

describe('listModels', () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, 'fetch');
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it('returns ids from the captured /v1/models fixture', async () => {
		fetchSpy.mockResolvedValue(makeResponse(MODELS_FIXTURE));

		const ids = await listModels({ baseUrl: 'http://localhost:1234/v1' });

		expect(ids).toEqual(['unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL']);
	});

	it('throws LlmError with status on 401', async () => {
		fetchSpy.mockResolvedValue(
			makeResponse('{"error":{"message":"unauthorized"}}', { status: 401 })
		);

		await expect(listModels({ baseUrl: 'http://localhost:1234/v1' })).rejects.toMatchObject({
			name: 'LlmError',
			status: 401,
			message: 'unauthorized'
		});
	});

	it('throws LlmError on malformed models response', async () => {
		fetchSpy.mockResolvedValue(makeResponse('{"object":"list"}'));

		await expect(listModels({ baseUrl: 'http://localhost:1234/v1' })).rejects.toBeInstanceOf(
			LlmError
		);
	});

	it('omits the Authorization header when no apiKey is set', async () => {
		fetchSpy.mockResolvedValue(makeResponse(MODELS_FIXTURE));
		await listModels({ baseUrl: 'http://localhost:1234/v1' });

		const url = fetchSpy.mock.calls[0][0] as string;
		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(url).toBe('http://localhost:1234/v1/models');
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBeUndefined();
		expect(headers['Content-Type']).toBe('application/json');
	});

	it('sends Authorization Bearer when apiKey is set', async () => {
		fetchSpy.mockResolvedValue(makeResponse(MODELS_FIXTURE));
		await listModels({ baseUrl: 'http://localhost:1234/v1', apiKey: 'test-key' });

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe('Bearer test-key');
	});

	it('normalizes a trailing slash on baseUrl', async () => {
		fetchSpy.mockResolvedValue(makeResponse(MODELS_FIXTURE));
		await listModels({ baseUrl: 'http://localhost:1234/v1/' });

		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toBe('http://localhost:1234/v1/models');
	});
});

describe('streamChat', () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, 'fetch');
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it('invokes onDelta for each captured chunk and resolves on stream end', async () => {
		fetchSpy.mockResolvedValue(makeStreamResponse(streamFromString(CHAT_STREAM_FIXTURE)));

		const deltas: Array<{
			content?: string;
			reasoningContent?: string;
			finishReason?: string | null;
		}> = [];
		await streamChat({
			baseUrl: 'http://localhost:1234/v1',
			model: 'unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL',
			messages: [{ role: 'user', content: 'hi' }],
			onDelta: (d) => deltas.push(d)
		});

		const reasoning = deltas.map((d) => d.reasoningContent ?? '').join('');
		expect(reasoning).toBe(EXPECTED_REASONING);
		expect(deltas.length).toBe(18);
	});

	it('rejects with LlmError on non-2xx response', async () => {
		fetchSpy.mockResolvedValue(
			makeResponse('{"error":{"message":"server boom"}}', { status: 500 })
		);

		await expect(
			streamChat({
				baseUrl: 'http://localhost:1234/v1',
				model: 'm',
				messages: [{ role: 'user', content: 'hi' }],
				onDelta: () => {}
			})
		).rejects.toMatchObject({ name: 'LlmError', status: 500, message: 'server boom' });
	});

	it('sends stream:true and the model/messages in the request body', async () => {
		fetchSpy.mockResolvedValue(makeStreamResponse(streamFromString(CHAT_STREAM_FIXTURE)));

		await streamChat({
			baseUrl: 'http://localhost:1234/v1',
			model: 'unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL',
			messages: [
				{ role: 'system', content: 'be terse' },
				{ role: 'user', content: 'hi' }
			],
			onDelta: () => {}
		});

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		const body = JSON.parse(String(init.body));
		expect(body.stream).toBe(true);
		expect(body.model).toBe('unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL');
		expect(body.messages).toEqual([
			{ role: 'system', content: 'be terse' },
			{ role: 'user', content: 'hi' }
		]);
	});
});

describe('chat (non-streaming)', () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, 'fetch');
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it('returns content, reasoningContent, and finishReason', async () => {
		fetchSpy.mockResolvedValue(
			makeResponse(
				JSON.stringify({
					choices: [
						{
							message: {
								role: 'assistant',
								content: 'hello',
								reasoning_content: 'thinking'
							},
							finish_reason: 'stop'
						}
					]
				})
			)
		);

		const result = await chat({
			baseUrl: 'http://localhost:1234/v1',
			model: 'm',
			messages: [{ role: 'user', content: 'hi' }]
		});

		expect(result).toEqual({
			content: 'hello',
			reasoningContent: 'thinking',
			finishReason: 'stop'
		});
	});

	it('throws LlmError when choices[0] is missing', async () => {
		fetchSpy.mockResolvedValue(makeResponse(JSON.stringify({ choices: [] })));

		await expect(
			chat({ baseUrl: 'http://localhost:1234/v1', model: 'm', messages: [] })
		).rejects.toBeInstanceOf(LlmError);
	});
});
