import { parseSseChatStream } from './sse';
import { LlmError, type ChatMessage, type LlmSettings, type StreamChatRequest } from './types';

export type { ChatDelta, ChatMessage, LlmSettings, StreamChatRequest } from './types';
export { LlmError } from './types';
export { parseSseChatStream } from './sse';

function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

type Auth = { baseUrl: string; apiKey?: string };

function buildHeaders(auth: Auth): Record<string, string> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (auth.apiKey && auth.apiKey.length > 0) {
		headers.Authorization = `Bearer ${auth.apiKey}`;
	}
	return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
	try {
		const text = await response.text();
		if (text.length === 0) return `HTTP ${response.status}`;
		try {
			const obj = JSON.parse(text) as { error?: { message?: string }; message?: string };
			const message = obj.error?.message ?? obj.message;
			if (typeof message === 'string' && message.length > 0) return message;
		} catch {
			// fall through
		}
		return text;
	} catch {
		return `HTTP ${response.status}`;
	}
}

async function llmFetch(
	path: string,
	auth: Auth,
	init: RequestInit & { signal?: AbortSignal }
): Promise<Response> {
	const url = `${normalizeBaseUrl(auth.baseUrl)}${path}`;
	const headers = {
		...buildHeaders(auth),
		...(init.headers as Record<string, string> | undefined)
	};
	const response = await fetch(url, { ...init, headers });
	if (!response.ok) {
		const message = await readErrorMessage(response);
		throw new LlmError(message, { status: response.status });
	}
	return response;
}

export type ListModelsRequest = Auth & { signal?: AbortSignal };

export async function listModels(settings: ListModelsRequest): Promise<string[]> {
	const response = await llmFetch('/models', settings, {
		method: 'GET',
		signal: settings.signal
	});
	const body = (await response.json()) as { data?: Array<{ id?: string }> };
	if (!body.data || !Array.isArray(body.data)) {
		throw new LlmError('Malformed /v1/models response: missing "data" array', {
			code: 'malformed_models'
		});
	}
	const ids: string[] = [];
	for (const entry of body.data) {
		if (typeof entry.id === 'string' && entry.id.length > 0) ids.push(entry.id);
	}
	return ids;
}

export type ChatCompletionRequest = LlmSettings & {
	messages: ChatMessage[];
	signal?: AbortSignal;
	temperature?: number;
};

export type ChatCompletionResult = {
	content: string;
	reasoningContent?: string;
	finishReason: string | null;
};

export async function chat(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
	const { baseUrl, apiKey, model, messages, signal, temperature } = req;
	const response = await llmFetch(
		'/chat/completions',
		{ baseUrl, apiKey },
		{
			method: 'POST',
			body: JSON.stringify({
				model,
				messages,
				stream: false,
				...(temperature !== undefined ? { temperature } : {})
			}),
			signal
		}
	);

	const body = (await response.json()) as {
		choices?: Array<{
			message?: { content?: string | null; reasoning_content?: string | null };
			finish_reason?: string | null;
		}>;
	};
	const choice = body.choices?.[0];
	if (!choice) {
		throw new LlmError('Malformed /v1/chat/completions response: missing choices[0]', {
			code: 'malformed_chat'
		});
	}
	const content = choice.message?.content ?? '';
	const reasoningContent = choice.message?.reasoning_content ?? undefined;
	return {
		content,
		...(reasoningContent !== undefined ? { reasoningContent } : {}),
		finishReason: choice.finish_reason ?? null
	};
}

export async function streamChat(req: StreamChatRequest): Promise<void> {
	const { baseUrl, apiKey, model, messages, onDelta, signal, temperature } = req;
	const response = await llmFetch(
		'/chat/completions',
		{ baseUrl, apiKey },
		{
			method: 'POST',
			body: JSON.stringify({
				model,
				messages,
				stream: true,
				...(temperature !== undefined ? { temperature } : {})
			}),
			signal
		}
	);

	if (!response.body) {
		throw new LlmError('Streaming response has no body', { code: 'no_body' });
	}

	await parseSseChatStream(response.body, onDelta, signal);
}
