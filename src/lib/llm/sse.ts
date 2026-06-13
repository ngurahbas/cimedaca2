import { LlmError, type ChatDelta } from './types';

type SseEvent = {
	role?: string;
	content?: string | null;
	reasoning_content?: string | null;
	finish_reason?: string | null;
};

type SseChunk = {
	choices?: Array<{
		delta?: SseEvent;
		finish_reason?: string | null;
	}>;
};

function buildAbortError(): Error {
	if (typeof DOMException !== 'undefined') {
		return new DOMException('Aborted', 'AbortError');
	}
	const err = new Error('Aborted');
	err.name = 'AbortError';
	return err;
}

function isAborted(signal: AbortSignal | undefined): boolean {
	return signal?.aborted === true;
}

function toStr(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (value === null || value === undefined) return undefined;
	return String(value);
}

function toFinishReason(
	delta: SseEvent,
	choice: { finish_reason?: string | null } | undefined
): string | null | undefined {
	if (delta.finish_reason !== undefined) {
		return delta.finish_reason === null ? null : String(delta.finish_reason);
	}
	if (choice?.finish_reason !== undefined) {
		return choice.finish_reason === null ? null : String(choice.finish_reason);
	}
	return undefined;
}

function buildDelta(chunk: SseChunk): ChatDelta | null {
	const choice = chunk.choices?.[0];
	if (!choice) return null;
	const delta = choice.delta ?? {};

	if (delta.role !== undefined) return null;

	const content = toStr(delta.content);
	const reasoning = toStr(delta.reasoning_content);
	const finish = toFinishReason(delta, choice);

	if (content === undefined && reasoning === undefined && finish === undefined) {
		return null;
	}

	const out: ChatDelta = {};
	if (content !== undefined) out.content = content;
	if (reasoning !== undefined) out.reasoningContent = reasoning;
	if (finish !== undefined) out.finishReason = finish;
	return out;
}

function processLine(
	line: string,
	onDelta: (delta: ChatDelta) => void
): { ok: true } | { ok: false; error: Error } {
	if (line.length === 0) return { ok: true };
	if (!line.startsWith('data:')) return { ok: true };
	if (line.startsWith('data: ')) {
		if (line.slice(6).trim() === '[DONE]') return { ok: true };
	} else if (line === 'data:') {
		return { ok: true };
	} else if (line.slice(5).trim() === '[DONE]') {
		return { ok: true };
	}

	const payload = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
	let parsed: SseChunk;
	try {
		parsed = JSON.parse(payload) as SseChunk;
	} catch (cause) {
		return {
			ok: false,
			error: new LlmError('Failed to parse SSE chunk', { code: 'sse_parse', cause })
		};
	}

	const delta = buildDelta(parsed);
	if (delta) onDelta(delta);
	return { ok: true };
}

export async function parseSseChatStream(
	stream: ReadableStream<Uint8Array>,
	onDelta: (delta: ChatDelta) => void,
	signal?: AbortSignal
): Promise<void> {
	if (isAborted(signal)) throw buildAbortError();

	const reader = stream.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	const abortHandler = () => {
		void reader.cancel().catch(() => {});
	};
	if (signal) {
		if (signal.aborted) throw buildAbortError();
		signal.addEventListener('abort', abortHandler, { once: true });
	}

	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			if (isAborted(signal)) throw buildAbortError();

			buffer += decoder.decode(value, { stream: true });
			let newlineIdx = buffer.indexOf('\n');
			while (newlineIdx !== -1) {
				const rawLine = buffer.slice(0, newlineIdx);
				buffer = buffer.slice(newlineIdx + 1);
				const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
				const result = processLine(line, onDelta);
				if (!result.ok) throw result.error;
				newlineIdx = buffer.indexOf('\n');
			}
		}

		buffer += decoder.decode();
		if (buffer.length > 0) {
			const tail = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
			const result = processLine(tail, onDelta);
			if (!result.ok) throw result.error;
		}

		if (isAborted(signal)) throw buildAbortError();
	} finally {
		if (signal) signal.removeEventListener('abort', abortHandler);
	}
}
